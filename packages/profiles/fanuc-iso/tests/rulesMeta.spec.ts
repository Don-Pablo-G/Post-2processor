import { describe, expect, it } from "vitest";
import { parse } from "@cnc/core";
import { fanucIsoProfile, fanucIsoRuleDocs, lintFanucIsoMill } from "../src/index.js";

describe("@cnc/profile-fanuc-iso rules.meta registry", () => {
  it("has stable, unique, dotted-lowercase ids", () => {
    const seen = new Set<string>();
    for (const rule of fanucIsoRuleDocs) {
      expect(rule.id, `rule id should be lowercase + dotted: ${rule.id}`).toMatch(
        /^[a-z][a-z0-9.\-]*$/
      );
      expect(seen.has(rule.id), `duplicate rule id: ${rule.id}`).toBe(false);
      seen.add(rule.id);
    }
  });

  it("each rule's positiveSnippet triggers a matching LintIssue", () => {
    for (const rule of fanucIsoRuleDocs) {
      const ast = parse(rule.positiveSnippet, fanucIsoProfile);
      const issues = lintFanucIsoMill(ast);
      const matched = issues.filter((issue) => rule.messageMatcher.test(issue.message));
      expect(
        matched.length,
        `${rule.id}: positiveSnippet must trigger ${rule.messageMatcher}\n` +
          `actual messages: ${issues.map((i) => i.message).join(" | ")}`
      ).toBeGreaterThan(0);
      for (const m of matched) {
        expect(m.severity, `${rule.id}: severity mismatch`).toBe(rule.severity);
      }
    }
  });

  it("each rule's negativeSnippet does NOT trigger the matcher", () => {
    for (const rule of fanucIsoRuleDocs) {
      const ast = parse(rule.negativeSnippet, fanucIsoProfile);
      const issues = lintFanucIsoMill(ast);
      const matched = issues.filter((issue) => rule.messageMatcher.test(issue.message));
      expect(
        matched.length,
        `${rule.id}: negativeSnippet must NOT trigger ${rule.messageMatcher}\n` +
          `actual matches: ${matched.map((i) => i.message).join(" | ")}`
      ).toBe(0);
    }
  });

  it("deprecatedSince (when set) matches the YYYY-MM ISO year-month shape", () => {
    for (const rule of fanucIsoRuleDocs) {
      if (rule.deprecatedSince === undefined) continue;
      expect(
        rule.deprecatedSince,
        `${rule.id}: deprecatedSince must match /^\\d{4}-(0[1-9]|1[0-2])$/`
      ).toMatch(/^\d{4}-(0[1-9]|1[0-2])$/);
    }
  });
});
