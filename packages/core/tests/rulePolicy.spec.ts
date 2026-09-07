import { describe, expect, it } from "vitest";
import {
  applyRulePolicy,
  attachRuleCodesFromDocs,
  buildRulePolicyFromFlags,
  mergeRulePolicies,
  parseRulePolicyJson
} from "../src/lints/rulePolicy.js";
import type { LintIssue, ProfileRuleDoc } from "../src/types.js";

const docs: ProfileRuleDoc[] = [
  {
    id: "haas.demo-rule",
    severity: "warning",
    messageMatcher: /Demo rule fired/,
    summary: "demo",
    positiveSnippet: "O1\nM30\n",
    negativeSnippet: "O1\nM30\n"
  }
];

describe("rulePolicy", () => {
  it("attaches codes from rule docs", () => {
    const issues: LintIssue[] = [
      { severity: "warning", message: "Demo rule fired on block", blockIndex: 0 }
    ];
    const coded = attachRuleCodesFromDocs(issues, docs);
    expect(coded[0]?.code).toBe("haas.demo-rule");
  });

  it("filters disabled rules by code", () => {
    const issues: LintIssue[] = [
      { severity: "warning", message: "x", blockIndex: 0, code: "haas.demo-rule" },
      { severity: "warning", message: "y", blockIndex: 1, code: "CG_N_AND_O_MIXED" }
    ];
    const filtered = applyRulePolicy(issues, {
      rules: { "haas.demo-rule": { enabled: false } }
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.code).toBe("CG_N_AND_O_MIXED");
  });

  it("parses and merges policy JSON with disable flags", () => {
    const file = parseRulePolicyJson(
      JSON.stringify({ rules: { "haas.demo-rule": { enabled: true, severity: "error" } } })
    );
    const merged = mergeRulePolicies(
      file,
      buildRulePolicyFromFlags({ disableRules: ["haas.demo-rule"] })
    );
    expect(merged.rules["haas.demo-rule"]?.enabled).toBe(false);
  });
});
