import { describe, expect, it } from "vitest";
import {
  buildRuleToggleRows,
  disableAllDeprecated,
  filterRuleRows,
  readPersistedLintRuleDefaults,
  sanitizePersistedLintController,
  sanitizePersistedRulePolicy,
  toggleRuleInPolicy,
  tryParseCustomDeclarativeRules
} from "./rulesPolicyView";
import type { ProfileRuleDoc } from "@cnc/core/browser";

const docs: ProfileRuleDoc[] = [
  {
    id: "haas.a",
    severity: "warning",
    messageMatcher: /a/,
    summary: "Rule A",
    positiveSnippet: "O1\n",
    negativeSnippet: "O1\n"
  },
  {
    id: "haas.b",
    severity: "warning",
    messageMatcher: /b/,
    summary: "Rule B",
    positiveSnippet: "O1\n",
    negativeSnippet: "O1\n",
    deprecatedSince: "2026-01"
  }
];

describe("rulesPolicyView", () => {
  it("builds toggle rows and toggles policy", () => {
    const rows = buildRuleToggleRows(docs, undefined);
    expect(rows.find((r) => r.id === "haas.b")?.enabled).toBe(false);
    const policy = toggleRuleInPolicy(undefined, "haas.a", false);
    expect(buildRuleToggleRows(docs, policy).find((r) => r.id === "haas.a")?.enabled).toBe(false);
  });

  it("disables all deprecated", () => {
    const policy = disableAllDeprecated(docs, undefined);
    expect(policy.rules["haas.b"]?.enabled).toBe(false);
  });

  it("filters and parses custom rules", () => {
    const rows = buildRuleToggleRows(docs, undefined);
    expect(filterRuleRows(rows, "rule a")).toHaveLength(1);
    const parsed = tryParseCustomDeclarativeRules("[]");
    expect(parsed.ok).toBe(true);
  });

  it("sanitizes persisted rule policy and lint controller", () => {
    expect(sanitizePersistedLintController("fanuc")).toBe("fanuc");
    expect(sanitizePersistedLintController("nope")).toBeUndefined();
    expect(
      sanitizePersistedRulePolicy({
        rules: {
          "haas.a": { enabled: false },
          bad: { enabled: "yes" },
          "haas.b": { enabled: true, severity: "error" }
        }
      })
    ).toEqual({
      rules: {
        "haas.a": { enabled: false },
        "haas.b": { enabled: true, severity: "error" }
      }
    });
  });

  it("reads persisted lint rule defaults from uiDefaults blobs", () => {
    expect(
      readPersistedLintRuleDefaults({
        lintController: "haas-legacy",
        rulePolicy: { rules: { "haas.a": { enabled: false } } },
        customDeclarativeRulesJson: "[]"
      })
    ).toEqual({
      lintController: "haas-legacy",
      rulePolicy: { rules: { "haas.a": { enabled: false } } },
      customDeclarativeRulesJson: "[]"
    });
    expect(readPersistedLintRuleDefaults({ rulePolicy: null })).toEqual({
      rulePolicy: undefined
    });
    expect(readPersistedLintRuleDefaults(null)).toEqual({});
  });
});
