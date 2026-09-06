import { describe, expect, it } from "vitest";

import { getSafetyFindingFix, SAFETY_FINDING_FIXES } from "../src/workshop/safetyFindingFixes.js";

describe("safetyFindingFixes", () => {
  it("covers high-traffic advisor and simulation codes", () => {
    const required = [
      "MISSING_G43_BEFORE_NEGATIVE_Z",
      "SAFE_START_NOT_DETECTED",
      "MISSING_PROGRAM_END",
      "SIM_RAPID_Z_PLUNGE",
      "SIM_MAIN_M99",
      "SIM_CALL_DEPTH_LIMIT"
    ];
    for (const code of required) {
      expect(SAFETY_FINDING_FIXES[code]).toBeDefined();
      expect(getSafetyFindingFix(code)?.code).toBe(code);
    }
  });

  it("returns undefined for unknown codes", () => {
    expect(getSafetyFindingFix("DOES_NOT_EXIST")).toBeUndefined();
  });
});
