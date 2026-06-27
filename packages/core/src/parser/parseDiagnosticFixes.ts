/**
 * Catalogue mapping every parser `ParseDiagnostic.code` to a stable canonical
 * fix template and rationale. Mirrors {@link controllerGrammarFixes} for
 * lexer/parser diagnostics so IDE batch tooling can surface hints by code
 * without scraping `ParseDiagnostic.message` text.
 */

import type { ParseDiagnostic } from "../types.js";

export type ParseDiagnosticFix = {
  code: ParseDiagnostic["code"];
  title: string;
  rationale: string;
  replacementTemplate?: string;
};

export const PARSE_DIAGNOSTIC_FIXES: Readonly<
  Record<ParseDiagnostic["code"], ParseDiagnosticFix>
> = {
  UNMATCHED_OPEN_PAREN: {
    code: "UNMATCHED_OPEN_PAREN",
    title: "Close the comment with ')'",
    rationale: "An unmatched '(' leaves trailing text outside comment syntax.",
    replacementTemplate: ")"
  },
  UNMATCHED_CLOSE_PAREN: {
    code: "UNMATCHED_CLOSE_PAREN",
    title: "Remove unmatched ')'",
    rationale: "A stray ')' without a matching '(' breaks block comment parsing."
  },
  ADDRESS_MISSING_VALUE: {
    code: "ADDRESS_MISSING_VALUE",
    title: "Add a numeric value after the address letter",
    rationale: "Address words like X or G require a value on strict parsers.",
    replacementTemplate: "{{LETTER}}0"
  },
  UNMATCHED_BRACKET: {
    code: "UNMATCHED_BRACKET",
    title: "Balance bracket expression delimiters",
    rationale: "Macro bracket expressions require matching '[' and ']'.",
    replacementTemplate: "]"
  },
  BRACKET_EXPRESSION_INVALID: {
    code: "BRACKET_EXPRESSION_INVALID",
    title: "Fix bracket expression syntax",
    rationale: "Bracket expressions must parse as a single balanced operand."
  },
  UNKNOWN_TOKEN: {
    code: "UNKNOWN_TOKEN",
    title: "Remove or replace the unknown token",
    rationale: "Strict parsers reject tokens that are not valid address words."
  },
  INVALID_CHARACTER: {
    code: "INVALID_CHARACTER",
    title: "Remove unsupported character",
    rationale: "The active compliance mode rejects this character in program text."
  }
};

export function getParseDiagnosticFix(
  code: string
): ParseDiagnosticFix | undefined {
  return PARSE_DIAGNOSTIC_FIXES[code as ParseDiagnostic["code"]];
}
