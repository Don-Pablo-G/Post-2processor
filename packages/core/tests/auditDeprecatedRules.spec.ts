import { describe, expect, it } from "vitest";

import {
  buildDeprecatedRuleAudit,
  parseOlderThanThreshold,
  type DeprecatedRuleAuditRow
} from "../src/cli/auditDeprecatedRules.js";
import type { ProfileRuleDoc } from "../src/types.js";

function doc(
  id: string,
  deprecatedSince?: string,
  extra: Partial<ProfileRuleDoc> = {}
): ProfileRuleDoc {
  return {
    id,
    severity: "warning",
    messageMatcher: /placeholder/,
    summary: "placeholder",
    positiveSnippet: "",
    negativeSnippet: "",
    ...(deprecatedSince !== undefined ? { deprecatedSince } : {}),
    ...extra
  };
}

const FROZEN_NOW_FN = () => new Date(Date.UTC(2026, 9, 1)); // 2026-10-01 UTC

describe("buildDeprecatedRuleAudit", () => {
  it("returns an empty array for an empty docs map", () => {
    expect(buildDeprecatedRuleAudit(new Map())).toEqual([]);
  });

  it("returns an empty array when no doc has deprecatedSince", () => {
    const docs = new Map<string, ProfileRuleDoc[]>([
      ["fanuc", [doc("fanuc.r1"), doc("fanuc.r2")]]
    ]);
    expect(buildDeprecatedRuleAudit(docs)).toEqual([]);
  });

  it("emits one row per deprecated rule and skips non-deprecated rules in the same pack", () => {
    const docs = new Map<string, ProfileRuleDoc[]>([
      [
        "fanuc",
        [doc("fanuc.live"), doc("fanuc.deprecated", "2026-05"), doc("fanuc.also-live")]
      ]
    ]);
    const rows = buildDeprecatedRuleAudit(docs, { nowFn: FROZEN_NOW_FN });
    expect(rows.map((r) => r.ruleId)).toEqual(["fanuc.deprecated"]);
    expect(rows[0].deprecatedSince).toBe("2026-05");
    expect(rows[0].ageMonths).toBe(5); // 2026-05 -> 2026-10 = 5 months
  });

  it("computes ageMonths in UTC year-month arithmetic and clamps a future date to 0", () => {
    const docs = new Map<string, ProfileRuleDoc[]>([
      [
        "fanuc",
        [
          doc("fanuc.future", "2027-01"), // ahead of FROZEN_NOW_FN
          doc("fanuc.same-month", "2026-10")
        ]
      ]
    ]);
    const rows = buildDeprecatedRuleAudit(docs, { nowFn: FROZEN_NOW_FN });
    const future = rows.find((r) => r.ruleId === "fanuc.future")!;
    const sameMonth = rows.find((r) => r.ruleId === "fanuc.same-month")!;
    expect(future.ageMonths).toBe(0);
    expect(sameMonth.ageMonths).toBe(0);
  });

  it("carries replacementSuggestion when set on the rule doc", () => {
    const docs = new Map<string, ProfileRuleDoc[]>([
      [
        "fanuc",
        [
          doc("fanuc.deprecated", "2026-05", {
            replacementSuggestion: "Use the controller alarm instead."
          })
        ]
      ]
    ]);
    const rows = buildDeprecatedRuleAudit(docs, { nowFn: FROZEN_NOW_FN });
    expect(rows[0].replacementSuggestion).toBe("Use the controller alarm instead.");
  });

  it("omits replacementSuggestion when not set on the rule doc", () => {
    const docs = new Map<string, ProfileRuleDoc[]>([
      ["fanuc", [doc("fanuc.deprecated", "2026-05")]]
    ]);
    const rows = buildDeprecatedRuleAudit(docs, { nowFn: FROZEN_NOW_FN });
    expect(rows[0]).not.toHaveProperty("replacementSuggestion");
  });

  it("flips overThreshold when ageMonths is exactly equal to thresholdMonths", () => {
    const docs = new Map<string, ProfileRuleDoc[]>([
      [
        "fanuc",
        [
          doc("fanuc.exactly-six", "2026-04"), // 6 months old at FROZEN_NOW_FN
          doc("fanuc.just-under", "2026-05") // 5 months old
        ]
      ]
    ]);
    const rows = buildDeprecatedRuleAudit(docs, {
      thresholdMonths: 6,
      nowFn: FROZEN_NOW_FN
    });
    expect(rows.find((r) => r.ruleId === "fanuc.exactly-six")?.overThreshold).toBe(true);
    expect(rows.find((r) => r.ruleId === "fanuc.just-under")?.overThreshold).toBe(false);
  });

  it("never flips overThreshold when no thresholdMonths was supplied", () => {
    const docs = new Map<string, ProfileRuleDoc[]>([
      ["fanuc", [doc("fanuc.ancient", "2020-01")]]
    ]);
    const rows = buildDeprecatedRuleAudit(docs, { nowFn: FROZEN_NOW_FN });
    expect(rows[0].ageMonths).toBeGreaterThan(50);
    expect(rows[0].overThreshold).toBe(false);
  });

  it("skips docs with malformed deprecatedSince (not YYYY-MM, out-of-range month)", () => {
    const docs = new Map<string, ProfileRuleDoc[]>([
      [
        "fanuc",
        [
          doc("fanuc.bad-format", "2026/05"),
          doc("fanuc.bad-month", "2026-13"),
          doc("fanuc.zero-month", "2026-00"),
          doc("fanuc.empty", ""),
          doc("fanuc.good", "2026-05")
        ]
      ]
    ]);
    const rows = buildDeprecatedRuleAudit(docs, { nowFn: FROZEN_NOW_FN });
    expect(rows.map((r) => r.ruleId)).toEqual(["fanuc.good"]);
  });

  it("sorts rows by pack ascending, then ruleId ascending across multiple packs", () => {
    const docs = new Map<string, ProfileRuleDoc[]>([
      ["zeta-pack", [doc("z.b", "2026-01"), doc("z.a", "2026-01")]],
      ["alpha-pack", [doc("a.b", "2026-01"), doc("a.a", "2026-01")]]
    ]);
    const rows = buildDeprecatedRuleAudit(docs, { nowFn: FROZEN_NOW_FN });
    expect(rows.map((r) => `${r.pack}:${r.ruleId}`)).toEqual([
      "alpha-pack:a.a",
      "alpha-pack:a.b",
      "zeta-pack:z.a",
      "zeta-pack:z.b"
    ]);
  });

  it("preserves the verbatim deprecatedSince string on every emitted row", () => {
    const docs = new Map<string, ProfileRuleDoc[]>([
      ["fanuc", [doc("fanuc.pilot", "2026-05")]]
    ]);
    const [row] = buildDeprecatedRuleAudit(docs, { nowFn: FROZEN_NOW_FN });
    expect(row.deprecatedSince).toBe("2026-05");
  });

  it("never returns the same DeprecatedRuleAuditRow shape with extra fields", () => {
    const docs = new Map<string, ProfileRuleDoc[]>([
      ["fanuc", [doc("fanuc.pilot", "2026-05")]]
    ]);
    const rows = buildDeprecatedRuleAudit(docs, {
      thresholdMonths: 1,
      nowFn: FROZEN_NOW_FN
    });
    const expected: DeprecatedRuleAuditRow = {
      pack: "fanuc",
      ruleId: "fanuc.pilot",
      deprecatedSince: "2026-05",
      ageMonths: 5,
      overThreshold: true
    };
    expect(rows).toEqual([expected]);
    expect(Object.keys(rows[0]).sort()).toEqual(
      ["ageMonths", "deprecatedSince", "overThreshold", "pack", "ruleId"].sort()
    );
  });
});

describe("parseOlderThanThreshold", () => {
  it("accepts <N>mo and returns N as months", () => {
    expect(parseOlderThanThreshold("0mo")).toBe(0);
    expect(parseOlderThanThreshold("6mo")).toBe(6);
    expect(parseOlderThanThreshold("24mo")).toBe(24);
  });

  it("accepts <N>d and converts to months via Math.ceil(days / 30)", () => {
    expect(parseOlderThanThreshold("0d")).toBe(0);
    expect(parseOlderThanThreshold("1d")).toBe(1); // ceil(1/30) = 1, never trivial 0
    expect(parseOlderThanThreshold("30d")).toBe(1);
    expect(parseOlderThanThreshold("60d")).toBe(2);
    expect(parseOlderThanThreshold("180d")).toBe(6);
  });

  it("rejects malformed inputs by returning undefined", () => {
    expect(parseOlderThanThreshold("")).toBeUndefined();
    expect(parseOlderThanThreshold("6")).toBeUndefined(); // missing unit
    expect(parseOlderThanThreshold("mo")).toBeUndefined(); // missing amount
    expect(parseOlderThanThreshold("6months")).toBeUndefined(); // wrong unit
    expect(parseOlderThanThreshold("6 mo")).toBeUndefined(); // whitespace
    expect(parseOlderThanThreshold("-6mo")).toBeUndefined(); // negative
    expect(parseOlderThanThreshold("6.5mo")).toBeUndefined(); // fractional
    expect(parseOlderThanThreshold("six-months")).toBeUndefined();
  });
});
