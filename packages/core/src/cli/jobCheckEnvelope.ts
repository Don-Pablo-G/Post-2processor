import type {
  LintIssueProvenanceSource,
  LintIssueWithProvenance,
  RunJobCheckResult
} from "../types.js";
import { matchesAnyStrictControllerCodePattern } from "./strictControllerCodesGate.js";

export const CLI_SCHEMA_VERSION = 19;

export type CliLintIssuesBySourceEntry = {
  source: LintIssueProvenanceSource;
  count: number;
  blockers: number;
  warnings: number;
};

export type CliParseDiagnosticsByCodeEntry = {
  code: string;
  count: number;
  warnings: number;
  errors: number;
  /**
   * Schema v14: earliest `blockIndex` for this diagnostic code in the
   * parsed program. Absent when unavailable. Append-only optional field.
   */
  firstBlockIndex?: number;
};

/**
 * Schema v4: cross-table linking lint issues back to the parse diagnostic
 * codes that helped produce them via `provenance.relatedDiagnostics`. One
 * entry per `(source, code)` pair; `count` is the number of distinct lint
 * issues whose provenance references that code at least once.
 */
export type CliLintIssuesByParseDiagCodeEntry = {
  source: LintIssueProvenanceSource;
  code: string;
  count: number;
};

/**
 * Schema v5 cross-table: aggregates `lintIssues[]` by their stable rule
 * `code` (currently emitted by controller-grammar rules under the `CG_*`
 * namespace; see `lints/controllerGrammar.ts`). Issues without a `code` are
 * excluded — this is intentional so legacy / textual-only rules don't
 * pollute the bucket. Strict superset of `lintIssuesBySource` along the
 * `(source, code)` axis.
 */
export type CliLintIssuesByControllerCodeEntry = {
  source: LintIssueProvenanceSource;
  code: string;
  count: number;
  blockers: number;
  warnings: number;
};

/**
 * Schema v15–v16: rollup of advisor + simulation `SafetyFinding` rows by
 * `(source, code)`. Empty array when no safety findings are present.
 * Sorted by `count` desc → `source` asc → `code` asc. Append-only field.
 * Schema v16 adds the required `source` discriminator.
 */
export type CliSafetyFindingSource = "advisor" | "simulation";

export type CliSafetyFindingsByCodeEntry = {
  source: CliSafetyFindingSource;
  code: string;
  count: number;
  blockers: number;
  warnings: number;
  firstBlockIndex?: number;
};

export type CliJobCheckEnvelope = {
  schemaVersion: number;
  readyToRunScore: number;
  blockerCount: number;
  warningCount: number;
  blocked: boolean;
  messages: string[];
  parseDiagnosticsSummary: RunJobCheckResult["parseDiagnosticsSummary"];
  parseDiagnosticsPolicyBreaches: RunJobCheckResult["parseDiagnosticsPolicyBreaches"];
  lintIssuesSummary: RunJobCheckResult["lintIssuesSummary"];
  /** Schema v2: per-source rollup with severity sub-counts. Append-only field. */
  lintIssuesBySource: CliLintIssuesBySourceEntry[];
  /**
   * Schema v3: per-code rollup of parse diagnostics with warning / error
   * sub-counts. Strict superset of `parseDiagnosticsSummary.byCode`. Append-only.
   * Note: the original "Known Gaps" entry called this `parseDiagnosticsBySource`,
   * but parse diagnostics are categorized by `code`, not `source`, so the
   * shipping field uses the more accurate `parseDiagnosticsByCode` name.
   */
  parseDiagnosticsByCode: CliParseDiagnosticsByCodeEntry[];
  /**
   * Schema v4: cross-table aggregating `lintIssues[].provenance.relatedDiagnostics[].code`.
   * Empty array when no lint issue references any parse diagnostic. Sorted by
   * `count` desc, then `source` asc, then `code` asc. Append-only field.
   */
  lintIssuesByParseDiagCode: CliLintIssuesByParseDiagCodeEntry[];
  /**
   * Schema v5: cross-table aggregating `lintIssues[]` by stable rule `code`.
   * Only issues with a defined `code` (e.g. `CG_*` controller-grammar codes)
   * contribute. Empty array when no coded issues are present. Sorted by
   * `count` desc, then `source` asc, then `code` asc. Append-only field.
   */
  lintIssuesByControllerCode: CliLintIssuesByControllerCodeEntry[];
  /**
   * Schema v15–v16: per-(source, code) rollup of advisor `safetyFindings` +
   * `simulationFindings`. Empty array when none. Sorted `count` desc →
   * `source` asc → `code` asc. Append-only field. Schema v16 requires `source`.
   */
  safetyFindingsByCode: CliSafetyFindingsByCodeEntry[];
  controllerLints: LintIssueWithProvenance[];
  setupSheetExportTxt: string;
  proveoutCode: string;
  /**
   * Schema v7: when `--strict-controller-codes <code,...>` flips
   * `blocked = true` because at least one lint issue's `code` matched a
   * provided pattern (exact or `*`-suffix family wildcard), this field
   * lists the matched codes (sorted ascending, deduplicated). Absent when
   * the flag was not supplied or no code matched. Append-only optional field.
   */
  strictControllerCodesGated?: string[];
  /**
   * Schema v8: structured per-envelope block reasons. Parallel to
   * `messages[]` for back-compat (every entry's `message` mirrors the
   * canonical line that's also pushed to `messages[]`), but exposes a
   * stable `reason` discriminator + an optional `matchedCodes` payload
   * for downstream tooling that wants to aggregate or filter by reason.
   *
   * Canonical reasons emitted by this build:
   *   - `parse_diagnostics_policy_breach` — `parseDiagnosticsPolicyBreaches`
   *     is non-empty. `matchedCodes` lists the breach codes (sorted asc, deduped).
   *   - `lint_blocker` — `blockerCount > 0`. No `matchedCodes` (blockers
   *     come from many sources; consumers should consult
   *     `lintIssuesByControllerCode` for the per-code attribution).
   *   - `strict_controller_codes` — pushed by `applyStrictControllerCodesGate`
   *     when at least one lint code matched a `--strict-controller-codes` pattern.
   *     `matchedCodes` mirrors `strictControllerCodesGated`.
   *
   * Absent (NOT empty array) when no structured reason was produced.
   * Append-only optional field — new reasons may be added in future schemas
   * without breaking v8 consumers.
   */
  blockReasons?: CliBlockReason[];
};

export type CliBlockReason = {
  /** Stable discriminator, e.g. `"strict_controller_codes"`. */
  reason: string;
  /** Human-readable line; mirrors the corresponding `messages[]` entry. */
  message: string;
  /**
   * Optional payload (e.g. matched controller codes for
   * `strict_controller_codes`, breach codes for
   * `parse_diagnostics_policy_breach`). When present, sorted ascending
   * and deduped. Absent when the reason has no per-code surface.
   */
  matchedCodes?: string[];
};

const ENVELOPE_SOURCE_ORDER: ReadonlyArray<LintIssueProvenanceSource> = [
  "lexer",
  "expression_parser",
  "controller_grammar",
  "common_lint",
  "profile_lint"
];

function buildLintIssuesBySource(
  result: RunJobCheckResult
): CliLintIssuesBySourceEntry[] {
  const summary = result.lintIssuesSummary;
  if (!summary || summary.total === 0) return [];
  const topOrder = new Map<LintIssueProvenanceSource, number>();
  summary.topSources.forEach((source, idx) => {
    topOrder.set(source, idx);
  });
  const entries = (Object.entries(summary.bySource) as Array<
    [LintIssueProvenanceSource, number]
  >).filter(([, count]) => count > 0);
  entries.sort((a, b) => {
    const aTop = topOrder.get(a[0]);
    const bTop = topOrder.get(b[0]);
    if (aTop !== undefined && bTop !== undefined) return aTop - bTop;
    if (aTop !== undefined) return -1;
    if (bTop !== undefined) return 1;
    if (b[1] !== a[1]) return b[1] - a[1];
    return ENVELOPE_SOURCE_ORDER.indexOf(a[0]) - ENVELOPE_SOURCE_ORDER.indexOf(b[0]);
  });
  return entries.map(([source, count]) => {
    const issuesForSource = result.lintIssues.filter(
      (issue) => issue.provenance.source === source
    );
    const blockers = issuesForSource.filter((issue) => issue.severity === "error").length;
    const warnings = issuesForSource.length - blockers;
    return { source, count, blockers, warnings };
  });
}

function buildParseDiagnosticsByCode(
  result: RunJobCheckResult
): CliParseDiagnosticsByCodeEntry[] {
  const summary = result.parseDiagnosticsSummary;
  if (!summary || summary.total === 0) return [];
  const bySeverity = summary.bySeverity ?? {};
  const entries = Object.entries(summary.byCode).filter(([, count]) => count > 0);
  entries.sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0].localeCompare(b[0]);
  });
  return entries.map(([code, count]) => {
    const sev = bySeverity[code] ?? { warnings: 0, errors: 0 };
    const firstBlockIndex = result.parseDiagnosticsFirstBlockIndexByCode[code];
    return {
      code,
      count,
      warnings: sev.warnings,
      errors: sev.errors,
      ...(firstBlockIndex !== undefined ? { firstBlockIndex } : {})
    };
  });
}

function buildLintIssuesByParseDiagCode(
  result: RunJobCheckResult
): CliLintIssuesByParseDiagCodeEntry[] {
  const counts = new Map<string, { source: LintIssueProvenanceSource; code: string; count: number }>();
  for (const issue of result.lintIssues) {
    const related = issue.provenance.relatedDiagnostics ?? [];
    if (related.length === 0) continue;
    // De-dup per issue: a single lint issue with the same code referenced
    // multiple times must only contribute once to the cross-table count.
    const seenCodesForIssue = new Set<string>();
    for (const diag of related) {
      if (seenCodesForIssue.has(diag.code)) continue;
      seenCodesForIssue.add(diag.code);
      const key = `${issue.provenance.source}::${diag.code}`;
      const existing = counts.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        counts.set(key, { source: issue.provenance.source, code: diag.code, count: 1 });
      }
    }
  }
  const entries = [...counts.values()];
  entries.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    if (a.source !== b.source) return a.source.localeCompare(b.source);
    return a.code.localeCompare(b.code);
  });
  return entries;
}

function buildLintIssuesByControllerCode(
  result: RunJobCheckResult
): CliLintIssuesByControllerCodeEntry[] {
  const buckets = new Map<
    string,
    {
      source: LintIssueProvenanceSource;
      code: string;
      count: number;
      blockers: number;
      warnings: number;
    }
  >();
  for (const issue of result.lintIssues) {
    if (typeof issue.code !== "string" || issue.code.length === 0) continue;
    const key = `${issue.provenance.source}::${issue.code}`;
    const existing = buckets.get(key);
    const isBlocker = issue.severity === "error";
    if (existing) {
      existing.count += 1;
      if (isBlocker) existing.blockers += 1;
      else existing.warnings += 1;
    } else {
      buckets.set(key, {
        source: issue.provenance.source,
        code: issue.code,
        count: 1,
        blockers: isBlocker ? 1 : 0,
        warnings: isBlocker ? 0 : 1
      });
    }
  }
  const entries = [...buckets.values()];
  entries.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    if (a.source !== b.source) return a.source.localeCompare(b.source);
    return a.code.localeCompare(b.code);
  });
  return entries;
}

/**
 * Schema v15–v16: roll up advisor + simulation safety findings by
 * `(source, code)`. Pure function — deterministic given `result`.
 */
export function buildSafetyFindingsByCode(
  result: RunJobCheckResult
): CliSafetyFindingsByCodeEntry[] {
  const groups: Array<{ source: CliSafetyFindingSource; findings: typeof result.simulationFindings }> = [
    { source: "advisor", findings: result.advisor?.safetyFindings ?? [] },
    { source: "simulation", findings: result.simulationFindings ?? [] }
  ];
  const buckets = new Map<
    string,
    {
      source: CliSafetyFindingSource;
      code: string;
      count: number;
      blockers: number;
      warnings: number;
      firstBlockIndex?: number;
    }
  >();
  for (const group of groups) {
    for (const finding of group.findings) {
      if (typeof finding.code !== "string" || finding.code.length === 0) continue;
      const key = `${group.source}::${finding.code}`;
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = {
          source: group.source,
          code: finding.code,
          count: 0,
          blockers: 0,
          warnings: 0
        };
        buckets.set(key, bucket);
      }
      bucket.count += 1;
      if (finding.severity === "blocker") bucket.blockers += 1;
      else bucket.warnings += 1;
      if (finding.blockIndex !== undefined) {
        if (bucket.firstBlockIndex === undefined || finding.blockIndex < bucket.firstBlockIndex) {
          bucket.firstBlockIndex = finding.blockIndex;
        }
      }
    }
  }
  const entries: CliSafetyFindingsByCodeEntry[] = [];
  for (const bucket of buckets.values()) {
    entries.push({
      source: bucket.source,
      code: bucket.code,
      count: bucket.count,
      blockers: bucket.blockers,
      warnings: bucket.warnings,
      ...(bucket.firstBlockIndex !== undefined ? { firstBlockIndex: bucket.firstBlockIndex } : {})
    });
  }
  entries.sort((a, b) => {
    if (a.count !== b.count) return b.count - a.count;
    if (a.source !== b.source) return a.source.localeCompare(b.source);
    return a.code.localeCompare(b.code);
  });
  return entries;
}

export function buildJobCheckEnvelope(result: RunJobCheckResult): CliJobCheckEnvelope {
  const controllerLints = result.lintIssues.filter(
    (issue) => issue.provenance.source === "controller_grammar"
  );
  const blockReasons = buildInitialBlockReasons(result);
  const envelope: CliJobCheckEnvelope = {
    schemaVersion: CLI_SCHEMA_VERSION,
    readyToRunScore: result.readyToRunScore,
    blockerCount: result.blockerCount,
    warningCount: result.warningCount,
    blocked: result.blocked,
    messages: [...result.messages],
    parseDiagnosticsSummary: result.parseDiagnosticsSummary,
    parseDiagnosticsPolicyBreaches: result.parseDiagnosticsPolicyBreaches,
    lintIssuesSummary: result.lintIssuesSummary,
    lintIssuesBySource: buildLintIssuesBySource(result),
    parseDiagnosticsByCode: buildParseDiagnosticsByCode(result),
    lintIssuesByParseDiagCode: buildLintIssuesByParseDiagCode(result),
    lintIssuesByControllerCode: buildLintIssuesByControllerCode(result),
    safetyFindingsByCode: buildSafetyFindingsByCode(result),
    controllerLints,
    setupSheetExportTxt: result.setupSheet.exportTxt,
    proveoutCode: result.proveout.code
  };
  if (blockReasons.length > 0) envelope.blockReasons = blockReasons;
  return envelope;
}

/**
 * Schema v8: derive structured `blockReasons` from the existing
 * `RunJobCheckResult` fields. Stays parallel to the canonical
 * `messages[]` lines (same wording, same ordering for the reasons
 * that overlap), so v7 consumers reading `messages[]` continue to
 * see the same content. v8 consumers get the structured discriminator
 * + optional matched-codes payload.
 */
function buildInitialBlockReasons(result: RunJobCheckResult): CliBlockReason[] {
  const reasons: CliBlockReason[] = [];
  if (result.parseDiagnosticsPolicyBreaches.length > 0) {
    // Each breach carries a `key` (e.g. `LEX_UNCLOSED_HEADER`) which
    // identifies the threshold that fired. Surface the union (sorted
    // ascending, deduped) as `matchedCodes` so dashboards can fan out
    // to the per-breach `parseDiagnosticsPolicyBreaches[]` rows.
    const matchedCodes = [
      ...new Set(result.parseDiagnosticsPolicyBreaches.map((b) => b.key))
    ].sort((a, b) => a.localeCompare(b));
    reasons.push({
      reason: "parse_diagnostics_policy_breach",
      message: `Parse diagnostics policy breached by ${result.parseDiagnosticsPolicyBreaches.length} finding(s): ${matchedCodes.join(", ")}`,
      matchedCodes
    });
  }
  if (result.blockerCount > 0) {
    reasons.push({
      reason: "lint_blocker",
      message: `Detected ${result.blockerCount} blocker(s); resolve before machine run.`
    });
  }
  // Schema v18: structured safety-blocker reason with matched finding codes.
  const safetyBlockerCodes = [
    ...new Set(
      [
        ...(result.advisor?.safetyFindings ?? []),
        ...(result.simulationFindings ?? [])
      ]
        .filter((f) => f.severity === "blocker" && typeof f.code === "string" && f.code.length > 0)
        .map((f) => f.code)
    )
  ].sort((a, b) => a.localeCompare(b));
  if (safetyBlockerCodes.length > 0) {
    reasons.push({
      reason: "safety_blocker",
      message: `Detected ${safetyBlockerCodes.length} safety blocker code(s): ${safetyBlockerCodes.join(", ")}`,
      matchedCodes: safetyBlockerCodes
    });
  }
  return reasons;
}

/**
 * Schema v7 strict-controller-codes gate. Walks every issue in
 * `envelope.lintIssuesByControllerCode` and matches its `code` against the
 * caller-supplied patterns (exact code strings or `*`-suffix family
 * wildcards). When at least one code matches:
 *   - `envelope.blocked` is flipped to `true` (idempotent — never flipped back).
 *   - `envelope.messages` gains a synthetic block reason mentioning the matched
 *     codes (deduped, sorted ascending).
 *   - `envelope.strictControllerCodesGated` is populated with the matched
 *     codes (sorted ascending, deduplicated).
 *
 * Returns the SAME envelope reference (mutated in place — cheap and the
 * envelope is freshly built upstream). When `patterns` is undefined or
 * empty, the envelope is returned unchanged so callers can chain
 * unconditionally.
 */
export function applyStrictControllerCodesGate(
  envelope: CliJobCheckEnvelope,
  patterns: readonly string[] | undefined
): CliJobCheckEnvelope {
  if (!patterns || patterns.length === 0) return envelope;
  const matched = new Set<string>();
  for (const entry of envelope.lintIssuesByControllerCode) {
    if (matchesAnyStrictControllerCodePattern(entry.code, patterns)) {
      matched.add(entry.code);
    }
  }
  if (matched.size === 0) return envelope;
  const sorted = [...matched].sort((a, b) => a.localeCompare(b));
  envelope.blocked = true;
  envelope.strictControllerCodesGated = sorted;
  const message = `Blocked by --strict-controller-codes: ${sorted.join(", ")}`;
  envelope.messages.push(message);
  // Schema v8: surface the gate as a structured block reason in
  // addition to the back-compat `messages[]` push. The reason
  // discriminator stays stable across schema bumps so dashboards
  // can pin on `reason === "strict_controller_codes"`.
  if (!envelope.blockReasons) envelope.blockReasons = [];
  envelope.blockReasons.push({
    reason: "strict_controller_codes",
    message,
    matchedCodes: sorted
  });
  return envelope;
}

export function formatJobCheckJson(
  result: RunJobCheckResult,
  envelopeOverride?: CliJobCheckEnvelope
): string {
  return JSON.stringify(envelopeOverride ?? buildJobCheckEnvelope(result), null, 2);
}

export function formatJobCheckNdjsonLine(
  result: RunJobCheckResult,
  envelopeOverride?: CliJobCheckEnvelope
): string {
  return JSON.stringify(envelopeOverride ?? buildJobCheckEnvelope(result));
}

export type CliNdjsonBatchEntry = {
  schemaVersion: number;
  input: string;
  envelope: CliJobCheckEnvelope;
};

export function formatBatchNdjson(entries: CliNdjsonBatchEntry[]): string {
  if (entries.length === 0) return "";
  return entries.map((entry) => JSON.stringify(entry)).join("\n");
}

export type CliBatchEntry = {
  schemaVersion: number;
  input: string;
  envelope: CliJobCheckEnvelope;
};

/**
 * Schema v6: per-input attribution row joining
 * `entries[].envelope.lintIssuesByControllerCode` to its source `input` path.
 * One row per `(input, source, code)` triple. Append-only.
 */
export type CliBatchControllerCodeAttribution = {
  /**
   * Input path as supplied to the CLI walker — absolute or
   * `--input-dir`-relative depending on how the user invoked the tool.
   * Mirrors `CliBatchEntry.input`.
   */
  input: string;
  source: LintIssueProvenanceSource;
  code: string;
  count: number;
  blockers: number;
  warnings: number;
};

export type CliBatchEnvelope = {
  schemaVersion: number;
  results: CliBatchEntry[];
  summary: {
    files: number;
    blocked: number;
    /**
     * Schema v6: per-input cross-table aggregating each entry's
     * `envelope.lintIssuesByControllerCode` keyed by the source input path.
     * Empty array when no entry has coded lint issues. Sorted by:
     *   1. `input` ascending (lexicographic),
     *   2. then `count` descending,
     *   3. then `source` ascending,
     *   4. then `code` ascending.
     * Append-only field.
     */
    lintIssuesByControllerCodePerInputFile: CliBatchControllerCodeAttribution[];
    /**
     * Schema v7: union of every entry's `envelope.strictControllerCodesGated`
     * (sorted ascending, deduplicated). Absent when no entry had a strict-gate
     * match. Append-only optional field; mirrors the per-entry semantics.
     */
    strictControllerCodesGated?: string[];
    /**
     * Schema v8: cross-input aggregation of every entry's
     * `envelope.blockReasons[]`. One row per distinct `reason` value;
     * `inputs` lists the entry inputs that hit the reason (sorted
     * ascending, deduped); `matchedCodes` is the union of every
     * contributing entry's `matchedCodes` (sorted ascending, deduped),
     * absent when no contributing entry had a `matchedCodes` payload.
     *
     * Sort order: `count` descending, then `reason` ascending. Absent
     * (NOT empty array) when no batch entry has any structured block
     * reason. Append-only optional field.
     */
    blockReasonsAggregated?: CliBatchBlockReasonAggregation[];
    /**
     * Schema v9: cross-input aggregation of every entry's
     * `envelope.lintIssuesBySource`. One row per distinct `source`;
     * `inputs` lists the entry inputs that reported the source (sorted
     * ascending, deduped). Counts sum across entries. Sort order:
     * `count` descending, then canonical `ENVELOPE_SOURCE_ORDER` asc.
     * Absent (NOT empty array) when no entry has lint issues by source.
     */
    lintIssuesBySourceAggregated?: CliBatchLintIssuesBySourceAggregation[];
    /**
     * Schema v10: cross-input aggregation of every entry's
     * `envelope.lintIssuesByParseDiagCode`. One row per distinct
     * `(source, code)` pair; `inputs` lists entry inputs that reported
     * the pair (sorted ascending, deduped). Counts sum across entries.
     * Sort order: `count` desc → `source` asc → `code` asc. Absent when
     * no entry has parse-diag-linked lint issues.
     */
    lintIssuesByParseDiagCodeAggregated?: CliBatchLintIssuesByParseDiagCodeAggregation[];
    /**
     * Schema v11: cross-input aggregation of every entry's
     * `envelope.lintIssuesByControllerCode`. One row per distinct
     * `(source, code)` pair; `inputs` lists entry inputs that reported
     * the pair (sorted ascending, deduped). Counts sum across entries.
     * Sort order: `count` desc → `source` asc → `code` asc. Absent when
     * no entry has controller-code lint issues.
     */
    lintIssuesByControllerCodeAggregated?: CliBatchLintIssuesByControllerCodeAggregation[];
    /**
     * Schema v12: cross-input aggregation of every entry's
     * `envelope.parseDiagnosticsByCode`. One row per distinct `code`;
     * `inputs` lists entry inputs that reported the code (sorted ascending,
     * deduped). Counts sum across entries. Sort order: `count` desc →
     * `code` asc. Absent when no entry has parse diagnostics by code.
     */
    parseDiagnosticsByCodeAggregated?: CliBatchParseDiagnosticsByCodeAggregation[];
    /**
     * Schema v13: per-code attribution for `--strict-controller-codes` gate
     * matches across the batch. One row per gated `code`; `inputs` lists
     * entry inputs where the code was gated (sorted ascending, deduped).
     * Sort order: `inputs.length` desc → `code` asc. Absent when no entry
     * matched a strict-controller-codes pattern.
     */
    strictControllerCodesGatedAggregated?: CliBatchStrictControllerCodesGatedAggregation[];
    /**
     * Schema v14: cross-input aggregation of every entry's
     * `envelope.parseDiagnosticsPolicyBreaches`. One row per distinct
     * `key`; `inputs` lists entry inputs that breached the key (sorted
     * ascending, deduped). `count` is the number of contributing inputs;
     * `totalObserved` sums every contributing breach's `observed` value;
     * `severity` is the worst severity across contributors. Sort order:
     * `count` desc → `key` asc. Absent when no entry has policy breaches.
     */
    parseDiagnosticsPolicyBreachesAggregated?: CliBatchParseDiagnosticsPolicyBreachesAggregation[];
    /**
     * Schema v15–v16: cross-input aggregation of every entry's
     * `envelope.safetyFindingsByCode`. One row per distinct `(source, code)`;
     * `inputs` lists entry inputs that reported the pair (sorted ascending,
     * deduped). Counts sum across entries. Sort order: `count` desc →
     * `source` asc → `code` asc. Absent when no entry has safety findings.
     * Schema v16 requires `source` on each row.
     */
    safetyFindingsByCodeAggregated?: CliBatchSafetyFindingsByCodeAggregation[];
    /**
     * Schema v16: per-input attribution of `safetyFindingsByCode` rows.
     * One row per `(input, source, code)`. Sorted by `input` asc → `count`
     * desc → `source` asc → `code` asc. Empty array when none.
     */
    safetyFindingsByCodePerInputFile: CliBatchSafetyFindingsAttribution[];
    /**
     * Schema v19: per-input attribution of `parseDiagnosticsByCode` rows.
     * One row per `(input, code)`. Sorted by `input` asc → `count` desc →
     * `code` asc. Empty array when none. Append-only required field.
     */
    parseDiagnosticsByCodePerInputFile: CliBatchParseDiagnosticsAttribution[];
    /**
     * Schema v19: union of every `safety_blocker` `matchedCodes` across the
     * batch (sorted ascending, deduped). Absent when no entry emitted a
     * `safety_blocker` reason. Append-only optional field.
     */
    safetyBlockerCodesAggregated?: string[];
    /**
     * Schema v17: how the batch input-dir walk was performed. Absent for
     * single-file runs. Append-only optional field.
     */
    batchWalk?: CliBatchWalk;
  };
};

/**
 * Schema v17: metadata describing an `--input-dir` (or desktop folder) walk.
 * Schema v18 adds optional `export` when `--out-dir` / PDF-batch roots were used.
 */
export type CliBatchWalk = {
  recursive: boolean;
  include: string[];
  exclude: string[];
  matched: number;
  skipped: number;
  root: string;
  /**
   * Schema v18: where per-file batch artifacts were written (CLI) or would be
   * mirrored (desktop). Absent when no export roots were configured.
   */
  export?: CliBatchWalkExport;
};

/**
 * Schema v18: optional export roots recorded on `summary.batchWalk`.
 */
export type CliBatchWalkExport = {
  /** `--out-dir` root when set. */
  outDir?: string;
  /** `--export-setup-sheet-pdf-batch` root when set. */
  setupSheetPdfDir?: string;
};

export type CliBatchBlockReasonAggregation = {
  reason: string;
  count: number;
  inputs: string[];
  matchedCodes?: string[];
};

/**
 * Schema v9: cross-input rollup of per-entry `lintIssuesBySource` rows.
 * One row per distinct `source`; `inputs` lists batch entries that reported
 * that source (sorted ascending, deduped). Counts sum across entries.
 */
export type CliBatchLintIssuesBySourceAggregation = {
  source: LintIssueProvenanceSource;
  count: number;
  blockers: number;
  warnings: number;
  inputs: string[];
};

/**
 * Schema v10: cross-input rollup of per-entry `lintIssuesByParseDiagCode`
 * rows. One row per distinct `(source, code)` pair.
 */
export type CliBatchLintIssuesByParseDiagCodeAggregation = {
  source: LintIssueProvenanceSource;
  code: string;
  count: number;
  inputs: string[];
};

/**
 * Schema v11: cross-input rollup of per-entry `lintIssuesByControllerCode`
 * rows. One row per distinct `(source, code)` pair.
 */
export type CliBatchLintIssuesByControllerCodeAggregation = {
  source: LintIssueProvenanceSource;
  code: string;
  count: number;
  blockers: number;
  warnings: number;
  inputs: string[];
};

/**
 * Schema v12: cross-input rollup of per-entry `parseDiagnosticsByCode` rows.
 * One row per distinct parse-diagnostic `code`.
 */
export type CliBatchParseDiagnosticsByCodeAggregation = {
  code: string;
  count: number;
  warnings: number;
  errors: number;
  inputs: string[];
};

/**
 * Schema v13: cross-input attribution of per-entry `strictControllerCodesGated`.
 */
export type CliBatchStrictControllerCodesGatedAggregation = {
  code: string;
  inputs: string[];
};

/**
 * Schema v14: cross-input rollup of per-entry `parseDiagnosticsPolicyBreaches`.
 */
export type CliBatchParseDiagnosticsPolicyBreachesAggregation = {
  key: string;
  count: number;
  inputs: string[];
  totalObserved: number;
  severity: "warning" | "blocker";
};

/**
 * Schema v15–v16: cross-input rollup of per-entry `safetyFindingsByCode` rows.
 * Schema v16 adds `source`.
 */
export type CliBatchSafetyFindingsByCodeAggregation = {
  source: CliSafetyFindingSource;
  code: string;
  count: number;
  blockers: number;
  warnings: number;
  inputs: string[];
};

/**
 * Schema v16: per-input attribution of safety findings by `(source, code)`.
 * Schema v18 adds optional `firstBlockIndex` when the per-entry row had one.
 */
export type CliBatchSafetyFindingsAttribution = {
  input: string;
  source: CliSafetyFindingSource;
  code: string;
  count: number;
  blockers: number;
  warnings: number;
  /** Schema v18: earliest block index for this `(input, source, code)`. */
  firstBlockIndex?: number;
};

/**
 * Schema v19: per-input attribution of parse diagnostics by `code`.
 */
export type CliBatchParseDiagnosticsAttribution = {
  input: string;
  code: string;
  count: number;
  warnings: number;
  errors: number;
  firstBlockIndex?: number;
};

function buildBatchControllerCodeAttribution(
  entries: CliBatchEntry[]
): CliBatchControllerCodeAttribution[] {
  const rows: CliBatchControllerCodeAttribution[] = [];
  for (const entry of entries) {
    for (const codeEntry of entry.envelope.lintIssuesByControllerCode) {
      rows.push({
        input: entry.input,
        source: codeEntry.source,
        code: codeEntry.code,
        count: codeEntry.count,
        blockers: codeEntry.blockers,
        warnings: codeEntry.warnings
      });
    }
  }
  rows.sort((a, b) => {
    if (a.input !== b.input) return a.input < b.input ? -1 : 1;
    if (a.count !== b.count) return b.count - a.count;
    if (a.source !== b.source) return a.source < b.source ? -1 : 1;
    return a.code < b.code ? -1 : a.code > b.code ? 1 : 0;
  });
  return rows;
}

export function buildBatchEnvelope(
  entries: CliBatchEntry[],
  options?: { batchWalk?: CliBatchWalk }
): CliBatchEnvelope {
  const blocked = entries.reduce((acc, entry) => acc + (entry.envelope.blocked ? 1 : 0), 0);
  const gatedCodes = new Set<string>();
  for (const entry of entries) {
    for (const code of entry.envelope.strictControllerCodesGated ?? []) {
      gatedCodes.add(code);
    }
  }
  const summary: CliBatchEnvelope["summary"] = {
    files: entries.length,
    blocked,
    lintIssuesByControllerCodePerInputFile: buildBatchControllerCodeAttribution(entries),
    safetyFindingsByCodePerInputFile: buildBatchSafetyFindingsAttribution(entries),
    parseDiagnosticsByCodePerInputFile: buildBatchParseDiagnosticsAttribution(entries)
  };
  if (options?.batchWalk) {
    summary.batchWalk = options.batchWalk;
  }
  if (gatedCodes.size > 0) {
    summary.strictControllerCodesGated = [...gatedCodes].sort((a, b) => a.localeCompare(b));
  }
  const aggregated = buildBatchBlockReasonAggregation(entries);
  if (aggregated.length > 0) {
    summary.blockReasonsAggregated = aggregated;
  }
  const safetyBlockerCodes = buildBatchSafetyBlockerCodesAggregation(entries);
  if (safetyBlockerCodes.length > 0) {
    summary.safetyBlockerCodesAggregated = safetyBlockerCodes;
  }
  const lintBySource = buildBatchLintIssuesBySourceAggregation(entries);
  if (lintBySource.length > 0) {
    summary.lintIssuesBySourceAggregated = lintBySource;
  }
  const lintByParseDiag = buildBatchLintIssuesByParseDiagCodeAggregation(entries);
  if (lintByParseDiag.length > 0) {
    summary.lintIssuesByParseDiagCodeAggregated = lintByParseDiag;
  }
  const lintByControllerCode = buildBatchLintIssuesByControllerCodeAggregation(entries);
  if (lintByControllerCode.length > 0) {
    summary.lintIssuesByControllerCodeAggregated = lintByControllerCode;
  }
  const parseDiagByCode = buildBatchParseDiagnosticsByCodeAggregation(entries);
  if (parseDiagByCode.length > 0) {
    summary.parseDiagnosticsByCodeAggregated = parseDiagByCode;
  }
  const strictGated = buildBatchStrictControllerCodesGatedAggregation(entries);
  if (strictGated.length > 0) {
    summary.strictControllerCodesGatedAggregated = strictGated;
  }
  const policyBreaches = buildBatchParseDiagnosticsPolicyBreachesAggregation(entries);
  if (policyBreaches.length > 0) {
    summary.parseDiagnosticsPolicyBreachesAggregated = policyBreaches;
  }
  const safetyByCode = buildBatchSafetyFindingsByCodeAggregation(entries);
  if (safetyByCode.length > 0) {
    summary.safetyFindingsByCodeAggregated = safetyByCode;
  }
  return {
    schemaVersion: CLI_SCHEMA_VERSION,
    results: entries,
    summary
  };
}

/**
 * Schema v8: walk every entry's `envelope.blockReasons[]` and group
 * them by `reason`. The result is suitable for CI dashboards that want
 * a one-line "why did the batch fail?" summary without iterating each
 * entry's envelope.
 *
 * Pure function: no I/O, no globals consulted, deterministic given the
 * same `entries`. Sorts rows by `count` desc → `reason` asc, and each
 * row's `inputs` / `matchedCodes` arrays ascending + deduped.
 */
export function buildBatchBlockReasonAggregation(
  entries: CliBatchEntry[]
): CliBatchBlockReasonAggregation[] {
  const byReason = new Map<
    string,
    { count: number; inputs: Set<string>; matchedCodes: Set<string> }
  >();
  for (const entry of entries) {
    const reasons = entry.envelope.blockReasons;
    if (!reasons || reasons.length === 0) continue;
    for (const row of reasons) {
      let bucket = byReason.get(row.reason);
      if (!bucket) {
        bucket = { count: 0, inputs: new Set<string>(), matchedCodes: new Set<string>() };
        byReason.set(row.reason, bucket);
      }
      // Per-entry rows count once per (reason, input) pair — duplicates
      // within a single envelope (currently impossible by construction
      // but cheap to guard) collapse to a single contribution.
      if (!bucket.inputs.has(entry.input)) {
        bucket.count += 1;
        bucket.inputs.add(entry.input);
      }
      for (const code of row.matchedCodes ?? []) bucket.matchedCodes.add(code);
    }
  }
  const rows: CliBatchBlockReasonAggregation[] = [];
  for (const [reason, bucket] of byReason) {
    const entry: CliBatchBlockReasonAggregation = {
      reason,
      count: bucket.count,
      inputs: [...bucket.inputs].sort((a, b) => a.localeCompare(b))
    };
    if (bucket.matchedCodes.size > 0) {
      entry.matchedCodes = [...bucket.matchedCodes].sort((a, b) => a.localeCompare(b));
    }
    rows.push(entry);
  }
  rows.sort((a, b) => {
    if (a.count !== b.count) return b.count - a.count;
    return a.reason.localeCompare(b.reason);
  });
  return rows;
}

/**
 * Schema v9: walk every entry's `envelope.lintIssuesBySource` and group by
 * `source`. Pure function — deterministic given the same `entries`.
 */
export function buildBatchLintIssuesBySourceAggregation(
  entries: CliBatchEntry[]
): CliBatchLintIssuesBySourceAggregation[] {
  const bySource = new Map<
    LintIssueProvenanceSource,
    { count: number; blockers: number; warnings: number; inputs: Set<string> }
  >();
  for (const entry of entries) {
    const rows = entry.envelope.lintIssuesBySource;
    if (!rows || rows.length === 0) continue;
    for (const row of rows) {
      let bucket = bySource.get(row.source);
      if (!bucket) {
        bucket = { count: 0, blockers: 0, warnings: 0, inputs: new Set<string>() };
        bySource.set(row.source, bucket);
      }
      bucket.count += row.count;
      bucket.blockers += row.blockers;
      bucket.warnings += row.warnings;
      bucket.inputs.add(entry.input);
    }
  }
  const rows: CliBatchLintIssuesBySourceAggregation[] = [];
  for (const [source, bucket] of bySource) {
    rows.push({
      source,
      count: bucket.count,
      blockers: bucket.blockers,
      warnings: bucket.warnings,
      inputs: [...bucket.inputs].sort((a, b) => a.localeCompare(b))
    });
  }
  rows.sort((a, b) => {
    if (a.count !== b.count) return b.count - a.count;
    return ENVELOPE_SOURCE_ORDER.indexOf(a.source) - ENVELOPE_SOURCE_ORDER.indexOf(b.source);
  });
  return rows;
}

/**
 * Schema v10: walk every entry's `envelope.lintIssuesByParseDiagCode` and
 * group by `(source, code)`. Pure function — deterministic given `entries`.
 */
export function buildBatchLintIssuesByParseDiagCodeAggregation(
  entries: CliBatchEntry[]
): CliBatchLintIssuesByParseDiagCodeAggregation[] {
  const byKey = new Map<
    string,
    { source: LintIssueProvenanceSource; code: string; count: number; inputs: Set<string> }
  >();
  for (const entry of entries) {
    const rows = entry.envelope.lintIssuesByParseDiagCode;
    if (!rows || rows.length === 0) continue;
    for (const row of rows) {
      const key = `${row.source}::${row.code}`;
      let bucket = byKey.get(key);
      if (!bucket) {
        bucket = {
          source: row.source,
          code: row.code,
          count: 0,
          inputs: new Set<string>()
        };
        byKey.set(key, bucket);
      }
      bucket.count += row.count;
      bucket.inputs.add(entry.input);
    }
  }
  const rows: CliBatchLintIssuesByParseDiagCodeAggregation[] = [];
  for (const bucket of byKey.values()) {
    rows.push({
      source: bucket.source,
      code: bucket.code,
      count: bucket.count,
      inputs: [...bucket.inputs].sort((a, b) => a.localeCompare(b))
    });
  }
  rows.sort((a, b) => {
    if (a.count !== b.count) return b.count - a.count;
    if (a.source !== b.source) return a.source.localeCompare(b.source);
    return a.code.localeCompare(b.code);
  });
  return rows;
}

/**
 * Schema v11: walk every entry's `envelope.lintIssuesByControllerCode` and
 * group by `(source, code)`. Pure function — deterministic given `entries`.
 */
export function buildBatchLintIssuesByControllerCodeAggregation(
  entries: CliBatchEntry[]
): CliBatchLintIssuesByControllerCodeAggregation[] {
  const byKey = new Map<
    string,
    {
      source: LintIssueProvenanceSource;
      code: string;
      count: number;
      blockers: number;
      warnings: number;
      inputs: Set<string>;
    }
  >();
  for (const entry of entries) {
    const rows = entry.envelope.lintIssuesByControllerCode;
    if (!rows || rows.length === 0) continue;
    for (const row of rows) {
      const key = `${row.source}::${row.code}`;
      let bucket = byKey.get(key);
      if (!bucket) {
        bucket = {
          source: row.source,
          code: row.code,
          count: 0,
          blockers: 0,
          warnings: 0,
          inputs: new Set<string>()
        };
        byKey.set(key, bucket);
      }
      bucket.count += row.count;
      bucket.blockers += row.blockers;
      bucket.warnings += row.warnings;
      bucket.inputs.add(entry.input);
    }
  }
  const rows: CliBatchLintIssuesByControllerCodeAggregation[] = [];
  for (const bucket of byKey.values()) {
    rows.push({
      source: bucket.source,
      code: bucket.code,
      count: bucket.count,
      blockers: bucket.blockers,
      warnings: bucket.warnings,
      inputs: [...bucket.inputs].sort((a, b) => a.localeCompare(b))
    });
  }
  rows.sort((a, b) => {
    if (a.count !== b.count) return b.count - a.count;
    if (a.source !== b.source) return a.source.localeCompare(b.source);
    return a.code.localeCompare(b.code);
  });
  return rows;
}

/**
 * Schema v12: walk every entry's `envelope.parseDiagnosticsByCode` and group
 * by `code`. Pure function — deterministic given `entries`.
 */
export function buildBatchParseDiagnosticsByCodeAggregation(
  entries: CliBatchEntry[]
): CliBatchParseDiagnosticsByCodeAggregation[] {
  const byCode = new Map<
    string,
    { count: number; warnings: number; errors: number; inputs: Set<string> }
  >();
  for (const entry of entries) {
    const rows = entry.envelope.parseDiagnosticsByCode;
    if (!rows || rows.length === 0) continue;
    for (const row of rows) {
      let bucket = byCode.get(row.code);
      if (!bucket) {
        bucket = { count: 0, warnings: 0, errors: 0, inputs: new Set<string>() };
        byCode.set(row.code, bucket);
      }
      bucket.count += row.count;
      bucket.warnings += row.warnings;
      bucket.errors += row.errors;
      bucket.inputs.add(entry.input);
    }
  }
  const rows: CliBatchParseDiagnosticsByCodeAggregation[] = [];
  for (const [code, bucket] of byCode) {
    rows.push({
      code,
      count: bucket.count,
      warnings: bucket.warnings,
      errors: bucket.errors,
      inputs: [...bucket.inputs].sort((a, b) => a.localeCompare(b))
    });
  }
  rows.sort((a, b) => {
    if (a.count !== b.count) return b.count - a.count;
    return a.code.localeCompare(b.code);
  });
  return rows;
}

/**
 * Schema v13: walk every entry's `envelope.strictControllerCodesGated` and
 * group by `code`. Pure function — deterministic given `entries`.
 */
export function buildBatchStrictControllerCodesGatedAggregation(
  entries: CliBatchEntry[]
): CliBatchStrictControllerCodesGatedAggregation[] {
  const byCode = new Map<string, Set<string>>();
  for (const entry of entries) {
    const gated = entry.envelope.strictControllerCodesGated;
    if (!gated || gated.length === 0) continue;
    for (const code of gated) {
      let inputs = byCode.get(code);
      if (!inputs) {
        inputs = new Set<string>();
        byCode.set(code, inputs);
      }
      inputs.add(entry.input);
    }
  }
  const rows: CliBatchStrictControllerCodesGatedAggregation[] = [];
  for (const [code, inputs] of byCode) {
    rows.push({
      code,
      inputs: [...inputs].sort((a, b) => a.localeCompare(b))
    });
  }
  rows.sort((a, b) => {
    if (a.inputs.length !== b.inputs.length) return b.inputs.length - a.inputs.length;
    return a.code.localeCompare(b.code);
  });
  return rows;
}

/**
 * Schema v14: walk every entry's `envelope.parseDiagnosticsPolicyBreaches`
 * and group by `key`. Pure function — deterministic given `entries`.
 */
export function buildBatchParseDiagnosticsPolicyBreachesAggregation(
  entries: CliBatchEntry[]
): CliBatchParseDiagnosticsPolicyBreachesAggregation[] {
  const byKey = new Map<
    string,
    {
      count: number;
      inputs: Set<string>;
      totalObserved: number;
      severity: "warning" | "blocker";
    }
  >();
  for (const entry of entries) {
    const breaches = entry.envelope.parseDiagnosticsPolicyBreaches;
    if (!breaches || breaches.length === 0) continue;
    const seenKeysForInput = new Set<string>();
    for (const breach of breaches) {
      let bucket = byKey.get(breach.key);
      if (!bucket) {
        bucket = {
          count: 0,
          inputs: new Set<string>(),
          totalObserved: 0,
          severity: "warning"
        };
        byKey.set(breach.key, bucket);
      }
      if (!seenKeysForInput.has(breach.key)) {
        seenKeysForInput.add(breach.key);
        bucket.count += 1;
        bucket.inputs.add(entry.input);
      }
      bucket.totalObserved += breach.observed;
      if (breach.severity === "blocker") bucket.severity = "blocker";
    }
  }
  const rows: CliBatchParseDiagnosticsPolicyBreachesAggregation[] = [];
  for (const [key, bucket] of byKey) {
    rows.push({
      key,
      count: bucket.count,
      inputs: [...bucket.inputs].sort((a, b) => a.localeCompare(b)),
      totalObserved: bucket.totalObserved,
      severity: bucket.severity
    });
  }
  rows.sort((a, b) => {
    if (a.count !== b.count) return b.count - a.count;
    return a.key.localeCompare(b.key);
  });
  return rows;
}

/**
 * Schema v15–v16: walk every entry's `envelope.safetyFindingsByCode` and group
 * by `(source, code)`. Pure function — deterministic given `entries`.
 */
export function buildBatchSafetyFindingsByCodeAggregation(
  entries: CliBatchEntry[]
): CliBatchSafetyFindingsByCodeAggregation[] {
  const byKey = new Map<
    string,
    {
      source: CliSafetyFindingSource;
      code: string;
      count: number;
      blockers: number;
      warnings: number;
      inputs: Set<string>;
    }
  >();
  for (const entry of entries) {
    const rows = entry.envelope.safetyFindingsByCode;
    if (!rows || rows.length === 0) continue;
    for (const row of rows) {
      const source = row.source ?? "advisor";
      const key = `${source}::${row.code}`;
      let bucket = byKey.get(key);
      if (!bucket) {
        bucket = {
          source,
          code: row.code,
          count: 0,
          blockers: 0,
          warnings: 0,
          inputs: new Set<string>()
        };
        byKey.set(key, bucket);
      }
      bucket.count += row.count;
      bucket.blockers += row.blockers;
      bucket.warnings += row.warnings;
      bucket.inputs.add(entry.input);
    }
  }
  const rows: CliBatchSafetyFindingsByCodeAggregation[] = [];
  for (const bucket of byKey.values()) {
    rows.push({
      source: bucket.source,
      code: bucket.code,
      count: bucket.count,
      blockers: bucket.blockers,
      warnings: bucket.warnings,
      inputs: [...bucket.inputs].sort((a, b) => a.localeCompare(b))
    });
  }
  rows.sort((a, b) => {
    if (a.count !== b.count) return b.count - a.count;
    if (a.source !== b.source) return a.source.localeCompare(b.source);
    return a.code.localeCompare(b.code);
  });
  return rows;
}

/**
 * Schema v16: per-input attribution of `safetyFindingsByCode`.
 */
export function buildBatchSafetyFindingsAttribution(
  entries: CliBatchEntry[]
): CliBatchSafetyFindingsAttribution[] {
  const rows: CliBatchSafetyFindingsAttribution[] = [];
  for (const entry of entries) {
    for (const codeEntry of entry.envelope.safetyFindingsByCode ?? []) {
      rows.push({
        input: entry.input,
        source: codeEntry.source,
        code: codeEntry.code,
        count: codeEntry.count,
        blockers: codeEntry.blockers,
        warnings: codeEntry.warnings,
        ...(codeEntry.firstBlockIndex !== undefined
          ? { firstBlockIndex: codeEntry.firstBlockIndex }
          : {})
      });
    }
  }
  rows.sort((a, b) => {
    if (a.input !== b.input) return a.input < b.input ? -1 : 1;
    if (a.count !== b.count) return b.count - a.count;
    if (a.source !== b.source) return a.source.localeCompare(b.source);
    return a.code.localeCompare(b.code);
  });
  return rows;
}

/**
 * Schema v19: per-input attribution of `parseDiagnosticsByCode`.
 */
export function buildBatchParseDiagnosticsAttribution(
  entries: CliBatchEntry[]
): CliBatchParseDiagnosticsAttribution[] {
  const rows: CliBatchParseDiagnosticsAttribution[] = [];
  for (const entry of entries) {
    for (const codeEntry of entry.envelope.parseDiagnosticsByCode ?? []) {
      rows.push({
        input: entry.input,
        code: codeEntry.code,
        count: codeEntry.count,
        warnings: codeEntry.warnings,
        errors: codeEntry.errors,
        ...(codeEntry.firstBlockIndex !== undefined
          ? { firstBlockIndex: codeEntry.firstBlockIndex }
          : {})
      });
    }
  }
  rows.sort((a, b) => {
    if (a.input !== b.input) return a.input < b.input ? -1 : 1;
    if (a.count !== b.count) return b.count - a.count;
    return a.code.localeCompare(b.code);
  });
  return rows;
}

/**
 * Schema v19: union of `safety_blocker` matched codes across the batch.
 */
export function buildBatchSafetyBlockerCodesAggregation(
  entries: CliBatchEntry[]
): string[] {
  const codes = new Set<string>();
  for (const entry of entries) {
    for (const reason of entry.envelope.blockReasons ?? []) {
      if (reason.reason !== "safety_blocker") continue;
      for (const code of reason.matchedCodes ?? []) codes.add(code);
    }
  }
  return [...codes].sort((a, b) => a.localeCompare(b));
}

export function formatBatchJson(
  entries: CliBatchEntry[],
  options?: { batchWalk?: CliBatchWalk }
): string {
  return JSON.stringify(buildBatchEnvelope(entries, options), null, 2);
}
