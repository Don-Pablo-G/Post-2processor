import { describe, expect, it } from "vitest";

import {
  buildDesktopBatchArchiveZip,
  buildDesktopBatchEnvelopeJsonFiles,
  buildDesktopBatchPatchedPrograms,
  buildDesktopBatchQuickFixPreviews,
  buildDesktopBatchSetupSheetPdfs,
  buildDesktopBatchSetupSheetTxts,
  filterBatchJobCheckFiles,
  formatDesktopBatchAggregationsAsCsv,
  formatDesktopBatchBlockReasonsChip,
  formatDesktopBatchPatchedProgramsChip,
  formatDesktopBatchQuickFixPreviewChip,
  formatDesktopBatchSarifChip,
  formatDesktopBatchExportInventoryChip,
  formatDesktopBatchExportZipSha256Sidecar,
  computeDesktopBatchExportZipSha256,
  formatDesktopBatchSummaryChip,
  formatDesktopBatchSummaryForExport,
  formatDesktopBatchSummaryAsNdjson,
  stampDesktopBatchExportSummaryPaths,
  formatDesktopBatchUnboundFixChip,
  formatDesktopBatchUnboundFixesAsSarifLite,
  formatDesktopBatchPatchedProgramsForClipboard,
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
    expect(batch.envelope.schemaVersion).toBe(CLI_SCHEMA_VERSION);
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
    expect(exported.schemaVersion).toBe(CLI_SCHEMA_VERSION);
    const ndjsonLine = formatDesktopBatchSummaryAsNdjson(batch.envelope).trimEnd();
    expect(JSON.parse(ndjsonLine).schemaVersion).toBe(CLI_SCHEMA_VERSION);
    expect(formatDesktopBatchSummaryAsNdjson(batch.envelope).endsWith("\n")).toBe(true);
    expect(exported.summary.batchWalk.matched).toBe(2);
    expect(exported.summary.batchWalk.export.csvSummaryPath).toBe("batch-summary.csv");
    expect(exported.summary.batchWalk.export.ndjsonSummaryPath).toBe("batch-summary.ndjson");
    expect(exported.summary.batchWalk.export.jsonSummaryPath).toBe("batch-summary.json");
    expect(exported.summary.batchWalk.export.zipSha256Path).toBe("batch-export.zip.sha256");
    expect(exported.summary.batchWalk.export.batchExportZip).toBe("batch-export.zip");
    expect(exported.summary.batchWalk.export.exportManifestPath).toBe(
      "batch-export-manifest.json"
    );
    expect(exported.summary.batchWalk.export.batchUnboundSarif).toBe(
      "batch-unbound-fixes.sarif.json"
    );
    expect(exported.summary.batchWalk.export.fixPreviewsPath).toBe(
      "batch-fix-previews.json"
    );
    expect(exported.summary.batchWalk.export.outDir).toBe(".");
    expect(exported.summary.batchWalk.export.setupSheetPdfDir).toBe("setup-pdf");
    expect(exported.summary.batchWalk.export.setupTxtDir).toBe("setup-txt");
    expect(exported.summary.batchWalk.export.patchedNcDir).toBe("patched-nc");
    expect(formatDesktopBatchExportInventoryChip(batch.envelope)).toMatch(/csv/);
    expect(formatDesktopBatchExportInventoryChip(batch.envelope)).toMatch(/ndjson/);
    expect(
      formatDesktopBatchExportInventoryChip(batch.envelope)
        .replace(/^batch-export:\s*/, "")
        .split(",")
    ).toContain("json");
    expect(
      formatDesktopBatchExportInventoryChip(batch.envelope)
        .replace(/^batch-export:\s*/, "")
        .split(",")
    ).toContain("sha256");
    expect(
      formatDesktopBatchExportInventoryChip(batch.envelope)
        .replace(/^batch-export:\s*/, "")
        .split(",")
    ).toContain("zip");
    expect(
      formatDesktopBatchExportInventoryChip(batch.envelope)
        .replace(/^batch-export:\s*/, "")
        .split(",")
    ).toContain("manifest");
    expect(
      formatDesktopBatchExportInventoryChip(batch.envelope)
        .replace(/^batch-export:\s*/, "")
        .split(",")
    ).toContain("sarif");
    expect(
      formatDesktopBatchExportInventoryChip(batch.envelope)
        .replace(/^batch-export:\s*/, "")
        .split(",")
    ).toContain("fixPreviews");
    expect(
      formatDesktopBatchExportInventoryChip(batch.envelope)
        .replace(/^batch-export:\s*/, "")
        .split(",")
    ).toContain("outDir");
    expect(
      formatDesktopBatchExportInventoryChip(batch.envelope)
        .replace(/^batch-export:\s*/, "")
        .split(",")
    ).toContain("pdf");
    expect(
      formatDesktopBatchExportInventoryChip(batch.envelope)
        .replace(/^batch-export:\s*/, "")
        .split(",")
    ).toContain("setupTxtDir");
    expect(
      formatDesktopBatchExportInventoryChip(batch.envelope)
        .replace(/^batch-export:\s*/, "")
        .split(",")
    ).toContain("patchedDir");
    expect(batch.runResults).toHaveLength(2);
  });

  it("stampDesktopBatchExportSummaryPaths preserves existing absolute paths", () => {
    const stamped = stampDesktopBatchExportSummaryPaths({
      recursive: false,
      include: [],
      exclude: [],
      matched: 1,
      skipped: 0,
      root: "x",
      export: {
        csvSummaryPath: "/abs/batch-summary.csv",
        outDir: "/abs/out",
        setupSheetPdfDir: "/abs/setup-pdf",
        setupTxtDir: "/abs/setup-txt",
        patchedNcDir: "/abs/patched-nc"
      }
    });
    expect(stamped?.export?.csvSummaryPath).toBe("/abs/batch-summary.csv");
    expect(stamped?.export?.outDir).toBe("/abs/out");
    expect(stamped?.export?.setupSheetPdfDir).toBe("/abs/setup-pdf");
    expect(stamped?.export?.setupTxtDir).toBe("/abs/setup-txt");
    expect(stamped?.export?.patchedNcDir).toBe("/abs/patched-nc");
    expect(stamped?.export?.ndjsonSummaryPath).toBe("batch-summary.ndjson");
    expect(stamped?.export?.jsonSummaryPath).toBe("batch-summary.json");
    expect(stamped?.export?.zipSha256Path).toBe("batch-export.zip.sha256");
    expect(stamped?.export?.batchExportZip).toBe("batch-export.zip");
    expect(stamped?.export?.exportManifestPath).toBe("batch-export-manifest.json");
    expect(stamped?.export?.batchUnboundSarif).toBe("batch-unbound-fixes.sarif.json");
    expect(stamped?.export?.fixPreviewsPath).toBe("batch-fix-previews.json");
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
    expect(JSON.parse(envelopes[0]!.body as string).schemaVersion).toBe(CLI_SCHEMA_VERSION);
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

  it("formatDesktopBatchAggregationsAsCsv and quick-fix previews", async () => {
    const batch = await runDesktopBatchJobCheck(
      [{ input: "a.nc", source: "O1\nG0 Z-5\nM30\n" }],
      async () =>
        makeResult({
          blocked: true,
          safetyFindings: [
            {
              code: "MISSING_G43_BEFORE_NEGATIVE_Z",
              severity: "blocker",
              message: "Negative Z move appears before G43 length compensation.",
              blockIndex: 1
            }
          ],
          parseDiagnosticsPolicyBreaches: [
            { key: "TOTAL", observed: 1, threshold: 0, severity: "blocker" }
          ]
        }),
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
    const csv = formatDesktopBatchAggregationsAsCsv(batch.envelope);
    expect(csv).toMatch(/^kind,key,count/);
    expect(csv).toMatch(/safety,/);
    expect(csv).toMatch(/policy-breach,/);
    const previews = buildDesktopBatchQuickFixPreviews(
      batch.envelope,
      new Map([["a.nc", "O1\nG0 Z-5\nM30\n"]])
    );
    expect(previews.length).toBeGreaterThan(0);
    expect(previews[0]!.code).toBe("MISSING_G43_BEFORE_NEGATIVE_Z");
    expect(previews[0]!.expanded).toMatch(/Z-5/);
    expect(formatDesktopBatchQuickFixPreviewChip(previews)).toMatch(/fixes=/);
    expect(formatDesktopBatchUnboundFixChip(previews)).toMatch(/batch-unbound-fixes/);
    const patched = buildDesktopBatchPatchedPrograms(
      batch.envelope,
      new Map([["a.nc", "O1\nG0 Z-5\nM30\n"]])
    );
    expect(patched).toHaveLength(1);
    expect(patched[0]!.filename).toBe("a.patched.nc");
    expect(String(patched[0]!.body)).toMatch(/G43/);
    expect(formatDesktopBatchPatchedProgramsChip(patched)).toMatch(/files=1/);
    expect(formatDesktopBatchPatchedProgramsForClipboard(patched)).toMatch(/a\.patched\.nc/);
    const sarif = formatDesktopBatchUnboundFixesAsSarifLite(batch.envelope, previews);
    expect(sarif).toMatch(/"version": "2\.1\.0"/);
    const zip = await buildDesktopBatchArchiveZip(
      [...buildDesktopBatchSetupSheetTxts(batch.runResults), ...patched],
      { compression: "deflate" }
    );
    expect(zip[0]).toBe(0x50);
    expect(zip[1]).toBe(0x4b);
  });

  it("formatDesktopBatchSarifChip and export inventory chip", async () => {
    expect(
      formatDesktopBatchSarifChip({
        schemaVersion: CLI_SCHEMA_VERSION,
        results: [],
        summary: {
          files: 0,
          blocked: 0,
          safetyFindingsByCodePerInputFile: [],
          lintIssuesByControllerCodePerInputFile: [],
          parseDiagnosticsByCodePerInputFile: []
        }
      } as never)
    ).toBe("batch-sarif: none");
    expect(formatDesktopBatchExportInventoryChip({ summary: {} } as never)).toBe(
      "batch-export: none"
    );
    const withExport = await runDesktopBatchJobCheck(
      [{ input: "a.nc", source: "O1\nG0 Z-5\nM30\n" }],
      async () =>
        makeResult({
          blocked: true,
          safetyFindings: [
            {
              code: "MISSING_G43_BEFORE_NEGATIVE_Z",
              severity: "blocker",
              message: "Negative Z move appears before G43 length compensation.",
              blockIndex: 1
            }
          ]
        }),
      {
        batchWalk: {
          recursive: false,
          include: [],
          exclude: [],
          matched: 1,
          skipped: 0,
          root: "folder",
          export: {
            outDir: "/out",
            batchExportZip: "/out/batch-export.zip",
            batchUnboundSarif: "/out/batch-unbound-fixes.sarif.json",
            patchedNcCount: 1,
            patchedNcDir: "/out/patched-nc",
            setupTxtCount: 1,
            setupTxtDir: "/out/setup-txt",
            setupPdfCount: 2,
            fixPreviewsPath: "/out/batch-fix-previews.json",
            fixPreviewCount: 3,
            exportManifestPath: "/out/batch-export-manifest.json",
            writtenFileCount: 12,
            zipEntryCount: 10,
            zipSha256: "abcdef0123456789deadbeef",
            zipBytes: 4096,
            totalBytes: 8192,
            sealedAt: "2026-09-06T14:05:30.123Z",
            byKind: { zip: 1, manifest: 1, "summary-json": 1 },
            ndjsonSummaryPath: "/out/batch-summary.ndjson",
            csvSummaryPath: "/out/batch-summary.csv",
            jsonSummaryPath: "/out/batch-summary.json",
            zipSha256Path: "/out/batch-export.zip.sha256"
          }
        }
      }
    );
    expect(formatDesktopBatchSarifChip(withExport.envelope)).toMatch(/candidates=/);
    expect(formatDesktopBatchSarifChip(withExport.envelope)).toMatch(/written/);
    expect(formatDesktopBatchExportInventoryChip(withExport.envelope)).toMatch(
      /batch-export:.*zip/
    );
    expect(formatDesktopBatchExportInventoryChip(withExport.envelope)).toMatch(/sarif/);
    expect(formatDesktopBatchExportInventoryChip(withExport.envelope)).toMatch(/patched=1/);
    expect(formatDesktopBatchExportInventoryChip(withExport.envelope)).toMatch(/patchedDir/);
    expect(formatDesktopBatchExportInventoryChip(withExport.envelope)).toMatch(/setupTxt=1/);
    expect(formatDesktopBatchExportInventoryChip(withExport.envelope)).toMatch(/setupTxtDir/);
    expect(formatDesktopBatchExportInventoryChip(withExport.envelope)).toMatch(/setupPdf=2/);
    expect(formatDesktopBatchExportInventoryChip(withExport.envelope)).toMatch(
      /fixPreviews=3/
    );
    expect(formatDesktopBatchExportInventoryChip(withExport.envelope)).toMatch(/manifest/);
    expect(formatDesktopBatchExportInventoryChip(withExport.envelope)).toMatch(/ndjson/);
    expect(formatDesktopBatchExportInventoryChip(withExport.envelope)).toMatch(/csv/);
    expect(
      formatDesktopBatchExportInventoryChip(withExport.envelope)
        .replace(/^batch-export:\s*/, "")
        .split(",")
    ).toContain("json");
    expect(
      formatDesktopBatchExportInventoryChip(withExport.envelope)
        .replace(/^batch-export:\s*/, "")
        .split(",")
    ).toContain("sha256");
    expect(formatDesktopBatchExportInventoryChip(withExport.envelope)).toMatch(/written=12/);
    expect(formatDesktopBatchExportInventoryChip(withExport.envelope)).toMatch(/zipEntries=10/);
    expect(formatDesktopBatchExportInventoryChip(withExport.envelope)).toMatch(/zipSha=abcdef01/);
    expect(formatDesktopBatchExportInventoryChip(withExport.envelope)).toMatch(/zipBytes=4096/);
    expect(formatDesktopBatchExportInventoryChip(withExport.envelope)).toMatch(/totalBytes=8192/);
    expect(formatDesktopBatchExportInventoryChip(withExport.envelope)).toMatch(/kinds=3/);
    expect(formatDesktopBatchExportInventoryChip(withExport.envelope)).toMatch(
      /sealedAt=2026-09-06T14:05/
    );
    expect(
      formatDesktopBatchQuickFixPreviewChip(
        buildDesktopBatchQuickFixPreviews(
          withExport.envelope,
          new Map([["a.nc", "O1\nG0 Z-5\nM30\n"]])
        )
      )
    ).toMatch(/fixes=/);
    expect(
      formatDesktopBatchPatchedProgramsChip(
        buildDesktopBatchPatchedPrograms(
          withExport.envelope,
          new Map([["a.nc", "O1\nG0 Z-5\nM30\n"]])
        )
      )
    ).toMatch(/files=1/);
  });

  it("desktop zip sha256 sidecar helpers match CLI format", async () => {
    const bytes = new TextEncoder().encode("batch-export-fixture");
    const digest = await computeDesktopBatchExportZipSha256(bytes);
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    expect(formatDesktopBatchExportZipSha256Sidecar(digest)).toBe(
      `${digest}  batch-export.zip\n`
    );
  });
});
