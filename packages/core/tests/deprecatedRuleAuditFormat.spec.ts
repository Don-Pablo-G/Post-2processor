import { describe, expect, it } from "vitest";

import {
  formatDeprecatedRuleAuditAsCsv,
  formatDeprecatedRuleAuditAsJson,
  formatDeprecatedRuleAuditAsText
} from "../src/cli/deprecatedRuleAuditFormat.js";
import type { DeprecatedRuleAuditRow } from "../src/cli/auditDeprecatedRules.js";

const SAMPLE_ROWS: DeprecatedRuleAuditRow[] = [
  {
    pack: "@cnc/profile-fanuc-iso",
    ruleId: "fanuc.t0-before-real-tool",
    deprecatedSince: "2025-06",
    ageMonths: 12,
    overThreshold: true,
    replacementSuggestion: "Use T1+ before first tool change"
  }
];

describe("deprecatedRuleAuditFormat", () => {
  it("formatDeprecatedRuleAuditAsJson wraps rows in a stable envelope", () => {
    const parsed = JSON.parse(formatDeprecatedRuleAuditAsJson(SAMPLE_ROWS)) as {
      rows: DeprecatedRuleAuditRow[];
    };
    expect(parsed.rows).toEqual(SAMPLE_ROWS);
  });

  it("formatDeprecatedRuleAuditAsCsv emits a header row and escapes commas", () => {
    const rows: DeprecatedRuleAuditRow[] = [
      {
        ...SAMPLE_ROWS[0],
        replacementSuggestion: "hint, with comma"
      }
    ];
    const csv = formatDeprecatedRuleAuditAsCsv(rows);
    expect(csv.split("\n")[0]).toBe(
      "pack,ruleId,deprecatedSince,ageMonths,overThreshold,replacementSuggestion"
    );
    expect(csv).toContain('"hint, with comma"');
  });

  it("formatDeprecatedRuleAuditAsText renders fixed-width columns", () => {
    const text = formatDeprecatedRuleAuditAsText(SAMPLE_ROWS);
    expect(text).toContain("pack");
    expect(text).toContain("fanuc.t0-before-real-tool");
    expect(text).toContain("Use T1+ before first tool change");
  });
});
