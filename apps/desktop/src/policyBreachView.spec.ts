import { describe, expect, it } from "vitest";

import {
  formatPolicyBreachRollupChip,
  formatPolicyBreachesForExport
} from "./policyBreachView";

describe("policyBreachView", () => {
  const breaches = [
    { key: "TOTAL", observed: 3, threshold: 0, severity: "blocker" as const },
    {
      key: "ADDRESS_MISSING_VALUE",
      observed: 1,
      threshold: 0,
      severity: "blocker" as const,
      firstBlockIndex: 2
    }
  ];

  it("formats a rollup-shaped chip sorted by key", () => {
    expect(formatPolicyBreachRollupChip(breaches)).toBe(
      "policy-breach: ADDRESS_MISSING_VALUE (obs=1), TOTAL (obs=3)"
    );
  });

  it("formats none when breaches are empty", () => {
    expect(formatPolicyBreachRollupChip([])).toBe("policy-breach: none");
  });

  it("exports JSON and CSV payloads", () => {
    const json = formatPolicyBreachesForExport(breaches, "json");
    const csv = formatPolicyBreachesForExport(breaches, "csv");
    expect(JSON.parse(json).breaches).toHaveLength(2);
    expect(csv.split("\n")[0]).toContain("key,observed,threshold,severity");
    expect(csv).toContain("ADDRESS_MISSING_VALUE");
  });
});
