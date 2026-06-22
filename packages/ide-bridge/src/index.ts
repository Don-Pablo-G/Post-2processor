/**
 * `@cnc/ide-bridge` — thin adapter layer that lets IDE plugins (VSCode,
 * Cursor) surface canonical controller-grammar quick-fixes by joining
 * `LintIssue.code` (or batch `CliBatchControllerCodeAttribution.code`) to
 * the catalogue entries in `@cnc/core`'s `getControllerGrammarFix`.
 *
 * The package intentionally has NO runtime dependencies — `@cnc/core` is a
 * peer dependency so consuming IDE extensions reuse the host's installed
 * version. All exports are pure, deterministic, and side-effect free.
 *
 * Three entry points cover the two ways IDEs consume cnc-workbench output:
 *
 *  - Single-issue lookup: `getQuickFixForLintIssue(issue)` — used when an
 *    IDE has a hovered diagnostic and wants the canonical fix.
 *  - Single-input envelope: `mapJobCheckEnvelopeToQuickFixes(envelope)` —
 *    used when the IDE just ran `cnc-job-check` against the open file and
 *    wants every applicable fix in one pass.
 *  - Batch envelope: `mapBatchAttributionToFileQuickFixes(envelope)` —
 *    used when the IDE ran a batch over a project and wants to attach
 *    fixes to each input file in the workspace tree. Returns a `Map`
 *    keyed by the batch entry's `input` string with one quick-fix per
 *    `(input, code)` pair (deduplicated across `source` rows).
 */

import {
  getControllerGrammarFix,
  type CliBatchEnvelope,
  type CliJobCheckEnvelope,
  type LintIssue
} from "@cnc/core";

/**
 * Canonical controller-grammar quick-fix surfaced to an IDE plugin. The
 * shape inlines the catalogue's `title` + `rationale` + optional
 * `replacementTemplate` so consumers don't have to hop through the
 * underlying `ControllerGrammarFix` reference. An optional `range`
 * field is reserved for future line/column resolution — today's
 * `LintIssue` carries only a `blockIndex`, so callers that need an
 * editor range derive it themselves; the field is left undefined.
 */
export type IdeQuickFix = {
  /**
   * Stable rule code as emitted by `LintIssue.code` (e.g.
   * `CG_N_AND_O_MIXED`). For the duplicate-address family this is the
   * per-letter code as actually emitted (`CG_DUPLICATE_ADDRESSES_X`),
   * NOT the catalogue's family wildcard.
   */
  code: string;
  /** Canonical fix title — mirrors the catalogue entry's `title`. */
  title: string;
  /** One-line rationale suitable for IDE tooltips. */
  rationale: string;
  /**
   * Optional snippet template using the catalogue's `{{NAME}}`
   * placeholder syntax. Consumers plug their own interpolation engine.
   */
  replacementTemplate?: string;
  /**
   * Optional editor range when the quick-fix can be tied back to a
   * specific source location. Today's pipeline does not populate this
   * (LintIssue only carries `blockIndex`); reserved for a future move
   * that resolves block index → line/column at envelope-build time.
   */
  range?: {
    startLine: number;
    startColumn?: number;
    endLine: number;
    endColumn?: number;
  };
};

/**
 * Resolve the canonical quick-fix for a single `LintIssue`. Returns
 * `undefined` when:
 *
 *  - the issue has no `code` set (most non-`CG_*` lints), or
 *  - the code is not in the catalogue (caller should fall back to the
 *    issue's own `suggestedFixes`).
 *
 * Honors the `CG_DUPLICATE_ADDRESSES_*` family via the catalogue's
 * built-in prefix matcher.
 */
export function getQuickFixForLintIssue(
  issue: LintIssue,
  source?: string
): IdeQuickFix | undefined {
  if (typeof issue.code !== "string" || issue.code.length === 0) return undefined;
  const fix = getControllerGrammarFix(issue.code);
  if (!fix) return undefined;
  const out = toQuickFix(issue.code, fix);
  if (source !== undefined) {
    const range = resolveQuickFixRange(source, issue.blockIndex);
    if (range) out.range = range;
  }
  return out;
}

/**
 * Walk every `controllerLints` entry in a single-input envelope and
 * return the resolved `IdeQuickFix` for each issue whose `code` has a
 * catalogue entry. Issues without a code (or whose code is not in the
 * catalogue) are silently skipped — the IDE can fall back to the
 * envelope's `controllerLints[i].suggestedFixes` for those.
 *
 * Output order mirrors the envelope's `controllerLints` order, which is
 * stable across runs (asserted by the CLI tests).
 */
export function mapJobCheckEnvelopeToQuickFixes(
  envelope: CliJobCheckEnvelope,
  source?: string
): IdeQuickFix[] {
  const out: IdeQuickFix[] = [];
  for (const issue of envelope.controllerLints) {
    const qf = getQuickFixForLintIssue(issue, source);
    if (qf) out.push(qf);
  }
  return out;
}

/**
 * Group every batch attribution row that resolves to a catalogue entry
 * into a `Map<string, IdeQuickFix[]>` keyed by the entry's `input`
 * path. The map preserves the input ordering of the batch's
 * `lintIssuesByControllerCodePerInputFile` array (sorted `input`
 * ascending → `count` desc → `source` asc → `code` asc), so an IDE can
 * iterate the map in deterministic order.
 *
 * Per the bridge contract, only one quick-fix per `(input, code)` pair
 * is emitted: when the same code is reported for the same input under
 * multiple `source` values (e.g. both `controller_grammar` and a
 * `profile_lint` rule alias the same `CG_*` code), the first row wins.
 *
 * Returns an empty `Map` when the batch envelope has no attribution
 * rows OR when none of its codes are in the catalogue. Inputs whose
 * rows all fail catalogue lookup are NOT inserted as empty arrays —
 * the map only contains keys that have at least one resolved fix.
 */
export function mapBatchAttributionToFileQuickFixes(
  envelope: CliBatchEnvelope
): Map<string, IdeQuickFix[]> {
  const result = new Map<string, IdeQuickFix[]>();
  const seenPerInput = new Map<string, Set<string>>();
  for (const row of envelope.summary.lintIssuesByControllerCodePerInputFile) {
    const fix = getControllerGrammarFix(row.code);
    if (!fix) continue;
    let seen = seenPerInput.get(row.input);
    if (!seen) {
      seen = new Set<string>();
      seenPerInput.set(row.input, seen);
    }
    if (seen.has(row.code)) continue;
    seen.add(row.code);
    const quickFix = toQuickFix(row.code, fix);
    const existing = result.get(row.input);
    if (existing) {
      existing.push(quickFix);
    } else {
      result.set(row.input, [quickFix]);
    }
  }
  return result;
}

function toQuickFix(
  code: string,
  fix: { title: string; rationale: string; replacementTemplate?: string }
): IdeQuickFix {
  const out: IdeQuickFix = {
    code,
    title: fix.title,
    rationale: fix.rationale
  };
  if (fix.replacementTemplate !== undefined) {
    out.replacementTemplate = fix.replacementTemplate;
  }
  return out;
}

/**
 * Substitution table consumed by {@link expandIdeQuickFixTemplate}. Keys
 * are the unbracketed token names (e.g. `LETTER`, `PROG`, `PROGRAM_NUMBER`)
 * and values are the literal strings that replace each `{{NAME}}` token
 * in the template. The map is `Readonly<Record<string, string>>` to make
 * the API self-documenting and to nudge consumers toward immutable
 * binding objects.
 */
export type IdeQuickFixBindings = Readonly<Record<string, string>>;

const TEMPLATE_TOKEN_PATTERN = /\{\{([A-Z0-9_]+)\}\}/g;

const DUPLICATE_ADDRESSES_PREFIX = "CG_DUPLICATE_ADDRESSES_";

/**
 * Deterministically interpolate a quick-fix template against a binding
 * map. Scans `fix.replacementTemplate` for `{{NAME}}` tokens (uppercase
 * letters, digits, underscore — matching the catalogue's
 * `replacementTemplate` placeholder grammar) and substitutes each
 * occurrence with `bindings[NAME]`.
 *
 * Lenient by design: tokens missing from `bindings` are left in place
 * verbatim so callers can compose multiple binding passes (e.g. a
 * heuristic pass via {@link deriveQuickFixBindings} followed by a
 * user-input pass for the still-unbound names). A `strict` opt-in that
 * throws on unbound tokens may be added in a follow-up wave.
 *
 * Returns `undefined` when `fix.replacementTemplate` is absent — no
 * template to expand. The original `fix` object is never mutated.
 */
export function expandIdeQuickFixTemplate(
  fix: IdeQuickFix,
  bindings: IdeQuickFixBindings
): string | undefined {
  if (fix.replacementTemplate === undefined) return undefined;
  return fix.replacementTemplate.replace(TEMPLATE_TOKEN_PATTERN, (match, name: string) => {
    const value = bindings[name];
    return value !== undefined ? value : match;
  });
}

/**
 * Heuristic that derives a starting binding table from the lint issue
 * itself, leveraging information already encoded in `LintIssue.code`.
 * Today's heuristics are intentionally narrow — only the bindings the
 * code alone makes unambiguous are populated:
 *
 *  - `CG_DUPLICATE_ADDRESSES_<L>` → `{ LETTER: <L> }`. Drives the family
 *    catalogue entry's `{{LETTER}}` token. Resolves at-most one letter
 *    per issue (the per-letter code carries exactly one).
 *
 * All other codes (and codeless issues) return an empty object. Templates
 * with placeholders the bridge cannot derive (e.g. `CG_DUPLICATE_O_HEADER`
 * needs the operator's pick for the new O-number) leave those tokens
 * intact for the IDE host to fill — the bridge stays heuristic-light by
 * design and never substitutes "guess" values.
 *
 * Bindings are returned as a frozen object so the caller can spread
 * additional manual bindings (e.g. `{ ...derived, UNIQUE_PROGRAM_NUMBER:
 * userInput }`) without mutating the heuristic baseline.
 */
export function deriveQuickFixBindings(issue: LintIssue): IdeQuickFixBindings {
  const code = typeof issue.code === "string" ? issue.code : "";
  if (code.length === 0) return Object.freeze({});
  if (code.startsWith(DUPLICATE_ADDRESSES_PREFIX)) {
    const letter = code.slice(DUPLICATE_ADDRESSES_PREFIX.length);
    if (letter.length > 0) {
      return Object.freeze({ LETTER: letter });
    }
  }
  return Object.freeze({});
}

/**
 * Split program source into display blocks using the same semantics as the
 * core parser's default (newline-separated, trimmed, empty lines skipped).
 */
export function splitProgramIntoDisplayBlocks(source: string): string[] {
  return source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/**
 * Resolve a parser `blockIndex` to a 1-based editor range in the original
 * source. Returns `undefined` when `blockIndex` is out of range.
 */
export function resolveQuickFixRange(
  source: string,
  blockIndex: number
): IdeQuickFix["range"] | undefined {
  if (!Number.isFinite(blockIndex) || blockIndex < 0) return undefined;
  let currentBlock = -1;
  let lineNo = 0;
  for (const rawLine of source.split(/\r?\n/)) {
    lineNo += 1;
    const trimmed = rawLine.trim();
    if (trimmed.length === 0) continue;
    currentBlock += 1;
    if (currentBlock === blockIndex) {
      const startColumn = rawLine.indexOf(trimmed) + 1;
      const endColumn = startColumn + trimmed.length - 1;
      return {
        startLine: lineNo,
        startColumn,
        endLine: lineNo,
        endColumn
      };
    }
  }
  return undefined;
}
