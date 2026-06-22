import type {
  LintIssueProvenanceSource,
  LintIssueWithProvenance,
  LintIssuesSummary,
  ParseDiagnosticsPolicyBreach,
  ParseDiagnosticsSummary,
  TimelineFindingsExportBundle,
  TimelineFindingsExportBundleInput
} from "../types.js";

const LINT_ISSUE_SOURCE_ORDER: ReadonlyArray<LintIssueProvenanceSource> = [
  "lexer",
  "expression_parser",
  "controller_grammar",
  "common_lint",
  "profile_lint"
];

export function summarizeLintIssues(
  issues: ReadonlyArray<LintIssueWithProvenance>
): LintIssuesSummary {
  const bySource: Partial<Record<LintIssueProvenanceSource, number>> = {};
  const bySourceSeverity: Partial<
    Record<LintIssueProvenanceSource, { blockers: number; warnings: number }>
  > = {};
  let blockers = 0;
  let warnings = 0;
  for (const issue of issues) {
    const isBlocker = issue.severity === "error";
    if (isBlocker) blockers += 1;
    else warnings += 1;
    const source = issue.provenance.source;
    bySource[source] = (bySource[source] ?? 0) + 1;
    const bucket = bySourceSeverity[source] ?? { blockers: 0, warnings: 0 };
    if (isBlocker) bucket.blockers += 1;
    else bucket.warnings += 1;
    bySourceSeverity[source] = bucket;
  }
  const sourcesPresent = Object.entries(bySource) as Array<[LintIssueProvenanceSource, number]>;
  sourcesPresent.sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return LINT_ISSUE_SOURCE_ORDER.indexOf(a[0]) - LINT_ISSUE_SOURCE_ORDER.indexOf(b[0]);
  });
  const topSources = sourcesPresent.slice(0, 2).map(([source]) => source);
  return {
    total: issues.length,
    blockers,
    warnings,
    bySource,
    bySourceSeverity,
    topSources
  };
}

export function formatLintIssuesSummaryBlock(
  summary: LintIssuesSummary | undefined
): { txt: string; md: string; histogram?: { txt: string; md: string } } {
  if (!summary || summary.total === 0) {
    return {
      txt: "lintIssues: total=0",
      md: "- Lint issues: total=0"
    };
  }
  const top = summary.topSources.length > 0 ? summary.topSources.join(",") : "n/a";
  const bySource = (Object.entries(summary.bySource) as Array<[LintIssueProvenanceSource, number]>)
    .sort(([a], [b]) =>
      LINT_ISSUE_SOURCE_ORDER.indexOf(a) - LINT_ISSUE_SOURCE_ORDER.indexOf(b)
    )
    .map(([source, count]) => `${source}=${count}`)
    .join(" ");
  const result: { txt: string; md: string; histogram?: { txt: string; md: string } } = {
    txt: `lintIssues: total=${summary.total} | severities=blocker:${summary.blockers},warning:${summary.warnings} | top=${top} | bySource=${bySource || "n/a"}`,
    md: `- Lint issues: total=${summary.total} | severities=blocker:${summary.blockers},warning:${summary.warnings} | top=${top} | bySource=${bySource || "n/a"}`
  };
  const histogram = formatLintIssuesBySourceHistogram(summary);
  if (histogram !== undefined) {
    result.histogram = histogram;
  }
  return result;
}

const HISTOGRAM_MAX_BAR_WIDTH = 10;

/**
 * Build a per-source severity histogram block. Returns `undefined` when:
 *  - the summary is missing or empty,
 *  - only a single source contributed (the rollup line is enough),
 *  - or the summary lacks `bySourceSeverity` (older payloads).
 *
 * Source ordering matches the consumers of `topSources`: top entries first,
 * then count desc, then canonical source order. Each row renders as:
 *   `  <source padded>  <bars>  <count> (blocker:N, warning:N)`.
 */
export function formatLintIssuesBySourceHistogram(
  summary: LintIssuesSummary | undefined
): { txt: string; md: string } | undefined {
  if (!summary || summary.total === 0) return undefined;
  if (!summary.bySourceSeverity) return undefined;
  const bySource = summary.bySource;
  const presentSources = (Object.keys(bySource) as LintIssueProvenanceSource[]).filter(
    (source) => (bySource[source] ?? 0) > 0
  );
  if (presentSources.length < 2) return undefined;
  const topOrder = new Map<LintIssueProvenanceSource, number>();
  summary.topSources.forEach((source, idx) => {
    topOrder.set(source, idx);
  });
  presentSources.sort((a, b) => {
    const aTop = topOrder.get(a);
    const bTop = topOrder.get(b);
    if (aTop !== undefined && bTop !== undefined) return aTop - bTop;
    if (aTop !== undefined) return -1;
    if (bTop !== undefined) return 1;
    const aCount = bySource[a] ?? 0;
    const bCount = bySource[b] ?? 0;
    if (bCount !== aCount) return bCount - aCount;
    return LINT_ISSUE_SOURCE_ORDER.indexOf(a) - LINT_ISSUE_SOURCE_ORDER.indexOf(b);
  });
  const labelWidth = presentSources.reduce((max, s) => Math.max(max, s.length), 0);
  const maxCount = presentSources.reduce(
    (max, s) => Math.max(max, bySource[s] ?? 0),
    0
  );
  const txtLines: string[] = [];
  const mdLines: string[] = [];
  for (const source of presentSources) {
    const count = bySource[source] ?? 0;
    const sev = summary.bySourceSeverity[source] ?? { blockers: 0, warnings: 0 };
    const barLen = maxCount === 0
      ? 0
      : Math.max(1, Math.round((count / maxCount) * HISTOGRAM_MAX_BAR_WIDTH));
    const bar = "#".repeat(barLen);
    const padBar = bar + " ".repeat(Math.max(0, HISTOGRAM_MAX_BAR_WIDTH - barLen));
    const label = source.padEnd(labelWidth, " ");
    const tail = `${count} (blocker:${sev.blockers}, warning:${sev.warnings})`;
    txtLines.push(`  ${label}  ${padBar}  ${tail}`);
    mdLines.push(`  - ${source}: ${bar} ${tail}`);
  }
  return { txt: txtLines.join("\n"), md: mdLines.join("\n") };
}

export function formatParseDiagnosticsSummary(summary: ParseDiagnosticsSummary | undefined): {
  txt: string;
  md: string;
} {
  if (!summary || summary.total === 0) {
    return {
      txt: "parseDiagnostics: total=0",
      md: "- Parse diagnostics: total=0"
    };
  }
  const top = summary.topCodes.length > 0 ? summary.topCodes.join(",") : "n/a";
  const byCodeEntries = Object.entries(summary.byCode)
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    })
    .map(([code, count]) => `${code}=${count}`)
    .join(" ");
  return {
    txt: `parseDiagnostics: total=${summary.total} | top=${top} | byCode=${byCodeEntries || "n/a"}`,
    md: `- Parse diagnostics: total=${summary.total} | top=${top} | byCode=${byCodeEntries || "n/a"}`
  };
}

export function formatParseDiagnosticsBreachesBlock(
  breaches: ReadonlyArray<ParseDiagnosticsPolicyBreach> | undefined
): { txt: string; md: string } {
  const list = breaches ?? [];
  if (list.length === 0) {
    return {
      txt: "parseDiagBreaches: total=0",
      md: "- Parse diagnostics breaches: total=0"
    };
  }
  const sorted = [...list].sort((a, b) => a.key.localeCompare(b.key));
  const severityCounts = new Map<string, number>();
  for (const breach of sorted) {
    severityCounts.set(breach.severity, (severityCounts.get(breach.severity) ?? 0) + 1);
  }
  const severities = [...severityCounts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([sev, n]) => `${sev}:${n}`)
    .join(",");
  const byKey = sorted.map((b) => `${b.key}:${b.observed}/${b.threshold}`).join(",");
  return {
    txt: `parseDiagBreaches: total=${sorted.length} | severities=${severities} | byKey=${byKey}`,
    md: `- Parse diagnostics breaches: total=${sorted.length} | severities=${severities} | byKey=${byKey}`
  };
}

export function buildTimelineFindingsExportBundle(
  input: TimelineFindingsExportBundleInput
): TimelineFindingsExportBundle {
  const parseSummary = formatParseDiagnosticsSummary(input.parseDiagnosticsSummary);
  const headerTxt = [
    "WORKSHOP TIMELINE + FINDINGS",
    `timestamp: ${input.timestampIso}`,
    `controller: ${input.controller}`,
    `policyPreset: ${input.policyPreset ?? "balanced"}`,
    `policyPresetSource: ${input.policyPresetSource ?? "unknown"}`,
    `subprogramTargetPolicy: ${input.subprogramTargetPolicy ?? "n/a"}`,
    `logSemantics: ${input.logSemantics ?? "n/a"}`,
    `score: ${input.score ?? "n/a"}`,
    parseSummary.txt,
    ""
  ];
  const headerMd = [
    "# Workshop Timeline + Findings",
    "",
    `- Timestamp: ${input.timestampIso}`,
    `- Controller: ${input.controller}`,
    `- Policy preset: ${input.policyPreset ?? "balanced"}`,
    `- Policy preset source: ${input.policyPresetSource ?? "unknown"}`,
    `- Subprogram target policy: ${input.subprogramTargetPolicy ?? "n/a"}`,
    `- LOG semantics: ${input.logSemantics ?? "n/a"}`,
    `- Score: ${input.score ?? "n/a"}`,
    parseSummary.md,
    ""
  ];

  const timelineLines = input.timelineEntries.map(
    (event) => `${eventTag(event.kind)} B${event.blockIndex}: [${event.kind}] ${event.message}`
  );
  const findingLines = input.findings.map((f) => {
    const block = f.blockIndex !== undefined ? `B${f.blockIndex}` : "B?";
    return `[${f.severity.toUpperCase()}] ${f.code} @ ${block}: ${f.message}`;
  });

  return {
    timelineTxt: [...headerTxt, "TIMELINE", ...(timelineLines.length > 0 ? timelineLines : ["- none"])].join("\n"),
    timelineMarkdown: [
      ...headerMd,
      "## Timeline",
      ...(timelineLines.length > 0 ? timelineLines.map((l) => `- ${l}`) : ["- none"])
    ].join("\n"),
    findingsTxt: [...headerTxt, "FINDINGS", ...(findingLines.length > 0 ? findingLines : ["- none"])].join("\n"),
    findingsMarkdown: [
      ...headerMd,
      "## Findings",
      ...(findingLines.length > 0 ? findingLines.map((l) => `- ${l}`) : ["- none"])
    ].join("\n")
  };
}

function eventTag(kind: string): string {
  if (kind === "alarm" || kind === "message_stop") return "[ALARM]";
  if (kind === "subprogram_call" || kind === "subprogram_return" || kind === "subprogram_repeat") return "[FLOW]";
  return "[CONTROL]";
}
