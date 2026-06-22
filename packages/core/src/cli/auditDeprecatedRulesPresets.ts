/**
 * Preset table for `cnc-job-check audit-deprecated-rules --policy <id>`.
 * Mirrors the `--policy-preset` chips on the main CLI so CI workflows can
 * express the deprecation cadence as a single auditable flag.
 */

export type AuditDeprecatedRulesPolicyPresetId =
  | "informational"
  | "six-month-strict"
  | "yearly-strict";

export const AUDIT_DEPRECATED_RULES_POLICY_PRESET_IDS: ReadonlyArray<AuditDeprecatedRulesPolicyPresetId> =
  ["informational", "six-month-strict", "yearly-strict"];

export type ResolvedAuditDeprecatedRulesPreset = {
  olderThan?: string;
  strict: boolean;
};

export function isAuditDeprecatedRulesPolicyPresetId(
  value: string
): value is AuditDeprecatedRulesPolicyPresetId {
  return (AUDIT_DEPRECATED_RULES_POLICY_PRESET_IDS as readonly string[]).includes(value);
}

/**
 * Resolve a named audit policy preset to its `--older-than` + `--strict`
 * equivalent. Pure, deterministic, no I/O.
 */
export function resolveAuditDeprecatedRulesPreset(
  preset: AuditDeprecatedRulesPolicyPresetId
): ResolvedAuditDeprecatedRulesPreset {
  switch (preset) {
    case "informational":
      return { strict: false };
    case "six-month-strict":
      return { olderThan: "6mo", strict: true };
    case "yearly-strict":
      return { olderThan: "12mo", strict: true };
  }
}
