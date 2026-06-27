import {
  resolveStrictControllerCodesGate,
  STRICT_CONTROLLER_GATE_WATCH_PATTERNS,
  type StrictControllerGateWatchPattern
} from "@cnc/core/browser";

export const STRICT_CONTROLLER_GATE_WATCH_PRESETS = STRICT_CONTROLLER_GATE_WATCH_PATTERNS;

export type { StrictControllerGateWatchPattern };

export type StrictControllerGateSummary = {
  patterns: readonly StrictControllerGateWatchPattern[];
  matchedCodes: string[];
  wouldBlock: boolean;
};

/**
 * Collect distinct controller-grammar `CG_*` codes from lint issues.
 */
export function collectControllerGrammarCodesFromLintIssues(
  lintIssues: readonly { code?: string }[]
): string[] {
  const codes = new Set<string>();
  for (const issue of lintIssues) {
    if (typeof issue.code === "string" && issue.code.length > 0) {
      codes.add(issue.code);
    }
  }
  return [...codes].sort((a, b) => a.localeCompare(b));
}

/**
 * Evaluate which gate patterns match the current program's coded lint issues.
 */
export function evaluateStrictControllerGate(
  lintIssues: readonly { code?: string }[],
  patterns: readonly StrictControllerGateWatchPattern[]
): StrictControllerGateSummary {
  const codes = collectControllerGrammarCodesFromLintIssues(lintIssues);
  const matchedCodes = resolveStrictControllerCodesGate(codes, patterns);
  return {
    patterns,
    matchedCodes,
    wouldBlock: matchedCodes.length > 0
  };
}

export function formatStrictControllerGateChip(summary: StrictControllerGateSummary): string {
  if (summary.matchedCodes.length === 0) {
    return `strict-gate: none (${summary.patterns.length} pattern(s) watched)`;
  }
  return `strict-gate: ${summary.matchedCodes.join(", ")}`;
}

export function strictControllerGatePatternLabel(
  pattern: StrictControllerGateWatchPattern,
  labels: {
    nAndO: string;
    duplicateO: string;
    duplicateAddresses: string;
  }
): string {
  switch (pattern) {
    case "CG_N_AND_O_MIXED":
      return labels.nAndO;
    case "CG_DUPLICATE_O_HEADER":
      return labels.duplicateO;
    case "CG_DUPLICATE_ADDRESSES_*":
      return labels.duplicateAddresses;
  }
}

export type StrictControllerGateExportFormat = "json" | "csv";

export function formatStrictControllerGateForExport(
  summary: StrictControllerGateSummary,
  format: StrictControllerGateExportFormat
): string {
  if (format === "json") {
    return JSON.stringify(
      {
        patterns: summary.patterns,
        matchedCodes: summary.matchedCodes,
        wouldBlock: summary.wouldBlock
      },
      null,
      2
    );
  }
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  return [
    "patterns,matchedCodes,wouldBlock",
    `${escape(summary.patterns.join("|"))},${escape(summary.matchedCodes.join("|"))},${summary.wouldBlock}`
  ].join("\n");
}
