import { describe, expect, it } from "vitest";
import { parse } from "@cnc/core";
import { haasNgcProfile, haasNgcRuleDocs, lintHaasNgcMillWithCodes } from "../src/index.js";

describe("@cnc/profile-haas-ngc rules.meta registry", () => {
  it("has stable, unique, dotted-lowercase ids", () => {
    const seen = new Set<string>();
    for (const rule of haasNgcRuleDocs) {
      expect(rule.id, `rule id should be lowercase + dotted: ${rule.id}`).toMatch(
        /^[a-z][a-z0-9.\-]*$/
      );
      expect(seen.has(rule.id), `duplicate rule id: ${rule.id}`).toBe(false);
      seen.add(rule.id);
    }
  });

  it("each rule's positiveSnippet triggers a matching LintIssue", () => {
    for (const rule of haasNgcRuleDocs) {
      const ast = parse(rule.positiveSnippet, haasNgcProfile);
      const issues = lintHaasNgcMillWithCodes(ast);
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
    for (const rule of haasNgcRuleDocs) {
      const ast = parse(rule.negativeSnippet, haasNgcProfile);
      const issues = lintHaasNgcMillWithCodes(ast);
      const matched = issues.filter((issue) => rule.messageMatcher.test(issue.message));
      expect(
        matched.length,
        `${rule.id}: negativeSnippet must NOT trigger ${rule.messageMatcher}\n` +
          `actual matches: ${matched.map((i) => i.message).join(" | ")}`
      ).toBe(0);
    }
  });

  it("covers Haas mill lint batch 86 G4 same-block residual conflicts", () => {
    const expected = new Map([
      [
        "haas.g4-and-g68-same-block",
        "G4 dwell and G68 on the same block — dwell and coordinate rotation separately."
      ],
      ["haas.g4-and-g51-same-block", "G4 dwell and G51 on the same block — dwell and scaling separately."],
      [
        "haas.g4-and-g43-same-block",
        "G4 dwell and G43 on the same block — dwell and tool length separately."
      ],
      [
        "haas.g4-and-g41-same-block",
        "G4 dwell and G41/G42 on the same block — dwell and cutter compensation separately."
      ],
      [
        "haas.g4-and-g80-same-block",
        "G4 dwell and G80 on the same block — dwell and canned-cycle cancel separately."
      ],
      [
        "haas.g4-and-g40-same-block",
        "G4 dwell and G40 on the same block — dwell and cutter-comp cancel separately."
      ],
      [
        "haas.g4-and-g49-same-block",
        "G4 dwell and G49 on the same block — dwell and tool-length cancel separately."
      ],
      [
        "haas.g4-and-g69-same-block",
        "G4 dwell and G69 on the same block — dwell and rotation cancel separately."
      ],
      [
        "haas.g4-and-g50-same-block",
        "G4 dwell and G50 on the same block — dwell and scaling cancel separately."
      ],
      [
        "haas.g4-and-work-offset-same-block",
        "G4 dwell and work offset (G54-G59/G154) on the same block — dwell and work-offset select separately."
      ]
    ]);

    for (const [id, message] of expected) {
      const rule = haasNgcRuleDocs.find((candidate) => candidate.id === id);
      expect(rule, `${id} should be documented`).toBeDefined();
      const ast = parse(rule!.positiveSnippet, haasNgcProfile);
      const issues = lintHaasNgcMillWithCodes(ast);
      expect(
        issues.some((issue) => issue.message === message),
        `${id}: positiveSnippet must emit exact batch 86 message\n` +
          `actual messages: ${issues.map((i) => i.message).join(" | ")}`
      ).toBe(true);
    }
  });

  it("deprecatedSince (when set) matches the YYYY-MM ISO year-month shape", () => {
    for (const rule of haasNgcRuleDocs) {
      if (rule.deprecatedSince === undefined) continue;
      expect(
        rule.deprecatedSince,
        `${rule.id}: deprecatedSince must match /^\\d{4}-(0[1-9]|1[0-2])$/`
      ).toMatch(/^\d{4}-(0[1-9]|1[0-2])$/);
    }
  });
});
