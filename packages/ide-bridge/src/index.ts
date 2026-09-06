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
  getParseDiagnosticFix,
  getSafetyFindingFix,
  blockSpanToRange,
  splitProgramIntoBlockSpans,
  splitProgramIntoBlocks,
  type BlockSplitOptions,
  type CliBatchEnvelope,
  type CliBatchLintIssuesByControllerCodeAggregation,
  type CliBatchParseDiagnosticsByCodeAggregation,
  type CliJobCheckEnvelope,
  type LintIssue
} from "@cnc/core";

/**
 * Canonical controller-grammar quick-fix surfaced to an IDE plugin. The
 * shape inlines the catalogue's `title` + `rationale` + optional
 * `replacementTemplate` so consumers don't have to hop through the
 * underlying `ControllerGrammarFix` reference. An optional `range`
 * field is populated when `getQuickFixForLintIssue(issue, source)` is
 * called with program source (and optional `semicolonEob` options).
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
   * specific source location. Populated by `resolveQuickFixRange` when
   * program `source` is supplied to `getQuickFixForLintIssue`.
   */
  range?: {
    startLine: number;
    startColumn?: number;
    endLine: number;
    endColumn?: number;
  };
};

export type QuickFixRangeOptions = BlockSplitOptions;

export { splitProgramIntoBlocks as splitProgramIntoDisplayBlocks };

/**
 * Resolve a parser `blockIndex` to a 1-based editor range in the original
 * source. Supports Haas semicolon-EOB block splitting when
 * `options.semicolonEob` is true.
 */
export function resolveQuickFixRange(
  source: string,
  blockIndex: number,
  options?: QuickFixRangeOptions
): IdeQuickFix["range"] | undefined {
  if (!Number.isFinite(blockIndex) || blockIndex < 0) return undefined;
  const spans = splitProgramIntoBlockSpans(source, options);
  const span = spans[blockIndex];
  if (!span) return undefined;
  return blockSpanToRange(source, span);
}

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
  source?: string,
  rangeOptions?: QuickFixRangeOptions
): IdeQuickFix | undefined {
  if (typeof issue.code !== "string" || issue.code.length === 0) return undefined;
  const fix = getControllerGrammarFix(issue.code);
  if (!fix) return undefined;
  const out = toQuickFix(issue.code, fix);
  if (source !== undefined) {
    const range = resolveQuickFixRange(source, issue.blockIndex, rangeOptions);
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
  source?: string,
  rangeOptions?: QuickFixRangeOptions
): IdeQuickFix[] {
  const out: IdeQuickFix[] = [];
  for (const issue of envelope.controllerLints) {
    const qf = getQuickFixForLintIssue(issue, source, rangeOptions);
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
  envelope: CliBatchEnvelope,
  sourcesByInput: ReadonlyMap<string, string> = new Map(),
  rangeOptions?: QuickFixRangeOptions
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
    const source = sourcesByInput.get(row.input);
    if (source !== undefined && row.firstBlockIndex !== undefined) {
      const range = resolveQuickFixRange(source, row.firstBlockIndex, rangeOptions);
      if (range) quickFix.range = range;
    }
    const existing = result.get(row.input);
    if (existing) {
      existing.push(quickFix);
    } else {
      result.set(row.input, [quickFix]);
    }
  }
  return result;
}

export type IdeBatchAggregatedQuickFix = IdeQuickFix & {
  count: number;
  blockers: number;
  warnings: number;
  inputs: string[];
};

/**
 * Map Schema v11 `summary.lintIssuesByControllerCodeAggregated` rows to
 * catalogue quick-fixes without walking per-input attribution. Output order
 * mirrors the batch rollup (count desc → source asc → code asc). Rows whose
 * `code` is not in the catalogue are skipped.
 */
export function mapBatchControllerCodeAggregatedToQuickFixes(
  envelope: CliBatchEnvelope
): IdeBatchAggregatedQuickFix[] {
  const rows = envelope.summary.lintIssuesByControllerCodeAggregated;
  if (!rows || rows.length === 0) return [];
  const out: IdeBatchAggregatedQuickFix[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.code)) continue;
    const fix = getControllerGrammarFix(row.code);
    if (!fix) continue;
    seen.add(row.code);
    out.push({
      ...toQuickFix(row.code, fix),
      count: row.count,
      blockers: row.blockers,
      warnings: row.warnings,
      inputs: [...row.inputs]
    });
  }
  return out;
}

/**
 * Map aggregated controller-code quick-fixes to per-input fixes with optional
 * editor ranges when program sources are supplied via `sourcesByInput`.
 */
export function mapBatchControllerCodeAggregatedToFileQuickFixes(
  envelope: CliBatchEnvelope,
  sourcesByInput: ReadonlyMap<string, string>,
  rangeOptions?: QuickFixRangeOptions
): Map<string, IdeQuickFix[]> {
  const aggregated = mapBatchControllerCodeAggregatedToQuickFixes(envelope);
  if (aggregated.length === 0) return new Map();

  const blockIndexByInputCode = new Map<string, Map<string, number>>();
  for (const entry of envelope.results) {
    const byCode = new Map<string, number>();
    for (const issue of entry.envelope.controllerLints) {
      if (typeof issue.code !== "string" || issue.code.length === 0) continue;
      if (!byCode.has(issue.code)) byCode.set(issue.code, issue.blockIndex);
    }
    blockIndexByInputCode.set(entry.input, byCode);
  }

  const result = new Map<string, IdeQuickFix[]>();
  const seenPerInput = new Map<string, Set<string>>();
  for (const fix of aggregated) {
    for (const input of fix.inputs) {
      let seen = seenPerInput.get(input);
      if (!seen) {
        seen = new Set<string>();
        seenPerInput.set(input, seen);
      }
      if (seen.has(fix.code)) continue;
      seen.add(fix.code);

      const out: IdeQuickFix = {
        code: fix.code,
        title: fix.title,
        rationale: fix.rationale
      };
      if (fix.replacementTemplate !== undefined) {
        out.replacementTemplate = fix.replacementTemplate;
      }
      const source = sourcesByInput.get(input);
      const blockIndex = blockIndexByInputCode.get(input)?.get(fix.code);
      if (source !== undefined && blockIndex !== undefined) {
        const range = resolveQuickFixRange(source, blockIndex, rangeOptions);
        if (range) out.range = range;
      }

      const existing = result.get(input);
      if (existing) {
        existing.push(out);
      } else {
        result.set(input, [out]);
      }
    }
  }
  return result;
}

export type IdeBatchParseDiagAggregatedQuickFix = IdeQuickFix & {
  count: number;
  warnings: number;
  errors: number;
  inputs: string[];
};

/**
 * Map Schema v12 `summary.parseDiagnosticsByCodeAggregated` rows to
 * catalogue parse-diagnostic fixes without walking per-input attribution.
 */
export function mapBatchParseDiagnosticsByCodeAggregatedToQuickFixes(
  envelope: CliBatchEnvelope
): IdeBatchParseDiagAggregatedQuickFix[] {
  const rows = envelope.summary.parseDiagnosticsByCodeAggregated;
  if (!rows || rows.length === 0) return [];
  const out: IdeBatchParseDiagAggregatedQuickFix[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.code)) continue;
    const fix = getParseDiagnosticFix(row.code);
    if (!fix) continue;
    seen.add(row.code);
    out.push({
      code: row.code,
      title: fix.title,
      rationale: fix.rationale,
      ...(fix.replacementTemplate !== undefined
        ? { replacementTemplate: fix.replacementTemplate }
        : {}),
      count: row.count,
      warnings: row.warnings,
      errors: row.errors,
      inputs: [...row.inputs]
    });
  }
  return out;
}

/**
 * Map aggregated parse-diagnostic quick-fixes to per-input fixes with optional
 * editor ranges when program sources are supplied via `sourcesByInput`.
 */
export function mapBatchParseDiagnosticsByCodeAggregatedToFileQuickFixes(
  envelope: CliBatchEnvelope,
  sourcesByInput: ReadonlyMap<string, string>,
  rangeOptions?: QuickFixRangeOptions
): Map<string, IdeQuickFix[]> {
  const aggregated = mapBatchParseDiagnosticsByCodeAggregatedToQuickFixes(envelope);
  if (aggregated.length === 0) return new Map();

  const blockIndexByInputCode = new Map<string, Map<string, number>>();
  for (const entry of envelope.results) {
    const byCode = new Map<string, number>();
    for (const row of entry.envelope.parseDiagnosticsByCode) {
      if (row.firstBlockIndex === undefined) continue;
      if (!byCode.has(row.code)) byCode.set(row.code, row.firstBlockIndex);
    }
    blockIndexByInputCode.set(entry.input, byCode);
  }

  const result = new Map<string, IdeQuickFix[]>();
  const seenPerInput = new Map<string, Set<string>>();
  for (const fix of aggregated) {
    for (const input of fix.inputs) {
      let seen = seenPerInput.get(input);
      if (!seen) {
        seen = new Set<string>();
        seenPerInput.set(input, seen);
      }
      if (seen.has(fix.code)) continue;
      seen.add(fix.code);

      const out: IdeQuickFix = {
        code: fix.code,
        title: fix.title,
        rationale: fix.rationale
      };
      if (fix.replacementTemplate !== undefined) {
        out.replacementTemplate = fix.replacementTemplate;
      }
      const source = sourcesByInput.get(input);
      const blockIndex = blockIndexByInputCode.get(input)?.get(fix.code);
      if (source !== undefined && blockIndex !== undefined) {
        const range = resolveQuickFixRange(source, blockIndex, rangeOptions);
        if (range) out.range = range;
      }

      const existing = result.get(input);
      if (existing) {
        existing.push(out);
      } else {
        result.set(input, [out]);
      }
    }
  }
  return result;
}

export type IdeBatchSafetyFindingsAggregatedQuickFix = IdeQuickFix & {
  source: string;
  count: number;
  blockers: number;
  warnings: number;
  inputs: string[];
};

/**
 * Map Schema v15/v16 `summary.safetyFindingsByCodeAggregated` rows to
 * catalogue safety-finding fixes.
 */
export function mapBatchSafetyFindingsByCodeAggregatedToQuickFixes(
  envelope: CliBatchEnvelope
): IdeBatchSafetyFindingsAggregatedQuickFix[] {
  const rows = envelope.summary.safetyFindingsByCodeAggregated;
  if (!rows || rows.length === 0) return [];
  const out: IdeBatchSafetyFindingsAggregatedQuickFix[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const key = `${row.source}::${row.code}`;
    if (seen.has(key)) continue;
    const fix = getSafetyFindingFix(row.code);
    if (!fix) continue;
    seen.add(key);
    out.push({
      code: row.code,
      title: fix.title,
      rationale: fix.rationale,
      ...(fix.replacementTemplate !== undefined
        ? { replacementTemplate: fix.replacementTemplate }
        : {}),
      source: row.source,
      count: row.count,
      blockers: row.blockers,
      warnings: row.warnings,
      inputs: [...row.inputs]
    });
  }
  return out;
}

/**
 * Map aggregated safety-finding quick-fixes to per-input fixes with optional
 * editor ranges when program sources are supplied via `sourcesByInput`.
 */
export function mapBatchSafetyFindingsByCodeAggregatedToFileQuickFixes(
  envelope: CliBatchEnvelope,
  sourcesByInput: ReadonlyMap<string, string>,
  rangeOptions?: QuickFixRangeOptions
): Map<string, IdeQuickFix[]> {
  const aggregated = mapBatchSafetyFindingsByCodeAggregatedToQuickFixes(envelope);
  if (aggregated.length === 0) return new Map();

  const blockIndexByInputCode = new Map<string, Map<string, number>>();
  for (const entry of envelope.results) {
    const byCode = new Map<string, number>();
    for (const row of entry.envelope.safetyFindingsByCode) {
      if (row.firstBlockIndex === undefined) continue;
      if (!byCode.has(row.code)) byCode.set(row.code, row.firstBlockIndex);
    }
    blockIndexByInputCode.set(entry.input, byCode);
  }

  const result = new Map<string, IdeQuickFix[]>();
  const seenPerInput = new Map<string, Set<string>>();
  for (const fix of aggregated) {
    for (const input of fix.inputs) {
      let seen = seenPerInput.get(input);
      if (!seen) {
        seen = new Set<string>();
        seenPerInput.set(input, seen);
      }
      if (seen.has(fix.code)) continue;
      seen.add(fix.code);

      const out: IdeQuickFix = {
        code: fix.code,
        title: fix.title,
        rationale: fix.rationale
      };
      if (fix.replacementTemplate !== undefined) {
        out.replacementTemplate = fix.replacementTemplate;
      }
      const source = sourcesByInput.get(input);
      const blockIndex = blockIndexByInputCode.get(input)?.get(fix.code);
      if (source !== undefined && blockIndex !== undefined) {
        const range = resolveQuickFixRange(source, blockIndex, rangeOptions);
        if (range) out.range = range;
      }

      const existing = result.get(input);
      if (existing) {
        existing.push(out);
      } else {
        result.set(input, [out]);
      }
    }
  }
  return result;
}

export function getQuickFixForSafetyFinding(input: {
  code: string;
}): IdeQuickFix | undefined {
  const fix = getSafetyFindingFix(input.code);
  if (!fix) return undefined;
  return {
    code: fix.code,
    title: fix.title,
    rationale: fix.rationale,
    ...(fix.replacementTemplate !== undefined
      ? { replacementTemplate: fix.replacementTemplate }
      : {})
  };
}

/**
 * Walk a single-input envelope's `safetyFindingsByCode` and resolve catalogue
 * safety-finding quick-fixes. Optional `source` attaches editor ranges via
 * each row's `firstBlockIndex`.
 */
export function mapJobCheckEnvelopeToSafetyQuickFixes(
  envelope: CliJobCheckEnvelope,
  source?: string,
  rangeOptions?: QuickFixRangeOptions
): IdeQuickFix[] {
  const out: IdeQuickFix[] = [];
  const seen = new Set<string>();
  for (const row of envelope.safetyFindingsByCode ?? []) {
    if (seen.has(row.code)) continue;
    const fix = getSafetyFindingFix(row.code);
    if (!fix) continue;
    seen.add(row.code);
    const qf = toQuickFix(row.code, fix);
    if (source !== undefined && row.firstBlockIndex !== undefined) {
      const range = resolveQuickFixRange(source, row.firstBlockIndex, rangeOptions);
      if (range) qf.range = range;
    }
    out.push(qf);
  }
  return out;
}

/**
 * Walk a single-input envelope's `parseDiagnosticsByCode` and resolve catalogue
 * parse-diagnostic quick-fixes. Optional `source` attaches editor ranges via
 * each row's `firstBlockIndex`.
 */
export function mapJobCheckEnvelopeToParseDiagnosticQuickFixes(
  envelope: CliJobCheckEnvelope,
  source?: string,
  rangeOptions?: QuickFixRangeOptions
): IdeQuickFix[] {
  const out: IdeQuickFix[] = [];
  const seen = new Set<string>();
  for (const row of envelope.parseDiagnosticsByCode ?? []) {
    if (seen.has(row.code)) continue;
    const fix = getParseDiagnosticFix(row.code);
    if (!fix) continue;
    seen.add(row.code);
    const qf = toQuickFix(row.code, fix);
    if (source !== undefined && row.firstBlockIndex !== undefined) {
      const range = resolveQuickFixRange(source, row.firstBlockIndex, rangeOptions);
      if (range) qf.range = range;
    }
    out.push(qf);
  }
  return out;
}

/**
 * Map Schema v16/v18 `summary.safetyFindingsByCodePerInputFile` attribution
 * rows to per-input quick-fixes. Prefer this over digging nested `results[]`
 * when only attribution is available. Schema v18 `firstBlockIndex` on rows
 * enables ranges without scanning per-entry envelopes.
 */
export function mapBatchSafetyFindingsAttributionToFileQuickFixes(
  envelope: CliBatchEnvelope,
  sourcesByInput: ReadonlyMap<string, string> = new Map(),
  rangeOptions?: QuickFixRangeOptions
): Map<string, IdeQuickFix[]> {
  const result = new Map<string, IdeQuickFix[]>();
  const seenPerInput = new Map<string, Set<string>>();
  for (const row of envelope.summary.safetyFindingsByCodePerInputFile ?? []) {
    const fix = getSafetyFindingFix(row.code);
    if (!fix) continue;
    let seen = seenPerInput.get(row.input);
    if (!seen) {
      seen = new Set<string>();
      seenPerInput.set(row.input, seen);
    }
    if (seen.has(row.code)) continue;
    seen.add(row.code);
    const out: IdeQuickFix = toQuickFix(row.code, fix);
    const source = sourcesByInput.get(row.input);
    if (source !== undefined && row.firstBlockIndex !== undefined) {
      const range = resolveQuickFixRange(source, row.firstBlockIndex, rangeOptions);
      if (range) out.range = range;
    }
    const existing = result.get(row.input);
    if (existing) existing.push(out);
    else result.set(row.input, [out]);
  }
  return result;
}

/**
 * Map Schema v19 `summary.parseDiagnosticsByCodePerInputFile` attribution
 * rows to per-input parse-diagnostic quick-fixes.
 */
export function mapBatchParseDiagnosticsAttributionToFileQuickFixes(
  envelope: CliBatchEnvelope,
  sourcesByInput: ReadonlyMap<string, string> = new Map(),
  rangeOptions?: QuickFixRangeOptions
): Map<string, IdeQuickFix[]> {
  const result = new Map<string, IdeQuickFix[]>();
  const seenPerInput = new Map<string, Set<string>>();
  for (const row of envelope.summary.parseDiagnosticsByCodePerInputFile ?? []) {
    const fix = getParseDiagnosticFix(row.code);
    if (!fix) continue;
    let seen = seenPerInput.get(row.input);
    if (!seen) {
      seen = new Set<string>();
      seenPerInput.set(row.input, seen);
    }
    if (seen.has(row.code)) continue;
    seen.add(row.code);
    const out: IdeQuickFix = toQuickFix(row.code, fix);
    const source = sourcesByInput.get(row.input);
    if (source !== undefined && row.firstBlockIndex !== undefined) {
      const range = resolveQuickFixRange(source, row.firstBlockIndex, rangeOptions);
      if (range) out.range = range;
    }
    const existing = result.get(row.input);
    if (existing) existing.push(out);
    else result.set(row.input, [out]);
  }
  return result;
}

/**
 * Thin status helper for Schema v17+ `summary.batchWalk` (no schema change).
 */
export function formatBatchWalkStatus(
  envelope: CliBatchEnvelope
): string {
  const walk = envelope.summary.batchWalk;
  if (!walk) return "batch-walk: none";
  const exportPart =
    walk.export?.outDir || walk.export?.setupSheetPdfDir
      ? `, export outDir=${walk.export.outDir ?? "-"} pdf=${walk.export.setupSheetPdfDir ?? "-"}`
      : "";
  return `batch-walk: root=${walk.root} matched=${walk.matched} skipped=${walk.skipped}${
    walk.recursive ? " recursive" : ""
  }${exportPart}`;
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
 * Default (lenient): tokens missing from `bindings` are left in place
 * verbatim so callers can compose multiple binding passes.
 *
 * Strict mode (`options.strict === true`): throws
 * `Error("Unbound template tokens: …")` when any `{{NAME}}` remains
 * unbound after substitution.
 *
 * Returns `undefined` when `fix.replacementTemplate` is absent — no
 * template to expand. The original `fix` object is never mutated.
 */
export function expandIdeQuickFixTemplate(
  fix: IdeQuickFix,
  bindings: IdeQuickFixBindings,
  options?: { strict?: boolean }
): string | undefined {
  if (fix.replacementTemplate === undefined) return undefined;
  const unbound = new Set<string>();
  const expanded = fix.replacementTemplate.replace(
    TEMPLATE_TOKEN_PATTERN,
    (match, name: string) => {
      const value = bindings[name];
      if (value === undefined) {
        unbound.add(name);
        return match;
      }
      return value;
    }
  );
  if (options?.strict && unbound.size > 0) {
    throw new Error(
      `Unbound template tokens: ${[...unbound].sort((a, b) => a.localeCompare(b)).join(", ")}`
    );
  }
  return expanded;
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

export type ParseDiagnosticBindingInput = {
  code: string;
  message?: string;
};

/**
 * Heuristic bindings for parse-diagnostic catalogue templates. Narrow by
 * design — only values unambiguously extractable from `code` + `message`:
 *
 *  - `ADDRESS_MISSING_VALUE` → `{ LETTER }` from `Address 'X' has no...`
 *  - `UNKNOWN_TOKEN` → `{ TOKEN }` from `Unknown token '...' skipped...`
 *
 * All other codes return an empty object.
 */
export function deriveParseDiagnosticFixBindings(
  input: ParseDiagnosticBindingInput
): IdeQuickFixBindings {
  const code = typeof input.code === "string" ? input.code : "";
  const message = typeof input.message === "string" ? input.message : "";
  if (code === "ADDRESS_MISSING_VALUE") {
    const match = message.match(/Address\s+'([A-Za-z])'/);
    if (match?.[1]) return Object.freeze({ LETTER: match[1].toUpperCase() });
  }
  if (code === "UNKNOWN_TOKEN") {
    const match = message.match(/Unknown token\s+'([^']+)'/);
    if (match?.[1]) return Object.freeze({ TOKEN: match[1] });
  }
  if (code === "INVALID_CHARACTER") {
    const match = message.match(/character\s+'([^']+)'/i) ?? message.match(/'([^']+)'/);
    if (match?.[1]) return Object.freeze({ CHAR: match[1] });
  }
  if (code === "UNMATCHED_BRACKET") {
    if (/missing\s+'\]'|Add missing '\]'/i.test(message) || /opens?\s*>\s*closes?/i.test(message)) {
      return Object.freeze({ CLOSER: "]" });
    }
  }
  return Object.freeze({});
}

export type SafetyFindingBindingInput = {
  code: string;
  message?: string;
  /** Optional program source for Schema v20 program-source binding pass. */
  source?: string;
  /** Block index into `source` (non-empty blocks). */
  blockIndex?: number;
  /** Forwarded to {@link splitProgramIntoBlocks} when reading `source`. */
  rangeOptions?: BlockSplitOptions;
};

function extractAddressValue(blockText: string, letter: string): string | undefined {
  const re = new RegExp(`\\b${letter}\\s*(-?\\d+(?:\\.\\d+)?)\\b`, "i");
  const match = blockText.match(re);
  return match?.[1];
}

function blockTextAtIndex(
  source: string,
  blockIndex: number,
  options?: BlockSplitOptions
): string | undefined {
  const blocks = splitProgramIntoBlocks(source, options);
  if (blockIndex < 0 || blockIndex >= blocks.length) return undefined;
  return blocks[blockIndex];
}

/**
 * Heuristic bindings for safety-finding catalogue templates.
 *
 * Message pass (v19): TOOL/H/Z/R from finding `message` when present.
 * Program-source pass (v20): when `source` + `blockIndex` are supplied,
 * fill still-unbound `TOOL`/`H`/`Z`/`R` from the block text. Message
 * bindings win on conflict so explicit finding text stays authoritative.
 * Schema v21: when H is still unbound for G43-related codes after the
 * source pass, default `H` to `"1"` so templates expand for apply-edit.
 */
export function deriveSafetyFindingFixBindings(
  input: SafetyFindingBindingInput
): IdeQuickFixBindings {
  const code = typeof input.code === "string" ? input.code : "";
  const message = typeof input.message === "string" ? input.message : "";
  const bindings: Record<string, string> = {};

  if (code === "TOOL_H_MISMATCH" || code === "TOOL_WITHOUT_G43") {
    const match = message.match(/\bT\s*(\d+)\b/i) ?? message.match(/tool\s+(\d+)/i);
    if (match?.[1]) {
      bindings.TOOL = match[1];
      bindings.H = match[1];
    }
  }
  if (code === "G43_WITHOUT_H") {
    const match = message.match(/\bH\s*(\d+)\b/i);
    if (match?.[1]) bindings.H = match[1];
  }
  if (code === "MISSING_G43_BEFORE_NEGATIVE_Z") {
    const match = message.match(/\bZ\s*(-?\d+(?:\.\d+)?)\b/i);
    if (match?.[1]) bindings.Z = match[1];
  }
  if (code === "CANNED_CYCLE_NO_R") {
    const match = message.match(/\bR\s*(-?\d+(?:\.\d+)?)\b/i);
    if (match?.[1]) bindings.R = match[1];
  }

  if (
    input.source !== undefined &&
    input.blockIndex !== undefined &&
    (code === "TOOL_H_MISMATCH" ||
      code === "TOOL_WITHOUT_G43" ||
      code === "G43_WITHOUT_H" ||
      code === "MISSING_G43_BEFORE_NEGATIVE_Z" ||
      code === "CANNED_CYCLE_NO_R")
  ) {
    const block = blockTextAtIndex(input.source, input.blockIndex, input.rangeOptions);
    if (block) {
      if (bindings.TOOL === undefined) {
        const t = extractAddressValue(block, "T");
        if (t) bindings.TOOL = t;
      }
      if (bindings.H === undefined) {
        const h = extractAddressValue(block, "H") ?? bindings.TOOL;
        if (h) bindings.H = h;
      }
      if (
        bindings.H === undefined &&
        (code === "MISSING_G43_BEFORE_NEGATIVE_Z" ||
          code === "TOOL_WITHOUT_G43" ||
          code === "G43_WITHOUT_H")
      ) {
        bindings.H = "1";
      }
      if (bindings.Z === undefined && code === "MISSING_G43_BEFORE_NEGATIVE_Z") {
        const z = extractAddressValue(block, "Z");
        if (z) bindings.Z = z;
      }
      if (bindings.R === undefined && code === "CANNED_CYCLE_NO_R") {
        const r = extractAddressValue(block, "R");
        if (r) bindings.R = r;
      }
    }
  }

  return Object.freeze(bindings);
}

/**
 * Offset-based edit for applying an expanded quick-fix template into
 * program source. Prefer this over line/column when splicing text.
 */
export type IdeQuickFixEdit = {
  startOffset: number;
  endOffset: number;
  replacement: string;
};

/**
 * Resolve a parser `blockIndex` to character offsets in `source`.
 */
export function resolveQuickFixSpan(
  source: string,
  blockIndex: number,
  options?: QuickFixRangeOptions
): { startOffset: number; endOffset: number } | undefined {
  if (!Number.isFinite(blockIndex) || blockIndex < 0) return undefined;
  const spans = splitProgramIntoBlockSpans(source, options);
  const span = spans[blockIndex];
  if (!span) return undefined;
  return { startOffset: span.startOffset, endOffset: span.endOffset };
}

/**
 * Apply a single offset-based edit. Returns `applied: false` when the
 * range is invalid (out of bounds or inverted).
 */
export function applyIdeQuickFixEdit(
  source: string,
  edit: IdeQuickFixEdit
): { source: string; applied: boolean } {
  if (
    !Number.isFinite(edit.startOffset) ||
    !Number.isFinite(edit.endOffset) ||
    edit.startOffset < 0 ||
    edit.endOffset < edit.startOffset ||
    edit.endOffset > source.length
  ) {
    return { source, applied: false };
  }
  return {
    source:
      source.slice(0, edit.startOffset) + edit.replacement + source.slice(edit.endOffset),
    applied: true
  };
}

/**
 * Apply multiple edits in descending `startOffset` order so earlier
 * ranges stay valid. Invalid edits are skipped.
 */
export function applyIdeQuickFixEdits(
  source: string,
  edits: ReadonlyArray<IdeQuickFixEdit>
): { source: string; applied: number } {
  const ordered = [...edits].sort((a, b) => b.startOffset - a.startOffset);
  let next = source;
  let applied = 0;
  for (const edit of ordered) {
    const result = applyIdeQuickFixEdit(next, edit);
    if (result.applied) {
      next = result.source;
      applied += 1;
    }
  }
  return { source: next, applied };
}
