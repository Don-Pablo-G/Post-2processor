export type ParseDiagnosticSeverity = "warning" | "error";

export type ParseDiagnosticFix = {
  title: string;
  replacement?: string;
};

export type ParseDiagnosticLike = {
  code: string;
  severity: ParseDiagnosticSeverity;
  message: string;
  blockIndex: number;
  suggestedFixes?: ParseDiagnosticFix[];
};

export type ParseDiagnosticGroup = [code: string, items: ParseDiagnosticLike[]];

export const DEFAULT_PARSE_DIAGNOSTICS_GROUP_CAP = 25;

export function severityRank(severity: ParseDiagnosticSeverity): number {
  // Errors first, warnings second; deterministic within group.
  return severity === "error" ? 0 : 1;
}

export function compareDiagnostics(a: ParseDiagnosticLike, b: ParseDiagnosticLike): number {
  if (a.blockIndex !== b.blockIndex) return a.blockIndex - b.blockIndex;
  const sev = severityRank(a.severity) - severityRank(b.severity);
  if (sev !== 0) return sev;
  return a.message.localeCompare(b.message);
}

export function groupAndSortDiagnostics(diagnostics: ParseDiagnosticLike[]): ParseDiagnosticGroup[] {
  const buckets = new Map<string, ParseDiagnosticLike[]>();
  for (const diag of diagnostics) {
    const list = buckets.get(diag.code) ?? [];
    list.push(diag);
    buckets.set(diag.code, list);
  }
  const groups: ParseDiagnosticGroup[] = [];
  for (const [code, list] of buckets) {
    list.sort(compareDiagnostics);
    groups.push([code, list]);
  }
  groups.sort(([a], [b]) => a.localeCompare(b));
  return groups;
}

export type CappedDiagnosticView = {
  visible: ParseDiagnosticLike[];
  hiddenCount: number;
  truncated: boolean;
};

export function applyDiagnosticsCap(
  items: ParseDiagnosticLike[],
  options: { cap: number; expanded: boolean }
): CappedDiagnosticView {
  if (options.expanded || options.cap <= 0 || items.length <= options.cap) {
    return { visible: items, hiddenCount: 0, truncated: false };
  }
  const visible = items.slice(0, options.cap);
  return { visible, hiddenCount: items.length - options.cap, truncated: true };
}

export type FixLineKind = "PARSE FIX" | "LINT FIX";

export function buildFixLine(input: {
  kind: FixLineKind;
  identifierKey: "code" | "source";
  identifierValue: string;
  blockIndex: number;
  fix: ParseDiagnosticFix;
}): string {
  const replacementSuffix = input.fix.replacement ? ` -> ${input.fix.replacement}` : "";
  return `${input.kind} | ${input.identifierKey}=${input.identifierValue} block=${input.blockIndex} | ${input.fix.title}${replacementSuffix}`;
}

export function buildParseFixLine(input: {
  code: string;
  blockIndex: number;
  fix: ParseDiagnosticFix;
}): string {
  return buildFixLine({
    kind: "PARSE FIX",
    identifierKey: "code",
    identifierValue: input.code,
    blockIndex: input.blockIndex,
    fix: input.fix
  });
}

export function buildAllFixesPayload(code: string, items: ParseDiagnosticLike[]): {
  payload: string;
  fixCount: number;
} {
  const lines: string[] = [];
  for (const diag of items) {
    for (const fix of diag.suggestedFixes ?? []) {
      lines.push(buildParseFixLine({ code, blockIndex: diag.blockIndex, fix }));
    }
  }
  return { payload: lines.join("\n"), fixCount: lines.length };
}

export type LintIssueProvenanceSource =
  | "lexer"
  | "expression_parser"
  | "controller_grammar"
  | "common_lint"
  | "profile_lint";

export type LintIssueLike = {
  severity: ParseDiagnosticSeverity;
  message: string;
  blockIndex: number;
  suggestedFixes?: ParseDiagnosticFix[];
  provenance: { source: LintIssueProvenanceSource };
};

export type LintIssueGroup = [source: LintIssueProvenanceSource, items: LintIssueLike[]];

export function compareLintIssues(a: LintIssueLike, b: LintIssueLike): number {
  if (a.blockIndex !== b.blockIndex) return a.blockIndex - b.blockIndex;
  const sev = severityRank(a.severity) - severityRank(b.severity);
  if (sev !== 0) return sev;
  return a.message.localeCompare(b.message);
}

export function groupLintIssuesBySource(issues: LintIssueLike[]): LintIssueGroup[] {
  const buckets = new Map<LintIssueProvenanceSource, LintIssueLike[]>();
  for (const issue of issues) {
    const list = buckets.get(issue.provenance.source) ?? [];
    list.push(issue);
    buckets.set(issue.provenance.source, list);
  }
  const groups: LintIssueGroup[] = [];
  for (const [source, list] of buckets) {
    list.sort(compareLintIssues);
    groups.push([source, list]);
  }
  groups.sort(([a], [b]) => a.localeCompare(b));
  return groups;
}

export function buildLintFixLine(input: {
  source: LintIssueProvenanceSource;
  blockIndex: number;
  fix: ParseDiagnosticFix;
}): string {
  return buildFixLine({
    kind: "LINT FIX",
    identifierKey: "source",
    identifierValue: input.source,
    blockIndex: input.blockIndex,
    fix: input.fix
  });
}

export function buildAllLintFixesPayload(
  source: LintIssueProvenanceSource,
  items: LintIssueLike[]
): {
  payload: string;
  fixCount: number;
} {
  const lines: string[] = [];
  for (const issue of items) {
    for (const fix of issue.suggestedFixes ?? []) {
      lines.push(buildLintFixLine({ source, blockIndex: issue.blockIndex, fix }));
    }
  }
  return { payload: lines.join("\n"), fixCount: lines.length };
}

export type DiagnosticsSummaryChip = {
  total: number;
  topCodes: string[];
  text: string;
  briefField: string;
};

export function buildDiagnosticsSummaryChip(
  groups: ParseDiagnosticGroup[],
  options: { topLimit?: number; emptyText?: string; label?: string } = {}
): DiagnosticsSummaryChip {
  const label = options.label ?? "parseDiagnostics";
  const topLimit = options.topLimit ?? 2;
  const total = groups.reduce((sum, [, items]) => sum + items.length, 0);
  if (total === 0) {
    return {
      total: 0,
      topCodes: [],
      text: options.emptyText ?? `${label}: total=0`,
      briefField: "parseDiag=total=0"
    };
  }
  const sorted = [...groups].sort(([codeA, a], [codeB, b]) => {
    if (b.length !== a.length) return b.length - a.length;
    return codeA.localeCompare(codeB);
  });
  const topCodes = sorted.slice(0, Math.max(1, topLimit)).map(([code]) => code);
  return {
    total,
    topCodes,
    text: `${label}: total=${total} | top=${topCodes.join(",")}`,
    briefField: `parseDiag=total=${total},top=${topCodes.join(",")}`
  };
}

export const DIAGNOSTICS_DEMO_PROGRAM = [
  "(DEMO PROGRAM EXERCISING PARSE DIAGNOSTICS",
  "G0 X Y1",
  "G1 @@@ X1",
  "X[#100+]",
  "M30"
].join("\n");

export type LintIssuesSummaryChip = {
  total: number;
  topSources: LintIssueProvenanceSource[];
  text: string;
  briefField: string;
};

export function buildLintIssuesSummaryChip(
  groups: LintIssueGroup[],
  options: { topLimit?: number; emptyText?: string; label?: string } = {}
): LintIssuesSummaryChip {
  const label = options.label ?? "lintIssues";
  const topLimit = options.topLimit ?? 2;
  const total = groups.reduce((sum, [, items]) => sum + items.length, 0);
  if (total === 0) {
    return {
      total: 0,
      topSources: [],
      text: options.emptyText ?? `${label}: total=0`,
      briefField: "lintIssues=total=0"
    };
  }
  const sorted = [...groups].sort(([sourceA, a], [sourceB, b]) => {
    if (b.length !== a.length) return b.length - a.length;
    return sourceA.localeCompare(sourceB);
  });
  const topSources = sorted.slice(0, Math.max(1, topLimit)).map(([source]) => source);
  return {
    total,
    topSources,
    text: `${label}: total=${total} | top=${topSources.join(",")}`,
    briefField: `lintIssues=total=${total},top=${topSources.join(",")}`
  };
}

export const LINT_DEMO_PROGRAM = [
  "(DEMO PROGRAM EXERCISING LINT SUGGESTED FIXES)",
  "N10 O1000",
  "G1 X1. X2. F100. F120.",
  "G65 P9010 K4. J2. I3.",
  "M30"
].join("\n");

export const LINT_DEMO_PROGRAM_FANUC = [
  "%",
  "(FANUC DEMO PROGRAM EXERCISING STRICT LINT SUGGESTED FIXES)",
  "G0 X1.",
  "O1000",
  "N10 O1000",
  "G1 X1. X2. F100. F120.",
  "G65 P9010 K4. J2. I3.",
  "O1000",
  "M30",
  "%"
].join("\n");

export const LINT_DEMO_PROGRAM_HAAS_LEGACY = [
  "%",
  "(HAAS LEGACY DEMO PROGRAM EXERCISING LEGACY IDIOMS + LINT SUGGESTED FIXES)",
  "O2000",
  "N10 G0 X1. Y1. F100.",
  "M97 P10",
  "M88",
  "G187 P3 E0.0005",
  "G1 X2. Y2. F120.",
  "M89",
  "N10 X3. F100.",
  "M99",
  "M30",
  "%"
].join("\n");

export type ControllerProfileKeyForDemo = "haas-ngc" | "haas-legacy" | "fanuc";

export function selectLintDemoProgram(controller: ControllerProfileKeyForDemo): string {
  if (controller === "fanuc") return LINT_DEMO_PROGRAM_FANUC;
  if (controller === "haas-legacy") return LINT_DEMO_PROGRAM_HAAS_LEGACY;
  return LINT_DEMO_PROGRAM;
}

export type ParseDiagnosticsPolicyThresholdKey =
  | "TOTAL"
  | "UNMATCHED_OPEN_PAREN"
  | "UNMATCHED_CLOSE_PAREN"
  | "ADDRESS_MISSING_VALUE"
  | "UNMATCHED_BRACKET"
  | "BRACKET_EXPRESSION_INVALID"
  | "UNKNOWN_TOKEN"
  | "INVALID_CHARACTER";

export const PARSE_DIAGNOSTICS_POLICY_THRESHOLD_KEYS: readonly ParseDiagnosticsPolicyThresholdKey[] = [
  "TOTAL",
  "UNMATCHED_OPEN_PAREN",
  "UNMATCHED_CLOSE_PAREN",
  "ADDRESS_MISSING_VALUE",
  "UNMATCHED_BRACKET",
  "BRACKET_EXPRESSION_INVALID",
  "UNKNOWN_TOKEN",
  "INVALID_CHARACTER"
];

export type ParseDiagnosticsPolicySeverity = "warning" | "blocker";

export type ParseDiagnosticsPolicyUiState = {
  enabled: boolean;
  severity: ParseDiagnosticsPolicySeverity;
  blockExport: boolean;
  thresholdsText: string;
};

export type ParseDiagnosticsPolicyResolved = {
  severity: ParseDiagnosticsPolicySeverity;
  blockExport: boolean;
  thresholds: Partial<Record<ParseDiagnosticsPolicyThresholdKey, number>>;
};

export function parseParseDiagnosticsPolicyThresholds(text: string): {
  thresholds: Partial<Record<ParseDiagnosticsPolicyThresholdKey, number>>;
  invalidEntries: string[];
} {
  const thresholds: Partial<Record<ParseDiagnosticsPolicyThresholdKey, number>> = {};
  const invalidEntries: string[] = [];
  const valid = new Set<string>(PARSE_DIAGNOSTICS_POLICY_THRESHOLD_KEYS);
  const tokens = text
    .split(/[,\n;]+/)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
  for (const token of tokens) {
    const eqIdx = token.indexOf("=");
    if (eqIdx <= 0) {
      invalidEntries.push(token);
      continue;
    }
    const keyRaw = token.slice(0, eqIdx).trim().toUpperCase();
    const valueRaw = token.slice(eqIdx + 1).trim();
    if (!valid.has(keyRaw)) {
      invalidEntries.push(token);
      continue;
    }
    const numeric = Number(valueRaw);
    if (!Number.isFinite(numeric) || numeric < 0 || !Number.isInteger(numeric)) {
      invalidEntries.push(token);
      continue;
    }
    thresholds[keyRaw as ParseDiagnosticsPolicyThresholdKey] = numeric;
  }
  return { thresholds, invalidEntries };
}

export function resolveParseDiagnosticsPolicy(
  state: ParseDiagnosticsPolicyUiState
): { policy: ParseDiagnosticsPolicyResolved | undefined; invalidEntries: string[] } {
  if (!state.enabled) return { policy: undefined, invalidEntries: [] };
  const { thresholds, invalidEntries } = parseParseDiagnosticsPolicyThresholds(state.thresholdsText);
  if (Object.keys(thresholds).length === 0) {
    return { policy: undefined, invalidEntries };
  }
  return {
    policy: { severity: state.severity, blockExport: state.blockExport, thresholds },
    invalidEntries
  };
}

export function serializeParseDiagnosticsPolicy(state: ParseDiagnosticsPolicyUiState): string {
  if (!state.enabled) return "parseDiagPolicy=disabled";
  const { thresholds } = parseParseDiagnosticsPolicyThresholds(state.thresholdsText);
  const entries = Object.entries(thresholds)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join(",");
  return `parseDiagPolicy=enabled,severity=${state.severity},blockExport=${state.blockExport},thresholds=${entries || "n/a"}`;
}

export type ParseDiagnosticsPolicyBriefBreach = {
  key: ParseDiagnosticsPolicyThresholdKey | string;
  observed: number;
  threshold: number;
};

export function selectFirstBlockIndexByCode(
  diagnostics: ParseDiagnosticLike[] | undefined
): Record<string, number> {
  const result: Record<string, number> = {};
  if (!diagnostics) return result;
  for (const diag of diagnostics) {
    const existing = result[diag.code];
    if (existing === undefined || diag.blockIndex < existing) {
      result[diag.code] = diag.blockIndex;
    }
  }
  return result;
}

export function buildParseDiagnosticsPolicyBriefField(input: {
  state: ParseDiagnosticsPolicyUiState;
  breaches?: ParseDiagnosticsPolicyBriefBreach[];
}): string {
  if (!input.state.enabled) return "parseDiagPolicy=inactive";
  const { thresholds } = parseParseDiagnosticsPolicyThresholds(input.state.thresholdsText);
  if (Object.keys(thresholds).length === 0) return "parseDiagPolicy=inactive";
  const breachedCodes = (input.breaches ?? [])
    .map((b) => b.key)
    .sort((a, b) => a.localeCompare(b))
    .join(",");
  const breached = breachedCodes.length > 0 ? breachedCodes : "none";
  return `parseDiagPolicy=active,severity=${input.state.severity},blockExport=${input.state.blockExport},breached=${breached}`;
}

export type ParseDiagnosticsPolicyBreachLike = {
  key: string;
  observed: number;
  threshold: number;
  severity: "warning" | "blocker";
  firstBlockIndex?: number;
};

export function buildParseDiagnosticsBreachContext(
  breaches: ParseDiagnosticsPolicyBreachLike[] | undefined,
  controller: string
): { payload: string; count: number; severities: string } {
  const list = breaches ?? [];
  const sorted = [...list].sort((a, b) => a.key.localeCompare(b.key));
  const lines = sorted.map((breach) => {
    const head = `parseDiagBreach: ${breach.key}=${breach.observed}>${breach.threshold} (${breach.severity})`;
    if (breach.firstBlockIndex !== undefined) {
      return `${head} firstBlock=${breach.firstBlockIndex}`;
    }
    return head;
  });
  lines.push(`controller=${controller}`);
  const severityCounts = new Map<string, number>();
  for (const breach of sorted) {
    severityCounts.set(breach.severity, (severityCounts.get(breach.severity) ?? 0) + 1);
  }
  const severities = [...severityCounts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([sev, n]) => `${sev}:${n}`)
    .join(",");
  return {
    payload: lines.join("\n"),
    count: sorted.length,
    severities: severities.length > 0 ? severities : "none"
  };
}

export function buildParseDiagBreachesBriefField(
  breaches: ParseDiagnosticsPolicyBreachLike[] | undefined
): string {
  const list = breaches ?? [];
  if (list.length === 0) return "parseDiagBreaches=none";
  const entries = [...list]
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((breach) => `${breach.key}:${breach.observed}/${breach.threshold}`)
    .join(",");
  return `parseDiagBreaches=${entries}`;
}

export function summarizeParseDiagBreachSeverities(
  breaches: ParseDiagnosticsPolicyBreachLike[] | undefined
): { total: number; blockers: number; warnings: number; chip: string } {
  const list = breaches ?? [];
  let blockers = 0;
  let warnings = 0;
  for (const breach of list) {
    if (breach.severity === "blocker") blockers += 1;
    else if (breach.severity === "warning") warnings += 1;
  }
  return {
    total: list.length,
    blockers,
    warnings,
    chip: `breaches: total=${list.length} | blockers=${blockers} | warnings=${warnings}`
  };
}

export function buildParseDiagBreachSeveritiesBriefField(
  breaches: ParseDiagnosticsPolicyBreachLike[] | undefined
): string {
  const list = breaches ?? [];
  if (list.length === 0) return "parseDiagBreachSeverities=none";
  const { blockers, warnings } = summarizeParseDiagBreachSeverities(list);
  return `parseDiagBreachSeverities=blockers=${blockers},warnings=${warnings}`;
}

export type LintIssuesSummaryLike = {
  total: number;
  blockers: number;
  warnings: number;
  bySource: Partial<Record<LintIssueProvenanceSource, number>>;
  topSources: LintIssueProvenanceSource[];
};

export function formatLintIssuesSummaryChip(summary: LintIssuesSummaryLike | undefined): string {
  const safe: LintIssuesSummaryLike = summary ?? {
    total: 0,
    blockers: 0,
    warnings: 0,
    bySource: {},
    topSources: []
  };
  const top = safe.topSources.length > 0 ? safe.topSources.join(",") : "n/a";
  return `lintIssues: total=${safe.total} | severities=blocker:${safe.blockers},warning:${safe.warnings} | top=${top}`;
}

const LINT_ISSUE_SOURCE_CANONICAL_ORDER: ReadonlyArray<LintIssueProvenanceSource> = [
  "lexer",
  "expression_parser",
  "controller_grammar",
  "common_lint",
  "profile_lint"
];

export function summarizeLintIssuesBySource(
  summary: LintIssuesSummaryLike | undefined
): Array<[LintIssueProvenanceSource, number]> {
  if (!summary || summary.total === 0) return [];
  const entries = Object.entries(summary.bySource) as Array<[LintIssueProvenanceSource, number]>;
  const present = entries.filter(([, count]) => count > 0);
  const topOrder = new Map<LintIssueProvenanceSource, number>();
  summary.topSources.forEach((source, idx) => {
    topOrder.set(source, idx);
  });
  return present.sort((a, b) => {
    const aTop = topOrder.get(a[0]);
    const bTop = topOrder.get(b[0]);
    if (aTop !== undefined && bTop !== undefined) return aTop - bTop;
    if (aTop !== undefined) return -1;
    if (bTop !== undefined) return 1;
    if (b[1] !== a[1]) return b[1] - a[1];
    return (
      LINT_ISSUE_SOURCE_CANONICAL_ORDER.indexOf(a[0]) -
      LINT_ISSUE_SOURCE_CANONICAL_ORDER.indexOf(b[0])
    );
  });
}

export type ParseDiagnosticsPolicyPreset = "strict" | "balanced" | "permissive";

export const PARSE_DIAGNOSTICS_POLICY_PRESETS: ReadonlyArray<ParseDiagnosticsPolicyPreset> = [
  "strict",
  "balanced",
  "permissive"
];

export function applyParseDiagnosticsPolicyPreset(
  preset: ParseDiagnosticsPolicyPreset
): ParseDiagnosticsPolicyUiState {
  switch (preset) {
    case "strict":
      return { enabled: true, severity: "blocker", blockExport: true, thresholdsText: "TOTAL=0" };
    case "balanced":
      return { enabled: true, severity: "warning", blockExport: false, thresholdsText: "TOTAL=10" };
    case "permissive":
      return { enabled: false, severity: "warning", blockExport: false, thresholdsText: "" };
  }
}

function thresholdsEqual(
  a: Partial<Record<ParseDiagnosticsPolicyThresholdKey, number>>,
  b: Partial<Record<ParseDiagnosticsPolicyThresholdKey, number>>
): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    if (a[key as ParseDiagnosticsPolicyThresholdKey] !== b[key as ParseDiagnosticsPolicyThresholdKey]) {
      return false;
    }
  }
  return true;
}

export function selectMatchingParseDiagnosticsPolicyPreset(
  state: ParseDiagnosticsPolicyUiState
): ParseDiagnosticsPolicyPreset | "custom" {
  if (!state.enabled) return "permissive";
  const { thresholds, invalidEntries } = parseParseDiagnosticsPolicyThresholds(state.thresholdsText);
  if (invalidEntries.length > 0) return "custom";
  for (const preset of PARSE_DIAGNOSTICS_POLICY_PRESETS) {
    if (preset === "permissive") continue;
    const canonical = applyParseDiagnosticsPolicyPreset(preset);
    if (state.severity !== canonical.severity) continue;
    if (state.blockExport !== canonical.blockExport) continue;
    const canonicalThresholds = parseParseDiagnosticsPolicyThresholds(canonical.thresholdsText).thresholds;
    if (thresholdsEqual(thresholds, canonicalThresholds)) return preset;
  }
  return "custom";
}
