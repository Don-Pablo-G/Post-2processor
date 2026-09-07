import type { DeclarativeRuleDef, ProfileRuleDoc, RulePolicy, RulePolicyEntry } from "@cnc/core/browser";
import {
  buildRulePolicyFromFlags,
  mergeRulePolicies,
  parseDeclarativeRulesJson
} from "@cnc/core/browser";

export type DesktopControllerId = "haas-ngc" | "haas-legacy" | "fanuc";

export type PersistedLintRuleDefaults = {
  lintController?: DesktopControllerId;
  rulePolicy?: RulePolicy;
  customDeclarativeRulesJson?: string;
};

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

/** Normalize a persisted rulePolicy blob from template JSON. */
export function sanitizePersistedRulePolicy(raw: unknown): RulePolicy | undefined {
  if (raw === null) return undefined;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const rulesRaw = (raw as { rules?: unknown }).rules;
  if (!rulesRaw || typeof rulesRaw !== "object" || Array.isArray(rulesRaw)) return undefined;
  const rules: Record<string, RulePolicyEntry> = {};
  for (const [id, value] of Object.entries(rulesRaw as Record<string, unknown>)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const entry = value as { enabled?: unknown; severity?: unknown };
    if (typeof entry.enabled !== "boolean") continue;
    if (
      entry.severity !== undefined &&
      entry.severity !== "warning" &&
      entry.severity !== "error"
    ) {
      continue;
    }
    rules[id] = {
      enabled: entry.enabled,
      ...(entry.severity === "warning" || entry.severity === "error"
        ? { severity: entry.severity }
        : {})
    };
  }
  return Object.keys(rules).length > 0 ? { rules } : undefined;
}

export function sanitizePersistedLintController(raw: unknown): DesktopControllerId | undefined {
  if (raw === "haas-ngc" || raw === "haas-legacy" || raw === "fanuc") return raw;
  return undefined;
}

export function readPersistedLintRuleDefaults(raw: unknown): PersistedLintRuleDefaults {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const obj = raw as Record<string, unknown>;
  const lintController = sanitizePersistedLintController(obj.lintController);
  const hasRulePolicyKey = Object.prototype.hasOwnProperty.call(obj, "rulePolicy");
  const rulePolicy = hasRulePolicyKey ? sanitizePersistedRulePolicy(obj.rulePolicy) : undefined;
  const customDeclarativeRulesJson =
    typeof obj.customDeclarativeRulesJson === "string" ? obj.customDeclarativeRulesJson : undefined;
  return {
    ...(lintController ? { lintController } : {}),
    ...(hasRulePolicyKey ? { rulePolicy } : {}),
    ...(customDeclarativeRulesJson !== undefined ? { customDeclarativeRulesJson } : {})
  };
}
