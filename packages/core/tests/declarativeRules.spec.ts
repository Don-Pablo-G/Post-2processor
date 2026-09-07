import { describe, expect, it } from "vitest";
import { parse } from "../src/api.js";
import { runDeclarativeRules, parseDeclarativeRulesJson } from "../src/lints/declarativeRules.js";
import type { ControllerProfile } from "../src/api.js";

const profile: ControllerProfile = {
  id: "test",
  name: "test",
  defaultFormatStyle: {
    upperCaseWords: true,
    normalizeSpacing: true,
    removeStandaloneOptionalStops: false
  }
};

describe("declarativeRules", () => {
  it("requires T with M6", () => {
    const ast = parse("O1\nM6\nM30", profile);
    const issues = runDeclarativeRules(ast, [
      {
        id: "custom.m6-requires-t",
        severity: "warning",
        summary: "M6 needs T",
        message: "M6 without T on the same block",
        kind: "requireLetterWith",
        whenWords: ["M6"],
        requireLetter: "T"
      }
    ]);
    expect(issues.some((i) => i.code === "custom.m6-requires-t")).toBe(true);
  });

  it("parses JSON array of rules", () => {
    const rules = parseDeclarativeRulesJson(
      JSON.stringify([
        {
          id: "custom.h0",
          severity: "warning",
          summary: "H0",
          message: "H0 is invalid",
          kind: "letterValue",
          letter: "H",
          forbiddenValues: [0]
        }
      ])
    );
    expect(rules).toHaveLength(1);
    const ast = parse("O1\nG43 H0 Z1\nM30", profile);
    expect(runDeclarativeRules(ast, rules).some((i) => i.code === "custom.h0")).toBe(true);
  });
});
