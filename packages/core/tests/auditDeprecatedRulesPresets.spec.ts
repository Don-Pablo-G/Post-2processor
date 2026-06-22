import { describe, expect, it } from "vitest";

import {
  isAuditDeprecatedRulesPolicyPresetId,
  resolveAuditDeprecatedRulesPreset
} from "../src/cli/auditDeprecatedRulesPresets.js";

describe("auditDeprecatedRulesPresets", () => {
  it("recognises shipped preset ids", () => {
    expect(isAuditDeprecatedRulesPolicyPresetId("informational")).toBe(true);
    expect(isAuditDeprecatedRulesPolicyPresetId("six-month-strict")).toBe(true);
    expect(isAuditDeprecatedRulesPolicyPresetId("yearly-strict")).toBe(true);
    expect(isAuditDeprecatedRulesPolicyPresetId("bogus")).toBe(false);
  });

  it("resolves six-month-strict to 6mo + strict", () => {
    expect(resolveAuditDeprecatedRulesPreset("six-month-strict")).toEqual({
      olderThan: "6mo",
      strict: true
    });
  });

  it("resolves informational without threshold", () => {
    expect(resolveAuditDeprecatedRulesPreset("informational")).toEqual({
      strict: false
    });
  });
});
