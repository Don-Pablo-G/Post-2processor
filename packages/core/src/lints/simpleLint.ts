import type { LintIssue, ProgramAst } from "../types.js";

function stripLintComments(raw: string): string {
  return raw.replace(/\([^)]*\)/g, "").replace(/;.*$/gim, "").trim();
}

/** Word-boundary G codes (G0 not G00 interior; G1 not G01, etc.). */
function motionModeConflictLabel(code: string): string | null {
  const g0 = /\bG\s*0\b/.test(code);
  const g1 = /\bG\s*1\b/.test(code);
  const g2 = /\bG\s*2\b/.test(code);
  const g3 = /\bG\s*3\b/.test(code);
  if (g0 && g1) return "G0 and G1";
  if (g0 && g2) return "G0 and G2";
  if (g0 && g3) return "G0 and G3";
  if (g1 && g2) return "G1 and G2";
  if (g1 && g3) return "G1 and G3";
  if (g2 && g3) return "G2 and G3";
  return null;
}

export function simpleLint(ast: ProgramAst): LintIssue[] {
  const issues: LintIssue[] = [];

  ast.blocks.forEach((block, index) => {
    if (block.words.length === 0) {
      issues.push({
        severity: "warning",
        message: "Block has no parseable words.",
        blockIndex: index
      });
    }
    const code = stripLintComments(block.raw).toUpperCase();
    const pair = motionModeConflictLabel(code);
    if (pair) {
      issues.push({
        severity: "warning",
        message: `Block mixes ${pair} in one line; verify motion mode intent.`,
        blockIndex: index
      });
    }
  });

  return issues;
}
