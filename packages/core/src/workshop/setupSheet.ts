import { analyzeProgram } from "./advisor.js";
import { buildToolingReport } from "../tooling/report.js";
import type { ProgramAst, SetupSheet } from "../types.js";

export function generateSetupSheet(ast: ProgramAst, initialState: Record<string, number>): SetupSheet {
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

  return {
    title: "Workshop Setup Sheet",
    lines,
    printable80mm: lines.map((l) => (l.length > 42 ? l.slice(0, 42) : l)).join("\n"),
    exportTxt: lines.join("\n"),
    exportMarkdown: toMarkdown(lines)
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
