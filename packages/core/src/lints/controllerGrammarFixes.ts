/**
 * Catalogue mapping every controller-grammar rule code (`CG_*`, emitted by
 * [`controllerGrammar.ts`](./controllerGrammar.ts)) to a stable canonical
 * fix template and a one-line rationale. The catalogue is the single source
 * of truth for downstream tooling that needs to surface fixes by code:
 *
 * - IDE quick-fixes / batch auto-fixers can do `getControllerGrammarFix(code)`
 *   instead of scraping `LintIssue.message` text.
 * - The auto-generated [`CONTROLLER_GRAMMAR_CODES.md`](../../../../CONTROLLER_GRAMMAR_CODES.md)
 *   reference doc is rendered from this catalogue.
 *
 * Every entry is contract-tested by
 * [`tests/controllerGrammarFixes.spec.ts`](../../tests/controllerGrammarFixes.spec.ts):
 * the test triggers every rule and asserts that the union of emitted codes
 * is covered by either an exact catalogue entry or the
 * `CG_DUPLICATE_ADDRESSES_*` prefix family. The catalogue is append-only —
 * adding a new rule MUST add an entry here.
 */

export type ControllerGrammarFix = {
  /**
   * Stable rule code as emitted by `LintIssue.code` (e.g.
   * `CG_N_AND_O_MIXED`). For the duplicate-address family the catalogue
   * uses the literal prefix `CG_DUPLICATE_ADDRESSES_*`; runtime code
   * lookups go through {@link getControllerGrammarFix}, which honors the
   * prefix.
   */
  code: string;
  /** Canonical fix title — matches the family of `LintIssue.suggestedFixes[0].title`. */
  title: string;
  /** One-line "why" suitable for IDE tooltips and the docs reference table. */
  rationale: string;
  /**
   * Optional snippet template. Placeholders use `{{NAME}}` syntax; the
   * catalogue does NOT prescribe an interpolation engine — downstream
   * consumers (auto-fixer, IDE plugin) plug in their own.
   */
  replacementTemplate?: string;
};

/** Literal prefix for the per-letter duplicate-address family (`CG_DUPLICATE_ADDRESSES_X`, etc.). */
export const CG_DUPLICATE_ADDRESSES_PREFIX = "CG_DUPLICATE_ADDRESSES_";

/**
 * Strict per-code catalogue. Every entry whose key starts with `CG_` and
 * does NOT end in `_*` is an exact match; the single `CG_DUPLICATE_ADDRESSES_*`
 * key documents the per-letter family and is matched by prefix at lookup
 * time.
 */
export const CONTROLLER_GRAMMAR_FIXES: Readonly<Record<string, ControllerGrammarFix>> = {
  CG_N_AND_O_MIXED: {
    code: "CG_N_AND_O_MIXED",
    title: "Move N number to a separate block from the O header",
    rationale:
      "Fanuc manuals state sequence numbers (N) are invalid on O-number blocks — controllers either drop the N silently or alarm.",
    replacementTemplate: "{{N_BLOCK}}\n{{O_BLOCK}}"
  },
  CG_FANUC_INVALID_N_O_FORMAT: {
    code: "CG_FANUC_INVALID_N_O_FORMAT",
    title: "Use an integer N or O value within 1..99999999",
    rationale:
      "Fanuc sequence (N) and program (O) numbers must be integer values in 1..99999999; fractional, negative, or out-of-range values alarm at the controller.",
    replacementTemplate: "{{LETTER}}{{INTEGER_1_TO_99999999}}"
  },
  CG_FANUC_MACRO_IJK_ORDER: {
    code: "CG_FANUC_MACRO_IJK_ORDER",
    title: "Reorder arguments so I appears before J before K",
    rationale:
      "Fanuc Macro (G65) documentation expects I, J, K arguments in alphabetical order; out-of-order args bind to the wrong macro variables.",
    replacementTemplate: "G65 P{{PROG}} I{{I}} J{{J}} K{{K}}"
  },
  CG_DUPLICATE_O_HEADER: {
    code: "CG_DUPLICATE_O_HEADER",
    title: "Use a unique O-number per program; rename duplicate O-header",
    rationale:
      "Two O-number headers with the same value make subprogram and call targets ambiguous — the controller picks one (usually the last) silently.",
    replacementTemplate: "O{{UNIQUE_PROGRAM_NUMBER}}"
  },
  CG_FANUC_PROGRAM_ENVELOPE: {
    code: "CG_FANUC_PROGRAM_ENVELOPE",
    title: "Move executable blocks below the O-number header",
    rationale:
      "Most Fanuc controls require the O-number header to be the first executable block; setup or motion blocks before it are dropped or treated as a separate (unnamed) program.",
    replacementTemplate: "O{{PROGRAM_NUMBER}}\n{{EXECUTABLE_BLOCKS}}"
  },
  [`${CG_DUPLICATE_ADDRESSES_PREFIX}*`]: {
    code: `${CG_DUPLICATE_ADDRESSES_PREFIX}*`,
    title:
      "Split duplicate <LETTER> words into two blocks; controller is last-value-wins",
    rationale:
      "Duplicated address letters in one block are typically last-value-wins on most controllers — the earlier value is silently dropped, which usually hides a programming mistake.",
    replacementTemplate: "{{FIRST_BLOCK_WITH_LETTER}}\n{{SECOND_BLOCK_WITH_LETTER}}"
  }
};

/**
 * Look up a canonical fix by `LintIssue.code`. Honors the per-letter
 * `CG_DUPLICATE_ADDRESSES_*` family: any code starting with that prefix
 * resolves to the family entry. Unknown codes return `undefined` so the
 * caller can fall back to the rule's own `suggestedFixes`.
 */
export function getControllerGrammarFix(
  code: string
): ControllerGrammarFix | undefined {
  if (CONTROLLER_GRAMMAR_FIXES[code]) return CONTROLLER_GRAMMAR_FIXES[code];
  if (code.startsWith(CG_DUPLICATE_ADDRESSES_PREFIX)) {
    return CONTROLLER_GRAMMAR_FIXES[`${CG_DUPLICATE_ADDRESSES_PREFIX}*`];
  }
  return undefined;
}
