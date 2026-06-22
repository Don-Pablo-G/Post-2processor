import { analyzeProgram } from "./advisor.js";
import { buildToolingReport } from "../tooling/report.js";
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
  SetupSheet
} from "../types.js";

export function generateSetupSheet(
  ast: ProgramAst,
  initialState: Record<string, number>,
  options: {
    parseDiagnosticsSummary?: ParseDiagnosticsSummary;
    parseDiagnosticsBreaches?: ReadonlyArray<ParseDiagnosticsPolicyBreach>;
    lintIssuesSummary?: LintIssuesSummary;
  } = {}
): SetupSheet {
  const tooling = buildToolingReport(ast, initialState, {
    includeSetupInstructions: true,
    fiveAxis: { enabled: true, machine: "umc" }
  });
  const advisor = analyzeProgram(ast, initialState);
  const blockerCount = advisor.safetyFindings.filter((f) => f.severity === "blocker").length;
  const handoff = blockerCount > 0 ? "NO-GO" : "GO";
  const lines: string[] = [];
  lines.push("SETUP SHEET");
  lines.push(`HANDOFF: ${handoff}`);
  lines.push(`Ready-to-run score: ${advisor.readyToRunScore}/100`);
  lines.push(`Program lowest Z: ${tooling.programLowestZ.toFixed(3)} mm`);
  lines.push(`Work offsets: ${tooling.workOffsetsSeen.join(", ") || "UNKNOWN"}`);
  lines.push("");
  lines.push("TOOLS");
  tooling.tools.forEach((t) => {
    const h = t.hOffsetParameter ?? (t.hOffset !== undefined ? `H${t.hOffset}` : "H-");
    const d = t.dOffsetParameter ?? (t.dOffset !== undefined ? `D${t.dOffset}` : "D-");
    lines.push(`T${t.toolNumber}: ${h}/${d}, Zmin ${t.lowestZ.toFixed(3)} mm`);
  });
  lines.push("");
  lines.push("FIRST-RUN CHECKLIST");
  advisor.checklist.forEach((c) => lines.push(`- ${c}`));
  lines.push("");
  lines.push("BLOCKERS/WARNINGS");
  advisor.safetyFindings.slice(0, 10).forEach((f) => {
    lines.push(`[${f.severity.toUpperCase()}] ${f.message}`);
  });

  const exportTxtLines = [...lines];
  const exportMarkdownExtras: string[] = [];
  if (options.parseDiagnosticsSummary) {
    const formatted = formatParseDiagnosticsSummary(options.parseDiagnosticsSummary);
    exportTxtLines.push("");
    exportTxtLines.push("PARSE DIAGNOSTICS");
    exportTxtLines.push(formatted.txt);
    exportMarkdownExtras.push("", "## Parse diagnostics", "", formatted.md);
  }
  if (options.parseDiagnosticsBreaches !== undefined) {
    const formatted = formatParseDiagnosticsBreachesBlock(options.parseDiagnosticsBreaches);
    exportTxtLines.push("");
    exportTxtLines.push("PARSE DIAGNOSTICS BREACHES");
    exportTxtLines.push(formatted.txt);
    exportMarkdownExtras.push("", "## Parse diagnostics breaches", "", formatted.md);
  }
  if (options.lintIssuesSummary !== undefined) {
    const formatted = formatLintIssuesSummaryBlock(options.lintIssuesSummary);
    exportTxtLines.push("");
    exportTxtLines.push("LINT ISSUES");
    exportTxtLines.push(formatted.txt);
    if (formatted.histogram) {
      exportTxtLines.push(formatted.histogram.txt);
    }
    exportMarkdownExtras.push("", "## Lint issues", "", formatted.md);
    if (formatted.histogram) {
      exportMarkdownExtras.push(formatted.histogram.md);
    }
  }

  return {
    title: "Workshop Setup Sheet",
    lines,
    printable80mm: lines.map((l) => (l.length > 42 ? l.slice(0, 42) : l)).join("\n"),
    exportTxt: exportTxtLines.join("\n"),
    exportMarkdown: [toMarkdown(lines), ...exportMarkdownExtras].join("\n")
  };
}

function toMarkdown(lines: string[]): string {
  const out: string[] = ["# Workshop Setup Sheet", ""];
  lines.forEach((line) => {
    if (!line) {
      out.push("");
      return;
    }
    if (line === line.toUpperCase() && /^[A-Z\s-]+$/.test(line)) {
      out.push(`## ${line}`);
      return;
    }
    if (line.startsWith("- ")) {
      out.push(line);
      return;
    }
    out.push(line);
  });
  return out.join("\n");
}
