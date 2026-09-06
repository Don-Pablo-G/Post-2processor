import { describe, expect, it } from "vitest";

import {
  buildDesktopBatchEnvelopeJsonFiles,
  buildDesktopBatchSetupSheetPdfs,
  buildDesktopBatchSetupSheetTxts,
  filterBatchJobCheckFiles,
  formatDesktopBatchBlockReasonsChip,
  formatDesktopBatchSummaryChip,
  formatDesktopBatchSummaryForExport,
  formatDesktopBatchWalkChip,
  runDesktopBatchJobCheck
} from "./batchJobCheckView";
import type { RunJobCheckResult } from "@cnc/core/browser";
import { CLI_SCHEMA_VERSION } from "@cnc/core/browser";

function makeResult(partial: {
  blocked?: boolean;
  safetyFindings?: RunJobCheckResult["advisor"]["safetyFindings"];
  simulationFindings?: RunJobCheckResult["simulationFindings"];
  parseDiagnosticsPolicyBreaches?: RunJobCheckResult["parseDiagnosticsPolicyBreaches"];
}): RunJobCheckResult {
  return {
    readyToRunScore: 100,
    blockerCount: 0,
    warningCount: 0,
    blocked: partial.blocked ?? false,
    simulation: {} as never,
    simulationFindings: partial.simulationFindings ?? [],
    advisor: {
      readyToRunScore: 100,
      safetyFindings: partial.safetyFindings ?? [],
      checklist: [],
      criticalEvents: [],
      setupOptimizations: [],
      optionalStopSuggestions: [],
      parameterFrontMatter: "",
      operatorViewProgram: ""
    },
    setupSheet: {
      title: "t",
      lines: ["line"],
      printable80mm: "p",
      exportTxt: "t",
      exportMarkdown: "m"
    },
    proveout: {} as never,
    messages: [],
    parseDiagnosticsSummary: { total: 0, byCode: {}, topCodes: [] },
    parseDiagnosticsPolicyBreaches: partial.parseDiagnosticsPolicyBreaches ?? [],
    lintIssues: [],
    lintIssuesSummary: { total: 0, blockers: 0, warnings: 0, bySource: {}, topSources: [] },
    parseDiagnosticsFirstBlockIndexByCode: {}
  };
}

describe("batchJobCheckView", () => {
  it("filters non-recursive gcode filenames and counts skipped nested", () => {
    const result = filterBatchJobCheckFiles(
      [
        { name: "a.nc", webkitRelativePath: "a.nc" },
        { name: "b.nc", webkitRelativePath: "sub/b.nc" },
        { name: "c.txt", webkitRelativePath: "c.txt" }
      ],
      { recursive: false }
    );
    expect(result.matched.map((f) => f.relativePath)).toEqual(["a.nc"]);
    expect(result.skipped).toBe(1);
    expect(result.batchWalk.matched).toBe(1);
    expect(result.batchWalk.recursive).toBe(false);
  });

  it("recursive include/exclude mirrors CLI-shaped globs", () => {
    const result = filterBatchJobCheckFiles(
      [
        { name: "a.nc", webkitRelativePath: "jobs/a.nc" },
        { name: "b.nc", webkitRelativePath: "jobs/sub/b.nc" },
        { name: "draft.nc", webkitRelativePath: "jobs/draft/x.nc" }
      ],
      { recursive: true, include: "**/*.nc", exclude: "draft/**" }
    );
    expect(result.matched.map((f) => f.relativePath)).toEqual(["a.nc", "sub/b.nc"]);
    expect(result.skipped).toBe(1);
    expect(result.batchWalk.root).toBe("jobs");
  });

  it("runDesktopBatchJobCheck emits CliBatchEnvelope schema 17 with batchWalk", async () => {
    const batch = await runDesktopBatchJobCheck(
      [
        {
          input: "a.nc",
          source: "x"
        },
        {
          input: "b.nc",
          source: "y"
        }
      ],
      async (source) =>
        makeResult({
          blocked: source === "x",
          safetyFindings:
            source === "x"
              ? [
                  {
                    code: "MISSING_G43_BEFORE_NEGATIVE_Z",
                    severity: "blocker",
                    message: "m",
                    blockIndex: 1
                  }
                ]
              : [],
          simulationFindings:
            source === "y"
              ? [{ code: "SIM_RAPID_Z_PLUNGE", severity: "warning", message: "s", blockIndex: 3 }]
              : [],
          parseDiagnosticsPolicyBreaches:
            source === "x"
              ? [{ key: "TOTAL", observed: 2, threshold: 0, severity: "blocker" }]
              : []
        }),
      {
        batchWalk: {
          recursive: false,
          include: [],
          exclude: [],
          matched: 2,
          skipped: 0,
          root: "folder"
        }
      }
    );
    expect(batch.envelope.schemaVersion).toBe(CLI_SCHEMA_VERSION);
    expect(batch.envelope.schemaVersion).toBe(19);
    expect(batch.envelope.summary.files).toBe(2);
    expect(batch.envelope.summary.blocked).toBe(1);
    expect(batch.envelope.summary.batchWalk?.root).toBe("folder");
    expect(batch.envelope.summary.safetyFindingsByCodeAggregated?.map((r) => r.code).sort()).toEqual([
      "MISSING_G43_BEFORE_NEGATIVE_Z",
      "SIM_RAPID_Z_PLUNGE"
    ]);
    expect(batch.envelope.summary.parseDiagnosticsPolicyBreachesAggregated?.[0].key).toBe("TOTAL");
    expect(formatDesktopBatchSummaryChip(batch.envelope)).toMatch(/files=2/);
    const exported = JSON.parse(formatDesktopBatchSummaryForExport(batch.envelope));
    expect(exported.schemaVersion).toBe(19);
    expect(exported.summary.batchWalk.matched).toBe(2);
    expect(batch.runResults).toHaveLength(2);
  });

  it("buildDesktopBatchSetupSheetPdfs emits one PDF per input", () => {
    const items = buildDesktopBatchSetupSheetPdfs([
      { input: "sub/a.nc", result: makeResult({}) },
      { input: "b.tap", result: makeResult({}) }
    ]);
    expect(items.map((i) => i.filename)).toEqual(["a.pdf", "b.pdf"]);
    expect(items[0]!.bytes.byteLength).toBeGreaterThan(4);
    expect(String.fromCharCode(items[0]!.bytes[0], items[0]!.bytes[1], items[0]!.bytes[2], items[0]!.bytes[3])).toBe(
      "%PDF"
    );
  });

  it("buildDesktopBatchSetupSheetTxts and envelope JSON multi-download builders", async () => {
    const batch = await runDesktopBatchJobCheck(
      [{ input: "a.nc", source: "x" }],
      async () => makeResult({}),
      {
        batchWalk: {
          recursive: false,
          include: [],
          exclude: [],
          matched: 1,
          skipped: 0,
          root: "folder"
        }
      }
    );
    const txts = buildDesktopBatchSetupSheetTxts(batch.runResults);
    expect(txts).toEqual([
      {
        filename: "a.setup.txt",
        body: "t",
        mimeType: "text/plain;charset=utf-8"
      }
    ]);
    const envelopes = buildDesktopBatchEnvelopeJsonFiles(batch.envelope);
    expect(envelopes).toHaveLength(1);
    expect(envelopes[0]!.filename).toBe("a.job-check.json");
    expect(JSON.parse(envelopes[0]!.body as string).schemaVersion).toBe(19);
    expect(formatDesktopBatchWalkChip(batch.envelope)).toMatch(/matched=1/);
    expect(formatDesktopBatchBlockReasonsChip(batch.envelope)).toMatch(/batch-block-reasons/);
  });

  it("formatDesktopBatchWalkChip includes export roots when present", async () => {
    const batch = await runDesktopBatchJobCheck(
      [{ input: "a.nc", source: "x" }],
      async () => makeResult({}),
      {
        batchWalk: {
          recursive: false,
          include: [],
          exclude: [],
          matched: 1,
          skipped: 0,
          root: "folder",
          export: { outDir: "/out", setupSheetPdfDir: "/pdf" }
        }
      }
    );
    expect(formatDesktopBatchWalkChip(batch.envelope)).toMatch(/export outDir=\/out/);
    expect(formatDesktopBatchWalkChip(batch.envelope)).toMatch(/pdf=\/pdf/);
  });
});
