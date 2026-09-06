import { describe, expect, it } from "vitest";

import {
  buildSafetyFindingsByCodeFromFindings,
  formatSafetyFindingsChip,
  formatSafetyFindingsForExport
} from "./safetyFindingsView";

describe("safetyFindingsView", () => {
  it("rolls up findings by code with blockers first", () => {
    const rows = buildSafetyFindingsByCodeFromFindings([
      { code: "SIM_RAPID_Z_PLUNGE", severity: "warning", blockIndex: 4 },
      { code: "MISSING_G43_BEFORE_NEGATIVE_Z", severity: "blocker", blockIndex: 2 },
      { code: "SIM_RAPID_Z_PLUNGE", severity: "warning", blockIndex: 1 }
    ]);
    expect(rows[0].code).toBe("MISSING_G43_BEFORE_NEGATIVE_Z");
    expect(rows[0].blockers).toBe(1);
    expect(rows[1].code).toBe("SIM_RAPID_Z_PLUNGE");
    expect(rows[1].count).toBe(2);
    expect(rows[1].firstBlockIndex).toBe(1);
  });

  it("formats chip and JSON export", () => {
    const rows = buildSafetyFindingsByCodeFromFindings([
      { code: "SAFE_START_NOT_DETECTED", severity: "warning" }
    ]);
    expect(formatSafetyFindingsChip(rows)).toMatch(/safety: blockers=0, warnings=1/);
    expect(JSON.parse(formatSafetyFindingsForExport(rows, "json")).safetyFindingsByCode).toHaveLength(
      1
    );
  });

  it("formats empty chip", () => {
    expect(formatSafetyFindingsChip([])).toBe("safety: none");
  });
});
