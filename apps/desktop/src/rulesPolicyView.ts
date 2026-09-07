import type { DeclarativeRuleDef, ProfileRuleDoc, RulePolicy } from "@cnc/core/browser";
import {
  buildRulePolicyFromFlags,
  mergeRulePolicies,
  parseDeclarativeRulesJson
} from "@cnc/core/browser";

export type DesktopControllerId = "haas-ngc" | "haas-legacy" | "fanuc";

export type RuleToggleRow = {
  id: string;
  summary: string;
  severity: "warning" | "error";
  enabled: boolean;
  deprecated: boolean;
};

export function buildRuleToggleRows(
  docs: readonly ProfileRuleDoc[],
  policy: RulePolicy | undefined
): RuleToggleRow[] {
  return docs
    .map((doc) => {
      const entry = policy?.rules[doc.id];
      const enabled = entry ? entry.enabled : doc.deprecatedSince === undefined;
      return {
        id: doc.id,
        summary: doc.summary,
        severity: doc.severity,
        enabled,
        deprecated: doc.deprecatedSince !== undefined
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function toggleRuleInPolicy(
  policy: RulePolicy | undefined,
  ruleId: string,
  enabled: boolean
): RulePolicy {
  return mergeRulePolicies(policy, {
    rules: { [ruleId]: { enabled } }
  });
}

export function disableAllDeprecated(
  docs: readonly ProfileRuleDoc[],
  policy: RulePolicy | undefined
): RulePolicy {
  const ids = docs.filter((d) => d.deprecatedSince !== undefined).map((d) => d.id);
  return mergeRulePolicies(policy, buildRulePolicyFromFlags({ disableRules: ids }));
}

export function filterRuleRows(rows: readonly RuleToggleRow[], query: string): RuleToggleRow[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...rows];
  return rows.filter(
    (row) => row.id.toLowerCase().includes(q) || row.summary.toLowerCase().includes(q)
  );
}

export function tryParseCustomDeclarativeRules(raw: string):
  | { ok: true; rules: DeclarativeRuleDef[] }
  | { ok: false; error: string } {
  try {
    return { ok: true, rules: parseDeclarativeRulesJson(raw) };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
