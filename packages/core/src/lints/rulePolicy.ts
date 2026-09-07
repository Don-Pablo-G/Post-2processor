import type { LintIssue, ProfileRuleDoc, RulePolicy, RulePolicyEntry } from "../types.js";

export type { RulePolicy, RulePolicyEntry };

/**
 * Attach stable rule codes to profile-lint issues by matching
 * `ProfileRuleDoc.messageMatcher`. Issues that already have a `code` are
 * left unchanged. First matching non-deprecated doc wins; if none, first
 * matching deprecated doc wins.
 */
export function attachRuleCodesFromDocs(
  issues: readonly LintIssue[],
  ruleDocs: readonly ProfileRuleDoc[]
): LintIssue[] {
  if (ruleDocs.length === 0) return issues.map((i) => ({ ...i }));
  const active = ruleDocs.filter((d) => d.deprecatedSince === undefined);
  const deprecated = ruleDocs.filter((d) => d.deprecatedSince !== undefined);
  return issues.map((issue) => {
    if (issue.code) return { ...issue };
    const fromActive = matchDoc(issue.message, active);
    if (fromActive) return { ...issue, code: fromActive.id };
    const fromDeprecated = matchDoc(issue.message, deprecated);
    if (fromDeprecated) return { ...issue, code: fromDeprecated.id };
    return { ...issue };
  });
}

function matchDoc(message: string, docs: readonly ProfileRuleDoc[]): ProfileRuleDoc | undefined {
  for (const doc of docs) {
    doc.messageMatcher.lastIndex = 0;
    if (doc.messageMatcher.test(message)) return doc;
  }
  return undefined;
}

/**
 * Filter and optionally re-severity issues according to `RulePolicy`.
 * Issues without a `code` always pass through (cannot be targeted).
 */
export function applyRulePolicy(
  issues: readonly LintIssue[],
  policy: RulePolicy | undefined
): LintIssue[] {
  if (!policy || Object.keys(policy.rules).length === 0) {
    return issues.map((i) => ({ ...i }));
  }
  const out: LintIssue[] = [];
  for (const issue of issues) {
    if (!issue.code) {
      out.push({ ...issue });
      continue;
    }
    const entry = policy.rules[issue.code];
    if (!entry) {
      out.push({ ...issue });
      continue;
    }
    if (!entry.enabled) continue;
    out.push({
      ...issue,
      severity: entry.severity ?? issue.severity
    });
  }
  return out;
}

/** Merge CLI enable/disable lists into a RulePolicy (disable wins on conflict). */
export function buildRulePolicyFromFlags(options: {
  enableRules?: readonly string[];
  disableRules?: readonly string[];
  base?: RulePolicy;
}): RulePolicy {
  const rules: Record<string, RulePolicyEntry> = { ...(options.base?.rules ?? {}) };
  for (const id of options.enableRules ?? []) {
    const trimmed = id.trim();
    if (!trimmed) continue;
    rules[trimmed] = { ...rules[trimmed], enabled: true };
  }
  for (const id of options.disableRules ?? []) {
    const trimmed = id.trim();
    if (!trimmed) continue;
    rules[trimmed] = { ...rules[trimmed], enabled: false };
  }
  return { rules };
}

/** Parse a JSON rule-policy file body. Throws on invalid shape. */
export function parseRulePolicyJson(raw: string): RulePolicy {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Invalid rule policy JSON: ${(err as Error).message}`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Rule policy JSON must be an object with a `rules` map.");
  }
  const root = parsed as { rules?: unknown };
  if (!root.rules || typeof root.rules !== "object" || Array.isArray(root.rules)) {
    throw new Error("Rule policy JSON must include a `rules` object.");
  }
  const rules: Record<string, RulePolicyEntry> = {};
  for (const [id, value] of Object.entries(root.rules as Record<string, unknown>)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(`Rule policy entry for "${id}" must be an object.`);
    }
    const entry = value as { enabled?: unknown; severity?: unknown };
    if (typeof entry.enabled !== "boolean") {
      throw new Error(`Rule policy entry for "${id}" must include boolean "enabled".`);
    }
    if (
      entry.severity !== undefined &&
      entry.severity !== "warning" &&
      entry.severity !== "error"
    ) {
      throw new Error(`Rule policy entry for "${id}" has invalid severity.`);
    }
    rules[id] = {
      enabled: entry.enabled,
      ...(entry.severity ? { severity: entry.severity } : {})
    };
  }
  return { rules };
}

export function mergeRulePolicies(...policies: Array<RulePolicy | undefined>): RulePolicy {
  const rules: Record<string, RulePolicyEntry> = {};
  for (const policy of policies) {
    if (!policy) continue;
    for (const [id, entry] of Object.entries(policy.rules)) {
      rules[id] = { ...rules[id], ...entry };
    }
  }
  return { rules };
}
