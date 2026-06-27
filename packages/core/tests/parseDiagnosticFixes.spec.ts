import { describe, expect, it } from "vitest";

import { getParseDiagnosticFix, PARSE_DIAGNOSTIC_FIXES } from "../src/parser/parseDiagnosticFixes.js";

describe("parseDiagnosticFixes", () => {
  it("covers every parser diagnostic code", () => {
    const codes = [
      "UNMATCHED_OPEN_PAREN",
      "UNMATCHED_CLOSE_PAREN",
      "ADDRESS_MISSING_VALUE",
      "UNMATCHED_BRACKET",
      "BRACKET_EXPRESSION_INVALID",
      "UNKNOWN_TOKEN",
      "INVALID_CHARACTER"
    ] as const;
    for (const code of codes) {
      expect(PARSE_DIAGNOSTIC_FIXES[code]).toBeDefined();
      expect(getParseDiagnosticFix(code)?.code).toBe(code);
    }
  });

  it("returns undefined for unknown codes", () => {
    expect(getParseDiagnosticFix("DOES_NOT_EXIST")).toBeUndefined();
  });
});
