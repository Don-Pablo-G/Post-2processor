import { describe, expect, it } from "vitest";

import {
  buildDesktopBatchSummary,
  filterBatchJobCheckFiles,
  formatDesktopBatchSummaryChip,
  formatDesktopBatchSummaryForExport,
  isBatchJobCheckFilename
} from "./batchJobCheckView";
import type { RunJobCheckResult } from "@cnc/core/browser";

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
    setupSheet: {} as never,
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
  it("filters non-recursive gcode filenames", () => {
    expect(isBatchJobCheckFilename("a.nc")).toBe(true);
    expect(isBatchJobCheckFilename("a.txt")).toBe(false);
    expect(
      filterBatchJobCheckFiles([
        { name: "a.nc", webkitRelativePath: "a.nc" },
        { name: "b.nc", webkitRelativePath: "sub/b.nc" },
        { name: "c.txt", webkitRelativePath: "c.txt" }
      ]).map((f) => f.relativePath)
    ).toEqual(["a.nc"]);
  });

  it("builds batch summary rollups", () => {
    const summary = buildDesktopBatchSummary([
      {
        input: "a.nc",
        blocked: true,
        result: makeResult({
          blocked: true,
          safetyFindings: [
            {
              code: "MISSING_G43_BEFORE_NEGATIVE_Z",
              severity: "blocker",
              message: "m",
              blockIndex: 1
            }
          ],
          parseDiagnosticsPolicyBreaches: [
            { key: "TOTAL", observed: 2, threshold: 0, severity: "blocker" }
          ]
        })
      },
      {
        input: "b.nc",
        blocked: false,
        result: makeResult({
          simulationFindings: [
            { code: "SIM_RAPID_Z_PLUNGE", severity: "warning", message: "s", blockIndex: 3 }
          ]
        })
      }
    ]);
    expect(summary.files).toBe(2);
    expect(summary.blocked).toBe(1);
    expect(summary.safetyFindingsByCodeAggregated?.map((r) => r.code).sort()).toEqual([
      "MISSING_G43_BEFORE_NEGATIVE_Z",
      "SIM_RAPID_Z_PLUNGE"
    ]);
    expect(summary.parseDiagnosticsPolicyBreachesAggregated?.[0].key).toBe("TOTAL");
    expect(formatDesktopBatchSummaryChip(summary)).toMatch(/files=2/);
    expect(JSON.parse(formatDesktopBatchSummaryForExport(summary)).files).toBe(2);
  });
});
