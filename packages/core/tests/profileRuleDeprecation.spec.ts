import { describe, expect, it } from "vitest";

import { filterDeprecatedProfileLintIssues } from "../src/lints/profileRuleDeprecation.js";
import type { LintIssue, ProfileRuleDoc } from "../src/types.js";

function makeIssue(message: string, severity: LintIssue["severity"] = "warning"): LintIssue {
  return { severity, message, blockIndex: 0 };
}

const ALIVE_DOC: ProfileRuleDoc = {
  id: "haas.spindle-on-without-s",
  severity: "warning",
  messageMatcher: /Spindle start \(M3\/M4\/M13\/M14\) without S/,
  positiveSnippet: "",
  negativeSnippet: "",
  summary: "Spindle on must specify S RPM."
};

const DEPRECATED_DOC: ProfileRuleDoc = {
  id: "fanuc.t0-before-real-tool",
  severity: "warning",
  messageMatcher: /T0 \(tool cancel\) issued before any real tool selection/,
  positiveSnippet: "",
  negativeSnippet: "",
  summary: "T0 before any real Tn trips the Fanuc tool-life manager.",
  deprecatedSince: "2026-05"
};

describe("filterDeprecatedProfileLintIssues", () => {
  it("returns the input unchanged when no docs carry deprecatedSince", () => {
    const issues = [
      makeIssue("Spindle start (M3/M4/M13/M14) without S"),
      makeIssue("Whatever else")
    ];
    const filtered = filterDeprecatedProfileLintIssues(issues, [ALIVE_DOC]);
    expect(filtered).toEqual(issues);
    // Defensive: returns a fresh array, not the same reference, to avoid
    // accidental external mutation.
    expect(filtered).not.toBe(issues);
  });

  it("drops issues whose messageMatcher resolves to a deprecated doc", () => {
    const live = makeIssue("Spindle start (M3/M4/M13/M14) without S");
    const dead = makeIssue("T0 (tool cancel) issued before any real tool selection");
    const filtered = filterDeprecatedProfileLintIssues([live, dead], [ALIVE_DOC, DEPRECATED_DOC]);
    expect(filtered).toEqual([live]);
  });

  it("preserves order of surviving issues", () => {
    const a = makeIssue("Spindle start (M3/M4/M13/M14) without S");
    const b = makeIssue("T0 (tool cancel) issued before any real tool selection");
    const c = makeIssue("Spindle start (M3/M4/M13/M14) without S", "error");
    const filtered = filterDeprecatedProfileLintIssues([a, b, c], [ALIVE_DOC, DEPRECATED_DOC]);
    expect(filtered).toEqual([a, c]);
  });

  it("does NOT suppress issues that match no doc at all", () => {
    const orphan = makeIssue("Some custom rule message that no doc owns");
    const filtered = filterDeprecatedProfileLintIssues(
      [orphan],
      [ALIVE_DOC, DEPRECATED_DOC]
    );
    expect(filtered).toEqual([orphan]);
  });

  it("handles an empty issues array without throwing", () => {
    expect(filterDeprecatedProfileLintIssues([], [DEPRECATED_DOC])).toEqual([]);
  });

  it("handles an empty docs array without throwing (passes everything through)", () => {
    const issues = [makeIssue("anything")];
    expect(filterDeprecatedProfileLintIssues(issues, [])).toEqual(issues);
  });

  it("treats a regex with global flag the same as a plain matcher (no stateful match leakage)", () => {
    const stickyDoc: ProfileRuleDoc = {
      ...DEPRECATED_DOC,
      messageMatcher: /T0/g
    };
    const issues = [makeIssue("T0 first"), makeIssue("T0 second"), makeIssue("alive")];
    expect(filterDeprecatedProfileLintIssues(issues, [stickyDoc])).toEqual([
      issues[2]
    ]);
  });
});
