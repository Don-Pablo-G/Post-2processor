import { describe, expect, it } from "vitest";

import {
  DEPRECATED_RULES_AUDIT_POLICY_PRESETS,
  formatDeprecatedRulesAuditChip,
  formatDeprecatedRulesAuditForExport,
  runDeprecatedRulesAudit
} from "./deprecatedRulesAuditView";

const FROZEN_NOW = () => new Date(Date.UTC(2026, 10, 1));

describe("deprecatedRulesAuditView", () => {
  it("exposes the three CLI-aligned policy presets", () => {
    expect(DEPRECATED_RULES_AUDIT_POLICY_PRESETS).toEqual([
      "informational",
      "six-month-strict",
      "yearly-strict"
    ]);
  });

  it("informational preset lists deprecated rules without threshold flags", () => {
    const summary = runDeprecatedRulesAudit("informational", FROZEN_NOW);
    expect(summary.deprecatedCount).toBeGreaterThanOrEqual(1);
    expect(summary.overThresholdCount).toBe(0);
    expect(summary.rows.every((row) => row.overThreshold === false)).toBe(true);
  });

  it("six-month-strict marks the fanuc pilot rule over threshold at frozen now", () => {
    const summary = runDeprecatedRulesAudit("six-month-strict", FROZEN_NOW);
    const fanuc = summary.rows.find((row) => row.ruleId === "fanuc.t0-before-real-tool");
    expect(fanuc).toBeDefined();
    expect(fanuc!.overThreshold).toBe(true);
    expect(summary.overThresholdCount).toBeGreaterThanOrEqual(1);
    expect(formatDeprecatedRulesAuditChip(summary)).toMatch(/over threshold/);
  });

  it("formatDeprecatedRulesAuditForExport emits JSON and CSV payloads", () => {
    const summary = runDeprecatedRulesAudit("informational", FROZEN_NOW);
    const json = formatDeprecatedRulesAuditForExport(summary, "json");
    const csv = formatDeprecatedRulesAuditForExport(summary, "csv");
    expect(JSON.parse(json).rows.length).toBe(summary.deprecatedCount);
    expect(csv.split("\n")[0]).toContain("pack,ruleId");
  });
});
