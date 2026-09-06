import { describe, expect, it } from "vitest";

import { getSafetyFindingFix, SAFETY_FINDING_FIXES } from "../src/workshop/safetyFindingFixes.js";

const REQUIRED_CATALOGUE = [
  "MISSING_G43_BEFORE_NEGATIVE_Z",
  "SAFE_START_NOT_DETECTED",
  "MISSING_PROGRAM_END",
  "TOOL_WITHOUT_G43",
  "G43_WITHOUT_H",
  "TOOL_H_MISMATCH",
  "CANNED_CYCLE_NO_R",
  "CLAMP_ZONE_COLLISION_RISK",
  "X_OUTSIDE_STOCK",
  "Y_OUTSIDE_STOCK",
  "Z_OUTSIDE_EXPECTED_ENVELOPE",
  "MIXED_FEED_MODES",
  "MIXED_UNITS",
  "SIM_RAPID_Z_PLUNGE",
  "SIM_MAIN_M99",
  "SIM_CALL_DEPTH_LIMIT",
  "SIM_UNSUPPORTED_M97",
  "SIM_GOTO_TARGET_MISS",
  "SIM_SUBPROGRAM_TARGET_MISS",
  "SIM_MAX_STEPS_LIMIT",
  "SIM_MACRO_ALARM",
  "SIM_UNFINISHED_RETURN_PATH",
  "SIM_INVALID_ASSIGNMENT",
  "SIM_IF_THEN_RHS_INVALID",
  "SIM_FUNCTION_DOMAIN_ERROR",
  "SIM_CONTROL_FLOW_MISSING_END",
  "SIM_CONTROL_FLOW_LOOP_LIMIT",
  "SIM_CONTROL_FLOW_ORPHAN_END",
  "SIM_CYCLE_PARAMETER_ISSUE",
  "SIM_UNSUPPORTED_FUNCTION"
] as const;

describe("safetyFindingFixes", () => {
  it("covers the frozen Schema v17 safety-finding catalogue", () => {
    for (const code of REQUIRED_CATALOGUE) {
      expect(SAFETY_FINDING_FIXES[code]).toBeDefined();
      expect(getSafetyFindingFix(code)?.code).toBe(code);
      expect(getSafetyFindingFix(code)?.title.length).toBeGreaterThan(0);
      expect(getSafetyFindingFix(code)?.rationale.length).toBeGreaterThan(0);
    }
  });

  it("returns undefined for unknown codes", () => {
    expect(getSafetyFindingFix("DOES_NOT_EXIST")).toBeUndefined();
  });
});
