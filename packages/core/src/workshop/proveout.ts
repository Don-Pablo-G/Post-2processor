import { analyzeProgram } from "./advisor.js";
import {
  formatLintIssuesSummaryBlock,
  formatParseDiagnosticsBreachesBlock,
  formatParseDiagnosticsSummary
} from "./exportBundle.js";
import type {
  LintIssuesSummary,
  ParseDiagnosticsPolicyBreach,
  ParseDiagnosticsSummary,
  ProgramAst,
  ProveoutPatchResult,
  ProveoutResult
} from "../types.js";

export function buildProveoutProgram(
  ast: ProgramAst,
  initialState: Record<string, number>,
  options: {
    parseDiagnosticsSummary?: ParseDiagnosticsSummary;
    parseDiagnosticsBreaches?: ReadonlyArray<ParseDiagnosticsPolicyBreach>;
    lintIssuesSummary?: LintIssuesSummary;
  } = {}
): ProveoutResult {
  const advisor = analyzeProgram(ast, initialState);
  const stopBlocks = new Map<number, string>(
    advisor.optionalStopSuggestions.map((s) => [s.blockIndex, s.suggestedLine])
  );

  let inserted = 0;
  const lines: string[] = [];
  lines.push("(PROVEOUT MODE ENABLED)");
  lines.push("(SET FEED OVERRIDE <=25% AND RAPID <=5%)");
  lines.push("(RUN SINGLE BLOCK THROUGH FIRST CUT)");
  if (options.parseDiagnosticsSummary) {
    const formatted = formatParseDiagnosticsSummary(options.parseDiagnosticsSummary);
    lines.push(`(${formatted.txt})`);
  }
  if (options.parseDiagnosticsBreaches !== undefined) {
    const formatted = formatParseDiagnosticsBreachesBlock(options.parseDiagnosticsBreaches);
    lines.push(`(${formatted.txt})`);
  }
  if (options.lintIssuesSummary !== undefined) {
    const formatted = formatLintIssuesSummaryBlock(options.lintIssuesSummary);
    lines.push(`(${formatted.txt})`);
  }

  ast.blocks.forEach((block, index) => {
    if (stopBlocks.has(index)) {
      inserted += 1;
      lines.push(stopBlocks.get(index)!);
    }
    lines.push(block.raw);
  });

  return {
    code: lines.join("\n"),
    insertedCheckpoints: inserted,
    notes: [
      "Program annotated for proveout mode.",
      "Optional stops inserted at critical points.",
      "Remove proveout comments and M01 markers for full production run."
    ]
  };
}

export function applyProveoutMarkers(code: string, markerLines: string[]): ProveoutPatchResult {
  const lines = code.split(/\r?\n/);
  let markersAdded = 0;
  const output: string[] = [];

  const header = [
    "(PROVEOUT MODE ENABLED)",
    "(SET FEED OVERRIDE <=25% AND RAPID <=5%)",
    "(RUN SINGLE BLOCK THROUGH FIRST CUT)"
  ];
  const hasHeader = header.every((h) => lines.includes(h));
  if (!hasHeader) {
    output.push(...header);
    markersAdded += header.length;
  }

  const existing = new Set(lines);
  const markers = markerLines.filter((m) => m.trim().length > 0);
  lines.forEach((line) => {
    output.push(line);
    if (/^\s*M0?1\b/i.test(line)) return;
  });
  for (const marker of markers) {
    if (!existing.has(marker)) {
      output.push(marker);
      markersAdded += 1;
    }
  }

  return {
    code: output.join("\n"),
    markersAdded,
    markersRemoved: 0
  };
}

export function removeProveoutMarkers(code: string): ProveoutPatchResult {
  const lines = code.split(/\r?\n/);
  let markersRemoved = 0;
  const output = lines.filter((line) => {
    const isMarker =
      line.includes("PROVEOUT MODE ENABLED") ||
      line.includes("SET FEED OVERRIDE <=") ||
      line.includes("RUN SINGLE BLOCK THROUGH FIRST CUT") ||
      /^\s*\(OPTIONAL STOP: .*?\)\s*M01\s*$/i.test(line);
    if (isMarker) markersRemoved += 1;
    return !isMarker;
  });

  return {
    code: output.join("\n"),
    markersAdded: 0,
    markersRemoved
  };
}
