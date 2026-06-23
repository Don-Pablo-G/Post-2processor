import {
  AUDIT_DEPRECATED_RULES_POLICY_PRESET_IDS,
  buildDeprecatedRuleAudit,
  resolveAuditDeprecatedRulesPreset,
  parseOlderThanThreshold,
  type AuditDeprecatedRulesPolicyPresetId,
  type DeprecatedRuleAuditRow,
  type ProfileRuleDoc
} from "@cnc/core/browser";
import { fanucIsoRuleDocs } from "@cnc/profile-fanuc-iso";
import { haasNgcRuleDocs } from "@cnc/profile-haas-ngc";

export const DEPRECATED_RULES_AUDIT_POLICY_PRESETS = AUDIT_DEPRECATED_RULES_POLICY_PRESET_IDS;

export type DeprecatedRulesAuditPolicyPresetId = AuditDeprecatedRulesPolicyPresetId;

export type DeprecatedRulesAuditSummary = {
  preset: DeprecatedRulesAuditPolicyPresetId;
  rows: DeprecatedRuleAuditRow[];
  overThresholdCount: number;
  deprecatedCount: number;
};

/**
 * Build the in-memory profile-pack rule-doc map used by the desktop
 * deprecation audit sweep (mirrors the CLI's built-in pack wiring).
 */
export function buildBundledProfileRuleDocsMap(): Map<string, readonly ProfileRuleDoc[]> {
  return new Map<string, readonly ProfileRuleDoc[]>([
    ["@cnc/profile-haas-ngc", haasNgcRuleDocs],
    ["@cnc/profile-fanuc-iso", fanucIsoRuleDocs]
  ]);
}

/**
 * Run the bundled deprecation audit for the selected policy preset.
 * Pure, deterministic, no I/O — suitable for the Job Check card chips.
 */
export function runDeprecatedRulesAudit(
  preset: DeprecatedRulesAuditPolicyPresetId,
  nowFn?: () => Date
): DeprecatedRulesAuditSummary {
  const resolved = resolveAuditDeprecatedRulesPreset(preset);
  const thresholdMonths =
    resolved.olderThan !== undefined
      ? parseOlderThanThreshold(resolved.olderThan)
      : undefined;
  const rows = buildDeprecatedRuleAudit(buildBundledProfileRuleDocsMap(), {
    thresholdMonths,
    nowFn
  });
  const overThresholdCount = rows.filter((row) => row.overThreshold).length;
  return {
    preset,
    rows,
    overThresholdCount,
    deprecatedCount: rows.length
  };
}

export function formatDeprecatedRulesAuditChip(summary: DeprecatedRulesAuditSummary): string {
  if (summary.deprecatedCount === 0) {
    return `deprecated-rules: none (preset=${summary.preset})`;
  }
  if (summary.overThresholdCount > 0) {
    return `deprecated-rules: ${summary.overThresholdCount}/${summary.deprecatedCount} over threshold (preset=${summary.preset})`;
  }
  return `deprecated-rules: ${summary.deprecatedCount} tracked (preset=${summary.preset})`;
}

export function deprecatedRulesAuditPresetLabel(
  preset: DeprecatedRulesAuditPolicyPresetId,
  labels: {
    informational: string;
    sixMonthStrict: string;
    yearlyStrict: string;
  }
): string {
  switch (preset) {
    case "informational":
      return labels.informational;
    case "six-month-strict":
      return labels.sixMonthStrict;
    case "yearly-strict":
      return labels.yearlyStrict;
  }
}
