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
  const modeCount = [g0, g1, g2, g3].filter(Boolean).length;
  if (modeCount >= 3) return "multiple motion modes (G0/G1/G2/G3)";
  if (g0 && g1) return "G0 and G1";
  if (g0 && g2) return "G0 and G2";
  if (g0 && g3) return "G0 and G3";
  if (g1 && g2) return "G1 and G2";
  if (g1 && g3) return "G1 and G3";
  if (g2 && g3) return "G2 and G3";
  return null;
}

function motionModeConflictMessage(label: string): string {
  if (label.startsWith("multiple motion modes")) {
    return `Block has ${label} in one line; keep one active mode per block.`;
  }
  return `Block mixes ${label} in one line; verify motion mode intent.`;
}

function duplicatedMotionModeLabel(code: string): string | null {
  const counts = { "0": 0, "1": 0, "2": 0, "3": 0 };
  for (const match of code.matchAll(/\bG\s*([0123])\b/g)) {
    counts[match[1] as keyof typeof counts] += 1;
  }
  for (const mode of ["0", "1", "2", "3"] as const) {
    if (counts[mode] >= 2) return `G${mode}`;
  }
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
        message: motionModeConflictMessage(pair),
        blockIndex: index
      });
    }
    const duplicatedMode = duplicatedMotionModeLabel(code);
    if (duplicatedMode) {
      issues.push({
        severity: "warning",
        message: `Block repeats ${duplicatedMode} in one line; keep one command per motion mode per block.`,
        blockIndex: index
      });
    }
  });

  return issues;
}
