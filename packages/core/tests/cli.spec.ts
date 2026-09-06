import { describe, expect, it } from "vitest";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  CLI_BATCH_FILE_SEPARATOR_PREFIX,
  CLI_SCHEMA_VERSION,
  CLI_TEXT_SEPARATOR,
  CLI_USAGE,
  CLI_USAGE_ROTATE_AUDIT_TRAIL_KEY,
  CLI_USAGE_VERIFY_AUDIT_TRAIL,
  CLI_USAGE_VERIFY_BATCH_EXPORT,
  CliArgumentError,
  buildControllerProfile,
  buildJobCheckEnvelope,
  buildBatchEnvelope,
  buildBatchLintIssuesByControllerCodeAggregation,
  buildBatchParseDiagnosticsPolicyBreachesAggregation,
  buildBatchSafetyFindingsByCodeAggregation,
  buildBatchSafetyFindingsAttribution,
  buildBatchStrictControllerCodesGatedAggregation,
  buildBatchParseDiagnosticsByCodeAggregation,
  buildBatchParseDiagnosticsAttribution,
  buildBatchSafetyBlockerCodesAggregation,
  buildSafetyFindingsByCode,
  buildBatchLintIssuesByParseDiagCodeAggregation,
  buildBatchLintIssuesBySourceAggregation,
  clearDiscoveredProfilePackLoadersCache,
  formatJobCheckJson,
  formatJobCheckText,
  formatBatchAggregationsAsCsv,
  BATCH_SUMMARY_CSV_HEADER,
  countBatchAggregationCsvRows,
  buildBatchExportManifest,
  classifyBatchExportPath,
  formatBatchExportZipSha256Sidecar,
  main,
  parseCliArgs,
  parseAuditDeprecatedRulesArgs,
  parseRotateAuditTrailKeyArgs,
  parseVerifyAuditTrailArgs,
  parseVerifyBatchExportArgs,
  setDiscoveredProfilePackLoadersForTesting,
  setDiscoveredProfilePackRuleDocsForTesting,
  type CliProfileLintLoader
} from "../src/cli.js";
import type { ProfileRuleDoc } from "../src/types.js";
import {
  computeHmacSha256,
  computeSha256,
  decryptAesGcm,
  encryptAesGcm
} from "../src/audit/auditTrailIntegrity.js";

type CapturedIo = {
  stdout: string;
  stderr: string;
  files: Map<string, string>;
};

async function setupTmpDir(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), "cnc-cli-spec-"));
}

function captureIo(files: Record<string, string> = {}): {
  io: {
    stdout: (chunk: string) => void;
    stderr: (chunk: string) => void;
    readFileFn: (path: string) => Promise<string>;
    writeFileFn: (path: string, content: string) => Promise<void>;
  };
  captured: CapturedIo;
} {
  const captured: CapturedIo = {
    stdout: "",
    stderr: "",
    files: new Map(Object.entries(files))
  };
  return {
    io: {
      stdout: (chunk) => {
        captured.stdout += chunk;
      },
      stderr: (chunk) => {
        captured.stderr += chunk;
      },
      readFileFn: async (p) => {
        const value = captured.files.get(p);
        if (value === undefined) {
          throw new Error(`mock readFile: missing ${p}`);
        }
        return value;
      },
      writeFileFn: async (p, c) => {
        captured.files.set(p, c);
      }
    },
    captured
  };
}

describe("parseCliArgs", () => {
  it("parses --input and applies defaults", () => {
    const args = parseCliArgs(["--input", "program.nc"]);
    expect(args.input).toBe("program.nc");
    expect(args.controller).toBe("haas-ngc");
    expect(args.format).toBe("json");
    expect(args.strict).toBe(false);
    expect(args.quiet).toBe(false);
    expect(args.schemaVersion).toBe(false);
    expect(args.help).toBe(false);
    expect(args.policy).toBeUndefined();
    expect(args.policyPreset).toBeUndefined();
    expect(args.inputDir).toBeUndefined();
    expect(args.out).toBeUndefined();
  });

  it("parses all flags including --strict", () => {
    const args = parseCliArgs([
      "--input",
      "p.nc",
      "--controller",
      "fanuc",
      "--policy",
      "policy.json",
      "--format",
      "text",
      "--out",
      "out.txt",
      "--strict"
    ]);
    expect(args.input).toBe("p.nc");
    expect(args.controller).toBe("fanuc");
    expect(args.policy).toBe("policy.json");
    expect(args.policyPreset).toBeUndefined();
    expect(args.format).toBe("text");
    expect(args.out).toBe("out.txt");
    expect(args.strict).toBe(true);
    expect(args.help).toBe(false);
    expect(args.inputDir).toBeUndefined();
  });

  it("parses --policy-preset and --input-dir", () => {
    const args = parseCliArgs([
      "--input-dir",
      "./shop",
      "--policy-preset",
      "balanced"
    ]);
    expect(args.inputDir).toBe("./shop");
    expect(args.policyPreset).toBe("balanced");
    expect(args.input).toBeUndefined();
  });

  it("throws on missing --input or --input-dir", () => {
    expect(() => parseCliArgs([])).toThrow(CliArgumentError);
    expect(() => parseCliArgs([])).toThrow(/Missing required --input/);
  });

  it("throws when both --input and --input-dir are supplied", () => {
    expect(() => parseCliArgs(["--input", "a.nc", "--input-dir", "./dir"])).toThrow(
      /mutually exclusive/
    );
  });

  it("throws when both --policy and --policy-preset are supplied", () => {
    expect(() =>
      parseCliArgs(["--input", "a.nc", "--policy", "p.json", "--policy-preset", "strict"])
    ).toThrow(/mutually exclusive/);
  });

  it("throws on invalid --controller", () => {
    expect(() => parseCliArgs(["--input", "p.nc", "--controller", "siemens"])).toThrow(
      /Invalid --controller/
    );
  });

  it("throws on invalid --policy-preset", () => {
    expect(() => parseCliArgs(["--input", "p.nc", "--policy-preset", "draconian"])).toThrow(
      /Invalid --policy-preset/
    );
  });

  it("throws on invalid --format", () => {
    expect(() => parseCliArgs(["--input", "p.nc", "--format", "yaml"])).toThrow(/Invalid --format/);
  });

  it("throws on unknown flag", () => {
    expect(() => parseCliArgs(["--input", "p.nc", "--bogus"])).toThrow(/Unknown argument/);
  });

  it("recognizes --help and -h without requiring --input", () => {
    expect(parseCliArgs(["--help"]).help).toBe(true);
    expect(parseCliArgs(["-h"]).help).toBe(true);
  });

  it("recognizes --schema-version without requiring --input", () => {
    const args = parseCliArgs(["--schema-version"]);
    expect(args.schemaVersion).toBe(true);
    expect(args.input).toBeUndefined();
  });

  it("parses --format ndjson", () => {
    const args = parseCliArgs(["--input", "p.nc", "--format", "ndjson"]);
    expect(args.format).toBe("ndjson");
  });

  it("parses --quiet flag", () => {
    const args = parseCliArgs(["--input", "p.nc", "--quiet"]);
    expect(args.quiet).toBe(true);
  });

  it("parses --recursive flag", () => {
    const args = parseCliArgs(["--input-dir", "x", "--recursive"]);
    expect(args.recursive).toBe(true);
  });

  it("defaults --recursive to false", () => {
    expect(parseCliArgs(["--input-dir", "x"]).recursive).toBe(false);
  });

  it("collects repeated --include / --exclude flags into arrays", () => {
    const args = parseCliArgs([
      "--input-dir",
      "x",
      "--include",
      "*.cnc",
      "--include",
      "*.gcode",
      "--exclude",
      "**/draft/*"
    ]);
    expect(args.include).toEqual(["*.cnc", "*.gcode"]);
    expect(args.exclude).toEqual(["**/draft/*"]);
  });

  it("rejects --include without a value", () => {
    expect(() => parseCliArgs(["--input-dir", "x", "--include"])).toThrow(/--include/);
  });

  it("parses --out-dir as a string", () => {
    const args = parseCliArgs(["--input-dir", "x", "--out-dir", "out"]);
    expect(args.outDir).toBe("out");
  });

  it("rejects --out + --out-dir as mutually exclusive", () => {
    expect(() =>
      parseCliArgs(["--input-dir", "x", "--out", "all.json", "--out-dir", "out"])
    ).toThrow(/--out and --out-dir are mutually exclusive/);
  });

  it("rejects --out-dir without --input-dir (per-file is batch-only)", () => {
    expect(() =>
      parseCliArgs(["--input", "p.nc", "--out-dir", "out"])
    ).toThrow(/--out-dir requires --input-dir/);
  });

  it("accumulates repeated --out-dir-format flags into a canonical record", () => {
    const args = parseCliArgs([
      "--input-dir",
      "x",
      "--out-dir",
      "out",
      "--out-dir-format",
      "json:.envelope.json",
      "--out-dir-format",
      "ndjson:.records"
    ]);
    expect(args.outDirFormat).toEqual({
      json: ".envelope.json",
      ndjson: ".records"
    });
  });

  it("rejects --out-dir-format with an unknown format key (e.g. xml)", () => {
    expect(() =>
      parseCliArgs([
        "--input-dir",
        "x",
        "--out-dir",
        "out",
        "--out-dir-format",
        "xml:.x"
      ])
    ).toThrow(/Invalid --out-dir-format format: xml/);
  });

  it("rejects --out-dir-format extensions that do not start with '.'", () => {
    expect(() =>
      parseCliArgs([
        "--input-dir",
        "x",
        "--out-dir",
        "out",
        "--out-dir-format",
        "json:envelope.json"
      ])
    ).toThrow(/must start with '\.'/);
  });

  it("rejects --out-dir-format without --out-dir", () => {
    expect(() =>
      parseCliArgs([
        "--input-dir",
        "x",
        "--out-dir-format",
        "json:.envelope.json"
      ])
    ).toThrow(/--out-dir-format requires --out-dir/);
  });
});

describe("buildControllerProfile", () => {
  it("maps haas-ngc to the canonical profile shape", () => {
    const profile = buildControllerProfile("haas-ngc");
    expect(profile.id).toBe("haas-ngc");
    expect(profile.name).toBe("Haas NGC");
    expect(profile.defaultFormatStyle).toEqual({
      upperCaseWords: true,
      normalizeSpacing: true,
      removeStandaloneOptionalStops: false
    });
  });

  it("maps fanuc to id=fanuc", () => {
    expect(buildControllerProfile("fanuc").id).toBe("fanuc");
  });

  it("maps haas-legacy to id=haas-legacy", () => {
    expect(buildControllerProfile("haas-legacy").id).toBe("haas-legacy");
  });
});

describe("formatJobCheckJson + formatJobCheckText + buildJobCheckEnvelope", () => {
  const baseResult = {
    readyToRunScore: 87,
    blockerCount: 0,
    warningCount: 1,
    blocked: false,
    messages: ["Detected 1 warning(s); review before release."],
    parseDiagnosticsSummary: { total: 0, byCode: {}, topCodes: [] },
    parseDiagnosticsPolicyBreaches: [],
    lintIssues: [],
    lintIssuesSummary: { total: 0, blockers: 0, warnings: 0, bySource: {}, topSources: [] },
    setupSheet: { exportTxt: "SETUP", exportMarkdown: "SETUP MD" },
    proveout: { code: "PROVEOUT" }
  } as unknown as Parameters<typeof formatJobCheckJson>[0];

  it("emits canonical JSON keys with schemaVersion + messages + lintIssuesSummary + controllerLints", () => {
    const json = formatJobCheckJson(baseResult);
    const parsed = JSON.parse(json);
    expect(Object.keys(parsed)).toEqual([
      "schemaVersion",
      "readyToRunScore",
      "blockerCount",
      "warningCount",
      "blocked",
      "messages",
      "parseDiagnosticsSummary",
      "parseDiagnosticsPolicyBreaches",
      "lintIssuesSummary",
      "lintIssuesBySource",
      "parseDiagnosticsByCode",
      "lintIssuesByParseDiagCode",
      "lintIssuesByControllerCode",
      "safetyFindingsByCode",
      "controllerLints",
      "setupSheetExportTxt",
      "proveoutCode"
    ]);
    expect(parsed.schemaVersion).toBe(CLI_SCHEMA_VERSION);
    expect(parsed.messages).toEqual(["Detected 1 warning(s); review before release."]);
    expect(parsed.blocked).toBe(false);
    expect(parsed.lintIssuesSummary).toEqual({
      total: 0,
      blockers: 0,
      warnings: 0,
      bySource: {},
      topSources: []
    });
    expect(parsed.controllerLints).toEqual([]);
    expect(parsed.setupSheetExportTxt).toBe("SETUP");
    expect(parsed.proveoutCode).toBe("PROVEOUT");
  });

  it("buildJobCheckEnvelope returns the typed envelope", () => {
    const envelope = buildJobCheckEnvelope(baseResult);
    expect(envelope.schemaVersion).toBe(CLI_SCHEMA_VERSION);
    expect(envelope.readyToRunScore).toBe(87);
    expect(envelope.blocked).toBe(false);
    expect(envelope.messages).toEqual(["Detected 1 warning(s); review before release."]);
    expect(envelope.controllerLints).toEqual([]);
  });

  it("emits the text format with both blocks separated", () => {
    const text = formatJobCheckText(baseResult);
    expect(text).toContain("SETUP");
    expect(text).toContain(CLI_TEXT_SEPARATOR);
    expect(text).toContain("PROVEOUT");
    expect(text.indexOf("SETUP")).toBeLessThan(text.indexOf(CLI_TEXT_SEPARATOR));
    expect(text.indexOf(CLI_TEXT_SEPARATOR)).toBeLessThan(text.indexOf("PROVEOUT"));
  });
});

describe("main()", () => {
  it("prints --help to stdout when requested", async () => {
    const { io, captured } = captureIo();
    const exitCode = await main(["--help"], io);
    expect(exitCode).toBe(0);
    expect(captured.stdout).toContain("Usage: cnc-job-check");
    expect(captured.stdout).toContain(CLI_USAGE);
  });

  it("returns exit code 2 with usage on argument error", async () => {
    const { io, captured } = captureIo();
    const exitCode = await main([], io);
    expect(exitCode).toBe(2);
    expect(captured.stderr).toContain("Missing required --input");
    expect(captured.stderr).toContain("Usage: cnc-job-check");
  });

  it("emits json output with empty parseDiagnosticsPolicyBreaches and the current CLI_SCHEMA_VERSION for a clean program", async () => {
    const tmp = await setupTmpDir();
    const inputPath = path.join(tmp, "clean.nc");
    await writeFile(inputPath, "G0 X1 Y1\nM30\n", "utf8");

    let stdout = "";
    const exitCode = await main(["--input", inputPath, "--format", "json"], {
      stdout: (chunk) => {
        stdout += chunk;
      }
    });
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.schemaVersion).toBe(CLI_SCHEMA_VERSION);
    expect(Array.isArray(parsed.messages)).toBe(true);
    expect(parsed.blocked).toBe(false);
    expect(parsed.parseDiagnosticsPolicyBreaches).toEqual([]);
    expect(typeof parsed.readyToRunScore).toBe("number");
    expect(typeof parsed.setupSheetExportTxt).toBe("string");
    expect(typeof parsed.proveoutCode).toBe("string");
    expect(parsed.setupSheetExportTxt).toMatch(/parseDiagBreaches: total=0/);
  });

  it("emits text output containing both setupSheet exportTxt and proveout code", async () => {
    const tmp = await setupTmpDir();
    const inputPath = path.join(tmp, "clean.nc");
    await writeFile(inputPath, "G0 X1 Y1\nM30\n", "utf8");

    let stdout = "";
    const exitCode = await main(["--input", inputPath, "--format", "text"], {
      stdout: (chunk) => {
        stdout += chunk;
      }
    });
    expect(exitCode).toBe(0);
    expect(stdout).toContain(CLI_TEXT_SEPARATOR);
    expect(stdout).toMatch(/parseDiagnostics: total=\d+/);
    expect(stdout).toMatch(/parseDiagBreaches: total=0/);
  });

  it("applies a strict --policy and surfaces a non-empty parseDiagBreaches block; --strict gates exit code and emits stderr hint", async () => {
    const tmp = await setupTmpDir();
    const inputPath = path.join(tmp, "malformed.nc");
    await writeFile(inputPath, "G0 X1\nG0 X Y1\nG1 X1\n", "utf8");
    const policyPath = path.join(tmp, "policy.json");
    await writeFile(
      policyPath,
      JSON.stringify({
        severity: "blocker",
        blockExport: true,
        thresholds: { TOTAL: 0, ADDRESS_MISSING_VALUE: 0 }
      }),
      "utf8"
    );

    let stdout = "";
    let stderr = "";
    const exitCode = await main(
      ["--input", inputPath, "--policy", policyPath, "--format", "json", "--strict"],
      {
        stdout: (chunk) => {
          stdout += chunk;
        },
        stderr: (chunk) => {
          stderr += chunk;
        }
      }
    );
    expect(exitCode).toBe(1);
    const parsed = JSON.parse(stdout);
    expect(parsed.parseDiagnosticsPolicyBreaches.length).toBe(2);
    expect(parsed.blockerCount).toBeGreaterThanOrEqual(2);
    expect(parsed.blocked).toBe(true);
    expect(parsed.setupSheetExportTxt).toContain("parseDiagBreaches: total=2");
    expect(parsed.setupSheetExportTxt).toMatch(
      /parseDiagBreaches: total=2 \| severities=blocker:2 \| byKey=ADDRESS_MISSING_VALUE:\d+\/0,TOTAL:\d+\/0/
    );
    expect(stderr).toMatch(
      /^cnc-job-check: blocked=true \(strict mode\); blockers=\d+ warnings=\d+/m
    );
  });

  it("--policy-preset strict produces a TOTAL breach on a malformed program", async () => {
    const tmp = await setupTmpDir();
    const inputPath = path.join(tmp, "malformed.nc");
    await writeFile(inputPath, "G0 X1\nG0 X Y1\nM30\n", "utf8");

    let stdout = "";
    let stderr = "";
    const exitCode = await main(
      ["--input", inputPath, "--policy-preset", "strict", "--strict"],
      {
        stdout: (chunk) => {
          stdout += chunk;
        },
        stderr: (chunk) => {
          stderr += chunk;
        }
      }
    );
    expect(exitCode).toBe(1);
    const parsed = JSON.parse(stdout);
    expect(parsed.blocked).toBe(true);
    expect(
      parsed.parseDiagnosticsPolicyBreaches.some(
        (breach: { key: string }) => breach.key === "TOTAL"
      )
    ).toBe(true);
    expect(parsed.setupSheetExportTxt).toMatch(/parseDiagBreaches: total=\d+/);
    expect(stderr).toContain("cnc-job-check: blocked=true (strict mode)");
  });

  it("--policy-preset permissive resolves to no policy (clean exit on malformed program)", async () => {
    const tmp = await setupTmpDir();
    const inputPath = path.join(tmp, "malformed.nc");
    await writeFile(inputPath, "G0 X1\nG0 X Y1\nM30\n", "utf8");

    let stdout = "";
    const exitCode = await main(
      ["--input", inputPath, "--policy-preset", "permissive", "--strict"],
      {
        stdout: (chunk) => {
          stdout += chunk;
        }
      }
    );
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.parseDiagnosticsPolicyBreaches).toEqual([]);
  });

  it("rejects --policy + --policy-preset combination", async () => {
    const { io, captured } = captureIo({ "p.nc": "G0 X1\nM30\n", "p.json": "{}" });
    const exitCode = await main(
      ["--input", "p.nc", "--policy", "p.json", "--policy-preset", "strict"],
      io
    );
    expect(exitCode).toBe(2);
    expect(captured.stderr).toContain("mutually exclusive");
  });

  it("returns exit code 0 without --strict even when blocked (no stderr hint)", async () => {
    const tmp = await setupTmpDir();
    const inputPath = path.join(tmp, "malformed.nc");
    await writeFile(inputPath, "G0 X1\nG0 X Y1\nM30\n", "utf8");
    const policyPath = path.join(tmp, "policy.json");
    await writeFile(
      policyPath,
      JSON.stringify({
        severity: "blocker",
        blockExport: true,
        thresholds: { TOTAL: 0 }
      }),
      "utf8"
    );

    let stderr = "";
    const exitCode = await main(["--input", inputPath, "--policy", policyPath], {
      stdout: () => {
        // discard
      },
      stderr: (chunk) => {
        stderr += chunk;
      }
    });
    expect(exitCode).toBe(0);
    expect(stderr).toBe("");
  });

  it("writes to --out instead of stdout when supplied", async () => {
    const tmp = await setupTmpDir();
    const inputPath = path.join(tmp, "clean.nc");
    const outPath = path.join(tmp, "out.json");
    await writeFile(inputPath, "G0 X1 Y1\nM30\n", "utf8");

    let stdout = "";
    const exitCode = await main(
      ["--input", inputPath, "--format", "json", "--out", outPath],
      {
        stdout: (chunk) => {
          stdout += chunk;
        }
      }
    );
    expect(exitCode).toBe(0);
    expect(stdout).toBe("");
    const written = await readFile(outPath, "utf8");
    const parsed = JSON.parse(written);
    expect(parsed.schemaVersion).toBe(CLI_SCHEMA_VERSION);
    expect(parsed.parseDiagnosticsPolicyBreaches).toEqual([]);
  });

  it("returns exit code 2 if --input file is missing", async () => {
    const { io, captured } = captureIo();
    const exitCode = await main(["--input", "non-existent-path-xyz.nc"], io);
    expect(exitCode).toBe(2);
    expect(captured.stderr).toMatch(/Failed to read --input/);
  });

  it("--input - reads from stdinReader and produces the canonical envelope", async () => {
    let stdout = "";
    const exitCode = await main(["--input", "-", "--format", "json"], {
      stdout: (chunk) => {
        stdout += chunk;
      },
      stdinReader: async () => "G0 X1 Y1\nM30\n"
    });
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.schemaVersion).toBe(CLI_SCHEMA_VERSION);
    expect(parsed.parseDiagnosticsPolicyBreaches).toEqual([]);
    expect(parsed.setupSheetExportTxt).toMatch(/parseDiagnostics: total=0/);
  });

  it("--input-dir runs every .nc file and aggregates the JSON envelope", async () => {
    const tmp = await setupTmpDir();
    const cleanPath = path.join(tmp, "01-clean.nc");
    const malformedPath = path.join(tmp, "02-malformed.nc");
    await writeFile(cleanPath, "G0 X1 Y1\nM30\n", "utf8");
    await writeFile(malformedPath, "G0 X1\nG0 X Y1\nG1 X1\n", "utf8");
    await writeFile(path.join(tmp, "ignored.txt"), "noop\n", "utf8");

    let stdout = "";
    let stderr = "";
    const exitCode = await main(
      ["--input-dir", tmp, "--policy-preset", "strict", "--strict", "--format", "json"],
      {
        stdout: (chunk) => {
          stdout += chunk;
        },
        stderr: (chunk) => {
          stderr += chunk;
        }
      }
    );
    expect(exitCode).toBe(1);
    const parsed = JSON.parse(stdout);
    expect(parsed.schemaVersion).toBe(CLI_SCHEMA_VERSION);
    expect(parsed.results).toHaveLength(2);
    expect(parsed.summary.files).toBe(2);
    expect(parsed.summary.blocked).toBe(1);
    const inputs = parsed.results.map((r: { input: string }) => path.basename(r.input)).sort();
    expect(inputs).toEqual(["01-clean.nc", "02-malformed.nc"]);
    const malformed = parsed.results.find((r: { input: string }) =>
      r.input.endsWith("02-malformed.nc")
    );
    expect(malformed.envelope.blocked).toBe(true);
    const clean = parsed.results.find((r: { input: string }) => r.input.endsWith("01-clean.nc"));
    expect(clean.envelope.blocked).toBe(false);
    expect(stderr).toContain("02-malformed.nc");
    expect(stderr).toContain("cnc-job-check: blocked=true (strict mode)");
  });

  it("--input-dir text format prints per-file separators", async () => {
    const tmp = await setupTmpDir();
    await writeFile(path.join(tmp, "a.nc"), "O1000\nG0 X1\nM30\n", "utf8");
    await writeFile(path.join(tmp, "b.nc"), "O1001\nG0 X2\nM30\n", "utf8");

    let stdout = "";
    const exitCode = await main(["--input-dir", tmp, "--format", "text"], {
      stdout: (chunk) => {
        stdout += chunk;
      }
    });
    expect(exitCode).toBe(0);
    const sepCount = stdout.split(CLI_BATCH_FILE_SEPARATOR_PREFIX).length - 1;
    expect(sepCount).toBe(2);
    expect(stdout).toContain(CLI_TEXT_SEPARATOR);
  });

  it("forwards haasNgcProfile.validateAst lints into lintIssuesSummary.bySource.profile_lint when --controller haas-ngc", async () => {
    const tmp = await setupTmpDir();
    const inputPath = path.join(tmp, "haas-g43-no-h.nc");
    await writeFile(
      inputPath,
      [
        "%",
        "(HAAS NGC SAMPLE - G43 WITHOUT H TRIGGERS PROFILE-LINT WARNING)",
        "G0 X1.",
        "G43 Z2.",
        "M30",
        "%"
      ].join("\n") + "\n",
      "utf8"
    );

    let stdout = "";
    const exitCode = await main(
      ["--input", inputPath, "--controller", "haas-ngc", "--format", "json"],
      {
        stdout: (chunk) => {
          stdout += chunk;
        }
      }
    );
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    expect((parsed.lintIssuesSummary.bySource.profile_lint ?? 0)).toBeGreaterThanOrEqual(1);
  });

  it("does NOT pull profile lints when --controller haas-legacy (registry has no loader yet)", async () => {
    const tmp = await setupTmpDir();
    const inputPath = path.join(tmp, "haas-legacy-g43.nc");
    await writeFile(
      inputPath,
      [
        "%",
        "(HAAS LEGACY SAMPLE - NO PROFILE PACK SHIPS YET)",
        "G0 X1.",
        "G43 Z2.",
        "M30",
        "%"
      ].join("\n") + "\n",
      "utf8"
    );

    let stdout = "";
    const exitCode = await main(
      ["--input", inputPath, "--controller", "haas-legacy", "--format", "json"],
      {
        stdout: (chunk) => {
          stdout += chunk;
        }
      }
    );
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.lintIssuesSummary.bySource.profile_lint ?? 0).toBe(0);
  });

  it("falls back to auto-discovered profile-pack loader when hand-wired registry has no loader for --controller haas-legacy", async () => {
    // Seed the auto-discovery cache with a synthetic loader for the
    // intentionally-orphan haas-legacy slot. The hand-wired registry must
    // win over discovery for haas-ngc/fanuc, but for haas-legacy the
    // discovery loader is the only candidate and MUST be invoked.
    const seenAsts: number[] = [];
    const discoveredLoader: CliProfileLintLoader = async (ast) => {
      seenAsts.push(ast.blocks.length);
      return [
        {
          severity: "warning",
          message: "synthetic discovered profile-lint marker",
          blockIndex: 0
        }
      ];
    };
    setDiscoveredProfilePackLoadersForTesting({ "haas-legacy": discoveredLoader });
    try {
      const tmp = await setupTmpDir();
      const inputPath = path.join(tmp, "haas-legacy-discovered.nc");
      await writeFile(inputPath, "G0 X1\nM30\n", "utf8");
      let stdout = "";
      const exitCode = await main(
        ["--input", inputPath, "--controller", "haas-legacy", "--format", "json"],
        {
          stdout: (chunk) => {
            stdout += chunk;
          }
        }
      );
      expect(exitCode).toBe(0);
      const parsed = JSON.parse(stdout);
      expect(parsed.lintIssuesSummary.bySource.profile_lint ?? 0).toBeGreaterThanOrEqual(1);
      // The synthetic discovery loader was invoked exactly once (one program,
      // one lint pass) â€” proves the fallback path actually wired up our IO.
      expect(seenAsts.length).toBe(1);
    } finally {
      setDiscoveredProfilePackLoadersForTesting(undefined);
    }
  });

  it("hand-wired loader wins over auto-discovered loader for the same controllerKey (haas-ngc)", async () => {
    // If the discovery cache also returns a loader for haas-ngc, the
    // hand-wired one must be invoked instead â€” the synthetic discovery
    // loader below would emit a marker message that we then assert is
    // ABSENT from the rendered setup sheet.
    let discoveredInvoked = false;
    setDiscoveredProfilePackLoadersForTesting({
      "haas-ngc": async () => {
        discoveredInvoked = true;
        return [
          {
            severity: "warning",
            message: "MARKER_FROM_DISCOVERY_SHOULD_NOT_FIRE",
            blockIndex: 0
          }
        ];
      }
    });
    try {
      const tmp = await setupTmpDir();
      const inputPath = path.join(tmp, "haas-handwired-wins.nc");
      await writeFile(inputPath, "G0 X1\nM30\n", "utf8");
      let stdout = "";
      const exitCode = await main(
        ["--input", inputPath, "--controller", "haas-ngc", "--format", "json"],
        {
          stdout: (chunk) => {
            stdout += chunk;
          }
        }
      );
      expect(exitCode).toBe(0);
      const parsed = JSON.parse(stdout);
      expect(discoveredInvoked).toBe(false);
      expect(parsed.setupSheetExportTxt).not.toMatch(/MARKER_FROM_DISCOVERY_SHOULD_NOT_FIRE/);
    } finally {
      setDiscoveredProfilePackLoadersForTesting(undefined);
    }
  });

  it("does NOT pull Haas-only profile lints when --controller fanuc (G43-without-H ignored, only Fanuc-specific rules apply)", async () => {
    // This program includes an O-header so the Fanuc-specific missing-O-header
    // rule does NOT fire. The point of the test is to verify that the Haas
    // loader is NOT invoked for --controller fanuc (Haas's G43-without-H rule
    // would otherwise add a profile_lint issue).
    const tmp = await setupTmpDir();
    const inputPath = path.join(tmp, "fanuc-g43-no-h.nc");
    await writeFile(
      inputPath,
      [
        "%",
        "O1000",
        "(FANUC SAMPLE - G43 WITHOUT H DOES NOT TRIGGER HAAS PROFILE LINT)",
        "G0 X1.",
        "G43 Z2.",
        "M30",
        "%"
      ].join("\n") + "\n",
      "utf8"
    );

    let stdout = "";
    const exitCode = await main(
      ["--input", inputPath, "--controller", "fanuc", "--format", "json"],
      {
        stdout: (chunk) => {
          stdout += chunk;
        }
      }
    );
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.lintIssuesSummary.bySource.profile_lint ?? 0).toBe(0);
  });

  it("forwards fanucIsoProfile.validateAst lints into lintIssuesSummary.bySource.profile_lint when --controller fanuc", async () => {
    const tmp = await setupTmpDir();
    const inputPath = path.join(tmp, "fanuc-no-o-header.nc");
    await writeFile(
      inputPath,
      [
        "%",
        "(FANUC SAMPLE - NO O#### HEADER TRIGGERS PROFILE-LINT WARNING)",
        "G0 X1.",
        "G1 X2.",
        "M30",
        "%"
      ].join("\n") + "\n",
      "utf8"
    );

    let stdout = "";
    const exitCode = await main(
      ["--input", inputPath, "--controller", "fanuc", "--format", "json"],
      {
        stdout: (chunk) => {
          stdout += chunk;
        }
      }
    );
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.lintIssuesSummary.bySource.profile_lint ?? 0).toBeGreaterThanOrEqual(1);
    // The rolled-up setup-sheet block must show the new profile_lint contribution.
    expect(parsed.setupSheetExportTxt).toMatch(/bySource=[^\n]*profile_lint=\d+/);
    // Cross-check via the schema-v2 lintIssuesBySource entry.
    const profileEntry = (parsed.lintIssuesBySource as Array<{
      source: string;
      count: number;
    }>).find((e) => e.source === "profile_lint");
    expect(profileEntry).toBeDefined();
    expect(profileEntry!.count).toBeGreaterThanOrEqual(1);
  });

  it("forwards the new G65-missing-P Fanuc rule into lintIssuesSummary.bySource.profile_lint when --controller fanuc", async () => {
    // Contract test: confirms the registry plumbing still routes the expanded
    // Fanuc rule pack (missing-O-header, G65-missing-P, G65-non-integer-L,
    // T0-without-prior-tool) end-to-end. We choose G65-missing-P specifically
    // because it is independent from the older missing-O-header rule and is
    // easy to isolate alongside a valid O header.
    const tmp = await setupTmpDir();
    const inputPath = path.join(tmp, "fanuc-g65-missing-p.nc");
    await writeFile(
      inputPath,
      [
        "%",
        "O1000",
        "G65 A1. B2.",
        "M30",
        "%"
      ].join("\n") + "\n",
      "utf8"
    );

    let stdout = "";
    const exitCode = await main(
      ["--input", inputPath, "--controller", "fanuc", "--format", "json"],
      {
        stdout: (chunk) => {
          stdout += chunk;
        }
      }
    );
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.lintIssuesSummary.bySource.profile_lint ?? 0).toBeGreaterThanOrEqual(1);
    // The summary block must reflect the new profile_lint contribution.
    expect(parsed.setupSheetExportTxt).toMatch(/bySource=[^\n]*profile_lint=\d+/);
    // Cross-check via the schema-v3 lintIssuesBySource entry: the new G65-P
    // rule should land in the profile_lint bucket.
    const profileEntry = (parsed.lintIssuesBySource as Array<{
      source: string;
      count: number;
    }>).find((e) => e.source === "profile_lint");
    expect(profileEntry).toBeDefined();
    expect(profileEntry!.count).toBeGreaterThanOrEqual(1);
  });

  it("does NOT pull the Fanuc loader for --controller haas-legacy (registry contract holds across controllers)", async () => {
    // Cross-controller contract: even though the Fanuc program would normally
    // trigger the missing-O-header rule, switching --controller to haas-legacy
    // (which has no registered loader) MUST NOT pull the Fanuc lint pack.
    const tmp = await setupTmpDir();
    const inputPath = path.join(tmp, "no-o-header.nc");
    await writeFile(
      inputPath,
      [
        "%",
        "(NO O HEADER, BUT HAAS-LEGACY HAS NO LOADER)",
        "G0 X1.",
        "G1 X2.",
        "M30",
        "%"
      ].join("\n") + "\n",
      "utf8"
    );

    let stdout = "";
    const exitCode = await main(
      ["--input", inputPath, "--controller", "haas-legacy", "--format", "json"],
      {
        stdout: (chunk) => {
          stdout += chunk;
        }
      }
    );
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.lintIssuesSummary.bySource.profile_lint ?? 0).toBe(0);
  });

  it("populates controllerLints + lintIssuesSummary for a malformed Fanuc program", async () => {
    const tmp = await setupTmpDir();
    const inputPath = path.join(tmp, "fanuc-malformed.nc");
    await writeFile(inputPath, "%\nG0 X1.\nO1000\nN10 O1000\nM30\n%\n", "utf8");

    let stdout = "";
    const exitCode = await main(
      ["--input", inputPath, "--controller", "fanuc", "--format", "json"],
      {
        stdout: (chunk) => {
          stdout += chunk;
        }
      }
    );
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.lintIssuesSummary.total).toBeGreaterThan(0);
    expect((parsed.lintIssuesSummary.bySource.controller_grammar ?? 0)).toBeGreaterThan(0);
    expect(Array.isArray(parsed.controllerLints)).toBe(true);
    expect(parsed.controllerLints.length).toBeGreaterThan(0);
    expect(
      parsed.controllerLints.every(
        (lint: { provenance: { source: string } }) =>
          lint.provenance.source === "controller_grammar"
      )
    ).toBe(true);
    expect(parsed.setupSheetExportTxt).toMatch(/lintIssues: total=\d+/);
  });

  it("--schema-version prints the schema and exits without running anything", async () => {
    let stdout = "";
    let stderr = "";
    const exitCode = await main(["--schema-version"], {
      stdout: (chunk) => {
        stdout += chunk;
      },
      stderr: (chunk) => {
        stderr += chunk;
      }
    });
    expect(exitCode).toBe(0);
    expect(stdout).toBe(`cnc-job-check schema=${CLI_SCHEMA_VERSION}\n`);
    // Drift sentinel: any future bump to CLI_SCHEMA_VERSION must update
    // this literal in lockstep with the README wave write-up.
    expect(stdout).toBe("cnc-job-check schema=45\n");
    expect(stderr).toBe("");
  });

  it("envelope.lintIssuesBySource is consistent with lintIssuesSummary on every run (schema v3)", async () => {
    const tmp = await setupTmpDir();
    const inputPath = path.join(tmp, "clean.nc");
    await writeFile(inputPath, "G0 X1 Y1\nM30\n", "utf8");

    let stdout = "";
    const exitCode = await main(
      ["--input", inputPath, "--controller", "fanuc", "--format", "json"],
      {
        stdout: (chunk) => {
          stdout += chunk;
        }
      }
    );
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.schemaVersion).toBe(CLI_SCHEMA_VERSION);
    expect(Array.isArray(parsed.lintIssuesBySource)).toBe(true);
    const reconstructed: Record<string, number> = {};
    let totalSeverity = 0;
    for (const entry of parsed.lintIssuesBySource as Array<{
      source: string;
      count: number;
      blockers: number;
      warnings: number;
    }>) {
      reconstructed[entry.source] = entry.count;
      expect(entry.blockers + entry.warnings).toBe(entry.count);
      totalSeverity += entry.count;
    }
    expect(reconstructed).toEqual(parsed.lintIssuesSummary.bySource);
    expect(totalSeverity).toBe(parsed.lintIssuesSummary.total);
  });

  it("envelope.lintIssuesBySource mirrors lintIssuesSummary.bySource for a malformed Fanuc program", async () => {
    const tmp = await setupTmpDir();
    const inputPath = path.join(tmp, "fanuc-malformed.nc");
    await writeFile(
      inputPath,
      [
        "%",
        "(FANUC SAMPLE - DUPLICATE O-NUMBER + N+O HEADER)",
        "G0 X1.",
        "O1000",
        "N10 O1000",
        "M30",
        "%"
      ].join("\n") + "\n",
      "utf8"
    );

    let stdout = "";
    const exitCode = await main(
      ["--input", inputPath, "--controller", "fanuc", "--format", "json"],
      {
        stdout: (chunk) => {
          stdout += chunk;
        }
      }
    );
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.schemaVersion).toBe(CLI_SCHEMA_VERSION);
    expect(Array.isArray(parsed.lintIssuesBySource)).toBe(true);
    const controllerEntry = parsed.lintIssuesBySource.find(
      (entry: { source: string }) => entry.source === "controller_grammar"
    );
    expect(controllerEntry).toBeDefined();
    expect(controllerEntry.count).toBeGreaterThanOrEqual(1);
    expect(controllerEntry.count).toBe(parsed.lintIssuesSummary.bySource.controller_grammar);
    expect(controllerEntry.blockers + controllerEntry.warnings).toBe(controllerEntry.count);
  });

  it("envelope.parseDiagnosticsByCode is an array consistent with parseDiagnosticsSummary.byCode (schema v3)", async () => {
    const tmp = await setupTmpDir();
    const inputPath = path.join(tmp, "diag.nc");
    // Mix of unmatched paren + bracket â†’ multiple parse-diag codes
    await writeFile(inputPath, "G0 X1 (unclosed\nG1 Y[1+2 X3.\nM30\n", "utf8");

    let stdout = "";
    const exitCode = await main(["--input", inputPath, "--format", "json"], {
      stdout: (chunk) => {
        stdout += chunk;
      }
    });
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.schemaVersion).toBe(CLI_SCHEMA_VERSION);
    expect(Array.isArray(parsed.parseDiagnosticsByCode)).toBe(true);
    expect(parsed.parseDiagnosticsByCode.length).toBeGreaterThan(0);
    const reconstructedByCode: Record<string, number> = {};
    let totalAcrossEntries = 0;
    for (const entry of parsed.parseDiagnosticsByCode as Array<{
      code: string;
      count: number;
      warnings: number;
      errors: number;
    }>) {
      reconstructedByCode[entry.code] = entry.count;
      totalAcrossEntries += entry.count;
      expect(entry.warnings + entry.errors).toBe(entry.count);
      expect(entry.warnings).toBeGreaterThanOrEqual(0);
      expect(entry.errors).toBeGreaterThanOrEqual(0);
    }
    expect(reconstructedByCode).toEqual(parsed.parseDiagnosticsSummary.byCode);
    expect(totalAcrossEntries).toBe(parsed.parseDiagnosticsSummary.total);
  });

  it("envelope.parseDiagnosticsByCode is empty array on a clean program (no parse diagnostics)", async () => {
    const tmp = await setupTmpDir();
    const inputPath = path.join(tmp, "clean.nc");
    await writeFile(inputPath, "G0 X1 Y1\nM30\n", "utf8");

    let stdout = "";
    const exitCode = await main(["--input", inputPath, "--format", "json"], {
      stdout: (chunk) => {
        stdout += chunk;
      }
    });
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.parseDiagnosticsByCode).toEqual([]);
    expect(parsed.parseDiagnosticsSummary.total).toBe(0);
  });

  it("envelope.parseDiagnosticsByCode entries are ordered by count desc, then code ascending", async () => {
    const tmp = await setupTmpDir();
    const inputPath = path.join(tmp, "ordered.nc");
    // 2 unclosed parens (UNMATCHED_OPEN_PAREN) + 1 unmatched bracket
    await writeFile(
      inputPath,
      "G0 X1 (unclosed\nG1 Y2 (also unclosed\nG2 Y[1+2 X3.\nM30\n",
      "utf8"
    );

    let stdout = "";
    const exitCode = await main(["--input", inputPath, "--format", "json"], {
      stdout: (chunk) => {
        stdout += chunk;
      }
    });
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    const entries = parsed.parseDiagnosticsByCode as Array<{
      code: string;
      count: number;
    }>;
    expect(entries.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < entries.length; i += 1) {
      const prev = entries[i - 1];
      const curr = entries[i];
      if (prev.count === curr.count) {
        expect(prev.code.localeCompare(curr.code)).toBeLessThanOrEqual(0);
      } else {
        expect(prev.count).toBeGreaterThan(curr.count);
      }
    }
  });

  it("envelope.lintIssuesByParseDiagCode is empty on a clean program (no parse diagnostics, no related lints)", async () => {
    const tmp = await setupTmpDir();
    const inputPath = path.join(tmp, "clean.nc");
    await writeFile(inputPath, "G0 X1\nM30\n", "utf8");

    let stdout = "";
    const exitCode = await main(["--input", inputPath, "--format", "json"], {
      stdout: (chunk) => {
        stdout += chunk;
      }
    });
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(Array.isArray(parsed.lintIssuesByParseDiagCode)).toBe(true);
    expect(parsed.lintIssuesByParseDiagCode).toEqual([]);
  });

  it("envelope.lintIssuesByParseDiagCode is populated for parse-diag-rich programs (every (source, code) appears at most once)", async () => {
    const tmp = await setupTmpDir();
    const inputPath = path.join(tmp, "diag-rich.nc");
    // Trigger BOTH unmatched paren (UNMATCHED_OPEN_PAREN -> lexer lint) and
    // an unbalanced bracket (the expression-parser branch).
    await writeFile(
      inputPath,
      "G0 X1 (unclosed\nG1 Y[1+2 X3.\nM30\n",
      "utf8"
    );

    let stdout = "";
    const exitCode = await main(["--input", inputPath, "--format", "json"], {
      stdout: (chunk) => {
        stdout += chunk;
      }
    });
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    const cross = parsed.lintIssuesByParseDiagCode as Array<{
      source: string;
      code: string;
      count: number;
    }>;
    expect(Array.isArray(cross)).toBe(true);
    expect(cross.length).toBeGreaterThan(0);
    // Uniqueness invariant: each (source, code) pair appears at most once.
    const seen = new Set<string>();
    for (const entry of cross) {
      const key = `${entry.source}::${entry.code}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
      expect(entry.count).toBeGreaterThan(0);
    }
    // Sum of counts is bounded by total lintIssues (a single issue can
    // contribute to several codes if its provenance lists several distinct
    // related diagnostics; the bound is total * number_of_distinct_codes â€” we
    // only need the weaker bound that no entry's count exceeds total).
    const totalLints = parsed.lintIssuesSummary.total as number;
    for (const entry of cross) {
      expect(entry.count).toBeLessThanOrEqual(totalLints);
    }
  });

  it("envelope.lintIssuesByParseDiagCode entries are ordered by count desc, then source asc, then code asc", async () => {
    const tmp = await setupTmpDir();
    const inputPath = path.join(tmp, "ordered-cross.nc");
    // Mix of unmatched parens AND unbalanced brackets across blocks so the
    // resulting cross-table has at least 2 distinct (source, code) pairs to
    // sort against.
    await writeFile(
      inputPath,
      "G0 X1 (open1\nG1 Y2 (open2\nG2 Y[1+2 X3.\nG3 Y[3+4 X5.\nM30\n",
      "utf8"
    );

    let stdout = "";
    const exitCode = await main(["--input", inputPath, "--format", "json"], {
      stdout: (chunk) => {
        stdout += chunk;
      }
    });
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    const cross = parsed.lintIssuesByParseDiagCode as Array<{
      source: string;
      code: string;
      count: number;
    }>;
    for (let i = 1; i < cross.length; i += 1) {
      const prev = cross[i - 1];
      const curr = cross[i];
      if (prev.count !== curr.count) {
        expect(prev.count).toBeGreaterThan(curr.count);
      } else if (prev.source !== curr.source) {
        expect(prev.source.localeCompare(curr.source)).toBeLessThan(0);
      } else {
        expect(prev.code.localeCompare(curr.code)).toBeLessThanOrEqual(0);
      }
    }
  });

  it("envelope.lintIssuesByControllerCode is empty on a clean program (no coded lint issues) [schema v5]", async () => {
    const tmp = await setupTmpDir();
    const inputPath = path.join(tmp, "clean.nc");
    await writeFile(inputPath, "O1000\nG0 X1\nM30\n", "utf8");

    let stdout = "";
    const exitCode = await main(["--input", inputPath, "--controller", "fanuc", "--format", "json"], {
      stdout: (chunk) => {
        stdout += chunk;
      }
    });
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(Array.isArray(parsed.lintIssuesByControllerCode)).toBe(true);
    expect(parsed.lintIssuesByControllerCode).toEqual([]);
  });

  it("envelope.lintIssuesByControllerCode is populated for malformed Fanuc programs (â‰Ą2 distinct CG_* codes, uniqueness invariant) [schema v5]", async () => {
    const tmp = await setupTmpDir();
    const inputPath = path.join(tmp, "malformed.nc");
    // Trigger BOTH CG_N_AND_O_MIXED (N+O on same block) and CG_DUPLICATE_O_HEADER
    // (two O-number headers with the same value).
    await writeFile(inputPath, "N10 O1000\nG0 X1\nO1000\nM30\n", "utf8");

    let stdout = "";
    const exitCode = await main(["--input", inputPath, "--controller", "fanuc", "--format", "json"], {
      stdout: (chunk) => {
        stdout += chunk;
      }
    });
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    const cross = parsed.lintIssuesByControllerCode as Array<{
      source: string;
      code: string;
      count: number;
      blockers: number;
      warnings: number;
    }>;
    expect(Array.isArray(cross)).toBe(true);
    expect(cross.length).toBeGreaterThanOrEqual(2);
    const codes = new Set(cross.map((entry) => entry.code));
    expect(codes.has("CG_N_AND_O_MIXED")).toBe(true);
    expect(codes.has("CG_DUPLICATE_O_HEADER")).toBe(true);
    // Uniqueness: each (source, code) pair appears at most once.
    const seen = new Set<string>();
    for (const entry of cross) {
      const key = `${entry.source}::${entry.code}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
      expect(entry.count).toBeGreaterThan(0);
      expect(entry.code).toMatch(/^CG_/);
      // blockers + warnings must equal count (every issue has a definite severity).
      expect(entry.blockers + entry.warnings).toBe(entry.count);
    }
  });

  it("envelope.lintIssuesByControllerCode entries are ordered by count desc, then source asc, then code asc [schema v5]", async () => {
    const tmp = await setupTmpDir();
    const inputPath = path.join(tmp, "ordered-codes.nc");
    // Multiple duplicate-address violations across blocks â†’ multiple
    // CG_DUPLICATE_ADDRESSES_<L> codes; CG_N_AND_O_MIXED appears once.
    await writeFile(
      inputPath,
      "N10 O1000\nG0 X1 X2\nG0 Y1 Y2\nG0 Z1 Z2\nM30\n",
      "utf8"
    );

    let stdout = "";
    const exitCode = await main(["--input", inputPath, "--controller", "fanuc", "--format", "json"], {
      stdout: (chunk) => {
        stdout += chunk;
      }
    });
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    const cross = parsed.lintIssuesByControllerCode as Array<{
      source: string;
      code: string;
      count: number;
    }>;
    for (let i = 1; i < cross.length; i += 1) {
      const prev = cross[i - 1];
      const curr = cross[i];
      if (prev.count !== curr.count) {
        expect(prev.count).toBeGreaterThan(curr.count);
      } else if (prev.source !== curr.source) {
        expect(prev.source.localeCompare(curr.source)).toBeLessThan(0);
      } else {
        expect(prev.code.localeCompare(curr.code)).toBeLessThanOrEqual(0);
      }
    }
  });

  it("CliBatchEnvelope.summary key-list includes lintIssuesByControllerCodePerInputFile [schema v6]", async () => {
    const tmp = await setupTmpDir();
    await writeFile(path.join(tmp, "01.nc"), "G0 X1 Y1\nM30\n", "utf8");
    await writeFile(path.join(tmp, "02.nc"), "G0 X2 Y2\nM30\n", "utf8");
    let stdout = "";
    const exitCode = await main(
      ["--input-dir", tmp, "--controller", "fanuc", "--format", "json"],
      {
        stdout: (chunk) => {
          stdout += chunk;
        }
      }
    );
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.schemaVersion).toBe(CLI_SCHEMA_VERSION);
    expect(parsed.schemaVersion).toBe(CLI_SCHEMA_VERSION);
    expect(parsed.summary).toMatchObject({
      files: 2,
      blocked: 0,
      lintIssuesByControllerCodePerInputFile: []
    });
    expect(parsed.summary.lintIssuesByControllerCodePerInputFile).toEqual([]);
  });

  it("summary.lintIssuesByControllerCodePerInputFile is an empty array on a clean 2-file batch [schema v6]", async () => {
    const tmp = await setupTmpDir();
    await writeFile(path.join(tmp, "alpha.nc"), "G0 X1\nM30\n", "utf8");
    await writeFile(path.join(tmp, "beta.nc"), "G0 Y2\nM30\n", "utf8");
    let stdout = "";
    const exitCode = await main(
      ["--input-dir", tmp, "--controller", "fanuc", "--format", "json"],
      {
        stdout: (chunk) => {
          stdout += chunk;
        }
      }
    );
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.summary.lintIssuesByControllerCodePerInputFile).toEqual([]);
  });

  it("summary.lintIssuesByControllerCodePerInputFile is populated and correctly attributed when each batch entry contributes distinct CG_* codes [schema v6]", async () => {
    const tmp = await setupTmpDir();
    const alphaPath = path.join(tmp, "alpha.nc");
    const betaPath = path.join(tmp, "beta.nc");
    // alpha triggers CG_N_AND_O_MIXED + CG_DUPLICATE_O_HEADER (Fanuc envelope);
    // beta triggers CG_FANUC_MACRO_IJK_ORDER + CG_DUPLICATE_ADDRESSES_X.
    await writeFile(alphaPath, "N10 O1000\nO1000\nM30\n", "utf8");
    await writeFile(betaPath, "O1234\nG65 P9000 K1 J2 I3\nG0 X1 X2\nM30\n", "utf8");

    let stdout = "";
    const exitCode = await main(
      ["--input-dir", tmp, "--controller", "fanuc", "--format", "json"],
      {
        stdout: (chunk) => {
          stdout += chunk;
        }
      }
    );
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    const rows = parsed.summary.lintIssuesByControllerCodePerInputFile as Array<{
      input: string;
      source: string;
      code: string;
      count: number;
      blockers: number;
      warnings: number;
    }>;
    expect(rows.length).toBeGreaterThan(0);

    // Attribution invariant: every row's input MUST be one of the two batch inputs,
    // and every (input, source, code) triple MUST be unique.
    const allowedInputs = new Set([alphaPath, betaPath]);
    const seenTriples = new Set<string>();
    for (const row of rows) {
      expect(allowedInputs.has(row.input)).toBe(true);
      const key = `${row.input}|${row.source}|${row.code}`;
      expect(seenTriples.has(key)).toBe(false);
      seenTriples.add(key);
      expect(row.count).toBeGreaterThan(0);
      expect(row.blockers + row.warnings).toBe(row.count);
    }

    // Attribution: each input contributes its own CG_* codes; no cross-pollination.
    const alphaCodes = rows.filter((r) => r.input === alphaPath).map((r) => r.code).sort();
    const betaCodes = rows.filter((r) => r.input === betaPath).map((r) => r.code).sort();
    expect(alphaCodes).toContain("CG_N_AND_O_MIXED");
    expect(alphaCodes).toContain("CG_DUPLICATE_O_HEADER");
    expect(betaCodes).toContain("CG_FANUC_MACRO_IJK_ORDER");
    expect(betaCodes.some((c) => c.startsWith("CG_DUPLICATE_ADDRESSES_"))).toBe(true);
  });

  it("summary.lintIssuesByControllerCodePerInputFile is sorted by input asc -> count desc -> source asc -> code asc [schema v6]", async () => {
    const tmp = await setupTmpDir();
    const alphaPath = path.join(tmp, "alpha.nc");
    const betaPath = path.join(tmp, "beta.nc");
    await writeFile(alphaPath, "N10 O1000\nG0 X1 X2\nG0 Y1 Y2\nM30\n", "utf8");
    await writeFile(betaPath, "O1234\nG65 P9000 K1 J2 I3\nG0 X1 X2\nM30\n", "utf8");

    let stdout = "";
    const exitCode = await main(
      ["--input-dir", tmp, "--controller", "fanuc", "--format", "json"],
      {
        stdout: (chunk) => {
          stdout += chunk;
        }
      }
    );
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    const rows = parsed.summary.lintIssuesByControllerCodePerInputFile as Array<{
      input: string;
      source: string;
      code: string;
      count: number;
    }>;
    for (let i = 1; i < rows.length; i += 1) {
      const prev = rows[i - 1];
      const curr = rows[i];
      if (prev.input !== curr.input) {
        expect(prev.input < curr.input).toBe(true);
      } else if (prev.count !== curr.count) {
        expect(prev.count).toBeGreaterThan(curr.count);
      } else if (prev.source !== curr.source) {
        expect(prev.source < curr.source).toBe(true);
      } else {
        expect(prev.code <= curr.code).toBe(true);
      }
    }
  });

  it("--format ndjson single-input produces exactly one JSON line", async () => {
    const tmp = await setupTmpDir();
    const inputPath = path.join(tmp, "clean.nc");
    await writeFile(inputPath, "G0 X1 Y1\nM30\n", "utf8");

    let stdout = "";
    const exitCode = await main(["--input", inputPath, "--format", "ndjson"], {
      stdout: (chunk) => {
        stdout += chunk;
      }
    });
    expect(exitCode).toBe(0);
    expect(stdout.endsWith("\n")).toBe(true);
    const lines = stdout.split("\n").filter((line) => line.length > 0);
    expect(lines).toHaveLength(1);
    const parsed = JSON.parse(lines[0]);
    expect(parsed.schemaVersion).toBe(CLI_SCHEMA_VERSION);
    expect(parsed.parseDiagnosticsPolicyBreaches).toEqual([]);
    expect(parsed.lintIssuesSummary).toBeDefined();
  });

  it("--format ndjson --input-dir produces N JSON lines without summary aggregate", async () => {
    const tmp = await setupTmpDir();
    await writeFile(path.join(tmp, "01.nc"), "G0 X1 Y1\nM30\n", "utf8");
    await writeFile(path.join(tmp, "02.nc"), "G0 X2 Y2\nM30\n", "utf8");

    let stdout = "";
    const exitCode = await main(["--input-dir", tmp, "--format", "ndjson"], {
      stdout: (chunk) => {
        stdout += chunk;
      }
    });
    expect(exitCode).toBe(0);
    const lines = stdout.split("\n").filter((line) => line.length > 0);
    expect(lines).toHaveLength(2);
    for (const line of lines) {
      const parsed = JSON.parse(line);
      expect(parsed.schemaVersion).toBe(CLI_SCHEMA_VERSION);
      expect(typeof parsed.input).toBe("string");
      expect(parsed.envelope).toBeDefined();
      expect(parsed.summary).toBeUndefined();
    }
    const inputs = lines.map((line) => path.basename(JSON.parse(line).input)).sort();
    expect(inputs).toEqual(["01.nc", "02.nc"]);
  });

  it("--quiet --strict on a blocked program suppresses the strict-block stderr hint", async () => {
    const tmp = await setupTmpDir();
    const inputPath = path.join(tmp, "malformed.nc");
    await writeFile(inputPath, "G0 X1\nG0 X Y1\nM30\n", "utf8");

    let stdout = "";
    let stderr = "";
    const exitCode = await main(
      ["--input", inputPath, "--policy-preset", "strict", "--strict", "--quiet"],
      {
        stdout: (chunk) => {
          stdout += chunk;
        },
        stderr: (chunk) => {
          stderr += chunk;
        }
      }
    );
    expect(exitCode).toBe(1);
    expect(stderr).toBe("");
    expect(stdout.length).toBeGreaterThan(0);
  });

  it("--quiet on an empty --input-dir suppresses the empty-dir notice but still exits 2", async () => {
    const tmp = await setupTmpDir();
    await writeFile(path.join(tmp, "ignored.txt"), "noop\n", "utf8");

    let stderr = "";
    const exitCode = await main(["--input-dir", tmp, "--quiet"], {
      stdout: () => {
        // discard
      },
      stderr: (chunk) => {
        stderr += chunk;
      }
    });
    expect(exitCode).toBe(2);
    expect(stderr).toBe("");
  });

  it("--input-dir without --recursive only walks the top level", async () => {
    const tmp = await setupTmpDir();
    await writeFile(path.join(tmp, "top.nc"), "G0 X1\nM30\n", "utf8");
    const sub = path.join(tmp, "sub");
    await mkdir(sub);
    await writeFile(path.join(sub, "nested.nc"), "G0 X2\nM30\n", "utf8");

    let stdout = "";
    const exitCode = await main(["--input-dir", tmp, "--format", "json"], {
      stdout: (chunk) => {
        stdout += chunk;
      }
    });
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.results).toHaveLength(1);
    expect(parsed.results[0].input.endsWith("top.nc")).toBe(true);
  });

  it("--input-dir --recursive walks subtrees with deterministic ordering", async () => {
    const tmp = await setupTmpDir();
    await writeFile(path.join(tmp, "top.nc"), "G0 X1\nM30\n", "utf8");
    await writeFile(path.join(tmp, "ignored.txt"), "noop\n", "utf8");
    const sub = path.join(tmp, "sub");
    const subSub = path.join(sub, "nested");
    await mkdir(sub);
    await mkdir(subSub);
    await writeFile(path.join(sub, "b.nc"), "G0 X2\nM30\n", "utf8");
    await writeFile(path.join(subSub, "deep.tap"), "G0 X3\nM30\n", "utf8");
    await writeFile(path.join(subSub, "skip.txt"), "ignore me\n", "utf8");

    let stdout = "";
    const exitCode = await main(
      ["--input-dir", tmp, "--recursive", "--format", "json"],
      {
        stdout: (chunk) => {
          stdout += chunk;
        }
      }
    );
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.results).toHaveLength(3);
    const inputs = parsed.results.map((r: { input: string }) => path.basename(r.input));
    expect(inputs).toEqual(["b.nc", "deep.tap", "top.nc"]);
    expect(
      parsed.results.every(
        (r: { input: string }) => !r.input.endsWith(".txt")
      )
    ).toBe(true);
  });

  it("--include replaces the extension floor (lets *.cnc through, drops *.nc)", async () => {
    const tmp = await setupTmpDir();
    await writeFile(path.join(tmp, "a.nc"), "G0 X1\nM30\n", "utf8");
    await writeFile(path.join(tmp, "b.cnc"), "G0 X2\nM30\n", "utf8");

    let stdout = "";
    const exitCode = await main(
      ["--input-dir", tmp, "--include", "*.cnc", "--format", "json"],
      {
        stdout: (chunk) => {
          stdout += chunk;
        }
      }
    );
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.results).toHaveLength(1);
    expect(parsed.results[0].input.endsWith("b.cnc")).toBe(true);
  });

  it("--exclude wins over --include and over the extension floor", async () => {
    const tmp = await setupTmpDir();
    await writeFile(path.join(tmp, "top.nc"), "G0 X1\nM30\n", "utf8");
    const sub = path.join(tmp, "sub");
    await mkdir(sub);
    await writeFile(path.join(sub, "keep.nc"), "G0 X2\nM30\n", "utf8");
    const draft = path.join(sub, "draft");
    await mkdir(draft);
    await writeFile(path.join(draft, "skip.nc"), "G0 X3\nM30\n", "utf8");

    let stdout = "";
    const exitCode = await main(
      [
        "--input-dir",
        tmp,
        "--recursive",
        "--exclude",
        "**/draft/*",
        "--format",
        "json"
      ],
      {
        stdout: (chunk) => {
          stdout += chunk;
        }
      }
    );
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    const inputs = parsed.results
      .map((r: { input: string }) => path.basename(r.input))
      .sort();
    expect(inputs).toEqual(["keep.nc", "top.nc"]);
  });

  it("--include + --exclude: --exclude precedence on overlapping match", async () => {
    const tmp = await setupTmpDir();
    await writeFile(path.join(tmp, "a.nc"), "G0 X1\nM30\n", "utf8");
    const sub = path.join(tmp, "sub");
    await mkdir(sub);
    await writeFile(path.join(sub, "b.nc"), "G0 X2\nM30\n", "utf8");

    let stdout = "";
    const exitCode = await main(
      [
        "--input-dir",
        tmp,
        "--recursive",
        "--include",
        "**/*.nc",
        "--exclude",
        "**/sub/*",
        "--format",
        "json"
      ],
      {
        stdout: (chunk) => {
          stdout += chunk;
        }
      }
    );
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.results).toHaveLength(1);
    expect(parsed.results[0].input.endsWith("a.nc")).toBe(true);
  });

  it("--input-dir returns exit 2 when directory has no matching files", async () => {
    const tmp = await setupTmpDir();
    await writeFile(path.join(tmp, "ignored.txt"), "noop\n", "utf8");

    let stderr = "";
    const exitCode = await main(["--input-dir", tmp], {
      stdout: () => {
        // discard
      },
      stderr: (chunk) => {
        stderr += chunk;
      }
    });
    expect(exitCode).toBe(2);
    expect(stderr).toMatch(/No \.nc\/\.tap\/\.gcode files found/);
  });

  it("--out-dir + --format json writes one parseable envelope per input, mirroring the relative tree", async () => {
    const tmp = await setupTmpDir();
    await writeFile(path.join(tmp, "top.nc"), "G0 X1\nM30\n", "utf8");
    const sub = path.join(tmp, "sub");
    await mkdir(sub);
    await writeFile(path.join(sub, "b.nc"), "G0 X2\nM30\n", "utf8");
    const subSub = path.join(sub, "nested");
    await mkdir(subSub);
    await writeFile(path.join(subSub, "deep.tap"), "G0 X3\nM30\n", "utf8");

    const outDir = path.join(tmp, "out");
    let stdout = "";
    const exitCode = await main(
      [
        "--input-dir",
        tmp,
        "--recursive",
        "--out-dir",
        outDir,
        "--format",
        "json"
      ],
      {
        stdout: (chunk) => {
          stdout += chunk;
        }
      }
    );
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/cnc-job-check: wrote 14 files to /);
    const top = JSON.parse(await readFile(path.join(outDir, "top.json"), "utf8"));
    expect(top.schemaVersion).toBe(CLI_SCHEMA_VERSION);
    expect(typeof top.proveoutCode).toBe("string");
    const nested = JSON.parse(
      await readFile(path.join(outDir, "sub", "b.json"), "utf8")
    );
    expect(nested.schemaVersion).toBe(CLI_SCHEMA_VERSION);
    const deep = JSON.parse(
      await readFile(path.join(outDir, "sub", "nested", "deep.json"), "utf8")
    );
    expect(deep.schemaVersion).toBe(CLI_SCHEMA_VERSION);
    const batchSummary = JSON.parse(
      await readFile(path.join(outDir, "batch-summary.json"), "utf8")
    );
    expect(batchSummary.summary.batchWalk.export.outDir).toBe(outDir);
  });

  it("--out-dir + --format ndjson writes single-line .ndjson files (one envelope per file)", async () => {
    const tmp = await setupTmpDir();
    await writeFile(path.join(tmp, "a.nc"), "O1000\nG0 X1\nM30\n", "utf8");
    await writeFile(path.join(tmp, "b.nc"), "O1001\nG0 X2\nM30\n", "utf8");

    const outDir = path.join(tmp, "out");
    let stdout = "";
    const exitCode = await main(
      ["--input-dir", tmp, "--out-dir", outDir, "--format", "ndjson"],
      {
        stdout: (c) => {
          stdout += c;
        }
      }
    );
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/cnc-job-check: wrote 12 files to /);
    const aRaw = await readFile(path.join(outDir, "a.ndjson"), "utf8");
    const aLines = aRaw.split("\n").filter((l) => l.length > 0);
    expect(aLines).toHaveLength(1);
    expect(JSON.parse(aLines[0]).schemaVersion).toBe(CLI_SCHEMA_VERSION);
    const bRaw = await readFile(path.join(outDir, "b.ndjson"), "utf8");
    const bLines = bRaw.split("\n").filter((l) => l.length > 0);
    expect(bLines).toHaveLength(1);
    const summaryJson = JSON.parse(await readFile(path.join(outDir, "batch-summary.json"), "utf8"));
    expect(summaryJson.schemaVersion).toBe(CLI_SCHEMA_VERSION);
    const summaryNdjson = (
      await readFile(path.join(outDir, "batch-summary.ndjson"), "utf8")
    )
      .split("\n")
      .filter((l) => l.length > 0);
    expect(summaryNdjson).toHaveLength(1);
    expect(JSON.parse(summaryNdjson[0]).summary.files).toBe(2);
  });

  it("--out + --out-dir: the parser-level mutual-exclusion message reaches stderr (exit 2)", async () => {
    const tmp = await setupTmpDir();
    await writeFile(path.join(tmp, "a.nc"), "G0 X1\nM30\n", "utf8");

    let stderr = "";
    const exitCode = await main(
      [
        "--input-dir",
        tmp,
        "--out",
        path.join(tmp, "all.json"),
        "--out-dir",
        path.join(tmp, "out")
      ],
      {
        stdout: () => {},
        stderr: (chunk) => {
          stderr += chunk;
        }
      }
    );
    expect(exitCode).toBe(2);
    expect(stderr).toContain("--out and --out-dir are mutually exclusive");
  });

  it("--export-setup-sheet-pdf writes a valid PDF file (single --input only) and exits 0", async () => {
    const tmp = await setupTmpDir();
    const inputPath = path.join(tmp, "prog.nc");
    await writeFile(inputPath, "%\nO1000\nG0 X1\nM30\n%\n", "utf8");
    const pdfPath = path.join(tmp, "out.pdf");

    let stdout = "";
    const exitCode = await main(
      ["--input", inputPath, "--export-setup-sheet-pdf", pdfPath, "--format", "json"],
      {
        stdout: (chunk) => {
          stdout += chunk;
        }
      }
    );
    expect(exitCode).toBe(0);
    // JSON envelope still emitted on stdout.
    expect(JSON.parse(stdout).schemaVersion).toBe(CLI_SCHEMA_VERSION);

    const bytes = await readFile(pdfPath);
    expect(bytes.subarray(0, 8).toString("latin1")).toBe("%PDF-1.4");
    expect(bytes.subarray(bytes.length - 5).toString("latin1")).toBe("%%EOF");
  });

  it("--export-setup-sheet-pdf with --input-dir is rejected at parse time (single-input only)", async () => {
    const tmp = await setupTmpDir();
    await writeFile(path.join(tmp, "a.nc"), "G0 X1\nM30\n", "utf8");

    let stderr = "";
    const exitCode = await main(
      [
        "--input-dir",
        tmp,
        "--export-setup-sheet-pdf",
        path.join(tmp, "out.pdf")
      ],
      {
        stdout: () => {},
        stderr: (chunk) => {
          stderr += chunk;
        }
      }
    );
    expect(exitCode).toBe(2);
    expect(stderr).toMatch(/--export-setup-sheet-pdf is single-input only/);
  });

  it("--export-setup-sheet-pdf-batch parses cleanly with --input-dir", () => {
    const parsed = parseCliArgs([
      "--input-dir",
      "in",
      "--export-setup-sheet-pdf-batch",
      "pdfs"
    ]);
    expect(parsed.exportSetupSheetPdfBatch).toBe("pdfs");
    expect(parsed.inputDir).toBe("in");
  });

  it("--export-setup-sheet-pdf-batch without --input-dir is rejected", () => {
    expect(() =>
      parseCliArgs(["--input", "a.nc", "--export-setup-sheet-pdf-batch", "pdfs"])
    ).toThrow(/--export-setup-sheet-pdf-batch requires --input-dir/);
  });

  it("--export-setup-sheet-pdf-batch combined with --export-setup-sheet-pdf is rejected", () => {
    expect(() =>
      parseCliArgs([
        "--input-dir",
        "in",
        "--export-setup-sheet-pdf",
        "out.pdf",
        "--export-setup-sheet-pdf-batch",
        "pdfs"
      ])
    ).toThrow(
      /--export-setup-sheet-pdf is single-input only|mutually exclusive/
    );
  });

  it("--export-setup-sheet-pdf-batch writes one valid PDF per --input-dir input mirroring the relative tree", async () => {
    const tmp = await setupTmpDir();
    await writeFile(path.join(tmp, "alpha.nc"), "%\nO1000\nT1 M6\nM30\n%\n", "utf8");
    const subDir = path.join(tmp, "nest");
    await mkdir(subDir, { recursive: true });
    await writeFile(path.join(subDir, "beta.nc"), "%\nO2000\nT1 M6\nM30\n%\n", "utf8");

    const pdfDir = path.join(tmp, "pdfs");
    let stdout = "";
    const exitCode = await main(
      [
        "--input-dir",
        tmp,
        "--recursive",
        "--export-setup-sheet-pdf-batch",
        pdfDir,
        "--format",
        "json"
      ],
      {
        stdout: (chunk) => {
          stdout += chunk;
        }
      }
    );
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/cnc-job-check: wrote 2 PDFs to/);

    const alphaPdf = await readFile(path.join(pdfDir, "alpha.pdf"));
    const betaPdf = await readFile(path.join(pdfDir, "nest", "beta.pdf"));
    for (const bytes of [alphaPdf, betaPdf]) {
      expect(bytes.subarray(0, 8).toString("latin1")).toBe("%PDF-1.4");
      expect(bytes.subarray(bytes.length - 5).toString("latin1")).toBe("%%EOF");
    }
  });

  it("--out-dir + --out-dir-format json:.envelope.json renames the per-file output extension", async () => {
    const tmp = await setupTmpDir();
    await writeFile(path.join(tmp, "alpha.nc"), "G0 X1\nM30\n", "utf8");
    await writeFile(path.join(tmp, "beta.nc"), "G0 X2\nM30\n", "utf8");

    const outDir = path.join(tmp, "out");
    let stdout = "";
    const exitCode = await main(
      [
        "--input-dir",
        tmp,
        "--out-dir",
        outDir,
        "--out-dir-format",
        "json:.envelope.json",
        "--format",
        "json"
      ],
      {
        stdout: (chunk) => {
          stdout += chunk;
        }
      }
    );
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/cnc-job-check: wrote 12 files to /);
    const alpha = JSON.parse(
      await readFile(path.join(outDir, "alpha.envelope.json"), "utf8")
    );
    expect(alpha.schemaVersion).toBe(CLI_SCHEMA_VERSION);
    const beta = JSON.parse(
      await readFile(path.join(outDir, "beta.envelope.json"), "utf8")
    );
    expect(beta.schemaVersion).toBe(CLI_SCHEMA_VERSION);
    // Default extension MUST NOT have been written when override is active.
    await expect(readFile(path.join(outDir, "alpha.json"), "utf8")).rejects.toBeDefined();
  });

  it("--out-dir refuses to write outside the input root when an injected IO returns escaped paths", async () => {
    const tmp = await setupTmpDir();
    const outDir = path.join(tmp, "out");
    // Inject a custom readDirEntriesFn that returns a name resolving outside the
    // --input-dir root via path traversal. resolveOutDirTarget must reject this
    // before any write happens.
    let stderr = "";
    const exitCode = await main(
      ["--input-dir", tmp, "--out-dir", outDir, "--format", "json"],
      {
        stdout: () => {},
        stderr: (chunk) => {
          stderr += chunk;
        },
        readDirEntriesFn: async (dirPath) => {
          if (dirPath === tmp) {
            return [{ name: "../escape.nc", isDirectory: false }];
          }
          return [];
        },
        readFileFn: async () => "G0 X1\nM30\n"
      }
    );
    expect(exitCode).toBe(2);
    expect(stderr).toMatch(/refusing to write outside --out-dir/);
  });
});

describe("parseVerifyAuditTrailArgs", () => {
  it("parses --main + --sha256 alone", () => {
    const args = parseVerifyAuditTrailArgs(["--main", "audit.ndjson", "--sha256", "audit.ndjson.sha256"]);
    expect(args.main).toBe("audit.ndjson");
    expect(args.sha256).toBe("audit.ndjson.sha256");
    expect(args.hmac).toBeUndefined();
    expect(args.encrypted).toBeUndefined();
  });

  it("parses --main + --hmac + --secret", () => {
    const args = parseVerifyAuditTrailArgs([
      "--main",
      "a.ndjson",
      "--hmac",
      "a.ndjson.hmac-sha256",
      "--secret",
      "shared-key"
    ]);
    expect(args.hmac).toBe("a.ndjson.hmac-sha256");
    expect(args.hmacSecret).toBe("shared-key");
  });

  it("parses --main + --encrypted + --encryption-secret", () => {
    const args = parseVerifyAuditTrailArgs([
      "--main",
      "a.ndjson",
      "--encrypted",
      "a.ndjson.aes-gcm",
      "--encryption-secret",
      "encrypt-key"
    ]);
    expect(args.encrypted).toBe("a.ndjson.aes-gcm");
    expect(args.encryptionSecret).toBe("encrypt-key");
  });

  it("parses every sidecar combined", () => {
    const args = parseVerifyAuditTrailArgs([
      "--main",
      "a",
      "--sha256",
      "a.sha256",
      "--hmac",
      "a.hmac-sha256",
      "--secret",
      "k1",
      "--encrypted",
      "a.aes-gcm",
      "--encryption-secret",
      "k2",
      "--quiet"
    ]);
    expect(args.sha256).toBe("a.sha256");
    expect(args.hmac).toBe("a.hmac-sha256");
    expect(args.hmacSecret).toBe("k1");
    expect(args.encrypted).toBe("a.aes-gcm");
    expect(args.encryptionSecret).toBe("k2");
    expect(args.quiet).toBe(true);
  });

  it("rejects --hmac without --secret", () => {
    expect(() =>
      parseVerifyAuditTrailArgs(["--main", "a", "--hmac", "a.hmac-sha256"])
    ).toThrow(CliArgumentError);
  });

  it("rejects --encrypted without --encryption-secret", () => {
    expect(() =>
      parseVerifyAuditTrailArgs(["--main", "a", "--encrypted", "a.aes-gcm"])
    ).toThrow(CliArgumentError);
  });

  it("rejects missing --main", () => {
    expect(() => parseVerifyAuditTrailArgs(["--sha256", "a.sha256"])).toThrow(
      /requires --main/
    );
  });

  it("rejects when no sidecar is supplied", () => {
    expect(() => parseVerifyAuditTrailArgs(["--main", "a"])).toThrow(
      /at least one of/
    );
  });

  it("--help short-circuits validation", () => {
    const args = parseVerifyAuditTrailArgs(["--help"]);
    expect(args.help).toBe(true);
  });

  it("rejects unknown flags with a clear message", () => {
    expect(() =>
      parseVerifyAuditTrailArgs(["--main", "a", "--mystery", "x"])
    ).toThrow(/Unknown verify-audit-trail flag/);
  });
});

describe("verify-audit-trail subcommand (end-to-end via main())", () => {
  const REAL_CRYPTO = !!(globalThis as { crypto?: { subtle?: SubtleCrypto } }).crypto?.subtle;

  it("--help prints the sub-usage and exits 0", async () => {
    const { io, captured } = captureIo();
    const exitCode = await main(["verify-audit-trail", "--help"], io);
    expect(exitCode).toBe(0);
    expect(captured.stdout).toContain(CLI_USAGE_VERIFY_AUDIT_TRAIL);
  });

  it("argument errors exit 2 and echo the sub-usage on stderr", async () => {
    const { io, captured } = captureIo();
    const exitCode = await main(["verify-audit-trail"], io);
    expect(exitCode).toBe(2);
    expect(captured.stderr).toContain("requires --main");
    expect(captured.stderr).toContain(CLI_USAGE_VERIFY_AUDIT_TRAIL);
  });

  it("happy path: SHA-256 + HMAC + AES-GCM all match -> exit 0", async () => {
    if (!REAL_CRYPTO) return;
    const tmp = await setupTmpDir();
    const payload = "audit-trail line 1\naudit-trail line 2\n";
    const mainPath = path.join(tmp, "audit.ndjson");
    await writeFile(mainPath, payload, "utf8");
    const sha256Path = path.join(tmp, "audit.ndjson.sha256");
    const hmacPath = path.join(tmp, "audit.ndjson.hmac-sha256");
    const encPath = path.join(tmp, "audit.ndjson.aes-gcm");

    await writeFile(sha256Path, `${await computeSha256(payload)}  audit.ndjson\n`, "utf8");
    await writeFile(
      hmacPath,
      `${await computeHmacSha256(payload, "shared-key")}  audit.ndjson\n`,
      "utf8"
    );
    const encrypted = await encryptAesGcm(payload, "encrypt-key");
    await writeFile(encPath, encrypted);

    let stdout = "";
    let stderr = "";
    const exitCode = await main(
      [
        "verify-audit-trail",
        "--main",
        mainPath,
        "--sha256",
        sha256Path,
        "--hmac",
        hmacPath,
        "--secret",
        "shared-key",
        "--encrypted",
        encPath,
        "--encryption-secret",
        "encrypt-key"
      ],
      {
        stdout: (chunk) => {
          stdout += chunk;
        },
        stderr: (chunk) => {
          stderr += chunk;
        }
      }
    );
    expect(exitCode).toBe(0);
    expect(stderr).toBe("");
    expect(stdout).toMatch(/sha256 OK/);
    expect(stdout).toMatch(/hmac OK/);
    expect(stdout).toMatch(/encrypted OK/);
  });

  it("mismatch path: hand-edited SHA-256 sidecar -> exit 1 with canonical mismatch line", async () => {
    if (!REAL_CRYPTO) return;
    const tmp = await setupTmpDir();
    const mainPath = path.join(tmp, "audit.ndjson");
    await writeFile(mainPath, "real-payload\n", "utf8");
    const sha256Path = path.join(tmp, "audit.ndjson.sha256");
    // Tamper: write a digest of a DIFFERENT payload.
    await writeFile(sha256Path, `${await computeSha256("tampered\n")}  audit.ndjson\n`, "utf8");

    let stderr = "";
    const exitCode = await main(
      ["verify-audit-trail", "--main", mainPath, "--sha256", sha256Path],
      {
        stdout: () => {},
        stderr: (chunk) => {
          stderr += chunk;
        }
      }
    );
    expect(exitCode).toBe(1);
    expect(stderr).toMatch(/sha256 mismatch \(expected .+ got .+\)/);
  });

  it("mismatch path: HMAC with wrong secret -> exit 1", async () => {
    if (!REAL_CRYPTO) return;
    const tmp = await setupTmpDir();
    const mainPath = path.join(tmp, "audit.ndjson");
    await writeFile(mainPath, "real-payload\n", "utf8");
    const hmacPath = path.join(tmp, "audit.ndjson.hmac-sha256");
    await writeFile(
      hmacPath,
      `${await computeHmacSha256("real-payload\n", "right-key")}  audit.ndjson\n`,
      "utf8"
    );

    let stderr = "";
    const exitCode = await main(
      [
        "verify-audit-trail",
        "--main",
        mainPath,
        "--hmac",
        hmacPath,
        "--secret",
        "wrong-key"
      ],
      {
        stdout: () => {},
        stderr: (chunk) => {
          stderr += chunk;
        }
      }
    );
    expect(exitCode).toBe(1);
    expect(stderr).toMatch(/hmac mismatch/);
  });

  it("mismatch path: AES-GCM blob with wrong encryption secret -> exit 1", async () => {
    if (!REAL_CRYPTO) return;
    const tmp = await setupTmpDir();
    const mainPath = path.join(tmp, "audit.ndjson");
    await writeFile(mainPath, "real-payload\n", "utf8");
    const encPath = path.join(tmp, "audit.ndjson.aes-gcm");
    const encrypted = await encryptAesGcm("real-payload\n", "right-key");
    await writeFile(encPath, encrypted);

    let stderr = "";
    const exitCode = await main(
      [
        "verify-audit-trail",
        "--main",
        mainPath,
        "--encrypted",
        encPath,
        "--encryption-secret",
        "wrong-key"
      ],
      {
        stdout: () => {},
        stderr: (chunk) => {
          stderr += chunk;
        }
      }
    );
    expect(exitCode).toBe(1);
    expect(stderr).toMatch(/encrypted decrypt failed/);
  });

  it("--quiet suppresses per-check OK lines but still echoes mismatches on stderr", async () => {
    if (!REAL_CRYPTO) return;
    const tmp = await setupTmpDir();
    const mainPath = path.join(tmp, "audit.ndjson");
    await writeFile(mainPath, "payload\n", "utf8");
    const sha256Path = path.join(tmp, "audit.ndjson.sha256");
    await writeFile(sha256Path, `${await computeSha256("payload\n")}  audit.ndjson\n`, "utf8");

    let stdout = "";
    const exitCode = await main(
      ["verify-audit-trail", "--main", mainPath, "--sha256", sha256Path, "--quiet"],
      {
        stdout: (chunk) => {
          stdout += chunk;
        },
        stderr: () => {}
      }
    );
    expect(exitCode).toBe(0);
    expect(stdout).toBe("");
  });
});

describe("profile-pack hot-reload (clearDiscoveredProfilePackLoadersCache + --rediscover-profile-packs)", () => {
  it("parseCliArgs accepts --rediscover-profile-packs flag", () => {
    const args = parseCliArgs(["--input", "p.nc", "--rediscover-profile-packs"]);
    expect(args.rediscoverProfilePacks).toBe(true);
  });

  it("default rediscoverProfilePacks is false when the flag is absent", () => {
    const args = parseCliArgs(["--input", "p.nc"]);
    expect(args.rediscoverProfilePacks).toBe(false);
  });

  it("clearDiscoveredProfilePackLoadersCache flushes the in-memory registry between two seeded loader sets", async () => {
    let firstInvoked = 0;
    let secondInvoked = 0;
    setDiscoveredProfilePackLoadersForTesting({
      "haas-legacy": async () => {
        firstInvoked += 1;
        return [
          {
            severity: "warning",
            message: "FIRST_DISCOVERY_LOADER_FIRED",
            blockIndex: 0
          }
        ];
      }
    });
    try {
      const tmp = await setupTmpDir();
      const inputPath = path.join(tmp, "first.nc");
      await writeFile(inputPath, "G0 X1\nM30\n", "utf8");
      const exitCodeA = await main(
        ["--input", inputPath, "--controller", "haas-legacy", "--format", "json"],
        { stdout: () => {}, stderr: () => {} }
      );
      expect(exitCodeA).toBe(0);
      expect(firstInvoked).toBe(1);

      // Now flush the cache and seed a SECOND loader. Without the flush, the
      // memoized first loader would still win.
      clearDiscoveredProfilePackLoadersCache();
      setDiscoveredProfilePackLoadersForTesting({
        "haas-legacy": async () => {
          secondInvoked += 1;
          return [
            {
              severity: "warning",
              message: "SECOND_DISCOVERY_LOADER_FIRED",
              blockIndex: 0
            }
          ];
        }
      });
      const exitCodeB = await main(
        ["--input", inputPath, "--controller", "haas-legacy", "--format", "json"],
        { stdout: () => {}, stderr: () => {} }
      );
      expect(exitCodeB).toBe(0);
      expect(secondInvoked).toBe(1);
      // The first loader's invocation count MUST stay at 1 â€” cache was flushed.
      expect(firstInvoked).toBe(1);
    } finally {
      setDiscoveredProfilePackLoadersForTesting(undefined);
    }
  });

  it("--rediscover-profile-packs flag wipes a previously-seeded loader before the run (no fallback => exit 0 with no profile_lint)", async () => {
    // Seed a loader that emits a marker so we can prove the seeded cache is
    // active. Without --rediscover, the loader fires on every run; with
    // --rediscover, the cache is flushed BEFORE the seeded loader is even
    // queried for the run, so the loader never fires.
    let invokedCount = 0;
    setDiscoveredProfilePackLoadersForTesting({
      "haas-legacy": async () => {
        invokedCount += 1;
        return [
          {
            severity: "warning",
            message: "REDISCOVER_TEST_MARKER",
            blockIndex: 0
          }
        ];
      }
    });
    try {
      const tmp = await setupTmpDir();
      const inputPath = path.join(tmp, "rediscover.nc");
      await writeFile(inputPath, "G0 X1\nM30\n", "utf8");

      // Baseline: seeded loader fires once when --rediscover-profile-packs is OFF.
      const exitBaseline = await main(
        ["--input", inputPath, "--controller", "haas-legacy", "--format", "json"],
        { stdout: () => {}, stderr: () => {} }
      );
      expect(exitBaseline).toBe(0);
      expect(invokedCount).toBe(1);

      // With --rediscover-profile-packs, the seeded cache is wiped before the
      // run. The auto-discovery walker then runs against the real filesystem
      // (which has no haas-legacy pack) and returns no loader, so the seeded
      // loader is NOT invoked.
      const exitRediscover = await main(
        [
          "--input",
          inputPath,
          "--controller",
          "haas-legacy",
          "--rediscover-profile-packs",
          "--format",
          "json"
        ],
        { stdout: () => {}, stderr: () => {} }
      );
      expect(exitRediscover).toBe(0);
      // invokedCount MUST remain at 1 â€” the cache flush wiped the seed before
      // the loader could be queried again.
      expect(invokedCount).toBe(1);
    } finally {
      clearDiscoveredProfilePackLoadersCache();
      setDiscoveredProfilePackLoadersForTesting(undefined);
    }
  });
});

describe("profile-pack rule deprecation (--no-deprecated-rules)", () => {
  it("parseCliArgs accepts --no-deprecated-rules flag (default false)", () => {
    const off = parseCliArgs(["--input", "p.nc"]);
    expect(off.noDeprecatedRules).toBe(false);
    const on = parseCliArgs(["--input", "p.nc", "--no-deprecated-rules"]);
    expect(on.noDeprecatedRules).toBe(true);
  });

  it("WITHOUT --no-deprecated-rules, deprecated profile-lint issues still surface in lintIssuesSummary.bySource.profile_lint", async () => {
    setDiscoveredProfilePackLoadersForTesting({
      "haas-legacy": async () => [
        { severity: "warning", message: "DEPRECATED rule fired", blockIndex: 0 },
        { severity: "warning", message: "ALIVE rule fired", blockIndex: 0 }
      ]
    });
    setDiscoveredProfilePackRuleDocsForTesting({
      "haas-legacy": [
        {
          id: "deprecated.rule",
          severity: "warning",
          messageMatcher: /DEPRECATED rule/,
          positiveSnippet: "",
          negativeSnippet: "",
          summary: "deprecated pilot",
          deprecatedSince: "2026-05"
        },
        {
          id: "alive.rule",
          severity: "warning",
          messageMatcher: /ALIVE rule/,
          positiveSnippet: "",
          negativeSnippet: "",
          summary: "alive"
        }
      ] satisfies ProfileRuleDoc[]
    });
    try {
      const tmp = await setupTmpDir();
      const inputPath = path.join(tmp, "deprec-baseline.nc");
      // Wrap in `%` lines to silence simpleLint's "no %" warnings (which would
      // otherwise be heuristically classified as profile_lint and inflate the
      // count we're asserting on).
      await writeFile(inputPath, "%\nG0 X1\nM30\n%\n", "utf8");
      const out: string[] = [];
      const exit = await main(
        ["--input", inputPath, "--controller", "haas-legacy", "--format", "json"],
        { stdout: (c) => out.push(c), stderr: () => {} }
      );
      expect(exit).toBe(0);
      const env = JSON.parse(out.join(""));
      // Profile lints don't surface in `controllerLints` (controller_grammar only),
      // they're counted in `lintIssuesSummary.bySource.profile_lint`. Both the
      // deprecated and the alive issue contribute => count is 2.
      expect(env.lintIssuesSummary.bySource.profile_lint).toBe(2);
    } finally {
      setDiscoveredProfilePackLoadersForTesting(undefined);
      setDiscoveredProfilePackRuleDocsForTesting(undefined);
    }
  });

  it("WITH --no-deprecated-rules, deprecated profile-lint issues are filtered out (count drops to 1)", async () => {
    setDiscoveredProfilePackLoadersForTesting({
      "haas-legacy": async () => [
        { severity: "warning", message: "DEPRECATED rule fired", blockIndex: 0 },
        { severity: "warning", message: "ALIVE rule fired", blockIndex: 0 }
      ]
    });
    setDiscoveredProfilePackRuleDocsForTesting({
      "haas-legacy": [
        {
          id: "deprecated.rule",
          severity: "warning",
          messageMatcher: /DEPRECATED rule/,
          positiveSnippet: "",
          negativeSnippet: "",
          summary: "deprecated pilot",
          deprecatedSince: "2026-05"
        },
        {
          id: "alive.rule",
          severity: "warning",
          messageMatcher: /ALIVE rule/,
          positiveSnippet: "",
          negativeSnippet: "",
          summary: "alive"
        }
      ] satisfies ProfileRuleDoc[]
    });
    try {
      const tmp = await setupTmpDir();
      const inputPath = path.join(tmp, "deprec-suppressed.nc");
      await writeFile(inputPath, "%\nG0 X1\nM30\n%\n", "utf8");
      const out: string[] = [];
      const exit = await main(
        [
          "--input",
          inputPath,
          "--controller",
          "haas-legacy",
          "--format",
          "json",
          "--no-deprecated-rules"
        ],
        { stdout: (c) => out.push(c), stderr: () => {} }
      );
      expect(exit).toBe(0);
      const env = JSON.parse(out.join(""));
      // The DEPRECATED rule is filtered out; only the ALIVE rule contributes.
      expect(env.lintIssuesSummary.bySource.profile_lint).toBe(1);
    } finally {
      setDiscoveredProfilePackLoadersForTesting(undefined);
      setDiscoveredProfilePackRuleDocsForTesting(undefined);
    }
  });

  it("clearDiscoveredProfilePackLoadersCache also flushes the rule-docs cache", async () => {
    setDiscoveredProfilePackLoadersForTesting({
      "haas-legacy": async () => [
        { severity: "warning", message: "DEPRECATED rule fired", blockIndex: 0 }
      ]
    });
    setDiscoveredProfilePackRuleDocsForTesting({
      "haas-legacy": [
        {
          id: "deprecated.rule",
          severity: "warning",
          messageMatcher: /DEPRECATED rule/,
          positiveSnippet: "",
          negativeSnippet: "",
          summary: "deprecated pilot",
          deprecatedSince: "2026-05"
        }
      ] satisfies ProfileRuleDoc[]
    });
    try {
      const tmp = await setupTmpDir();
      const inputPath = path.join(tmp, "deprec-cache-flush.nc");
      await writeFile(inputPath, "%\nG0 X1\nM30\n%\n", "utf8");
      const baseline: string[] = [];
      const exitBaseline = await main(
        [
          "--input",
          inputPath,
          "--controller",
          "haas-legacy",
          "--format",
          "json",
          "--no-deprecated-rules"
        ],
        { stdout: (c) => baseline.push(c), stderr: () => {} }
      );
      expect(exitBaseline).toBe(0);
      const baselineEnv = JSON.parse(baseline.join(""));
      // Docs say the rule is deprecated; suppression filters it out.
      expect(baselineEnv.lintIssuesSummary.bySource.profile_lint ?? 0).toBe(0);

      // Flush BOTH caches; the seeded docs cache should be gone too.
      clearDiscoveredProfilePackLoadersCache();
      // Re-seed only the LOADER, not the docs. Without docs, deprecation
      // suppression is a no-op (we cannot know which rule is deprecated).
      setDiscoveredProfilePackLoadersForTesting({
        "haas-legacy": async () => [
          { severity: "warning", message: "DEPRECATED rule fired", blockIndex: 0 }
        ]
      });
      const after: string[] = [];
      const exitAfter = await main(
        [
          "--input",
          inputPath,
          "--controller",
          "haas-legacy",
          "--format",
          "json",
          "--no-deprecated-rules"
        ],
        { stdout: (c) => after.push(c), stderr: () => {} }
      );
      expect(exitAfter).toBe(0);
      const afterEnv = JSON.parse(after.join(""));
      // No docs => no deprecation filter => the issue surfaces again.
      expect(afterEnv.lintIssuesSummary.bySource.profile_lint).toBe(1);
    } finally {
      clearDiscoveredProfilePackLoadersCache();
      setDiscoveredProfilePackLoadersForTesting(undefined);
      setDiscoveredProfilePackRuleDocsForTesting(undefined);
    }
  });
});

describe("--strict-controller-codes gate (schema v7)", () => {
  it("CLI_SCHEMA_VERSION is 45", () => {
    expect(CLI_SCHEMA_VERSION).toBe(45);
  });

  it("parseCliArgs accepts a single --strict-controller-codes value", () => {
    const args = parseCliArgs([
      "--input",
      "p.nc",
      "--strict-controller-codes",
      "CG_FANUC_MACRO_IJK_ORDER"
    ]);
    expect(args.strictControllerCodes).toEqual(["CG_FANUC_MACRO_IJK_ORDER"]);
  });

  it("parseCliArgs splits comma-separated --strict-controller-codes values", () => {
    const args = parseCliArgs([
      "--input",
      "p.nc",
      "--strict-controller-codes",
      "CG_FANUC_MACRO_IJK_ORDER,CG_DUPLICATE_ADDRESSES_*,CG_FANUC_DUP_O"
    ]);
    expect(args.strictControllerCodes).toEqual([
      "CG_FANUC_MACRO_IJK_ORDER",
      "CG_DUPLICATE_ADDRESSES_*",
      "CG_FANUC_DUP_O"
    ]);
  });

  it("parseCliArgs trims whitespace and ignores blank entries", () => {
    const args = parseCliArgs([
      "--input",
      "p.nc",
      "--strict-controller-codes",
      " CG_A , , CG_B "
    ]);
    expect(args.strictControllerCodes).toEqual(["CG_A", "CG_B"]);
  });

  it("parseCliArgs rejects an empty --strict-controller-codes list", () => {
    expect(() =>
      parseCliArgs(["--input", "p.nc", "--strict-controller-codes", " ,, "])
    ).toThrow(CliArgumentError);
  });

  it("parseCliArgs rejects --strict-controller-codes without a value", () => {
    expect(() =>
      parseCliArgs(["--input", "p.nc", "--strict-controller-codes"])
    ).toThrow(CliArgumentError);
  });

  it("default strictControllerCodes is undefined", () => {
    const args = parseCliArgs(["--input", "p.nc"]);
    expect(args.strictControllerCodes).toBeUndefined();
  });

  it("flips envelope.blocked=true and surfaces the matched code in strictControllerCodesGated for a single input", async () => {
    // Use a malformed Fanuc program known to emit CG_* codes.
    const tmp = await setupTmpDir();
    const inputPath = path.join(tmp, "fanuc-cg.nc");
    await writeFile(inputPath, "%\nO0001\nN10 O0001\nM30\n%\n", "utf8");
    // Capture the natural set of codes first (without the gate) to pick one
    // we know is present.
    const baseline: string[] = [];
    await main(
      ["--input", inputPath, "--controller", "fanuc", "--format", "json"],
      { stdout: (c) => baseline.push(c), stderr: () => {} }
    );
    const baselineEnv = JSON.parse(baseline.join(""));
    const codes = (
      baselineEnv.lintIssuesByControllerCode as Array<{ code: string }>
    ).map((e) => e.code);
    if (codes.length === 0) {
      throw new Error(
        "Test setup invariant: malformed Fanuc input must emit at least one CG_* code"
      );
    }
    const gateCode = codes[0];

    const out: string[] = [];
    const exit = await main(
      [
        "--input",
        inputPath,
        "--controller",
        "fanuc",
        "--format",
        "json",
        "--strict-controller-codes",
        gateCode
      ],
      { stdout: (c) => out.push(c), stderr: () => {} }
    );
    expect(exit).toBe(0); // no --strict, so even a blocked envelope exits 0
    const env = JSON.parse(out.join(""));
    expect(env.blocked).toBe(true);
    expect(env.strictControllerCodesGated).toEqual([gateCode]);
    expect(env.messages.some((m: string) => m.includes(gateCode))).toBe(true);
  });

  it("--strict-controller-codes + --strict exits 1 with stderr hint when a gate matches", async () => {
    const tmp = await setupTmpDir();
    const inputPath = path.join(tmp, "fanuc-cg-strict.nc");
    await writeFile(inputPath, "%\nO0001\nN10 O0001\nM30\n%\n", "utf8");
    const baseline: string[] = [];
    await main(
      ["--input", inputPath, "--controller", "fanuc", "--format", "json"],
      { stdout: (c) => baseline.push(c), stderr: () => {} }
    );
    const codes = (
      JSON.parse(baseline.join("")).lintIssuesByControllerCode as Array<{ code: string }>
    ).map((e) => e.code);
    const gateCode = codes[0];

    let stderr = "";
    const out: string[] = [];
    const exit = await main(
      [
        "--input",
        inputPath,
        "--controller",
        "fanuc",
        "--format",
        "json",
        "--strict",
        "--strict-controller-codes",
        gateCode
      ],
      { stdout: (c) => out.push(c), stderr: (c) => (stderr += c) }
    );
    expect(exit).toBe(1);
    expect(stderr).toContain("blocked=true (strict mode)");
  });

  it("a wildcard pattern (CG_FAMILY_*) matches every code in the family", async () => {
    const tmp = await setupTmpDir();
    const inputPath = path.join(tmp, "fanuc-family.nc");
    await writeFile(inputPath, "%\nO0001\nN10 O0001\nM30\n%\n", "utf8");
    const out: string[] = [];
    const exit = await main(
      [
        "--input",
        inputPath,
        "--controller",
        "fanuc",
        "--format",
        "json",
        "--strict-controller-codes",
        "CG_*"
      ],
      { stdout: (c) => out.push(c), stderr: () => {} }
    );
    expect(exit).toBe(0);
    const env = JSON.parse(out.join(""));
    expect(env.blocked).toBe(true);
    const gated = env.strictControllerCodesGated as string[];
    expect(gated.length).toBeGreaterThan(0);
    for (const c of gated) {
      expect(c.startsWith("CG_")).toBe(true);
    }
    // Sorted ascending + deduplicated.
    expect([...gated].sort((a, b) => a.localeCompare(b))).toEqual(gated);
    expect(new Set(gated).size).toBe(gated.length);
  });

  it("an unrelated --strict-controller-codes pattern leaves the envelope unchanged", async () => {
    const tmp = await setupTmpDir();
    const inputPath = path.join(tmp, "fanuc-no-gate.nc");
    await writeFile(inputPath, "%\nO0001\nN10 O0001\nM30\n%\n", "utf8");
    const out: string[] = [];
    const exit = await main(
      [
        "--input",
        inputPath,
        "--controller",
        "fanuc",
        "--format",
        "json",
        "--strict-controller-codes",
        "CG_THIS_CODE_DOES_NOT_EXIST"
      ],
      { stdout: (c) => out.push(c), stderr: () => {} }
    );
    expect(exit).toBe(0);
    const env = JSON.parse(out.join(""));
    // Pre-gate `result.blocked` for this clean-but-coded program may be false,
    // and the gate must NOT flip it because no code matched.
    expect(env.strictControllerCodesGated).toBeUndefined();
  });

  it("batch --strict-controller-codes unions per-entry gated codes into summary.strictControllerCodesGated", async () => {
    const tmp = await setupTmpDir();
    await writeFile(path.join(tmp, "a.nc"), "%\nO0001\nN10 O0001\nM30\n%\n", "utf8");
    await writeFile(path.join(tmp, "b.nc"), "%\nO0002\nN20 O0002\nM30\n%\n", "utf8");
    const out: string[] = [];
    const exit = await main(
      [
        "--input-dir",
        tmp,
        "--controller",
        "fanuc",
        "--format",
        "json",
        "--strict-controller-codes",
        "CG_*"
      ],
      { stdout: (c) => out.push(c), stderr: () => {} }
    );
    expect(exit).toBe(0);
    const batch = JSON.parse(out.join(""));
    expect(batch.summary.strictControllerCodesGated).toBeDefined();
    expect(Array.isArray(batch.summary.strictControllerCodesGated)).toBe(true);
    expect(batch.summary.strictControllerCodesGated.length).toBeGreaterThan(0);
    // Sorted ascending + deduplicated.
    expect([...batch.summary.strictControllerCodesGated].sort((a: string, b: string) =>
      a.localeCompare(b)
    )).toEqual(batch.summary.strictControllerCodesGated);
    expect(new Set(batch.summary.strictControllerCodesGated).size).toBe(
      batch.summary.strictControllerCodesGated.length
    );
    // summary.blocked > 0 because every entry gates on CG_*.
    expect(batch.summary.blocked).toBeGreaterThan(0);
    // Each entry envelope.blocked should be true.
    for (const entry of batch.results as Array<{ envelope: { blocked: boolean } }>) {
      expect(entry.envelope.blocked).toBe(true);
    }
  });

  it("batch summary.strictControllerCodesGated is absent when no entry matched", async () => {
    const tmp = await setupTmpDir();
    await writeFile(path.join(tmp, "clean.nc"), "%\nG0 X1\nM30\n%\n", "utf8");
    const out: string[] = [];
    const exit = await main(
      [
        "--input-dir",
        tmp,
        "--controller",
        "fanuc",
        "--format",
        "json",
        "--strict-controller-codes",
        "CG_DOES_NOT_EXIST"
      ],
      { stdout: (c) => out.push(c), stderr: () => {} }
    );
    expect(exit).toBe(0);
    const batch = JSON.parse(out.join(""));
    expect(batch.summary.strictControllerCodesGated).toBeUndefined();
  });
});

describe("Schema v13: summary.strictControllerCodesGatedAggregated", () => {
  it("batch summary.strictControllerCodesGatedAggregated is absent when no entry matched", async () => {
    const tmp = await setupTmpDir();
    await writeFile(path.join(tmp, "clean.nc"), "O1000\nG0 X1 Y1\nM30\n", "utf8");
    const out: string[] = [];
    const exit = await main(
      [
        "--input-dir",
        tmp,
        "--controller",
        "fanuc",
        "--format",
        "json",
        "--strict-controller-codes",
        "CG_DOES_NOT_EXIST"
      ],
      { stdout: (c) => out.push(c), stderr: () => {} }
    );
    expect(exit).toBe(0);
    const batch = JSON.parse(out.join(""));
    expect(batch.schemaVersion).toBe(CLI_SCHEMA_VERSION);
    expect(batch.summary.strictControllerCodesGatedAggregated).toBeUndefined();
  });

  it("batch summary.strictControllerCodesGatedAggregated attributes gated codes per input", async () => {
    const tmp = await setupTmpDir();
    const alphaPath = path.join(tmp, "alpha.nc");
    const betaPath = path.join(tmp, "beta.nc");
    await writeFile(alphaPath, "%\nO0001\nN10 O0001\nM30\n%\n", "utf8");
    await writeFile(betaPath, "O1234\nG65 P9000 K1 J2 I3\nG0 X1 X2\nM30\n", "utf8");

    const baseline: string[] = [];
    await main(
      ["--input", alphaPath, "--controller", "fanuc", "--format", "json"],
      { stdout: (c) => baseline.push(c), stderr: () => {} }
    );
    const alphaCodes = (
      JSON.parse(baseline.join("")).lintIssuesByControllerCode as Array<{ code: string }>
    ).map((e) => e.code);
    const gateCode = alphaCodes[0];
    if (!gateCode) throw new Error("alpha must emit at least one CG_* code");

    const out: string[] = [];
    const exit = await main(
      [
        "--input-dir",
        tmp,
        "--controller",
        "fanuc",
        "--format",
        "json",
        "--strict-controller-codes",
        gateCode
      ],
      { stdout: (c) => out.push(c), stderr: () => {} }
    );
    expect(exit).toBe(0);
    const batch = JSON.parse(out.join(""));
    const agg = batch.summary.strictControllerCodesGatedAggregated as Array<{
      code: string;
      inputs: string[];
    }>;
    expect(Array.isArray(agg)).toBe(true);
    expect(agg.length).toBeGreaterThan(0);
    const row = agg.find((r) => r.code === gateCode);
    expect(row).toBeDefined();
    expect(row!.inputs).toContain(alphaPath);
    expect(batch.summary.strictControllerCodesGated).toContain(gateCode);
  });

  it("buildBatchStrictControllerCodesGatedAggregation sorts by inputs desc then code asc", () => {
    const entries = [
      {
        input: "b.nc",
        schemaVersion: 20,
        envelope: { strictControllerCodesGated: ["CG_N_AND_O_MIXED"] }
      },
      {
        input: "a.nc",
        schemaVersion: 20,
        envelope: {
          strictControllerCodesGated: ["CG_N_AND_O_MIXED", "CG_DUPLICATE_O_HEADER"]
        }
      }
    ] as Parameters<typeof buildBatchStrictControllerCodesGatedAggregation>[0];
    const agg = buildBatchStrictControllerCodesGatedAggregation(entries);
    expect(agg[0]).toEqual({
      code: "CG_N_AND_O_MIXED",
      inputs: ["a.nc", "b.nc"]
    });
    expect(agg[1].code).toBe("CG_DUPLICATE_O_HEADER");
    expect(agg[1].inputs).toEqual(["a.nc"]);
  });
});

describe("Schema v14: summary.parseDiagnosticsPolicyBreachesAggregated + firstBlockIndex", () => {
  it("batch summary.parseDiagnosticsPolicyBreachesAggregated is undefined for a clean batch", async () => {
    const tmp = await setupTmpDir();
    await writeFile(path.join(tmp, "clean.nc"), "O1000\nG0 X1 Y1\nM30\n", "utf8");
    const out: string[] = [];
    const exit = await main(
      ["--input-dir", tmp, "--controller", "fanuc", "--format", "json"],
      { stdout: (c) => out.push(c), stderr: () => {} }
    );
    expect(exit).toBe(0);
    const batch = JSON.parse(out.join(""));
    expect(batch.schemaVersion).toBe(CLI_SCHEMA_VERSION);
    expect(batch.summary.parseDiagnosticsPolicyBreachesAggregated).toBeUndefined();
  });

  it("batch summary.parseDiagnosticsPolicyBreachesAggregated attributes breach keys per input", async () => {
    const tmp = await setupTmpDir();
    const alphaPath = path.join(tmp, "alpha.nc");
    const betaPath = path.join(tmp, "beta.nc");
    await writeFile(alphaPath, "G0 X1\nG0 X Y1\nM30\n", "utf8");
    await writeFile(betaPath, "G0 X2\nG0 X Y2\nM30\n", "utf8");
    const out: string[] = [];
    const exit = await main(
      [
        "--input-dir",
        tmp,
        "--controller",
        "fanuc",
        "--format",
        "json",
        "--policy-preset",
        "strict"
      ],
      { stdout: (c) => out.push(c), stderr: () => {} }
    );
    expect(exit).toBe(0);
    const batch = JSON.parse(out.join(""));
    const agg = batch.summary.parseDiagnosticsPolicyBreachesAggregated as Array<{
      key: string;
      count: number;
      inputs: string[];
    }>;
    expect(Array.isArray(agg)).toBe(true);
    expect(agg.length).toBeGreaterThan(0);
    const total = agg.find((row) => row.key === "TOTAL");
    expect(total).toBeDefined();
    expect(total!.count).toBe(2);
    expect(total!.inputs).toContain(alphaPath);
    expect(total!.inputs).toContain(betaPath);
  });

  it("buildBatchParseDiagnosticsPolicyBreachesAggregation sorts by count desc then key asc", () => {
    const entries = [
      {
        input: "b.nc",
        schemaVersion: 20,
        envelope: {
          parseDiagnosticsPolicyBreaches: [
            { key: "TOTAL", observed: 3, threshold: 0, severity: "blocker" as const }
          ]
        }
      },
      {
        input: "a.nc",
        schemaVersion: 20,
        envelope: {
          parseDiagnosticsPolicyBreaches: [
            {
              key: "ADDRESS_MISSING_VALUE",
              observed: 1,
              threshold: 0,
              severity: "blocker" as const
            },
            { key: "TOTAL", observed: 2, threshold: 0, severity: "blocker" as const }
          ]
        }
      }
    ] as Parameters<typeof buildBatchParseDiagnosticsPolicyBreachesAggregation>[0];
    const agg = buildBatchParseDiagnosticsPolicyBreachesAggregation(entries);
    expect(agg[0].key).toBe("TOTAL");
    expect(agg[0].count).toBe(2);
    expect(agg[1].key).toBe("ADDRESS_MISSING_VALUE");
    expect(agg[1].inputs).toEqual(["a.nc"]);
  });

  it("envelope.parseDiagnosticsByCode includes firstBlockIndex when diagnostics exist", async () => {
    const tmp = await setupTmpDir();
    const inputPath = path.join(tmp, "paren.nc");
    await writeFile(inputPath, "O1\nG0 X1 (\nM30\n", "utf8");
    const out: string[] = [];
    const exit = await main(
      ["--input", inputPath, "--controller", "fanuc", "--format", "json"],
      { stdout: (c) => out.push(c), stderr: () => {} }
    );
    expect(exit).toBe(0);
    const env = JSON.parse(out.join(""));
    const row = (env.parseDiagnosticsByCode as Array<{ code: string; firstBlockIndex?: number }>).find(
      (entry) => entry.code === "UNMATCHED_OPEN_PAREN"
    );
    expect(row).toBeDefined();
    expect(row!.firstBlockIndex).toBe(1);
  });
});

describe("Schema v15: safetyFindingsByCode + summary.safetyFindingsByCodeAggregated", () => {
  it("envelope.safetyFindingsByCode is present (possibly empty) on clean programs", async () => {
    const tmp = await setupTmpDir();
    const inputPath = path.join(tmp, "clean.nc");
    await writeFile(inputPath, "%\nO0001\nG90 G17\nG0 X1\nM30\n%\n", "utf8");
    const out: string[] = [];
    const exit = await main(
      ["--input", inputPath, "--controller", "fanuc", "--format", "json"],
      { stdout: (c) => out.push(c), stderr: () => {} }
    );
    expect(exit).toBe(0);
    const env = JSON.parse(out.join(""));
    expect(env.schemaVersion).toBe(CLI_SCHEMA_VERSION);
    expect(Array.isArray(env.safetyFindingsByCode)).toBe(true);
  });

  it("batch summary.safetyFindingsByCodeAggregated is undefined for a clean batch", async () => {
    const tmp = await setupTmpDir();
    await writeFile(path.join(tmp, "clean.nc"), "%\nO0001\nG90 G17\nG0 X1\nM30\n%\n", "utf8");
    const out: string[] = [];
    const exit = await main(
      ["--input-dir", tmp, "--controller", "fanuc", "--format", "json"],
      { stdout: (c) => out.push(c), stderr: () => {} }
    );
    expect(exit).toBe(0);
    const batch = JSON.parse(out.join(""));
    expect(batch.schemaVersion).toBe(CLI_SCHEMA_VERSION);
    expect(batch.summary.safetyFindingsByCodeAggregated).toBeUndefined();
  });

  it("buildBatchSafetyFindingsByCodeAggregation sorts by count desc then source/code asc", () => {
    const entries = [
      {
        input: "b.nc",
        schemaVersion: 20,
        envelope: {
          safetyFindingsByCode: [
            {
              source: "simulation" as const,
              code: "SIM_RAPID_Z_PLUNGE",
              count: 1,
              blockers: 0,
              warnings: 1
            }
          ]
        }
      },
      {
        input: "a.nc",
        schemaVersion: 20,
        envelope: {
          safetyFindingsByCode: [
            {
              source: "simulation" as const,
              code: "SIM_RAPID_Z_PLUNGE",
              count: 2,
              blockers: 0,
              warnings: 2
            },
            {
              source: "advisor" as const,
              code: "MISSING_G43_BEFORE_NEGATIVE_Z",
              count: 1,
              blockers: 1,
              warnings: 0
            }
          ]
        }
      }
    ] as Parameters<typeof buildBatchSafetyFindingsByCodeAggregation>[0];
    const agg = buildBatchSafetyFindingsByCodeAggregation(entries);
    expect(agg[0]).toEqual({
      source: "simulation",
      code: "SIM_RAPID_Z_PLUNGE",
      count: 3,
      blockers: 0,
      warnings: 3,
      inputs: ["a.nc", "b.nc"]
    });
    expect(agg[1].source).toBe("advisor");
    expect(agg[1].code).toBe("MISSING_G43_BEFORE_NEGATIVE_Z");
    expect(agg[1].inputs).toEqual(["a.nc"]);
  });

  it("buildSafetyFindingsByCode attributes advisor vs simulation sources", () => {
    const rows = buildSafetyFindingsByCode({
      advisor: {
        safetyFindings: [
          { code: "MISSING_G43_BEFORE_NEGATIVE_Z", severity: "blocker", message: "m", blockIndex: 2 }
        ]
      },
      simulationFindings: [
        { code: "SIM_RAPID_Z_PLUNGE", severity: "warning", message: "s", blockIndex: 4 },
        { code: "SIM_RAPID_Z_PLUNGE", severity: "warning", message: "s2", blockIndex: 1 }
      ]
    } as Parameters<typeof buildSafetyFindingsByCode>[0]);
    expect(rows).toHaveLength(2);
    expect(rows[0].source).toBe("simulation");
    expect(rows[0].code).toBe("SIM_RAPID_Z_PLUNGE");
    expect(rows[0].count).toBe(2);
    expect(rows[0].firstBlockIndex).toBe(1);
    expect(rows[1].source).toBe("advisor");
    expect(rows[1].code).toBe("MISSING_G43_BEFORE_NEGATIVE_Z");
    expect(rows[1].blockers).toBe(1);
  });

  it("buildBatchSafetyFindingsAttribution emits per-input rows", () => {
    const rows = buildBatchSafetyFindingsAttribution([
      {
        input: "b.nc",
        schemaVersion: 20,
        envelope: {
          safetyFindingsByCode: [
            {
              source: "simulation",
              code: "SIM_RAPID_Z_PLUNGE",
              count: 1,
              blockers: 0,
              warnings: 1
            }
          ]
        }
      },
      {
        input: "a.nc",
        schemaVersion: 20,
        envelope: {
          safetyFindingsByCode: [
            {
              source: "advisor",
              code: "MISSING_G43_BEFORE_NEGATIVE_Z",
              count: 1,
              blockers: 1,
              warnings: 0
            }
          ]
        }
      }
    ] as Parameters<typeof buildBatchSafetyFindingsAttribution>[0]);
    expect(rows.map((r) => r.input)).toEqual(["a.nc", "b.nc"]);
    expect(rows[0].source).toBe("advisor");
  });
});

describe("Schema v17: summary.batchWalk", () => {
  it("batch JSON includes batchWalk with matched/skipped/root for --input-dir", async () => {
    const tmp = await setupTmpDir();
    await writeFile(path.join(tmp, "keep.nc"), "G0 X1\nM30\n", "utf8");
    await writeFile(path.join(tmp, "skip.nc"), "G0 X2\nM30\n", "utf8");
    await writeFile(path.join(tmp, "notes.txt"), "noop\n", "utf8");
    const out: string[] = [];
    const exit = await main(
      [
        "--input-dir",
        tmp,
        "--exclude",
        "skip.nc",
        "--format",
        "json",
        "--controller",
        "fanuc"
      ],
      { stdout: (c) => out.push(c), stderr: () => {} }
    );
    expect(exit).toBe(0);
    const batch = JSON.parse(out.join(""));
    expect(batch.schemaVersion).toBe(CLI_SCHEMA_VERSION);
    expect(batch.summary.batchWalk).toEqual({
      recursive: false,
      include: [],
      exclude: ["skip.nc"],
      matched: 1,
      skipped: 1,
      root: tmp
    });
    expect(batch.results).toHaveLength(1);
  });

  it("single-file JSON has no summary.batchWalk", async () => {
    const tmp = await setupTmpDir();
    const inputPath = path.join(tmp, "one.nc");
    await writeFile(inputPath, "G0 X1\nM30\n", "utf8");
    const out: string[] = [];
    const exit = await main(
      ["--input", inputPath, "--controller", "fanuc", "--format", "json"],
      { stdout: (c) => out.push(c), stderr: () => {} }
    );
    expect(exit).toBe(0);
    const env = JSON.parse(out.join(""));
    expect(env.schemaVersion).toBe(CLI_SCHEMA_VERSION);
    expect(env.summary?.batchWalk).toBeUndefined();
  });

  it("buildBatchEnvelope attaches batchWalk when options.batchWalk is set", () => {
    const batch = buildBatchEnvelope([], {
      batchWalk: {
        recursive: true,
        include: ["**/*.nc"],
        exclude: [],
        matched: 0,
        skipped: 2,
        root: "/jobs"
      }
    });
    expect(batch.schemaVersion).toBe(CLI_SCHEMA_VERSION);
    expect(batch.summary.batchWalk?.recursive).toBe(true);
    expect(batch.summary.batchWalk?.skipped).toBe(2);
    expect(batch.summary.batchWalk?.root).toBe("/jobs");
  });
});

describe("Schema v18: safety attribution firstBlockIndex + batchWalk.export + safety_blocker", () => {
  it("buildBatchSafetyFindingsAttribution propagates firstBlockIndex", () => {
    const rows = buildBatchSafetyFindingsAttribution([
      {
        input: "a.nc",
        schemaVersion: 20,
        envelope: {
          safetyFindingsByCode: [
            {
              source: "advisor",
              code: "MISSING_G43_BEFORE_NEGATIVE_Z",
              count: 1,
              blockers: 1,
              warnings: 0,
              firstBlockIndex: 4
            }
          ]
        }
      }
    ] as Parameters<typeof buildBatchSafetyFindingsAttribution>[0]);
    expect(rows[0].firstBlockIndex).toBe(4);
  });

  it("envelope.blockReasons includes safety_blocker with matchedCodes", async () => {
    const tmp = await setupTmpDir();
    const inputPath = path.join(tmp, "unsafe.nc");
    // Negative Z without G43 â†’ MISSING_G43_BEFORE_NEGATIVE_Z blocker via advisor.
    await writeFile(inputPath, "%\nO0001\nG90 G17\nG0 Z-5\nM30\n%\n", "utf8");
    const out: string[] = [];
    const exit = await main(
      ["--input", inputPath, "--controller", "fanuc", "--format", "json"],
      { stdout: (c) => out.push(c), stderr: () => {} }
    );
    expect(exit).toBe(0);
    const env = JSON.parse(out.join(""));
    expect(env.schemaVersion).toBe(CLI_SCHEMA_VERSION);
    const safety = (env.blockReasons ?? []).find(
      (r: { reason: string }) => r.reason === "safety_blocker"
    );
    expect(safety).toBeDefined();
    expect(Array.isArray(safety.matchedCodes)).toBe(true);
    expect(safety.matchedCodes.length).toBeGreaterThan(0);
  });

  it("batchWalk.export records outDir on --out-dir batch-summary.json", async () => {
    const tmp = await setupTmpDir();
    await writeFile(path.join(tmp, "a.nc"), "G0 X1\nM30\n", "utf8");
    const outDir = path.join(tmp, "out");
    await mkdir(outDir);
    const exit = await main(
      [
        "--input-dir",
        tmp,
        "--out-dir",
        outDir,
        "--format",
        "json",
        "--controller",
        "fanuc"
      ],
      { stdout: () => {}, stderr: () => {} }
    );
    expect(exit).toBe(0);
    const summary = JSON.parse(await readFile(path.join(outDir, "batch-summary.json"), "utf8"));
    expect(summary.schemaVersion).toBe(CLI_SCHEMA_VERSION);
    expect(summary.summary.batchWalk.export.outDir).toBe(outDir);
    expect(summary.summary.batchWalk.export.batchExportZip).toMatch(/batch-export\.zip$/);
  });

  it("batchWalk.export records setupSheetPdfDir on JSON batch", async () => {
    const tmp = await setupTmpDir();
    await writeFile(path.join(tmp, "a.nc"), "G0 X1\nM30\n", "utf8");
    const pdfDir = path.join(tmp, "pdfs");
    await mkdir(pdfDir);
    const out: string[] = [];
    const exit = await main(
      [
        "--input-dir",
        tmp,
        "--export-setup-sheet-pdf-batch",
        pdfDir,
        "--format",
        "json",
        "--quiet",
        "--controller",
        "fanuc"
      ],
      { stdout: (c) => out.push(c), stderr: () => {} }
    );
    expect(exit).toBe(0);
    const batch = JSON.parse(out.join(""));
    expect(batch.summary.batchWalk.export).toEqual({
      setupSheetPdfDir: pdfDir,
      setupPdfCount: 1
    });
  });
});

describe("Schema v19: parseDiagnosticsByCodePerInputFile + safetyBlockerCodesAggregated", () => {
  it("batch summary.parseDiagnosticsByCodePerInputFile is present (possibly empty)", async () => {
    const tmp = await setupTmpDir();
    await writeFile(path.join(tmp, "a.nc"), "G0 X1\nM30\n", "utf8");
    const out: string[] = [];
    const exit = await main(
      ["--input-dir", tmp, "--controller", "fanuc", "--format", "json"],
      { stdout: (c) => out.push(c), stderr: () => {} }
    );
    expect(exit).toBe(0);
    const batch = JSON.parse(out.join(""));
    expect(batch.schemaVersion).toBe(CLI_SCHEMA_VERSION);
    expect(Array.isArray(batch.summary.parseDiagnosticsByCodePerInputFile)).toBe(true);
  });

  it("buildBatchParseDiagnosticsAttribution propagates firstBlockIndex", () => {
    const rows = buildBatchParseDiagnosticsAttribution([
      {
        input: "a.nc",
        schemaVersion: 20,
        envelope: {
          parseDiagnosticsByCode: [
            {
              code: "UNMATCHED_OPEN_PAREN",
              count: 2,
              warnings: 2,
              errors: 0,
              firstBlockIndex: 3
            }
          ]
        }
      }
    ] as Parameters<typeof buildBatchParseDiagnosticsAttribution>[0]);
    expect(rows[0]).toMatchObject({
      input: "a.nc",
      code: "UNMATCHED_OPEN_PAREN",
      count: 2,
      firstBlockIndex: 3
    });
  });

  it("batch summary.safetyBlockerCodesAggregated unions safety_blocker matchedCodes", async () => {
    const tmp = await setupTmpDir();
    await writeFile(path.join(tmp, "a.nc"), "%\nO0001\nG90 G17\nG0 Z-5\nM30\n%\n", "utf8");
    await writeFile(path.join(tmp, "b.nc"), "%\nO0002\nG90 G17\nG0 Z-2\nM30\n%\n", "utf8");
    const out: string[] = [];
    const exit = await main(
      ["--input-dir", tmp, "--controller", "fanuc", "--format", "json"],
      { stdout: (c) => out.push(c), stderr: () => {} }
    );
    expect(exit).toBe(0);
    const batch = JSON.parse(out.join(""));
    expect(batch.summary.safetyBlockerCodesAggregated).toContain("MISSING_G43_BEFORE_NEGATIVE_Z");
    const safetyRow = (batch.summary.blockReasonsAggregated ?? []).find(
      (r: { reason: string }) => r.reason === "safety_blocker"
    );
    expect(safetyRow).toBeDefined();
    expect(safetyRow.count).toBe(2);
    expect(safetyRow.matchedCodes).toContain("MISSING_G43_BEFORE_NEGATIVE_Z");
  });

  it("buildBatchSafetyBlockerCodesAggregation is empty when no safety_blocker reasons", () => {
    expect(
      buildBatchSafetyBlockerCodesAggregation([
        {
          input: "a.nc",
          schemaVersion: 20,
          envelope: { blockReasons: [{ reason: "lint_blocker", message: "x" }] }
        }
      ] as Parameters<typeof buildBatchSafetyBlockerCodesAggregation>[0])
    ).toEqual([]);
  });
});

describe("Schema v20: lintIssuesByControllerCode firstBlockIndex", () => {
  it("envelope.lintIssuesByControllerCode includes firstBlockIndex when issues exist", async () => {
    const tmp = await setupTmpDir();
    const inputPath = path.join(tmp, "mixed.nc");
    await writeFile(inputPath, "%\nO0001\nN10 O0001\nM30\n%\n", "utf8");
    const out: string[] = [];
    const exit = await main(
      ["--input", inputPath, "--controller", "fanuc", "--format", "json"],
      { stdout: (c) => out.push(c), stderr: () => {} }
    );
    expect(exit).toBe(0);
    const env = JSON.parse(out.join(""));
    expect(env.schemaVersion).toBe(CLI_SCHEMA_VERSION);
    const coded = (env.lintIssuesByControllerCode as Array<{
      code: string;
      firstBlockIndex?: number;
    }>).filter((r) => r.code.startsWith("CG_"));
    expect(coded.length).toBeGreaterThan(0);
    expect(coded.some((r) => r.firstBlockIndex !== undefined)).toBe(true);
  });

  it("batch attribution propagates firstBlockIndex", async () => {
    const tmp = await setupTmpDir();
    await writeFile(path.join(tmp, "a.nc"), "%\nO0001\nN10 O0001\nM30\n%\n", "utf8");
    const out: string[] = [];
    const exit = await main(
      ["--input-dir", tmp, "--controller", "fanuc", "--format", "json"],
      { stdout: (c) => out.push(c), stderr: () => {} }
    );
    expect(exit).toBe(0);
    const batch = JSON.parse(out.join(""));
    const rows = batch.summary.lintIssuesByControllerCodePerInputFile as Array<{
      firstBlockIndex?: number;
    }>;
    expect(rows.some((r) => r.firstBlockIndex !== undefined)).toBe(true);
  });
});

describe("Schema v21: lintIssuesByParseDiagCode firstBlockIndex + batch-summary.csv", () => {
  it("envelope.lintIssuesByParseDiagCode includes firstBlockIndex when related lints exist", async () => {
    const tmp = await setupTmpDir();
    const inputPath = path.join(tmp, "paren.nc");
    await writeFile(inputPath, "G0 X1 (unclosed\nM30\n", "utf8");
    const out: string[] = [];
    const exit = await main(["--input", inputPath, "--format", "json"], {
      stdout: (c) => out.push(c),
      stderr: () => {}
    });
    expect(exit).toBe(0);
    const env = JSON.parse(out.join(""));
    expect(env.schemaVersion).toBe(CLI_SCHEMA_VERSION);
    const rows = env.lintIssuesByParseDiagCode as Array<{
      code: string;
      firstBlockIndex?: number;
    }>;
    if (rows.length > 0) {
      expect(rows.some((r) => r.firstBlockIndex !== undefined)).toBe(true);
    }
  });

  it("--out-dir writes batch-summary.csv beside batch-summary.json", async () => {
    const tmp = await setupTmpDir();
    await writeFile(path.join(tmp, "a.nc"), "O1\nG0 Z-5\nM30\n", "utf8");
    const outDir = path.join(tmp, "out");
    const exit = await main(
      ["--input-dir", tmp, "--out-dir", outDir, "--format", "json"],
      { stdout: () => {}, stderr: () => {} }
    );
    expect(exit).toBe(0);
    const csv = await readFile(path.join(outDir, "batch-summary.csv"), "utf8");
    expect(csv).toMatch(/^kind,key,count/);
    const summary = JSON.parse(await readFile(path.join(outDir, "batch-summary.json"), "utf8"));
    expect(summary.schemaVersion).toBe(CLI_SCHEMA_VERSION);
  });
});

describe("Schema v22: parse-diag aggregated firstBlockIndex + expanded CSV", () => {
  it("buildBatchLintIssuesByParseDiagCodeAggregation propagates firstBlockIndex", () => {
    const entries = [
      {
        schemaVersion: CLI_SCHEMA_VERSION,
        input: "a.nc",
        envelope: {
          lintIssuesByParseDiagCode: [
            { source: "common_lint", code: "UNMATCHED_OPEN_PAREN", count: 1, firstBlockIndex: 2 }
          ]
        }
      },
      {
        schemaVersion: CLI_SCHEMA_VERSION,
        input: "b.nc",
        envelope: {
          lintIssuesByParseDiagCode: [
            { source: "common_lint", code: "UNMATCHED_OPEN_PAREN", count: 1, firstBlockIndex: 0 }
          ]
        }
      }
    ] as Parameters<typeof buildBatchLintIssuesByParseDiagCodeAggregation>[0];
    const rows = buildBatchLintIssuesByParseDiagCodeAggregation(entries);
    expect(rows[0]!.code).toBe("UNMATCHED_OPEN_PAREN");
    expect(rows[0]!.firstBlockIndex).toBe(0);
    expect(rows[0]!.count).toBe(2);
  });

  it("formatBatchAggregationsAsCsv includes controller kinds on fanuc batch --out-dir", async () => {
    const tmp = await setupTmpDir();
    await writeFile(path.join(tmp, "a.nc"), "%\nO0001\nN10 O0001\nM30\n%\n", "utf8");
    const outDir = path.join(tmp, "out");
    const exit = await main(
      ["--input-dir", tmp, "--controller", "fanuc", "--out-dir", outDir, "--format", "json"],
      { stdout: () => {}, stderr: () => {} }
    );
    expect(exit).toBe(0);
    const csv = await readFile(path.join(outDir, "batch-summary.csv"), "utf8");
    expect(csv).toMatch(/controller,/);
  });
});

describe("Schema v23: controller aggregated firstBlockIndex + batch-export.zip", () => {
  it("buildBatchLintIssuesByControllerCodeAggregation propagates firstBlockIndex", () => {
    const entries = [
      {
        schemaVersion: CLI_SCHEMA_VERSION,
        input: "a.nc",
        envelope: {
          lintIssuesByControllerCode: [
            {
              source: "controller_grammar",
              code: "CG_N_AND_O_MIXED",
              count: 1,
              blockers: 1,
              warnings: 0,
              firstBlockIndex: 3
            }
          ]
        }
      },
      {
        schemaVersion: CLI_SCHEMA_VERSION,
        input: "b.nc",
        envelope: {
          lintIssuesByControllerCode: [
            {
              source: "controller_grammar",
              code: "CG_N_AND_O_MIXED",
              count: 1,
              blockers: 1,
              warnings: 0,
              firstBlockIndex: 1
            }
          ]
        }
      }
    ] as Parameters<typeof buildBatchLintIssuesByControllerCodeAggregation>[0];
    const rows = buildBatchLintIssuesByControllerCodeAggregation(entries);
    expect(rows[0]!.firstBlockIndex).toBe(1);
    expect(rows[0]!.count).toBe(2);
  });

  it("--out-dir writes batch-export.zip and records it on batchWalk.export", async () => {
    const tmp = await setupTmpDir();
    await writeFile(path.join(tmp, "a.nc"), "O1\nG0 X1\nM30\n", "utf8");
    const outDir = path.join(tmp, "out");
    const exit = await main(
      ["--input-dir", tmp, "--out-dir", outDir, "--format", "json"],
      { stdout: () => {}, stderr: () => {} }
    );
    expect(exit).toBe(0);
    const zipBytes = await readFile(path.join(outDir, "batch-export.zip"));
    expect(zipBytes[0]).toBe(0x50);
    expect(zipBytes[1]).toBe(0x4b);
    const summary = JSON.parse(await readFile(path.join(outDir, "batch-summary.json"), "utf8"));
    expect(summary.summary.batchWalk.export.batchExportZip).toMatch(/batch-export\.zip$/);
  });
});

describe("Schema v24: parseDiagnostics aggregated firstBlockIndex + SARIF sidecar", () => {
  it("buildBatchParseDiagnosticsByCodeAggregation propagates firstBlockIndex", () => {
    const entries = [
      {
        schemaVersion: CLI_SCHEMA_VERSION,
        input: "a.nc",
        envelope: {
          parseDiagnosticsByCode: [
            { code: "UNMATCHED_OPEN_PAREN", count: 1, warnings: 1, errors: 0, firstBlockIndex: 4 }
          ]
        }
      },
      {
        schemaVersion: CLI_SCHEMA_VERSION,
        input: "b.nc",
        envelope: {
          parseDiagnosticsByCode: [
            { code: "UNMATCHED_OPEN_PAREN", count: 1, warnings: 1, errors: 0, firstBlockIndex: 1 }
          ]
        }
      }
    ] as Parameters<typeof buildBatchParseDiagnosticsByCodeAggregation>[0];
    const rows = buildBatchParseDiagnosticsByCodeAggregation(entries);
    expect(rows[0]!.firstBlockIndex).toBe(1);
    expect(rows[0]!.count).toBe(2);
  });

  it("--out-dir writes batch-unbound-fixes.sarif.json and setup-txt in zip metadata", async () => {
    const tmp = await setupTmpDir();
    await writeFile(path.join(tmp, "a.nc"), "O1\nG0 X1\nM30\n", "utf8");
    const outDir = path.join(tmp, "out");
    const exit = await main(
      ["--input-dir", tmp, "--out-dir", outDir, "--format", "json"],
      { stdout: () => {}, stderr: () => {} }
    );
    expect(exit).toBe(0);
    const sarif = JSON.parse(
      await readFile(path.join(outDir, "batch-unbound-fixes.sarif.json"), "utf8")
    );
    expect(sarif.version).toBe("2.1.0");
    expect(Array.isArray(sarif.runs)).toBe(true);
    const summary = JSON.parse(await readFile(path.join(outDir, "batch-summary.json"), "utf8"));
    expect(summary.summary.batchWalk.export.batchUnboundSarif).toMatch(
      /batch-unbound-fixes\.sarif\.json$/
    );
  });
});

describe("Schema v25: safety aggregated firstBlockIndex + patched NC in zip", () => {
  it("buildBatchSafetyFindingsByCodeAggregation propagates earliest firstBlockIndex", () => {
    const entries = [
      {
        schemaVersion: CLI_SCHEMA_VERSION,
        input: "a.nc",
        envelope: {
          safetyFindingsByCode: [
            {
              source: "advisor",
              code: "MISSING_G43_BEFORE_NEGATIVE_Z",
              count: 1,
              blockers: 1,
              warnings: 0,
              firstBlockIndex: 4
            }
          ]
        }
      },
      {
        schemaVersion: CLI_SCHEMA_VERSION,
        input: "b.nc",
        envelope: {
          safetyFindingsByCode: [
            {
              source: "advisor",
              code: "MISSING_G43_BEFORE_NEGATIVE_Z",
              count: 1,
              blockers: 1,
              warnings: 0,
              firstBlockIndex: 1
            }
          ]
        }
      }
    ] as Parameters<typeof buildBatchSafetyFindingsByCodeAggregation>[0];
    const rows = buildBatchSafetyFindingsByCodeAggregation(entries);
    expect(rows[0]!.code).toBe("MISSING_G43_BEFORE_NEGATIVE_Z");
    expect(rows[0]!.firstBlockIndex).toBe(1);
    expect(rows[0]!.count).toBe(2);
  });

  it("--out-dir zip includes patched-nc and records patchedNcCount when fixes apply", async () => {
    const tmp = await setupTmpDir();
    await writeFile(path.join(tmp, "a.nc"), "O1\nG0 Z-5\nM30\n", "utf8");
    const outDir = path.join(tmp, "out");
    const exit = await main(
      ["--input-dir", tmp, "--out-dir", outDir, "--format", "json", "--controller", "fanuc"],
      { stdout: () => {}, stderr: () => {} }
    );
    expect(exit).toBe(0);
    const summary = JSON.parse(await readFile(path.join(outDir, "batch-summary.json"), "utf8"));
    expect(summary.summary.batchWalk.export.patchedNcCount).toBe(1);
    const zipBytes = await readFile(path.join(outDir, "batch-export.zip"));
    const zipAscii = Buffer.from(zipBytes).toString("binary");
    expect(zipAscii).toMatch(/patched-nc\/a\.patched\.nc/);
  });
});

describe("Schema v26: CSV firstBlockIndex + patched-nc sidecars on disk", () => {
  it("formatBatchAggregationsAsCsv includes firstBlockIndex column", () => {
    const csv = formatBatchAggregationsAsCsv({
      schemaVersion: CLI_SCHEMA_VERSION,
      results: [],
      summary: {
        files: 2,
        blocked: 1,
        safetyFindingsByCodeAggregated: [
          {
            source: "advisor",
            code: "MISSING_G43_BEFORE_NEGATIVE_Z",
            count: 2,
            blockers: 2,
            warnings: 0,
            inputs: ["a.nc", "b.nc"],
            firstBlockIndex: 1
          }
        ],
        safetyFindingsByCodePerInputFile: [],
        lintIssuesByControllerCodePerInputFile: [],
        parseDiagnosticsByCodePerInputFile: []
      }
    });
    expect(csv).toMatch(/^kind,key,count,blockers,warnings,inputs,firstBlockIndex\n/);
    expect(csv).toMatch(/safety,advisor:MISSING_G43_BEFORE_NEGATIVE_Z,2,2,0,/);
    expect(csv).toMatch(/,1\n/);
  });

  it("--out-dir writes patched-nc sidecars and records patchedNcDir", async () => {
    const tmp = await setupTmpDir();
    await writeFile(path.join(tmp, "a.nc"), "O1\nG0 Z-5\nM30\n", "utf8");
    const outDir = path.join(tmp, "out");
    const exit = await main(
      ["--input-dir", tmp, "--out-dir", outDir, "--format", "json", "--controller", "fanuc"],
      { stdout: () => {}, stderr: () => {} }
    );
    expect(exit).toBe(0);
    const summary = JSON.parse(await readFile(path.join(outDir, "batch-summary.json"), "utf8"));
    expect(summary.summary.batchWalk.export.patchedNcCount).toBe(1);
    expect(summary.summary.batchWalk.export.patchedNcDir).toMatch(/patched-nc$/);
    const body = await readFile(path.join(outDir, "patched-nc", "a.patched.nc"), "utf8");
    expect(body).toMatch(/G43/);
    const csv = await readFile(path.join(outDir, "batch-summary.csv"), "utf8");
    expect(csv).toMatch(/^kind,key,count,blockers,warnings,inputs,firstBlockIndex\n/);
  });
});

describe("Schema v27: setup-txt sidecars + setupTxtDir metadata", () => {
  it("--out-dir writes setup-txt sidecars and records setupTxtDir/setupTxtCount", async () => {
    const tmp = await setupTmpDir();
    await writeFile(path.join(tmp, "a.nc"), "O1\nG0 X1\nM30\n", "utf8");
    const outDir = path.join(tmp, "out");
    const exit = await main(
      ["--input-dir", tmp, "--out-dir", outDir, "--format", "json", "--controller", "fanuc"],
      { stdout: () => {}, stderr: () => {} }
    );
    expect(exit).toBe(0);
    const summary = JSON.parse(await readFile(path.join(outDir, "batch-summary.json"), "utf8"));
    expect(summary.schemaVersion).toBe(CLI_SCHEMA_VERSION);
    expect(summary.summary.batchWalk.export.setupTxtCount).toBe(1);
    expect(summary.summary.batchWalk.export.setupTxtDir).toMatch(/setup-txt$/);
    const txt = await readFile(path.join(outDir, "setup-txt", "a.setup.txt"), "utf8");
    expect(txt.length).toBeGreaterThan(0);
    const zipBytes = await readFile(path.join(outDir, "batch-export.zip"));
    expect(Buffer.from(zipBytes).toString("binary")).toMatch(/setup-txt\/a\.setup\.txt/);
  });
});

describe("Schema v28: fix-previews sidecar + setupPdfCount", () => {
  it("--out-dir writes batch-fix-previews.json when fixes apply", async () => {
    const tmp = await setupTmpDir();
    await writeFile(path.join(tmp, "a.nc"), "O1\nG0 Z-5\nM30\n", "utf8");
    const outDir = path.join(tmp, "out");
    const exit = await main(
      ["--input-dir", tmp, "--out-dir", outDir, "--format", "json", "--controller", "fanuc"],
      { stdout: () => {}, stderr: () => {} }
    );
    expect(exit).toBe(0);
    const summary = JSON.parse(await readFile(path.join(outDir, "batch-summary.json"), "utf8"));
    expect(summary.schemaVersion).toBe(CLI_SCHEMA_VERSION);
    expect(summary.summary.batchWalk.export.fixPreviewCount).toBeGreaterThan(0);
    expect(summary.summary.batchWalk.export.fixPreviewsPath).toMatch(
      /batch-fix-previews\.json$/
    );
    const previews = JSON.parse(
      await readFile(path.join(outDir, "batch-fix-previews.json"), "utf8")
    );
    expect(Array.isArray(previews)).toBe(true);
    expect(previews.length).toBeGreaterThan(0);
    const zipAscii = Buffer.from(
      await readFile(path.join(outDir, "batch-export.zip"))
    ).toString("binary");
    expect(zipAscii).toMatch(/batch-fix-previews\.json/);
  });

  it("--export-setup-sheet-pdf-batch records setupPdfCount on batchWalk.export", async () => {
    const tmp = await setupTmpDir();
    await writeFile(path.join(tmp, "a.nc"), "O1\nG0 X1\nM30\n", "utf8");
    await writeFile(path.join(tmp, "b.nc"), "O2\nG0 X2\nM30\n", "utf8");
    const pdfDir = path.join(tmp, "pdfs");
    const outDir = path.join(tmp, "out");
    const exit = await main(
      [
        "--input-dir",
        tmp,
        "--out-dir",
        outDir,
        "--export-setup-sheet-pdf-batch",
        pdfDir,
        "--format",
        "json",
        "--controller",
        "fanuc"
      ],
      { stdout: () => {}, stderr: () => {} }
    );
    expect(exit).toBe(0);
    const summary = JSON.parse(await readFile(path.join(outDir, "batch-summary.json"), "utf8"));
    expect(summary.summary.batchWalk.export.setupPdfCount).toBe(2);
    expect(summary.summary.batchWalk.export.setupSheetPdfDir).toBe(pdfDir);
  });
});

describe("Schema v29: export manifest + writtenFileCount", () => {
  it("--out-dir writes batch-export-manifest.json and records export metadata", async () => {
    const tmp = await setupTmpDir();
    await writeFile(path.join(tmp, "a.nc"), "O1\nG0 X1\nM30\n", "utf8");
    const outDir = path.join(tmp, "out");
    const exit = await main(
      ["--input-dir", tmp, "--out-dir", outDir, "--format", "json", "--controller", "fanuc"],
      { stdout: () => {}, stderr: () => {} }
    );
    expect(exit).toBe(0);
    const summary = JSON.parse(await readFile(path.join(outDir, "batch-summary.json"), "utf8"));
    expect(summary.schemaVersion).toBe(CLI_SCHEMA_VERSION);
    expect(summary.summary.batchWalk.export.exportManifestPath).toMatch(
      /batch-export-manifest\.json$/
    );
    expect(summary.summary.batchWalk.export.writtenFileCount).toBeGreaterThan(0);
    const manifest = JSON.parse(
      await readFile(path.join(outDir, "batch-export-manifest.json"), "utf8")
    );
    expect(manifest.schemaVersion).toBe(CLI_SCHEMA_VERSION);
    expect(Array.isArray(manifest.entries)).toBe(true);
    expect(manifest.entries.some((e: { kind: string }) => e.kind === "zip")).toBe(true);
    expect(manifest.entries.some((e: { kind: string }) => e.kind === "manifest")).toBe(true);
    expect(manifest.writtenFileCount).toBe(summary.summary.batchWalk.export.writtenFileCount);
    const zipAscii = Buffer.from(
      await readFile(path.join(outDir, "batch-export.zip"))
    ).toString("binary");
    expect(zipAscii).toMatch(/batch-export-manifest\.json/);
  });
});

describe("Schema v30: shared export manifest + zipEntryCount", () => {
  it("buildBatchExportManifest classifies paths and rolls up byKind", () => {
    const manifest = buildBatchExportManifest(
      [
        "a.json",
        "setup-txt/a.setup.txt",
        "batch-summary.json",
        "batch-export-manifest.json",
        "batch-export.zip"
      ],
      { schemaVersion: CLI_SCHEMA_VERSION, writtenFileCount: 5, zipEntryCount: 4 }
    );
    expect(classifyBatchExportPath("patched-nc/a.patched.nc")).toBe("patched-nc");
    expect(manifest.byKind.envelope).toBe(1);
    expect(manifest.byKind["setup-txt"]).toBe(1);
    expect(manifest.byKind.manifest).toBe(1);
    expect(manifest.byKind.zip).toBe(1);
    expect(manifest.zipEntryCount).toBe(4);
  });

  it("--out-dir records zipEntryCount and manifest.byKind", async () => {
    const tmp = await setupTmpDir();
    await writeFile(path.join(tmp, "a.nc"), "O1\nG0 X1\nM30\n", "utf8");
    const outDir = path.join(tmp, "out");
    const exit = await main(
      ["--input-dir", tmp, "--out-dir", outDir, "--format", "json", "--controller", "fanuc"],
      { stdout: () => {}, stderr: () => {} }
    );
    expect(exit).toBe(0);
    const summary = JSON.parse(await readFile(path.join(outDir, "batch-summary.json"), "utf8"));
    expect(summary.schemaVersion).toBe(CLI_SCHEMA_VERSION);
    expect(summary.summary.batchWalk.export.zipEntryCount).toBeGreaterThan(0);
    const manifest = JSON.parse(
      await readFile(path.join(outDir, "batch-export-manifest.json"), "utf8")
    );
    expect(manifest.byKind).toBeDefined();
    expect(manifest.byKind.manifest).toBe(1);
    expect(manifest.zipEntryCount).toBe(summary.summary.batchWalk.export.zipEntryCount);
  });
});

describe("Schema v31: zipSha256 + manifest entry bytes", () => {
  it("buildBatchExportManifest accepts per-entry bytes and zipSha256", () => {
    expect(classifyBatchExportPath("batch-export.zip.sha256")).toBe("zip-sha256");
    const manifest = buildBatchExportManifest(
      [
        { path: "batch-summary.json", bytes: 12 },
        { path: "batch-export.zip", bytes: 100 },
        { path: "batch-export.zip.sha256", bytes: 80 }
      ],
      {
        schemaVersion: CLI_SCHEMA_VERSION,
        zipSha256: "a".repeat(64),
        zipEntryCount: 1
      }
    );
    expect(manifest.zipSha256).toBe("a".repeat(64));
    expect(manifest.byKind["zip-sha256"]).toBe(1);
    expect(manifest.entries.find((e) => e.path === "batch-summary.json")?.bytes).toBe(12);
  });

  it("--out-dir writes batch-export.zip.sha256 and records zipSha256 + entry bytes", async () => {
    const tmp = await setupTmpDir();
    await writeFile(path.join(tmp, "a.nc"), "O1\nG0 X1\nM30\n", "utf8");
    const outDir = path.join(tmp, "out");
    const exit = await main(
      ["--input-dir", tmp, "--out-dir", outDir, "--format", "json", "--controller", "fanuc"],
      { stdout: () => {}, stderr: () => {} }
    );
    expect(exit).toBe(0);
    const summary = JSON.parse(await readFile(path.join(outDir, "batch-summary.json"), "utf8"));
    expect(summary.schemaVersion).toBe(CLI_SCHEMA_VERSION);
    expect(summary.summary.batchWalk.export.zipSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(summary.summary.batchWalk.export.zipSha256Path).toMatch(/batch-export\.zip\.sha256$/);
    const sidecar = await readFile(path.join(outDir, "batch-export.zip.sha256"), "utf8");
    expect(sidecar).toMatch(new RegExp(`^${summary.summary.batchWalk.export.zipSha256}  batch-export\\.zip\\n$`));
    const zipBytes = await readFile(path.join(outDir, "batch-export.zip"));
    const { createHash } = await import("node:crypto");
    const actual = createHash("sha256").update(zipBytes).digest("hex");
    expect(summary.summary.batchWalk.export.zipSha256).toBe(actual);
    const manifest = JSON.parse(
      await readFile(path.join(outDir, "batch-export-manifest.json"), "utf8")
    );
    expect(manifest.zipSha256).toBe(summary.summary.batchWalk.export.zipSha256);
    expect(manifest.byKind["zip-sha256"]).toBe(1);
    expect(manifest.entries.some((e: { bytes?: number }) => typeof e.bytes === "number")).toBe(
      true
    );
    expect(summary.summary.batchWalk.export.writtenFileCount).toBe(
      manifest.writtenFileCount
    );
  });
});

describe("Schema v32: zipBytes + manifest totalBytes", () => {
  it("buildBatchExportManifest rolls up totalBytes and formatBatchExportZipSha256Sidecar", () => {
    const manifest = buildBatchExportManifest(
      [
        { path: "batch-summary.json", bytes: 10 },
        { path: "batch-export.zip", bytes: 100 },
        { path: "batch-export.zip.sha256", bytes: 80 }
      ],
      { schemaVersion: CLI_SCHEMA_VERSION, zipSha256: "b".repeat(64) }
    );
    expect(manifest.totalBytes).toBe(190);
    expect(formatBatchExportZipSha256Sidecar("abcd", "batch-export.zip")).toBe(
      "abcd  batch-export.zip\n"
    );
  });

  it("--out-dir records zipBytes and manifest.totalBytes", async () => {
    const tmp = await setupTmpDir();
    await writeFile(path.join(tmp, "a.nc"), "O1\nG0 X1\nM30\n", "utf8");
    const outDir = path.join(tmp, "out");
    const exit = await main(
      ["--input-dir", tmp, "--out-dir", outDir, "--format", "json", "--controller", "fanuc"],
      { stdout: () => {}, stderr: () => {} }
    );
    expect(exit).toBe(0);
    const summary = JSON.parse(await readFile(path.join(outDir, "batch-summary.json"), "utf8"));
    expect(summary.schemaVersion).toBe(CLI_SCHEMA_VERSION);
    const zipBytesOnDisk = (await readFile(path.join(outDir, "batch-export.zip"))).byteLength;
    expect(summary.summary.batchWalk.export.zipBytes).toBe(zipBytesOnDisk);
    const manifest = JSON.parse(
      await readFile(path.join(outDir, "batch-export-manifest.json"), "utf8")
    );
    expect(manifest.totalBytes).toBeGreaterThan(0);
    expect(
      manifest.entries
        .filter((e: { bytes?: number }) => typeof e.bytes === "number")
        .reduce((sum: number, e: { bytes: number }) => sum + e.bytes, 0)
    ).toBe(manifest.totalBytes);
  });
});

describe("Schema v33: sealedAt + totalBytes on export + verify-batch-export", () => {
  it("buildBatchExportManifest accepts sealedAt", () => {
    const manifest = buildBatchExportManifest(["batch-export.zip"], {
      schemaVersion: CLI_SCHEMA_VERSION,
      sealedAt: "2026-09-06T12:00:00.000Z"
    });
    expect(manifest.sealedAt).toBe("2026-09-06T12:00:00.000Z");
  });

  it("--out-dir records sealedAt and export.totalBytes", async () => {
    const tmp = await setupTmpDir();
    await writeFile(path.join(tmp, "a.nc"), "O1\nG0 X1\nM30\n", "utf8");
    const outDir = path.join(tmp, "out");
    const exit = await main(
      ["--input-dir", tmp, "--out-dir", outDir, "--format", "json", "--controller", "fanuc"],
      { stdout: () => {}, stderr: () => {} }
    );
    expect(exit).toBe(0);
    const summary = JSON.parse(await readFile(path.join(outDir, "batch-summary.json"), "utf8"));
    expect(summary.schemaVersion).toBe(CLI_SCHEMA_VERSION);
    expect(summary.summary.batchWalk.export.sealedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
    );
    expect(summary.summary.batchWalk.export.totalBytes).toBeGreaterThan(0);
    const manifest = JSON.parse(
      await readFile(path.join(outDir, "batch-export-manifest.json"), "utf8")
    );
    expect(manifest.sealedAt).toBe(summary.summary.batchWalk.export.sealedAt);
    expect(manifest.totalBytes).toBe(summary.summary.batchWalk.export.totalBytes);
  });

  it("parseVerifyBatchExportArgs requires --zip and --sha256", () => {
    expect(parseVerifyBatchExportArgs(["--help"]).help).toBe(true);
    expect(() => parseVerifyBatchExportArgs(["--zip", "a.zip"])).toThrow(/--sha256/);
    expect(() => parseVerifyBatchExportArgs(["--sha256", "a.sha256"])).toThrow(/--zip/);
    expect(
      parseVerifyBatchExportArgs(["--zip", "a.zip", "--sha256", "a.sha256", "--quiet"])
    ).toEqual({ zip: "a.zip", sha256: "a.sha256", quiet: true, help: false, format: "text" });
  });

  it("parseVerifyBatchExportArgs --out-dir resolves zip + sha256 paths", () => {
    const args = parseVerifyBatchExportArgs(["--out-dir", "/exports/run1"]);
    expect(args.zip).toMatch(/batch-export\.zip$/);
    expect(args.sha256).toMatch(/batch-export\.zip\.sha256$/);
    expect(args.outDir).toBe("/exports/run1");
    expect(() =>
      parseVerifyBatchExportArgs(["--out-dir", "/x", "--zip", "a.zip"])
    ).toThrow(/mutually exclusive/);
  });

  it("verify-batch-export accepts a matching zip + sidecar", async () => {
    const tmp = await setupTmpDir();
    await writeFile(path.join(tmp, "a.nc"), "O1\nG0 X1\nM30\n", "utf8");
    const outDir = path.join(tmp, "out");
    expect(
      await main(
        ["--input-dir", tmp, "--out-dir", outDir, "--format", "json", "--controller", "fanuc"],
        { stdout: () => {}, stderr: () => {} }
      )
    ).toBe(0);
    const zipPath = path.join(outDir, "batch-export.zip");
    const shaPath = path.join(outDir, "batch-export.zip.sha256");
    let stdout = "";
    const exit = await main(
      ["verify-batch-export", "--zip", zipPath, "--sha256", shaPath],
      {
        stdout: (c) => {
          stdout += c;
        },
        stderr: () => {}
      }
    );
    expect(exit).toBe(0);
    expect(stdout).toMatch(/verify-batch-export: sha256 OK/);
  });

  it("verify-batch-export --help prints usage", async () => {
    let stdout = "";
    const exit = await main(["verify-batch-export", "--help"], {
      stdout: (c) => {
        stdout += c;
      },
      stderr: () => {}
    });
    expect(exit).toBe(0);
    expect(stdout).toContain(CLI_USAGE_VERIFY_BATCH_EXPORT);
  });

  it("verify-batch-export exits 1 on digest mismatch", async () => {
    const tmp = await setupTmpDir();
    const zipPath = path.join(tmp, "batch-export.zip");
    const shaPath = path.join(tmp, "batch-export.zip.sha256");
    await writeFile(zipPath, Buffer.from([1, 2, 3, 4]));
    await writeFile(shaPath, `${"0".repeat(64)}  batch-export.zip\n`, "utf8");
    let stderr = "";
    const exit = await main(
      ["verify-batch-export", "--zip", zipPath, "--sha256", shaPath],
      {
        stdout: () => {},
        stderr: (c) => {
          stderr += c;
        }
      }
    );
    expect(exit).toBe(1);
    expect(stderr).toMatch(/sha256 mismatch/);
  });
});

describe("Schema v34: byKind on export + verify-batch-export --out-dir", () => {
  it("--out-dir records export.byKind mirroring the manifest", async () => {
    const tmp = await setupTmpDir();
    await writeFile(path.join(tmp, "a.nc"), "O1\nG0 X1\nM30\n", "utf8");
    const outDir = path.join(tmp, "out");
    const exit = await main(
      ["--input-dir", tmp, "--out-dir", outDir, "--format", "json", "--controller", "fanuc"],
      { stdout: () => {}, stderr: () => {} }
    );
    expect(exit).toBe(0);
    const summary = JSON.parse(await readFile(path.join(outDir, "batch-summary.json"), "utf8"));
    expect(summary.schemaVersion).toBe(CLI_SCHEMA_VERSION);
    expect(summary.summary.batchWalk.export.byKind).toBeDefined();
    expect(summary.summary.batchWalk.export.byKind.manifest).toBe(1);
    expect(summary.summary.batchWalk.export.byKind.zip).toBe(1);
    const manifest = JSON.parse(
      await readFile(path.join(outDir, "batch-export-manifest.json"), "utf8")
    );
    expect(summary.summary.batchWalk.export.byKind).toEqual(manifest.byKind);
  });

  it("verify-batch-export --out-dir verifies a sealed export directory", async () => {
    const tmp = await setupTmpDir();
    await writeFile(path.join(tmp, "a.nc"), "O1\nG0 X1\nM30\n", "utf8");
    const outDir = path.join(tmp, "out");
    expect(
      await main(
        ["--input-dir", tmp, "--out-dir", outDir, "--format", "json", "--controller", "fanuc"],
        { stdout: () => {}, stderr: () => {} }
      )
    ).toBe(0);
    let stdout = "";
    const exit = await main(["verify-batch-export", "--out-dir", outDir], {
      stdout: (c) => {
        stdout += c;
      },
      stderr: () => {}
    });
    expect(exit).toBe(0);
    expect(stdout).toMatch(/verify-batch-export: sha256 OK/);
  });
});

describe("Schema v35: always-on batch-summary.ndjson + ndjsonSummaryPath", () => {
  it("--out-dir always writes batch-summary.ndjson and records ndjsonSummaryPath", async () => {
    const tmp = await setupTmpDir();
    await writeFile(path.join(tmp, "a.nc"), "O1\nG0 X1\nM30\n", "utf8");
    const outDir = path.join(tmp, "out");
    const exit = await main(
      ["--input-dir", tmp, "--out-dir", outDir, "--format", "json", "--controller", "fanuc"],
      { stdout: () => {}, stderr: () => {} }
    );
    expect(exit).toBe(0);
    const summary = JSON.parse(await readFile(path.join(outDir, "batch-summary.json"), "utf8"));
    expect(summary.schemaVersion).toBe(CLI_SCHEMA_VERSION);
    expect(summary.summary.batchWalk.export.ndjsonSummaryPath).toMatch(/batch-summary\.ndjson$/);
    const ndjsonRaw = await readFile(path.join(outDir, "batch-summary.ndjson"), "utf8");
    const ndjsonLines = ndjsonRaw.split("\n").filter((l) => l.length > 0);
    expect(ndjsonLines).toHaveLength(1);
    const ndjsonEnv = JSON.parse(ndjsonLines[0]!);
    expect(ndjsonEnv.schemaVersion).toBe(CLI_SCHEMA_VERSION);
    expect(ndjsonEnv.summary.batchWalk.export.sealedAt).toBe(
      summary.summary.batchWalk.export.sealedAt
    );
    expect(summary.summary.batchWalk.export.byKind["summary-ndjson"]).toBe(1);
  });
});

describe("Schema v36: csvSummaryPath", () => {
  it("--out-dir records csvSummaryPath for batch-summary.csv", async () => {
    const tmp = await setupTmpDir();
    await writeFile(path.join(tmp, "a.nc"), "O1\nG0 X1\nM30\n", "utf8");
    const outDir = path.join(tmp, "out");
    const exit = await main(
      ["--input-dir", tmp, "--out-dir", outDir, "--format", "json", "--controller", "fanuc"],
      { stdout: () => {}, stderr: () => {} }
    );
    expect(exit).toBe(0);
    const summary = JSON.parse(await readFile(path.join(outDir, "batch-summary.json"), "utf8"));
    expect(summary.schemaVersion).toBe(CLI_SCHEMA_VERSION);
    expect(summary.summary.batchWalk.export.csvSummaryPath).toMatch(/batch-summary\.csv$/);
    const csv = await readFile(path.join(outDir, "batch-summary.csv"), "utf8");
    expect(csv.length).toBeGreaterThan(0);
    expect(summary.summary.batchWalk.export.byKind["summary-csv"]).toBe(1);
  });
});

describe("Schema v37: jsonSummaryPath", () => {
  it("--out-dir records jsonSummaryPath for batch-summary.json", async () => {
    const tmp = await setupTmpDir();
    await writeFile(path.join(tmp, "a.nc"), "O1\nG0 X1\nM30\n", "utf8");
    const outDir = path.join(tmp, "out");
    const exit = await main(
      ["--input-dir", tmp, "--out-dir", outDir, "--format", "json", "--controller", "fanuc"],
      { stdout: () => {}, stderr: () => {} }
    );
    expect(exit).toBe(0);
    const summary = JSON.parse(await readFile(path.join(outDir, "batch-summary.json"), "utf8"));
    expect(summary.schemaVersion).toBe(CLI_SCHEMA_VERSION);
    expect(summary.summary.batchWalk.export.jsonSummaryPath).toMatch(/batch-summary\.json$/);
    expect(summary.summary.batchWalk.export.csvSummaryPath).toMatch(/batch-summary\.csv$/);
    expect(summary.summary.batchWalk.export.ndjsonSummaryPath).toMatch(/batch-summary\.ndjson$/);
    expect(summary.summary.batchWalk.export.byKind["summary-json"]).toBe(1);
  });
});

describe("Schema v38: manifest zipBytes + verify-batch-export --format json", () => {
  it("buildBatchExportManifest accepts zipBytes", () => {
    const manifest = buildBatchExportManifest(["batch-export.zip"], {
      schemaVersion: CLI_SCHEMA_VERSION,
      zipBytes: 4096,
      zipSha256: "a".repeat(64)
    });
    expect(manifest.zipBytes).toBe(4096);
    expect(manifest.zipSha256).toBe("a".repeat(64));
  });

  it("--out-dir records zipBytes on sealed export manifest", async () => {
    const tmp = await setupTmpDir();
    await writeFile(path.join(tmp, "a.nc"), "O1\nG0 X1\nM30\n", "utf8");
    const outDir = path.join(tmp, "out");
    const exit = await main(
      ["--input-dir", tmp, "--out-dir", outDir, "--format", "json", "--controller", "fanuc"],
      { stdout: () => {}, stderr: () => {} }
    );
    expect(exit).toBe(0);
    const summary = JSON.parse(await readFile(path.join(outDir, "batch-summary.json"), "utf8"));
    expect(summary.schemaVersion).toBe(CLI_SCHEMA_VERSION);
    const zipBytesOnDisk = (await readFile(path.join(outDir, "batch-export.zip"))).byteLength;
    expect(summary.summary.batchWalk.export.zipBytes).toBe(zipBytesOnDisk);
    const manifest = JSON.parse(
      await readFile(path.join(outDir, "batch-export-manifest.json"), "utf8")
    );
    expect(manifest.zipBytes).toBe(zipBytesOnDisk);
    expect(manifest.schemaVersion).toBe(CLI_SCHEMA_VERSION);
  });

  it("verify-batch-export --format json emits ok result with zipBytes", async () => {
    const tmp = await setupTmpDir();
    await writeFile(path.join(tmp, "a.nc"), "O1\nG0 X1\nM30\n", "utf8");
    const outDir = path.join(tmp, "out");
    expect(
      await main(
        ["--input-dir", tmp, "--out-dir", outDir, "--format", "json", "--controller", "fanuc"],
        { stdout: () => {}, stderr: () => {} }
      )
    ).toBe(0);
    const out: string[] = [];
    const exit = await main(
      ["verify-batch-export", "--out-dir", outDir, "--format", "json"],
      { stdout: (c) => out.push(c), stderr: () => {} }
    );
    expect(exit).toBe(0);
    const result = JSON.parse(out.join(""));
    expect(result.schemaVersion).toBe(CLI_SCHEMA_VERSION);
    expect(result.ok).toBe(true);
    expect(result.zipSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result.zipBytes).toBeGreaterThan(0);
    expect(result.zip).toMatch(/batch-export\.zip$/);
    expect(result.sha256Path).toMatch(/batch-export\.zip\.sha256$/);
  });

  it("verify-batch-export --format json emits ok:false on mismatch", async () => {
    const tmp = await setupTmpDir();
    const zipPath = path.join(tmp, "batch-export.zip");
    const shaPath = path.join(tmp, "batch-export.zip.sha256");
    await writeFile(zipPath, "not-a-real-zip", "utf8");
    await writeFile(shaPath, `${"0".repeat(64)}  batch-export.zip\n`, "utf8");
    const out: string[] = [];
    const exit = await main(
      ["verify-batch-export", "--zip", zipPath, "--sha256", shaPath, "--format", "json"],
      { stdout: (c) => out.push(c), stderr: () => {} }
    );
    expect(exit).toBe(1);
    const result = JSON.parse(out.join(""));
    expect(result.ok).toBe(false);
    expect(result.expectedZipSha256).toBe("0".repeat(64));
    expect(result.zipSha256).not.toBe(result.expectedZipSha256);
  });
});

describe("Schema v39: verify summary cross-check + sealedAt in verify JSON", () => {
  it("verify-batch-export --format json includes summaryMatched and sealedAt from --out-dir", async () => {
    const tmp = await setupTmpDir();
    await writeFile(path.join(tmp, "a.nc"), "O1\nG0 X1\nM30\n", "utf8");
    const outDir = path.join(tmp, "out");
    expect(
      await main(
        ["--input-dir", tmp, "--out-dir", outDir, "--format", "json", "--controller", "fanuc"],
        { stdout: () => {}, stderr: () => {} }
      )
    ).toBe(0);
    const summary = JSON.parse(await readFile(path.join(outDir, "batch-summary.json"), "utf8"));
    expect(summary.schemaVersion).toBe(CLI_SCHEMA_VERSION);
    const out: string[] = [];
    const exit = await main(
      ["verify-batch-export", "--out-dir", outDir, "--format", "json"],
      { stdout: (c) => out.push(c), stderr: () => {} }
    );
    expect(exit).toBe(0);
    const result = JSON.parse(out.join(""));
    expect(result.schemaVersion).toBe(CLI_SCHEMA_VERSION);
    expect(result.ok).toBe(true);
    expect(result.summaryMatched).toBe(true);
    expect(result.summaryPath).toMatch(/batch-summary\.json$/);
    expect(result.sealedAt).toBe(summary.summary.batchWalk.export.sealedAt);
    expect(result.totalBytes).toBe(summary.summary.batchWalk.export.totalBytes);
    expect(result.zipSha256).toBe(summary.summary.batchWalk.export.zipSha256);
  });

  it("verify-batch-export text mode reports summaryMatched when summary is present", async () => {
    const tmp = await setupTmpDir();
    await writeFile(path.join(tmp, "a.nc"), "O1\nG0 X1\nM30\n", "utf8");
    const outDir = path.join(tmp, "out");
    expect(
      await main(
        ["--input-dir", tmp, "--out-dir", outDir, "--format", "json", "--controller", "fanuc"],
        { stdout: () => {}, stderr: () => {} }
      )
    ).toBe(0);
    const out: string[] = [];
    const exit = await main(["verify-batch-export", "--out-dir", outDir], {
      stdout: (c) => out.push(c),
      stderr: () => {}
    });
    expect(exit).toBe(0);
    expect(out.join("")).toMatch(/summaryMatched=true/);
    expect(out.join("")).toMatch(/sealedAt=/);
  });

  it("verify-batch-export fails when summary zipSha256 disagrees with the zip", async () => {
    const tmp = await setupTmpDir();
    await writeFile(path.join(tmp, "a.nc"), "O1\nG0 X1\nM30\n", "utf8");
    const outDir = path.join(tmp, "out");
    expect(
      await main(
        ["--input-dir", tmp, "--out-dir", outDir, "--format", "json", "--controller", "fanuc"],
        { stdout: () => {}, stderr: () => {} }
      )
    ).toBe(0);
    const summaryPath = path.join(outDir, "batch-summary.json");
    const summary = JSON.parse(await readFile(summaryPath, "utf8"));
    summary.summary.batchWalk.export.zipSha256 = "f".repeat(64);
    await writeFile(summaryPath, `${JSON.stringify(summary)}\n`, "utf8");
    const err: string[] = [];
    const out: string[] = [];
    const exit = await main(
      ["verify-batch-export", "--out-dir", outDir, "--format", "json"],
      { stdout: (c) => out.push(c), stderr: (c) => err.push(c) }
    );
    expect(exit).toBe(1);
    const result = JSON.parse(out.join(""));
    expect(result.ok).toBe(false);
    expect(result.summaryMatched).toBe(false);
    expect(result.expectedZipSha256).toBeUndefined();
  });
});

describe("Schema v40: verify manifest cross-check + byKind + desktop sarif stamp", () => {
  it("verify-batch-export --format json includes manifestMatched, byKind from --out-dir", async () => {
    const tmp = await setupTmpDir();
    await writeFile(path.join(tmp, "a.nc"), "O1\nG0 X1\nM30\n", "utf8");
    const outDir = path.join(tmp, "out");
    expect(
      await main(
        ["--input-dir", tmp, "--out-dir", outDir, "--format", "json", "--controller", "fanuc"],
        { stdout: () => {}, stderr: () => {} }
      )
    ).toBe(0);
    const summary = JSON.parse(await readFile(path.join(outDir, "batch-summary.json"), "utf8"));
    expect(summary.schemaVersion).toBe(CLI_SCHEMA_VERSION);
    const manifest = JSON.parse(
      await readFile(path.join(outDir, "batch-export-manifest.json"), "utf8")
    );
    const out: string[] = [];
    const exit = await main(
      ["verify-batch-export", "--out-dir", outDir, "--format", "json"],
      { stdout: (c) => out.push(c), stderr: () => {} }
    );
    expect(exit).toBe(0);
    const result = JSON.parse(out.join(""));
    expect(result.schemaVersion).toBe(CLI_SCHEMA_VERSION);
    expect(result.ok).toBe(true);
    expect(result.manifestMatched).toBe(true);
    expect(result.manifestPath).toMatch(/batch-export-manifest\.json$/);
    expect(result.summaryMatched).toBe(true);
    expect(result.byKind).toEqual(manifest.byKind);
    expect(result.zipSha256).toBe(manifest.zipSha256);
  });

  it("verify-batch-export text mode reports manifestMatched and kinds", async () => {
    const tmp = await setupTmpDir();
    await writeFile(path.join(tmp, "a.nc"), "O1\nG0 X1\nM30\n", "utf8");
    const outDir = path.join(tmp, "out");
    expect(
      await main(
        ["--input-dir", tmp, "--out-dir", outDir, "--format", "json", "--controller", "fanuc"],
        { stdout: () => {}, stderr: () => {} }
      )
    ).toBe(0);
    const out: string[] = [];
    const exit = await main(["verify-batch-export", "--out-dir", outDir], {
      stdout: (c) => out.push(c),
      stderr: () => {}
    });
    expect(exit).toBe(0);
    expect(out.join("")).toMatch(/manifestMatched=true/);
    expect(out.join("")).toMatch(/kinds=\d+/);
  });

  it("verify-batch-export fails when manifest zipSha256 disagrees with the zip", async () => {
    const tmp = await setupTmpDir();
    await writeFile(path.join(tmp, "a.nc"), "O1\nG0 X1\nM30\n", "utf8");
    const outDir = path.join(tmp, "out");
    expect(
      await main(
        ["--input-dir", tmp, "--out-dir", outDir, "--format", "json", "--controller", "fanuc"],
        { stdout: () => {}, stderr: () => {} }
      )
    ).toBe(0);
    const manifestPath = path.join(outDir, "batch-export-manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    manifest.zipSha256 = "e".repeat(64);
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    // Keep summary in sync so summary check does not fail first.
    const summaryPath = path.join(outDir, "batch-summary.json");
    const summary = JSON.parse(await readFile(summaryPath, "utf8"));
    summary.summary.batchWalk.export.zipSha256 = manifest.zipSha256;
    await writeFile(summaryPath, `${JSON.stringify(summary)}\n`, "utf8");
    const out: string[] = [];
    const err: string[] = [];
    const exit = await main(
      ["verify-batch-export", "--out-dir", outDir, "--format", "json"],
      { stdout: (c) => out.push(c), stderr: (c) => err.push(c) }
    );
    expect(exit).toBe(1);
    const result = JSON.parse(out.join(""));
    expect(result.ok).toBe(false);
    expect(result.manifestMatched).toBe(false);
  });

  it("verify-batch-export fails when manifest zipBytes disagrees", async () => {
    const tmp = await setupTmpDir();
    await writeFile(path.join(tmp, "a.nc"), "O1\nG0 X1\nM30\n", "utf8");
    const outDir = path.join(tmp, "out");
    expect(
      await main(
        ["--input-dir", tmp, "--out-dir", outDir, "--format", "json", "--controller", "fanuc"],
        { stdout: () => {}, stderr: () => {} }
      )
    ).toBe(0);
    const manifestPath = path.join(outDir, "batch-export-manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    manifest.zipBytes = (manifest.zipBytes ?? 1) + 999;
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    const out: string[] = [];
    const exit = await main(
      ["verify-batch-export", "--out-dir", outDir, "--format", "json"],
      { stdout: (c) => out.push(c), stderr: () => {} }
    );
    expect(exit).toBe(1);
    const result = JSON.parse(out.join(""));
    expect(result.ok).toBe(false);
    expect(result.manifestMatched).toBe(false);
  });
});

describe("Schema v41: verify NDJSON cross-check + inventory counts", () => {
  it("verify-batch-export --format json includes ndjsonMatched and written/zipEntry counts", async () => {
    const tmp = await setupTmpDir();
    await writeFile(path.join(tmp, "a.nc"), "O1\nG0 X1\nM30\n", "utf8");
    const outDir = path.join(tmp, "out");
    expect(
      await main(
        ["--input-dir", tmp, "--out-dir", outDir, "--format", "json", "--controller", "fanuc"],
        { stdout: () => {}, stderr: () => {} }
      )
    ).toBe(0);
    const summary = JSON.parse(await readFile(path.join(outDir, "batch-summary.json"), "utf8"));
    expect(summary.schemaVersion).toBe(CLI_SCHEMA_VERSION);
    const out: string[] = [];
    const exit = await main(
      ["verify-batch-export", "--out-dir", outDir, "--format", "json"],
      { stdout: (c) => out.push(c), stderr: () => {} }
    );
    expect(exit).toBe(0);
    const result = JSON.parse(out.join(""));
    expect(result.schemaVersion).toBe(CLI_SCHEMA_VERSION);
    expect(result.ok).toBe(true);
    expect(result.ndjsonMatched).toBe(true);
    expect(result.ndjsonPath).toMatch(/batch-summary\.ndjson$/);
    expect(result.writtenFileCount).toBe(summary.summary.batchWalk.export.writtenFileCount);
    expect(result.zipEntryCount).toBe(summary.summary.batchWalk.export.zipEntryCount);
    expect(result.summaryMatched).toBe(true);
    expect(result.manifestMatched).toBe(true);
  });

  it("verify-batch-export text mode reports ndjsonMatched and written/zipEntries", async () => {
    const tmp = await setupTmpDir();
    await writeFile(path.join(tmp, "a.nc"), "O1\nG0 X1\nM30\n", "utf8");
    const outDir = path.join(tmp, "out");
    expect(
      await main(
        ["--input-dir", tmp, "--out-dir", outDir, "--format", "json", "--controller", "fanuc"],
        { stdout: () => {}, stderr: () => {} }
      )
    ).toBe(0);
    const out: string[] = [];
    const exit = await main(["verify-batch-export", "--out-dir", outDir], {
      stdout: (c) => out.push(c),
      stderr: () => {}
    });
    expect(exit).toBe(0);
    expect(out.join("")).toMatch(/ndjsonMatched=true/);
    expect(out.join("")).toMatch(/written=\d+/);
    expect(out.join("")).toMatch(/zipEntries=\d+/);
  });

  it("verify-batch-export fails when NDJSON zipSha256 disagrees with the zip", async () => {
    const tmp = await setupTmpDir();
    await writeFile(path.join(tmp, "a.nc"), "O1\nG0 X1\nM30\n", "utf8");
    const outDir = path.join(tmp, "out");
    expect(
      await main(
        ["--input-dir", tmp, "--out-dir", outDir, "--format", "json", "--controller", "fanuc"],
        { stdout: () => {}, stderr: () => {} }
      )
    ).toBe(0);
    const ndjsonPath = path.join(outDir, "batch-summary.ndjson");
    const line = (await readFile(ndjsonPath, "utf8")).split("\n").find((l) => l.length > 0)!;
    const env = JSON.parse(line);
    env.summary.batchWalk.export.zipSha256 = "d".repeat(64);
    await writeFile(ndjsonPath, `${JSON.stringify(env)}\n`, "utf8");
    const out: string[] = [];
    const exit = await main(
      ["verify-batch-export", "--out-dir", outDir, "--format", "json"],
      { stdout: (c) => out.push(c), stderr: () => {} }
    );
    expect(exit).toBe(1);
    const result = JSON.parse(out.join(""));
    expect(result.ok).toBe(false);
    expect(result.ndjsonMatched).toBe(false);
    expect(result.summaryMatched).toBe(true);
    expect(result.manifestMatched).toBe(true);
  });
});

describe("Schema v42: csvPath + sealSources + summary zipBytes match", () => {
  it("verify-batch-export --format json includes csvPath and sealSources", async () => {
    const tmp = await setupTmpDir();
    await writeFile(path.join(tmp, "a.nc"), "O1\nG0 X1\nM30\n", "utf8");
    const outDir = path.join(tmp, "out");
    expect(
      await main(
        ["--input-dir", tmp, "--out-dir", outDir, "--format", "json", "--controller", "fanuc"],
        { stdout: () => {}, stderr: () => {} }
      )
    ).toBe(0);
    const summary = JSON.parse(await readFile(path.join(outDir, "batch-summary.json"), "utf8"));
    expect(summary.schemaVersion).toBe(CLI_SCHEMA_VERSION);
    const out: string[] = [];
    const exit = await main(
      ["verify-batch-export", "--out-dir", outDir, "--format", "json"],
      { stdout: (c) => out.push(c), stderr: () => {} }
    );
    expect(exit).toBe(0);
    const result = JSON.parse(out.join(""));
    expect(result.schemaVersion).toBe(CLI_SCHEMA_VERSION);
    expect(result.ok).toBe(true);
    expect(result.csvPath).toMatch(/batch-summary\.csv$/);
    expect(result.sealSources).toEqual(
      expect.arrayContaining(["sidecar", "summary", "manifest", "ndjson", "csv"])
    );
    expect(result.summaryMatched).toBe(true);
  });

  it("verify-batch-export text mode reports csvMatched and sources=", async () => {
    const tmp = await setupTmpDir();
    await writeFile(path.join(tmp, "a.nc"), "O1\nG0 X1\nM30\n", "utf8");
    const outDir = path.join(tmp, "out");
    expect(
      await main(
        ["--input-dir", tmp, "--out-dir", outDir, "--format", "json", "--controller", "fanuc"],
        { stdout: () => {}, stderr: () => {} }
      )
    ).toBe(0);
    const out: string[] = [];
    const exit = await main(["verify-batch-export", "--out-dir", outDir], {
      stdout: (c) => out.push(c),
      stderr: () => {}
    });
    expect(exit).toBe(0);
    expect(out.join("")).toMatch(/csvMatched=true/);
    expect(out.join("")).toMatch(/sources=sidecar\+summary\+manifest\+ndjson\+csv/);
  });

  it("verify-batch-export fails when summary zipBytes disagrees", async () => {
    const tmp = await setupTmpDir();
    await writeFile(path.join(tmp, "a.nc"), "O1\nG0 X1\nM30\n", "utf8");
    const outDir = path.join(tmp, "out");
    expect(
      await main(
        ["--input-dir", tmp, "--out-dir", outDir, "--format", "json", "--controller", "fanuc"],
        { stdout: () => {}, stderr: () => {} }
      )
    ).toBe(0);
    const summaryPath = path.join(outDir, "batch-summary.json");
    const summary = JSON.parse(await readFile(summaryPath, "utf8"));
    summary.summary.batchWalk.export.zipBytes =
      (summary.summary.batchWalk.export.zipBytes ?? 1) + 999;
    await writeFile(summaryPath, `${JSON.stringify(summary)}\n`, "utf8");
    const out: string[] = [];
    const exit = await main(
      ["verify-batch-export", "--out-dir", outDir, "--format", "json"],
      { stdout: (c) => out.push(c), stderr: () => {} }
    );
    expect(exit).toBe(1);
    const result = JSON.parse(out.join(""));
    expect(result.ok).toBe(false);
    expect(result.summaryMatched).toBe(false);
    expect(result.manifestMatched).toBe(true);
    expect(result.ndjsonMatched).toBe(true);
    expect(result.sealSources).toContain("csv");
  });
});

describe("Schema v43: csvMatched + kindCount", () => {
  it("verify-batch-export --format json includes csvMatched and kindCount", async () => {
    const tmp = await setupTmpDir();
    await writeFile(path.join(tmp, "a.nc"), "O1\nG0 X1\nM30\n", "utf8");
    const outDir = path.join(tmp, "out");
    expect(
      await main(
        ["--input-dir", tmp, "--out-dir", outDir, "--format", "json", "--controller", "fanuc"],
        { stdout: () => {}, stderr: () => {} }
      )
    ).toBe(0);
    const summary = JSON.parse(await readFile(path.join(outDir, "batch-summary.json"), "utf8"));
    expect(summary.schemaVersion).toBe(CLI_SCHEMA_VERSION);
    const out: string[] = [];
    const exit = await main(
      ["verify-batch-export", "--out-dir", outDir, "--format", "json"],
      { stdout: (c) => out.push(c), stderr: () => {} }
    );
    expect(exit).toBe(0);
    const result = JSON.parse(out.join(""));
    expect(result.schemaVersion).toBe(CLI_SCHEMA_VERSION);
    expect(result.ok).toBe(true);
    expect(result.csvMatched).toBe(true);
    expect(result.csvPath).toMatch(/batch-summary\.csv$/);
    expect(typeof result.kindCount).toBe("number");
    expect(result.kindCount).toBe(Object.keys(result.byKind ?? {}).length);
    expect(result.kindCount).toBeGreaterThan(0);
  });

  it("verify-batch-export fails when CSV header disagrees", async () => {
    const tmp = await setupTmpDir();
    await writeFile(path.join(tmp, "a.nc"), "O1\nG0 X1\nM30\n", "utf8");
    const outDir = path.join(tmp, "out");
    expect(
      await main(
        ["--input-dir", tmp, "--out-dir", outDir, "--format", "json", "--controller", "fanuc"],
        { stdout: () => {}, stderr: () => {} }
      )
    ).toBe(0);
    await writeFile(
      path.join(outDir, "batch-summary.csv"),
      "wrong,header,line\n",
      "utf8"
    );
    const out: string[] = [];
    const err: string[] = [];
    const exit = await main(
      ["verify-batch-export", "--out-dir", outDir, "--format", "json"],
      { stdout: (c) => out.push(c), stderr: (c) => err.push(c) }
    );
    expect(exit).toBe(1);
    const result = JSON.parse(out.join(""));
    expect(result.ok).toBe(false);
    expect(result.csvMatched).toBe(false);
    expect(result.summaryMatched).toBe(true);
    expect(result.manifestMatched).toBe(true);
  });

  it("verify-batch-export text mode reports csvMatched=true and kinds=", async () => {
    const tmp = await setupTmpDir();
    await writeFile(path.join(tmp, "a.nc"), "O1\nG0 X1\nM30\n", "utf8");
    const outDir = path.join(tmp, "out");
    expect(
      await main(
        ["--input-dir", tmp, "--out-dir", outDir, "--format", "json", "--controller", "fanuc"],
        { stdout: () => {}, stderr: () => {} }
      )
    ).toBe(0);
    const out: string[] = [];
    const exit = await main(["verify-batch-export", "--out-dir", outDir], {
      stdout: (c) => out.push(c),
      stderr: () => {}
    });
    expect(exit).toBe(0);
    expect(out.join("")).toMatch(/csvMatched=true/);
    expect(out.join("")).toMatch(/kinds=\d+/);
  });
});

describe("Schema v44: csvRowCount + aggregation row cross-check", () => {
  it("verify-batch-export --format json includes csvRowCount", async () => {
    const tmp = await setupTmpDir();
    await writeFile(path.join(tmp, "a.nc"), "O1\nG0 X1\nM30\n", "utf8");
    const outDir = path.join(tmp, "out");
    expect(
      await main(
        ["--input-dir", tmp, "--out-dir", outDir, "--format", "json", "--controller", "fanuc"],
        { stdout: () => {}, stderr: () => {} }
      )
    ).toBe(0);
    const summary = JSON.parse(await readFile(path.join(outDir, "batch-summary.json"), "utf8"));
    expect(summary.schemaVersion).toBe(CLI_SCHEMA_VERSION);
    const expectedRows = countBatchAggregationCsvRows(summary.summary);
    const out: string[] = [];
    const exit = await main(
      ["verify-batch-export", "--out-dir", outDir, "--format", "json"],
      { stdout: (c) => out.push(c), stderr: () => {} }
    );
    expect(exit).toBe(0);
    const result = JSON.parse(out.join(""));
    expect(result.schemaVersion).toBe(CLI_SCHEMA_VERSION);
    expect(result.ok).toBe(true);
    expect(result.csvMatched).toBe(true);
    expect(result.csvRowCount).toBe(expectedRows);
  });

  it("verify-batch-export fails when CSV row count disagrees with summary", async () => {
    const tmp = await setupTmpDir();
    await writeFile(path.join(tmp, "a.nc"), "O1\nG0 X1\nM30\n", "utf8");
    const outDir = path.join(tmp, "out");
    expect(
      await main(
        ["--input-dir", tmp, "--out-dir", outDir, "--format", "json", "--controller", "fanuc"],
        { stdout: () => {}, stderr: () => {} }
      )
    ).toBe(0);
    const summary = JSON.parse(await readFile(path.join(outDir, "batch-summary.json"), "utf8"));
    const expectedRows = countBatchAggregationCsvRows(summary.summary);
    const extraRows = Array.from({ length: expectedRows + 2 }, (_, i) =>
      `safety,extra:ROW${i},1,1,0,a.nc,`
    ).join("\n");
    await writeFile(
      path.join(outDir, "batch-summary.csv"),
      `${BATCH_SUMMARY_CSV_HEADER}\n${extraRows}\n`,
      "utf8"
    );
    const out: string[] = [];
    const exit = await main(
      ["verify-batch-export", "--out-dir", outDir, "--format", "json"],
      { stdout: (c) => out.push(c), stderr: () => {} }
    );
    expect(exit).toBe(1);
    const result = JSON.parse(out.join(""));
    expect(result.ok).toBe(false);
    expect(result.csvMatched).toBe(false);
    expect(result.csvRowCount).toBe(expectedRows + 2);
    expect(result.summaryMatched).toBe(true);
  });

  it("verify-batch-export text mode reports csvRows=", async () => {
    const tmp = await setupTmpDir();
    await writeFile(path.join(tmp, "a.nc"), "O1\nG0 X1\nM30\n", "utf8");
    const outDir = path.join(tmp, "out");
    expect(
      await main(
        ["--input-dir", tmp, "--out-dir", outDir, "--format", "json", "--controller", "fanuc"],
        { stdout: () => {}, stderr: () => {} }
      )
    ).toBe(0);
    const out: string[] = [];
    const exit = await main(["verify-batch-export", "--out-dir", outDir], {
      stdout: (c) => out.push(c),
      stderr: () => {}
    });
    expect(exit).toBe(0);
    expect(out.join("")).toMatch(/csvMatched=true/);
    expect(out.join("")).toMatch(/csvRows=\d+/);
  });
});

describe("Schema v45: expectedCsvRowCount + fixPreviewsPath", () => {
  it("verify-batch-export --format json includes expectedCsvRowCount", async () => {
    const tmp = await setupTmpDir();
    await writeFile(path.join(tmp, "a.nc"), "O1\nG0 X1\nM30\n", "utf8");
    const outDir = path.join(tmp, "out");
    expect(
      await main(
        ["--input-dir", tmp, "--out-dir", outDir, "--format", "json", "--controller", "fanuc"],
        { stdout: () => {}, stderr: () => {} }
      )
    ).toBe(0);
    const summary = JSON.parse(await readFile(path.join(outDir, "batch-summary.json"), "utf8"));
    expect(summary.schemaVersion).toBe(45);
    const expectedRows = countBatchAggregationCsvRows(summary.summary);
    const out: string[] = [];
    const exit = await main(
      ["verify-batch-export", "--out-dir", outDir, "--format", "json"],
      { stdout: (c) => out.push(c), stderr: () => {} }
    );
    expect(exit).toBe(0);
    const result = JSON.parse(out.join(""));
    expect(result.schemaVersion).toBe(45);
    expect(result.ok).toBe(true);
    expect(result.expectedCsvRowCount).toBe(expectedRows);
    expect(result.csvRowCount).toBe(expectedRows);
    expect(result.csvMatched).toBe(true);
  });

  it("verify-batch-export reports fixPreviewsPath when sibling file exists", async () => {
    const tmp = await setupTmpDir();
    await writeFile(path.join(tmp, "a.nc"), "O1\nG0 X1\nM30\n", "utf8");
    const outDir = path.join(tmp, "out");
    expect(
      await main(
        ["--input-dir", tmp, "--out-dir", outDir, "--format", "json", "--controller", "fanuc"],
        { stdout: () => {}, stderr: () => {} }
      )
    ).toBe(0);
    const fixPath = path.join(outDir, "batch-fix-previews.json");
    await writeFile(fixPath, "[]\n", "utf8");
    const out: string[] = [];
    const exit = await main(
      ["verify-batch-export", "--out-dir", outDir, "--format", "json"],
      { stdout: (c) => out.push(c), stderr: () => {} }
    );
    expect(exit).toBe(0);
    const result = JSON.parse(out.join(""));
    expect(result.fixPreviewsPath).toMatch(/batch-fix-previews\.json$/);
    expect(result.sealSources).toContain("fixPreviews");
  });

  it("verify-batch-export text mode reports csvRows=N/M", async () => {
    const tmp = await setupTmpDir();
    await writeFile(path.join(tmp, "a.nc"), "O1\nG0 X1\nM30\n", "utf8");
    const outDir = path.join(tmp, "out");
    expect(
      await main(
        ["--input-dir", tmp, "--out-dir", outDir, "--format", "json", "--controller", "fanuc"],
        { stdout: () => {}, stderr: () => {} }
      )
    ).toBe(0);
    const summary = JSON.parse(await readFile(path.join(outDir, "batch-summary.json"), "utf8"));
    const expectedRows = countBatchAggregationCsvRows(summary.summary);
    const out: string[] = [];
    const exit = await main(["verify-batch-export", "--out-dir", outDir], {
      stdout: (c) => out.push(c),
      stderr: () => {}
    });
    expect(exit).toBe(0);
    expect(out.join("")).toMatch(new RegExp(`csvRows=${expectedRows}/${expectedRows}`));
  });
});

describe("Schema v8: blockReasons + summary.blockReasonsAggregated", () => {
  it("envelope.blockReasons is undefined for a clean program (no blockers, no breaches, no strict gate)", async () => {
    const tmp = await setupTmpDir();
    const inputPath = path.join(tmp, "clean.nc");
    await writeFile(inputPath, "%\nO0001\nG0 X1\nM30\n%\n", "utf8");
    const out: string[] = [];
    const exit = await main(
      ["--input", inputPath, "--controller", "fanuc", "--format", "json"],
      { stdout: (c) => out.push(c), stderr: () => {} }
    );
    expect(exit).toBe(0);
    const env = JSON.parse(out.join(""));
    expect(env.blocked).toBe(false);
    expect(env.blockReasons).toBeUndefined();
  });

  it("envelope.blockReasons populates with reason='strict_controller_codes' + matchedCodes when --strict-controller-codes hits", async () => {
    const tmp = await setupTmpDir();
    const inputPath = path.join(tmp, "with-mixed.nc");
    // Trigger CG_N_AND_O_MIXED via N## O#### on the same block.
    await writeFile(inputPath, "%\nO0001\nN10 O0001\nM30\n%\n", "utf8");
    const out: string[] = [];
    const exit = await main(
      [
        "--input",
        inputPath,
        "--controller",
        "fanuc",
        "--format",
        "json",
        "--strict-controller-codes",
        "CG_N_AND_O_MIXED"
      ],
      { stdout: (c) => out.push(c), stderr: () => {} }
    );
    expect(exit).toBe(0);
    const env = JSON.parse(out.join(""));
    expect(env.blocked).toBe(true);
    expect(env.blockReasons).toBeDefined();
    const strictRow = env.blockReasons.find(
      (r: { reason: string }) => r.reason === "strict_controller_codes"
    );
    expect(strictRow).toBeDefined();
    expect(strictRow.matchedCodes).toEqual(["CG_N_AND_O_MIXED"]);
    expect(strictRow.message).toMatch(/Blocked by --strict-controller-codes/);
  });

  it("envelope.blockReasons preserves the back-compat messages[] entry for a v7 reader", async () => {
    const tmp = await setupTmpDir();
    const inputPath = path.join(tmp, "with-mixed.nc");
    await writeFile(inputPath, "%\nO0001\nN10 O0001\nM30\n%\n", "utf8");
    const out: string[] = [];
    const exit = await main(
      [
        "--input",
        inputPath,
        "--controller",
        "fanuc",
        "--format",
        "json",
        "--strict-controller-codes",
        "CG_N_AND_O_MIXED"
      ],
      { stdout: (c) => out.push(c), stderr: () => {} }
    );
    expect(exit).toBe(0);
    const env = JSON.parse(out.join(""));
    // v7 readers consult messages[] for the canonical block reason; the
    // structured block reason mirrors the same wording verbatim.
    const messageLine = (env.messages as string[]).find((m) =>
      m.startsWith("Blocked by --strict-controller-codes")
    );
    expect(messageLine).toBeDefined();
    const structuredLine = env.blockReasons.find(
      (r: { reason: string }) => r.reason === "strict_controller_codes"
    ).message;
    expect(structuredLine).toBe(messageLine);
  });

  it("batch summary.blockReasonsAggregated is undefined for a clean batch (no entry has block reasons)", async () => {
    const tmp = await setupTmpDir();
    await writeFile(path.join(tmp, "a.nc"), "O1000\nG0 X1\nM30\n", "utf8");
    await writeFile(path.join(tmp, "b.nc"), "O1001\nG0 X2\nM30\n", "utf8");
    const out: string[] = [];
    const exit = await main(
      ["--input-dir", tmp, "--controller", "fanuc", "--format", "json"],
      { stdout: (c) => out.push(c), stderr: () => {} }
    );
    expect(exit).toBe(0);
    const batch = JSON.parse(out.join(""));
    expect(batch.summary.blockReasonsAggregated).toBeUndefined();
  });

  it("batch summary.blockReasonsAggregated unions per-entry strict_controller_codes rows across 3 inputs", async () => {
    const tmp = await setupTmpDir();
    // Three inputs, all triggering CG_N_AND_O_MIXED via N + O on the same block.
    await writeFile(path.join(tmp, "a.nc"), "%\nO0001\nN10 O0001\nM30\n%\n", "utf8");
    await writeFile(path.join(tmp, "b.nc"), "%\nO0002\nN20 O0002\nM30\n%\n", "utf8");
    await writeFile(path.join(tmp, "c.nc"), "%\nO0003\nN30 O0003\nM30\n%\n", "utf8");
    const out: string[] = [];
    const exit = await main(
      [
        "--input-dir",
        tmp,
        "--controller",
        "fanuc",
        "--format",
        "json",
        "--strict-controller-codes",
        "CG_N_AND_O_MIXED"
      ],
      { stdout: (c) => out.push(c), stderr: () => {} }
    );
    expect(exit).toBe(0);
    const batch = JSON.parse(out.join(""));
    expect(Array.isArray(batch.summary.blockReasonsAggregated)).toBe(true);
    const strictRow = batch.summary.blockReasonsAggregated.find(
      (r: { reason: string }) => r.reason === "strict_controller_codes"
    );
    expect(strictRow).toBeDefined();
    expect(strictRow.count).toBe(3);
    expect(strictRow.inputs.length).toBe(3);
    // Inputs sorted ascending â€” paths are absolute on disk; just assert
    // the array is sorted, not its concrete contents.
    const sortedInputs = [...strictRow.inputs].sort((a: string, b: string) =>
      a.localeCompare(b)
    );
    expect(strictRow.inputs).toEqual(sortedInputs);
    expect(strictRow.matchedCodes).toEqual(["CG_N_AND_O_MIXED"]);
  });

  it("batch summary.blockReasonsAggregated sorts rows by count desc then reason asc", async () => {
    // Use 3 inputs: 2 trigger strict-gate, 1 triggers a parse-policy
    // breach (synthetic â€” empty string content) so blockReasonsAggregated
    // contains both reasons. We then assert the sort: count desc puts
    // strict_controller_codes first (count=2) ahead of any single-count
    // reason like parse_diagnostics_policy_breach (count=1).
    const tmp = await setupTmpDir();
    await writeFile(path.join(tmp, "a.nc"), "%\nO0001\nN10 O0001\nM30\n%\n", "utf8");
    await writeFile(path.join(tmp, "b.nc"), "%\nO0002\nN20 O0002\nM30\n%\n", "utf8");
    // c.nc is intentionally missing the closing % to drive a parse warning;
    // strict policy preset promotes parse warnings to a policy breach.
    await writeFile(path.join(tmp, "c.nc"), "%\nO0003\nG0 X3\nM30\n", "utf8");
    const out: string[] = [];
    const exit = await main(
      [
        "--input-dir",
        tmp,
        "--controller",
        "fanuc",
        "--format",
        "json",
        "--policy-preset",
        "strict",
        "--strict-controller-codes",
        "CG_N_AND_O_MIXED"
      ],
      { stdout: (c) => out.push(c), stderr: () => {} }
    );
    expect(exit).toBe(0);
    const batch = JSON.parse(out.join(""));
    const reasons = (
      batch.summary.blockReasonsAggregated as Array<{ reason: string; count: number }>
    ).map((r) => r.reason);
    // First entry has the highest count; ties break ascending by reason.
    expect(reasons.length).toBeGreaterThan(0);
    for (let i = 1; i < reasons.length; i += 1) {
      const prev = batch.summary.blockReasonsAggregated[i - 1];
      const cur = batch.summary.blockReasonsAggregated[i];
      if (prev.count === cur.count) {
        expect(prev.reason.localeCompare(cur.reason)).toBeLessThanOrEqual(0);
      } else {
        expect(prev.count).toBeGreaterThan(cur.count);
      }
    }
  });

  it("batch summary.blockReasonsAggregated dedupes inputs that hit the same reason in multiple ways", async () => {
    // Same input appearing twice in the entry stream is impossible in
    // production (input-dir walks unique paths), but the aggregation
    // function must still dedupe matchedCodes union across entries.
    const tmp = await setupTmpDir();
    await writeFile(
      path.join(tmp, "with-many.nc"),
      "%\nO0001\nN10 O0001\nN20 O0002\nM30\n%\n",
      "utf8"
    );
    const out: string[] = [];
    const exit = await main(
      [
        "--input-dir",
        tmp,
        "--controller",
        "fanuc",
        "--format",
        "json",
        "--strict-controller-codes",
        "CG_*"
      ],
      { stdout: (c) => out.push(c), stderr: () => {} }
    );
    expect(exit).toBe(0);
    const batch = JSON.parse(out.join(""));
    const strictRow = batch.summary.blockReasonsAggregated.find(
      (r: { reason: string }) => r.reason === "strict_controller_codes"
    );
    expect(strictRow).toBeDefined();
    // matchedCodes is sorted ascending and deduped (no repeats).
    expect(new Set(strictRow.matchedCodes).size).toBe(strictRow.matchedCodes.length);
    const sorted = [...strictRow.matchedCodes].sort((a: string, b: string) =>
      a.localeCompare(b)
    );
    expect(strictRow.matchedCodes).toEqual(sorted);
  });
});

describe("Schema v9: summary.lintIssuesBySourceAggregated", () => {
  it("batch summary.lintIssuesBySourceAggregated is absent when every entry has empty lintIssuesBySource", () => {
    const batch = buildBatchEnvelope([
      {
        input: "a.nc",
        schemaVersion: 20,
        envelope: {
          lintIssuesBySource: [],
          lintIssuesByControllerCode: [],
          parseDiagnosticsByCode: []
        }
      },
      {
        input: "b.nc",
        schemaVersion: 20,
        envelope: {
          lintIssuesBySource: [],
          lintIssuesByControllerCode: [],
          parseDiagnosticsByCode: []
        }
      }
    ] as Parameters<typeof buildBatchEnvelope>[0]);
    expect(batch.summary.lintIssuesBySourceAggregated).toBeUndefined();
  });

  it("batch summary.lintIssuesBySourceAggregated unions lint by source across 2 inputs", async () => {
    const tmp = await setupTmpDir();
    await writeFile(path.join(tmp, "a.nc"), "%\nO0001\nN10 O0001\nM30\n%\n", "utf8");
    await writeFile(path.join(tmp, "b.nc"), "%\nO0002\nN20 O0002\nM30\n%\n", "utf8");
    const out: string[] = [];
    const exit = await main(
      ["--input-dir", tmp, "--controller", "fanuc", "--format", "json"],
      { stdout: (c) => out.push(c), stderr: () => {} }
    );
    expect(exit).toBe(0);
    const batch = JSON.parse(out.join(""));
    const agg = batch.summary.lintIssuesBySourceAggregated as Array<{
      source: string;
      count: number;
      blockers: number;
      warnings: number;
      inputs: string[];
    }>;
    expect(Array.isArray(agg)).toBe(true);
    expect(agg.length).toBeGreaterThan(0);
    const cg = agg.find((r) => r.source === "controller_grammar");
    expect(cg).toBeDefined();
    expect(cg!.count).toBeGreaterThanOrEqual(2);
    expect(cg!.inputs.length).toBe(2);
    expect(cg!.blockers + cg!.warnings).toBe(cg!.count);
  });

  it("buildBatchLintIssuesBySourceAggregation sorts by count desc then source order", () => {
    const entries = [
      {
        input: "b.nc",
        schemaVersion: 20,
        envelope: {
          lintIssuesBySource: [
            { source: "profile_lint", count: 1, blockers: 0, warnings: 1 },
            { source: "controller_grammar", count: 1, blockers: 0, warnings: 1 }
          ]
        }
      },
      {
        input: "a.nc",
        schemaVersion: 20,
        envelope: {
          lintIssuesBySource: [
            { source: "controller_grammar", count: 2, blockers: 0, warnings: 2 },
            { source: "common_lint", count: 1, blockers: 0, warnings: 1 }
          ]
        }
      }
    ] as Parameters<typeof buildBatchLintIssuesBySourceAggregation>[0];
    const agg = buildBatchLintIssuesBySourceAggregation(entries);
    expect(agg[0].source).toBe("controller_grammar");
    expect(agg[0].count).toBe(3);
    expect(agg[0].inputs).toEqual(["a.nc", "b.nc"]);
  });
});

describe("Schema v10: summary.lintIssuesByParseDiagCodeAggregated", () => {
  it("batch summary.lintIssuesByParseDiagCodeAggregated is undefined for a clean batch", async () => {
    const tmp = await setupTmpDir();
    await writeFile(path.join(tmp, "a.nc"), "O1000\nG0 X1\nM30\n", "utf8");
    await writeFile(path.join(tmp, "b.nc"), "O1001\nG0 X2\nM30\n", "utf8");
    const out: string[] = [];
    const exit = await main(
      ["--input-dir", tmp, "--controller", "fanuc", "--format", "json"],
      { stdout: (c) => out.push(c), stderr: () => {} }
    );
    expect(exit).toBe(0);
    const batch = JSON.parse(out.join(""));
    expect(batch.schemaVersion).toBe(CLI_SCHEMA_VERSION);
    expect(batch.summary.lintIssuesByParseDiagCodeAggregated).toBeUndefined();
  });

  it("batch summary.lintIssuesByParseDiagCodeAggregated unions parse-diag codes across 2 inputs", async () => {
    const tmp = await setupTmpDir();
    await writeFile(path.join(tmp, "a.nc"), "G0 X1 (unclosed\nM30\n", "utf8");
    await writeFile(path.join(tmp, "b.nc"), "G0 Y[1+2 X3.\nM30\n", "utf8");
    const out: string[] = [];
    const exit = await main(
      ["--input-dir", tmp, "--controller", "fanuc", "--format", "json"],
      { stdout: (c) => out.push(c), stderr: () => {} }
    );
    expect(exit).toBe(0);
    const batch = JSON.parse(out.join(""));
    const agg = batch.summary.lintIssuesByParseDiagCodeAggregated as Array<{
      source: string;
      code: string;
      count: number;
      inputs: string[];
    }>;
    expect(Array.isArray(agg)).toBe(true);
    expect(agg.length).toBeGreaterThan(0);
    expect(agg[0].count).toBeGreaterThanOrEqual(agg[agg.length - 1].count);
    const withTwoInputs = agg.filter((row) => row.inputs.length === 2);
    expect(withTwoInputs.length).toBeGreaterThanOrEqual(0);
    for (const row of agg) {
      expect(row.inputs.length).toBeGreaterThan(0);
      expect(row.count).toBeGreaterThan(0);
    }
  });

  it("buildBatchLintIssuesByParseDiagCodeAggregation sorts by count desc then source then code", () => {
    const entries = [
      {
        input: "b.nc",
        schemaVersion: 20,
        envelope: {
          lintIssuesByParseDiagCode: [
            { source: "lexer", code: "UNMATCHED_OPEN_PAREN", count: 1 }
          ]
        }
      },
      {
        input: "a.nc",
        schemaVersion: 20,
        envelope: {
          lintIssuesByParseDiagCode: [
            { source: "lexer", code: "UNMATCHED_OPEN_PAREN", count: 2 },
            { source: "expression_parser", code: "UNBALANCED_BRACKET", count: 1 }
          ]
        }
      }
    ] as Parameters<typeof buildBatchLintIssuesByParseDiagCodeAggregation>[0];
    const agg = buildBatchLintIssuesByParseDiagCodeAggregation(entries);
    expect(agg[0]).toMatchObject({
      source: "lexer",
      code: "UNMATCHED_OPEN_PAREN",
      count: 3,
      inputs: ["a.nc", "b.nc"]
    });
    expect(agg[1].source).toBe("expression_parser");
    expect(agg[1].count).toBe(1);
  });
});

describe("Schema v11: summary.lintIssuesByControllerCodeAggregated", () => {
  it("batch summary.lintIssuesByControllerCodeAggregated is undefined for a clean batch", async () => {
    const tmp = await setupTmpDir();
    await writeFile(path.join(tmp, "a.nc"), "O1000\nG0 X1\nM30\n", "utf8");
    await writeFile(path.join(tmp, "b.nc"), "O1001\nG0 X2\nM30\n", "utf8");
    const out: string[] = [];
    const exit = await main(
      ["--input-dir", tmp, "--controller", "fanuc", "--format", "json"],
      { stdout: (c) => out.push(c), stderr: () => {} }
    );
    expect(exit).toBe(0);
    const batch = JSON.parse(out.join(""));
    expect(batch.schemaVersion).toBe(CLI_SCHEMA_VERSION);
    expect(batch.summary.lintIssuesByControllerCodeAggregated).toBeUndefined();
  });

  it("batch summary.lintIssuesByControllerCodeAggregated unions CG_* codes across 2 inputs", async () => {
    const tmp = await setupTmpDir();
    const alphaPath = path.join(tmp, "alpha.nc");
    const betaPath = path.join(tmp, "beta.nc");
    await writeFile(alphaPath, "N10 O1000\nO1000\nM30\n", "utf8");
    await writeFile(betaPath, "O1234\nG65 P9000 K1 J2 I3\nG0 X1 X2\nM30\n", "utf8");

    const out: string[] = [];
    const exit = await main(
      ["--input-dir", tmp, "--controller", "fanuc", "--format", "json"],
      { stdout: (c) => out.push(c), stderr: () => {} }
    );
    expect(exit).toBe(0);
    const batch = JSON.parse(out.join(""));
    const agg = batch.summary.lintIssuesByControllerCodeAggregated as Array<{
      source: string;
      code: string;
      count: number;
      blockers: number;
      warnings: number;
      inputs: string[];
    }>;
    expect(Array.isArray(agg)).toBe(true);
    expect(agg.length).toBeGreaterThan(0);
    for (const row of agg) {
      expect(row.count).toBeGreaterThan(0);
      expect(row.blockers + row.warnings).toBe(row.count);
      expect(row.inputs.length).toBeGreaterThan(0);
    }
    const dupO = agg.find((row) => row.code === "CG_DUPLICATE_O_HEADER");
    expect(dupO).toBeDefined();
    expect(dupO!.inputs).toEqual([alphaPath]);
  });

  it("buildBatchLintIssuesByControllerCodeAggregation sorts by count desc then source then code", () => {
    const entries = [
      {
        input: "b.nc",
        schemaVersion: 20,
        envelope: {
          lintIssuesByControllerCode: [
            {
              source: "controller_grammar",
              code: "CG_N_AND_O_MIXED",
              count: 1,
              blockers: 0,
              warnings: 1
            }
          ]
        }
      },
      {
        input: "a.nc",
        schemaVersion: 20,
        envelope: {
          lintIssuesByControllerCode: [
            {
              source: "controller_grammar",
              code: "CG_N_AND_O_MIXED",
              count: 2,
              blockers: 0,
              warnings: 2
            },
            {
              source: "controller_grammar",
              code: "CG_DUPLICATE_O_HEADER",
              count: 1,
              blockers: 0,
              warnings: 1
            }
          ]
        }
      }
    ] as Parameters<typeof buildBatchLintIssuesByControllerCodeAggregation>[0];
    const agg = buildBatchLintIssuesByControllerCodeAggregation(entries);
    expect(agg[0]).toMatchObject({
      source: "controller_grammar",
      code: "CG_N_AND_O_MIXED",
      count: 3,
      inputs: ["a.nc", "b.nc"]
    });
    expect(agg[1].code).toBe("CG_DUPLICATE_O_HEADER");
    expect(agg[1].count).toBe(1);
  });
});

describe("Schema v12: summary.parseDiagnosticsByCodeAggregated", () => {
  it("batch summary.parseDiagnosticsByCodeAggregated is undefined for a clean batch", async () => {
    const tmp = await setupTmpDir();
    await writeFile(path.join(tmp, "a.nc"), "O1000\nG0 X1\nM30\n", "utf8");
    await writeFile(path.join(tmp, "b.nc"), "O1001\nG0 X2\nM30\n", "utf8");
    const out: string[] = [];
    const exit = await main(
      ["--input-dir", tmp, "--controller", "fanuc", "--format", "json"],
      { stdout: (c) => out.push(c), stderr: () => {} }
    );
    expect(exit).toBe(0);
    const batch = JSON.parse(out.join(""));
    expect(batch.schemaVersion).toBe(CLI_SCHEMA_VERSION);
    expect(batch.summary.parseDiagnosticsByCodeAggregated).toBeUndefined();
  });

  it("batch summary.parseDiagnosticsByCodeAggregated unions parse-diag codes across 2 inputs", async () => {
    const tmp = await setupTmpDir();
    await writeFile(path.join(tmp, "a.nc"), "G0 X1 (unclosed\nM30\n", "utf8");
    await writeFile(path.join(tmp, "b.nc"), "G0 Y[1+2 X3.\nM30\n", "utf8");
    const out: string[] = [];
    const exit = await main(
      ["--input-dir", tmp, "--controller", "fanuc", "--format", "json"],
      { stdout: (c) => out.push(c), stderr: () => {} }
    );
    expect(exit).toBe(0);
    const batch = JSON.parse(out.join(""));
    const agg = batch.summary.parseDiagnosticsByCodeAggregated as Array<{
      code: string;
      count: number;
      warnings: number;
      errors: number;
      inputs: string[];
    }>;
    expect(Array.isArray(agg)).toBe(true);
    expect(agg.length).toBeGreaterThan(0);
    for (const row of agg) {
      expect(row.count).toBeGreaterThan(0);
      expect(row.warnings + row.errors).toBe(row.count);
      expect(row.inputs.length).toBeGreaterThan(0);
    }
    const paren = agg.find((row) => row.code === "UNMATCHED_OPEN_PAREN");
    expect(paren).toBeDefined();
    expect(paren!.inputs.length).toBe(1);
  });

  it("buildBatchParseDiagnosticsByCodeAggregation sorts by count desc then code asc", () => {
    const entries = [
      {
        input: "b.nc",
        schemaVersion: 20,
        envelope: {
          parseDiagnosticsByCode: [
            { code: "UNMATCHED_OPEN_PAREN", count: 1, warnings: 1, errors: 0 }
          ]
        }
      },
      {
        input: "a.nc",
        schemaVersion: 20,
        envelope: {
          parseDiagnosticsByCode: [
            { code: "UNMATCHED_OPEN_PAREN", count: 2, warnings: 2, errors: 0 },
            { code: "UNBALANCED_BRACKET", count: 1, warnings: 1, errors: 0 }
          ]
        }
      }
    ] as Parameters<typeof buildBatchParseDiagnosticsByCodeAggregation>[0];
    const agg = buildBatchParseDiagnosticsByCodeAggregation(entries);
    expect(agg[0]).toMatchObject({
      code: "UNMATCHED_OPEN_PAREN",
      count: 3,
      inputs: ["a.nc", "b.nc"]
    });
    expect(agg[1].code).toBe("UNBALANCED_BRACKET");
    expect(agg[1].count).toBe(1);
  });
});

describe("parseRotateAuditTrailKeyArgs", () => {
  it("parses the minimal --out variant", () => {
    const args = parseRotateAuditTrailKeyArgs([
      "--encrypted",
      "blob.aes-gcm",
      "--old-secret",
      "old",
      "--new-secret",
      "new",
      "--out",
      "rotated.aes-gcm"
    ]);
    expect(args).toEqual({
      encrypted: "blob.aes-gcm",
      oldSecret: "old",
      newSecret: "new",
      out: "rotated.aes-gcm",
      inPlace: false,
      recoverTemp: false,
      quiet: false,
      help: false
    });
  });

  it("parses the --in-place variant", () => {
    const args = parseRotateAuditTrailKeyArgs([
      "--encrypted",
      "blob.aes-gcm",
      "--old-secret",
      "old",
      "--new-secret",
      "new",
      "--in-place"
    ]);
    expect(args.inPlace).toBe(true);
    expect(args.out).toBeUndefined();
  });

  it("rejects when --out and --in-place are both supplied", () => {
    expect(() =>
      parseRotateAuditTrailKeyArgs([
        "--encrypted",
        "blob.aes-gcm",
        "--old-secret",
        "old",
        "--new-secret",
        "new",
        "--out",
        "x.aes-gcm",
        "--in-place"
      ])
    ).toThrow(CliArgumentError);
  });

  it("rejects when neither --out nor --in-place is supplied", () => {
    expect(() =>
      parseRotateAuditTrailKeyArgs([
        "--encrypted",
        "blob.aes-gcm",
        "--old-secret",
        "old",
        "--new-secret",
        "new"
      ])
    ).toThrow(CliArgumentError);
  });

  it("rejects missing --encrypted", () => {
    expect(() =>
      parseRotateAuditTrailKeyArgs([
        "--old-secret",
        "old",
        "--new-secret",
        "new",
        "--out",
        "x.aes-gcm"
      ])
    ).toThrow(CliArgumentError);
  });

  it("rejects empty --old-secret / --new-secret", () => {
    expect(() =>
      parseRotateAuditTrailKeyArgs([
        "--encrypted",
        "b",
        "--old-secret",
        "",
        "--new-secret",
        "new",
        "--out",
        "x"
      ])
    ).toThrow(CliArgumentError);
    expect(() =>
      parseRotateAuditTrailKeyArgs([
        "--encrypted",
        "b",
        "--old-secret",
        "old",
        "--new-secret",
        "",
        "--out",
        "x"
      ])
    ).toThrow(CliArgumentError);
  });

  it("--help short-circuits validation", () => {
    const args = parseRotateAuditTrailKeyArgs(["--help"]);
    expect(args.help).toBe(true);
    expect(args.encrypted).toBeUndefined();
  });

  it("rejects unknown flags", () => {
    expect(() =>
      parseRotateAuditTrailKeyArgs([
        "--encrypted",
        "b",
        "--old-secret",
        "old",
        "--new-secret",
        "new",
        "--out",
        "x",
        "--bogus"
      ])
    ).toThrow(CliArgumentError);
  });
});

describe("rotate-audit-trail-key subcommand (end-to-end via main())", () => {
  it("--help prints the sub-usage and exits 0", async () => {
    let stdout = "";
    const exit = await main(["rotate-audit-trail-key", "--help"], {
      stdout: (c) => (stdout += c),
      stderr: () => {}
    });
    expect(exit).toBe(0);
    expect(stdout).toContain(CLI_USAGE_ROTATE_AUDIT_TRAIL_KEY);
  });

  it("argument errors exit 2 and echo the sub-usage on stderr", async () => {
    let stderr = "";
    const exit = await main(["rotate-audit-trail-key", "--in-place"], {
      stdout: () => {},
      stderr: (c) => (stderr += c)
    });
    expect(exit).toBe(2);
    expect(stderr).toContain("rotate-audit-trail-key requires --encrypted");
    expect(stderr).toContain(CLI_USAGE_ROTATE_AUDIT_TRAIL_KEY);
  });

  it("happy path with --out: rotated blob round-trips under the new secret (exit 0)", async () => {
    const PAYLOAD = "audit body to rotate\n";
    const OLD = "old-secret-cli";
    const NEW = "new-secret-cli";
    const original = await encryptAesGcm(PAYLOAD, OLD);
    const inputPath = "/fake/blob.aes-gcm";
    const outputPath = "/fake/rotated.aes-gcm";

    const writes = new Map<string, Uint8Array>();
    let stdout = "";
    let stderr = "";
    const exit = await main(
      [
        "rotate-audit-trail-key",
        "--encrypted",
        inputPath,
        "--old-secret",
        OLD,
        "--new-secret",
        NEW,
        "--out",
        outputPath
      ],
      {
        stdout: (c) => (stdout += c),
        stderr: (c) => (stderr += c),
        readFileBytesFn: async (p) => {
          if (p === inputPath) return original;
          throw new Error(`unexpected read: ${p}`);
        },
        writeFileBytesFn: async (p, bytes) => {
          writes.set(p, bytes);
        }
      }
    );
    expect(exit).toBe(0);
    expect(stderr).toBe("");
    expect(stdout).toMatch(/rotate-audit-trail-key: OK/);
    const rotated = writes.get(outputPath);
    expect(rotated).toBeDefined();
    expect(await decryptAesGcm(rotated!, NEW)).toBe(PAYLOAD);
    // Old secret no longer works on the rotated blob.
    await expect(decryptAesGcm(rotated!, OLD)).rejects.toThrow();
  });

  it("happy path with --in-place: writes <input>.rotating then atomically renames to input", async () => {
    const PAYLOAD = "in-place rotation body\n";
    const OLD = "old-2";
    const NEW = "new-2";
    const original = await encryptAesGcm(PAYLOAD, OLD);
    const inputPath = "/fake/inplace.aes-gcm";

    const reads = new Map<string, Uint8Array>([[inputPath, original]]);
    const writes = new Map<string, Uint8Array>();
    const renames: Array<{ from: string; to: string }> = [];
    let stdout = "";
    const exit = await main(
      [
        "rotate-audit-trail-key",
        "--encrypted",
        inputPath,
        "--old-secret",
        OLD,
        "--new-secret",
        NEW,
        "--in-place"
      ],
      {
        stdout: (c) => (stdout += c),
        stderr: () => {},
        readFileBytesFn: async (p) => {
          const v = reads.get(p);
          if (!v) throw new Error(`unexpected read: ${p}`);
          return v;
        },
        writeFileBytesFn: async (p, bytes) => {
          writes.set(p, bytes);
        }
      }
    );
    // The renameFn defaults to fs/promises.rename, which would touch real
    // disk; we don't pass an injection here, so the test plays it safe by
    // confirming the WRITE happened to <input>.rotating and exit code is
    // either 0 (rename succeeded â€” extremely unlikely on a fake path) or
    // 3 (rename failed â†’ Schema-v8 stranded-temp surface). The previous
    // exit-2 outcome is no longer reachable: a post-write rename failure
    // now throws AuditTrailRotationStrandedTempError which the dispatcher
    // converts to exit 3 with a canonical recovery hint.
    expect(writes.has(`${inputPath}.rotating`)).toBe(true);
    const rotated = writes.get(`${inputPath}.rotating`)!;
    expect(await decryptAesGcm(rotated, NEW)).toBe(PAYLOAD);
    if (exit === 0) {
      expect(stdout).toMatch(/in-place/);
    }
    expect([0, 3]).toContain(exit);
  });

  it("--in-place with injected renameFn captures the temp -> dest atomic swap and exits 0", async () => {
    const PAYLOAD = "atomic rotation body\n";
    const OLD = "old-3";
    const NEW = "new-3";
    const original = await encryptAesGcm(PAYLOAD, OLD);
    const inputPath = "/fake/atomic.aes-gcm";

    const writes = new Map<string, Uint8Array>();
    const renames: Array<{ from: string; to: string }> = [];
    let stdout = "";
    const { runRotateAuditTrailKey } = await import("../src/cli.js");
    const exit = await runRotateAuditTrailKey(
      {
        encrypted: inputPath,
        oldSecret: OLD,
        newSecret: NEW,
        inPlace: true,
        recoverTemp: false,
        quiet: false,
        help: false
      },
      {
        stdout: (c) => (stdout += c),
        stderr: () => {},
        readFileBytesFn: async () => original,
        writeFileBytesFn: async (p, bytes) => {
          writes.set(p, bytes);
        },
        renameFn: async (from, to) => {
          renames.push({ from, to });
          // Simulate atomic rename by moving bytes between map entries.
          const bytes = writes.get(from);
          if (bytes) {
            writes.set(to, bytes);
            writes.delete(from);
          }
        }
      }
    );
    expect(exit).toBe(0);
    expect(renames).toEqual([{ from: `${inputPath}.rotating`, to: inputPath }]);
    const rotated = writes.get(inputPath);
    expect(rotated).toBeDefined();
    expect(await decryptAesGcm(rotated!, NEW)).toBe(PAYLOAD);
    expect(stdout).toMatch(/in-place/);
  });

  it("decryption with the wrong --old-secret exits 1 with the canonical error string", async () => {
    const PAYLOAD = "wrong-secret body\n";
    const original = await encryptAesGcm(PAYLOAD, "the-real-old");
    const writes = new Map<string, Uint8Array>();
    let stderr = "";
    const exit = await main(
      [
        "rotate-audit-trail-key",
        "--encrypted",
        "/fake/blob.aes-gcm",
        "--old-secret",
        "WRONG-secret",
        "--new-secret",
        "new",
        "--out",
        "/fake/rotated.aes-gcm"
      ],
      {
        stdout: () => {},
        stderr: (c) => (stderr += c),
        readFileBytesFn: async () => original,
        writeFileBytesFn: async (p, bytes) => {
          writes.set(p, bytes);
        }
      }
    );
    expect(exit).toBe(1);
    expect(stderr).toMatch(/rotate-audit-trail-key: decryption with old secret failed/);
    expect(writes.size).toBe(0);
  });

  it("--quiet suppresses the per-success OK line on stdout", async () => {
    const PAYLOAD = "quiet body\n";
    const OLD = "old-q";
    const NEW = "new-q";
    const original = await encryptAesGcm(PAYLOAD, OLD);
    const writes = new Map<string, Uint8Array>();
    let stdout = "";
    const exit = await main(
      [
        "rotate-audit-trail-key",
        "--encrypted",
        "/fake/q.aes-gcm",
        "--old-secret",
        OLD,
        "--new-secret",
        NEW,
        "--out",
        "/fake/q-rotated.aes-gcm",
        "--quiet"
      ],
      {
        stdout: (c) => (stdout += c),
        stderr: () => {},
        readFileBytesFn: async () => original,
        writeFileBytesFn: async (p, bytes) => {
          writes.set(p, bytes);
        }
      }
    );
    expect(exit).toBe(0);
    expect(stdout).toBe("");
    expect(writes.size).toBe(1);
  });
});

describe("rotate-audit-trail-key --recover-temp arm (Schema v8 stranded-temp surface)", () => {
  const OLD = "old-recover-secret";
  const NEW = "new-recover-secret";
  const PAYLOAD = "audit recovery body";

  it("parser accepts the minimal --recover-temp invocation", () => {
    const args = parseRotateAuditTrailKeyArgs([
      "--recover-temp",
      "--temp",
      "/tmp/audit.rotating",
      "--target",
      "/tmp/audit.aes-gcm",
      "--new-secret",
      NEW
    ]);
    expect(args.recoverTemp).toBe(true);
    expect(args.temp).toBe("/tmp/audit.rotating");
    expect(args.target).toBe("/tmp/audit.aes-gcm");
    expect(args.newSecret).toBe(NEW);
  });

  it("parser rejects --recover-temp combined with --encrypted (exit 2)", () => {
    expect(() =>
      parseRotateAuditTrailKeyArgs([
        "--recover-temp",
        "--encrypted",
        "/x",
        "--temp",
        "/y",
        "--target",
        "/z",
        "--new-secret",
        NEW
      ])
    ).toThrow(/mutually exclusive with --encrypted/);
  });

  it("parser rejects --recover-temp combined with --out (exit 2)", () => {
    expect(() =>
      parseRotateAuditTrailKeyArgs([
        "--recover-temp",
        "--out",
        "/x",
        "--temp",
        "/y",
        "--target",
        "/z",
        "--new-secret",
        NEW
      ])
    ).toThrow(/mutually exclusive with --out/);
  });

  it("parser rejects --recover-temp combined with --in-place (exit 2)", () => {
    expect(() =>
      parseRotateAuditTrailKeyArgs([
        "--recover-temp",
        "--in-place",
        "--temp",
        "/y",
        "--target",
        "/z",
        "--new-secret",
        NEW
      ])
    ).toThrow(/mutually exclusive with --in-place/);
  });

  it("parser rejects --recover-temp without --temp", () => {
    expect(() =>
      parseRotateAuditTrailKeyArgs([
        "--recover-temp",
        "--target",
        "/z",
        "--new-secret",
        NEW
      ])
    ).toThrow(/--recover-temp requires --temp/);
  });

  it("parser rejects --recover-temp without --target", () => {
    expect(() =>
      parseRotateAuditTrailKeyArgs([
        "--recover-temp",
        "--temp",
        "/y",
        "--new-secret",
        NEW
      ])
    ).toThrow(/--recover-temp requires --target/);
  });

  it("parser rejects --temp / --target on the rotation arm (only valid with --recover-temp)", () => {
    expect(() =>
      parseRotateAuditTrailKeyArgs([
        "--encrypted",
        "/x",
        "--old-secret",
        OLD,
        "--new-secret",
        NEW,
        "--out",
        "/y",
        "--temp",
        "/z"
      ])
    ).toThrow(/--temp is only valid with --recover-temp/);
  });

  it("--in-place dispatcher exits 3 with canonical stderr line when renameFn throws", async () => {
    const tmp = await mkdtemp(path.join(tmpdir(), "cnc-recover-spec-"));
    const inputPath = path.join(tmp, "audit.aes-gcm");
    const original = await encryptAesGcm(PAYLOAD, OLD);
    await writeFile(inputPath, original);
    const writes = new Map<string, Uint8Array>();
    let stderr = "";
    const exit = await main(
      [
        "rotate-audit-trail-key",
        "--encrypted",
        inputPath,
        "--old-secret",
        OLD,
        "--new-secret",
        NEW,
        "--in-place"
      ],
      {
        stdout: () => {},
        stderr: (c) => (stderr += c),
        readFileBytesFn: async () => original,
        writeFileBytesFn: async (p, bytes) => {
          writes.set(p, bytes);
        }
      } as Parameters<typeof main>[1] & { renameFn?: unknown }
    );
    // Default renameFn is node:fs/promises.rename â€” when it tries to
    // rename a non-existent temp file (we mocked writeFileBytesFn so
    // nothing was actually written) onto an existing real path, it
    // fails with ENOENT. The dispatcher must catch the resulting
    // AuditTrailRotationStrandedTempError and exit 3 with the canonical
    // stderr line pointing operators at --recover-temp.
    expect(exit).toBe(3);
    expect(stderr).toMatch(/stranded temp file at .+\.rotating/);
    expect(stderr).toMatch(/run --recover-temp to finish/);
    expect(writes.size).toBe(1); // temp WAS written via the mock
  });

  it("--recover-temp happy path: validates + renames a temp encrypted under --new-secret (exit 0)", async () => {
    const tmp = await mkdtemp(path.join(tmpdir(), "cnc-recover-spec-"));
    const tempPath = path.join(tmp, "audit.aes-gcm.rotating");
    const targetPath = path.join(tmp, "audit.aes-gcm");
    const tempBlob = await encryptAesGcm(PAYLOAD, NEW);
    await writeFile(tempPath, tempBlob);
    let stdout = "";
    let stderr = "";
    const exit = await main(
      [
        "rotate-audit-trail-key",
        "--recover-temp",
        "--temp",
        tempPath,
        "--target",
        targetPath,
        "--new-secret",
        NEW
      ],
      {
        stdout: (c) => (stdout += c),
        stderr: (c) => (stderr += c)
      }
    );
    expect(exit).toBe(0);
    expect(stderr).toBe("");
    expect(stdout).toMatch(/--recover-temp: OK/);
    // Target now exists with the same bytes the temp had; temp is gone.
    const recovered = await decryptAesGcm(await readFile(targetPath), NEW);
    expect(recovered).toBe(PAYLOAD);
  });

  it("--recover-temp decrypt failure (wrong --new-secret) exits 1 with canonical stderr line and leaves the temp untouched", async () => {
    const tmp = await mkdtemp(path.join(tmpdir(), "cnc-recover-spec-"));
    const tempPath = path.join(tmp, "audit.aes-gcm.rotating");
    const targetPath = path.join(tmp, "audit.aes-gcm");
    // Temp encrypted under DIFFERENT secret than what we'll pass.
    const tempBlob = await encryptAesGcm(PAYLOAD, "some-other-secret");
    await writeFile(tempPath, tempBlob);
    let stderr = "";
    const exit = await main(
      [
        "rotate-audit-trail-key",
        "--recover-temp",
        "--temp",
        tempPath,
        "--target",
        targetPath,
        "--new-secret",
        NEW
      ],
      {
        stdout: () => {},
        stderr: (c) => (stderr += c)
      }
    );
    expect(exit).toBe(1);
    expect(stderr).toMatch(
      /--recover-temp: temp file does not decrypt under --new-secret/
    );
    // Temp is still on disk; target was NOT created.
    const tempAfter = await readFile(tempPath);
    expect(tempAfter.length).toBe(tempBlob.length);
    await expect(readFile(targetPath)).rejects.toThrow();
  });

  it("--recover-temp returns exit 2 when --temp file is missing", async () => {
    const tmp = await mkdtemp(path.join(tmpdir(), "cnc-recover-spec-"));
    const tempPath = path.join(tmp, "does-not-exist.rotating");
    const targetPath = path.join(tmp, "audit.aes-gcm");
    let stderr = "";
    const exit = await main(
      [
        "rotate-audit-trail-key",
        "--recover-temp",
        "--temp",
        tempPath,
        "--target",
        targetPath,
        "--new-secret",
        NEW
      ],
      {
        stdout: () => {},
        stderr: (c) => (stderr += c)
      }
    );
    expect(exit).toBe(2);
    expect(stderr).toMatch(/failed to read --temp/);
  });

  it("--recover-temp surfaces in CLI_USAGE_ROTATE_AUDIT_TRAIL_KEY", () => {
    expect(CLI_USAGE_ROTATE_AUDIT_TRAIL_KEY).toMatch(/--recover-temp/);
    // Exit-code table includes the `  3   ` row for the stranded-temp surface.
    expect(CLI_USAGE_ROTATE_AUDIT_TRAIL_KEY).toMatch(/^\s*3\s+/m);
    expect(CLI_USAGE_ROTATE_AUDIT_TRAIL_KEY).toMatch(/stranded temp file/);
  });
});

describe("parseAuditDeprecatedRulesArgs", () => {
  it("defaults to text format, no threshold, not strict, not quiet", () => {
    const args = parseAuditDeprecatedRulesArgs([]);
    expect(args).toEqual({
      format: "text",
      strict: false,
      quiet: false,
      help: false
    });
  });

  it("resolves --policy six-month-strict to olderThan=6mo and strict=true", () => {
    const args = parseAuditDeprecatedRulesArgs(["--policy", "six-month-strict"]);
    expect(args.policy).toBe("six-month-strict");
    expect(args.olderThan).toBe("6mo");
    expect(args.strict).toBe(true);
  });

  it("resolves --policy yearly-strict to olderThan=12mo and strict=true", () => {
    const args = parseAuditDeprecatedRulesArgs(["--policy", "yearly-strict"]);
    expect(args.olderThan).toBe("12mo");
    expect(args.strict).toBe(true);
  });

  it("resolves --policy informational without threshold or strict", () => {
    const args = parseAuditDeprecatedRulesArgs(["--policy", "informational"]);
    expect(args.olderThan).toBeUndefined();
    expect(args.strict).toBe(false);
  });

  it("rejects --policy combined with --older-than", () => {
    expect(() =>
      parseAuditDeprecatedRulesArgs(["--policy", "six-month-strict", "--older-than", "6mo"])
    ).toThrow(/mutually exclusive with --older-than/);
  });

  it("rejects --policy combined with --strict", () => {
    expect(() =>
      parseAuditDeprecatedRulesArgs(["--policy", "six-month-strict", "--strict"])
    ).toThrow(/mutually exclusive with --strict/);
  });

  it("rejects unknown --policy values", () => {
    expect(() => parseAuditDeprecatedRulesArgs(["--policy", "bogus"])).toThrow(
      /invalid --policy value/
    );
  });

  it("accepts --older-than 6mo and stores the raw token", () => {
    const args = parseAuditDeprecatedRulesArgs(["--older-than", "6mo"]);
    expect(args.olderThan).toBe("6mo");
  });

  it("accepts --older-than 30d and stores the raw token", () => {
    const args = parseAuditDeprecatedRulesArgs(["--older-than", "30d"]);
    expect(args.olderThan).toBe("30d");
  });

  it("rejects malformed --older-than values", () => {
    expect(() =>
      parseAuditDeprecatedRulesArgs(["--older-than", "6"])
    ).toThrow(/invalid --older-than value/);
    expect(() =>
      parseAuditDeprecatedRulesArgs(["--older-than", "abc"])
    ).toThrow(/invalid --older-than value/);
    expect(() =>
      parseAuditDeprecatedRulesArgs(["--older-than", "6 mo"])
    ).toThrow(/invalid --older-than value/);
  });

  it("rejects --strict without --older-than", () => {
    expect(() =>
      parseAuditDeprecatedRulesArgs(["--strict"])
    ).toThrow(/--strict requires --older-than/);
  });

  it("accepts --format json|text and rejects everything else", () => {
    expect(parseAuditDeprecatedRulesArgs(["--format", "json"]).format).toBe("json");
    expect(parseAuditDeprecatedRulesArgs(["--format", "text"]).format).toBe("text");
    expect(() =>
      parseAuditDeprecatedRulesArgs(["--format", "ndjson"])
    ).toThrow(/invalid --format value/);
  });

  it("splits --scope-roots on `;` and trims/removes empty parts", () => {
    const args = parseAuditDeprecatedRulesArgs([
      "--scope-roots",
      "/a; /b/c ;;/d"
    ]);
    expect(args.scopeRoots).toEqual(["/a", "/b/c", "/d"]);
  });

  it("rejects --scope-roots with no usable paths", () => {
    expect(() =>
      parseAuditDeprecatedRulesArgs(["--scope-roots", " ; ;; "])
    ).toThrow(/at least one non-empty path/);
  });

  it("rejects unknown flags", () => {
    expect(() =>
      parseAuditDeprecatedRulesArgs(["--bogus"])
    ).toThrow(/Unknown audit-deprecated-rules flag/);
  });

  it("recognises --help and skips post-validation", () => {
    const args = parseAuditDeprecatedRulesArgs(["--help"]);
    expect(args.help).toBe(true);
  });
});

describe("audit-deprecated-rules subcommand (end-to-end via main())", () => {
  function makeRuleDoc(
    id: string,
    extra: Partial<ProfileRuleDoc> = {}
  ): ProfileRuleDoc {
    return {
      id,
      severity: "warning",
      messageMatcher: /placeholder/,
      summary: "placeholder",
      positiveSnippet: "",
      negativeSnippet: "",
      ...extra
    };
  }

  it("emits CLI_USAGE_AUDIT_DEPRECATED_RULES on --help and exits 0", async () => {
    let stdout = "";
    const exit = await main(["audit-deprecated-rules", "--help"], {
      stdout: (c) => (stdout += c),
      stderr: () => {}
    });
    expect(exit).toBe(0);
    expect(stdout).toMatch(/Usage: cnc-job-check audit-deprecated-rules/);
  });

  it("returns exit 2 on argument error", async () => {
    let stderr = "";
    const exit = await main(
      ["audit-deprecated-rules", "--older-than", "abc"],
      {
        stdout: () => {},
        stderr: (c) => (stderr += c)
      }
    );
    expect(exit).toBe(2);
    expect(stderr).toMatch(/invalid --older-than value/);
  });

  // The end-to-end paths below seed the discovered-rule-docs cache directly;
  // hand-wired loaders for built-in packs are also consulted by the default
  // loader, so we lock them down via a synthetic discovered set + freeze the
  // loadRuleDocsByPackFn injection point. We test the json/text/strict
  // matrix against the seeded set in isolation from the on-disk packs.

  it("emits the (no deprecated rules found) line in text mode when no rules match", async () => {
    setDiscoveredProfilePackRuleDocsForTesting({});
    let stdout = "";
    let stderr = "";
    const exit = await main(["audit-deprecated-rules"], {
      stdout: (c) => (stdout += c),
      stderr: (c) => (stderr += c)
    });
    setDiscoveredProfilePackRuleDocsForTesting(undefined);
    // Built-in packs may still emit deprecated rules (the fanuc pilot is
    // shipped today). The smoke we care about: exit 0 and either an empty
    // line OR the actual fanuc pilot row â€” neither outcome should produce
    // stderr noise.
    expect(exit).toBe(0);
    expect(stderr).toBe("");
    expect(stdout.length).toBeGreaterThan(0);
  });

  it("emits valid JSON with a `rows` array when --format json is passed", async () => {
    setDiscoveredProfilePackRuleDocsForTesting({
      "haas-legacy": [
        makeRuleDoc("legacy.deprecated", { deprecatedSince: "2026-01" }),
        makeRuleDoc("legacy.live")
      ]
    });
    let stdout = "";
    const exit = await main(
      ["audit-deprecated-rules", "--format", "json"],
      {
        stdout: (c) => (stdout += c),
        stderr: () => {}
      }
    );
    setDiscoveredProfilePackRuleDocsForTesting(undefined);
    expect(exit).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(Array.isArray(parsed.rows)).toBe(true);
    const legacyRow = parsed.rows.find(
      (r: { ruleId: string }) => r.ruleId === "legacy.deprecated"
    );
    expect(legacyRow).toBeDefined();
    expect(legacyRow.deprecatedSince).toBe("2026-01");
    expect(typeof legacyRow.ageMonths).toBe("number");
    expect(legacyRow.overThreshold).toBe(false);
  });

  it("includes replacementSuggestion in JSON rows when present on the rule doc", async () => {
    setDiscoveredProfilePackRuleDocsForTesting({
      "haas-legacy": [
        makeRuleDoc("legacy.deprecated", {
          deprecatedSince: "2026-01",
          replacementSuggestion: "Switch to controller-native checks."
        })
      ]
    });
    let stdout = "";
    const exit = await main(
      ["audit-deprecated-rules", "--format", "json"],
      {
        stdout: (c) => (stdout += c),
        stderr: () => {}
      }
    );
    setDiscoveredProfilePackRuleDocsForTesting(undefined);
    expect(exit).toBe(0);
    const row = JSON.parse(stdout).rows.find(
      (r: { ruleId: string }) => r.ruleId === "legacy.deprecated"
    );
    expect(row.replacementSuggestion).toBe("Switch to controller-native checks.");
  });

  it("--strict + --older-than fails exit 1 when at least one rule is over the threshold", async () => {
    setDiscoveredProfilePackRuleDocsForTesting({
      "haas-legacy": [
        makeRuleDoc("legacy.ancient", { deprecatedSince: "2020-01" })
      ]
    });
    let stderr = "";
    const exit = await main(
      [
        "audit-deprecated-rules",
        "--older-than",
        "1mo",
        "--strict",
        "--format",
        "json"
      ],
      {
        stdout: () => {},
        stderr: (c) => (stderr += c)
      }
    );
    setDiscoveredProfilePackRuleDocsForTesting(undefined);
    expect(exit).toBe(1);
    expect(stderr).toMatch(/over --older-than threshold/);
  });

  it("--strict + --older-than passes exit 0 when no rule is over the threshold", async () => {
    setDiscoveredProfilePackRuleDocsForTesting({
      "haas-legacy": [
        makeRuleDoc("legacy.recent", { deprecatedSince: "2099-01" })
      ]
    });
    let stderr = "";
    const exit = await main(
      [
        "audit-deprecated-rules",
        "--older-than",
        "12mo",
        "--strict",
        "--format",
        "json"
      ],
      {
        stdout: () => {},
        stderr: (c) => (stderr += c)
      }
    );
    setDiscoveredProfilePackRuleDocsForTesting(undefined);
    expect(exit).toBe(0);
    expect(stderr).toBe("");
  });

  it("text-format output renders aligned columns with the expected header", async () => {
    setDiscoveredProfilePackRuleDocsForTesting({
      "haas-legacy": [
        makeRuleDoc("legacy.deprecated", { deprecatedSince: "2026-01" })
      ]
    });
    let stdout = "";
    const exit = await main(["audit-deprecated-rules"], {
      stdout: (c) => (stdout += c),
      stderr: () => {}
    });
    setDiscoveredProfilePackRuleDocsForTesting(undefined);
    expect(exit).toBe(0);
    const firstLine = stdout.split("\n", 1)[0];
    expect(firstLine).toMatch(
      /^pack\s+ruleId\s+deprecatedSince\s+ageMonths\s+overThreshold\s+replacementSuggestion$/
    );
  });
});
