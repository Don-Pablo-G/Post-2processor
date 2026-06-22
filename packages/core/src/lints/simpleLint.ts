import type { LintIssue, ProgramAst } from "../types.js";
import {
  collectControllerGrammarIssues,
  collectControllerProgramEnvelopeIssues,
  isLikelyMacroControlFlowLine
} from "./controllerGrammar.js";

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

function duplicatedMotionModeLabels(code: string): string[] {
  const counts = { "0": 0, "1": 0, "2": 0, "3": 0 };
  for (const match of code.matchAll(/\bG\s*([0123])\b/g)) {
    counts[match[1] as keyof typeof counts] += 1;
  }
  const duplicates: string[] = [];
  for (const mode of ["0", "1", "2", "3"] as const) {
    if (counts[mode] >= 2) duplicates.push(`G${mode}`);
  }
  return duplicates;
}

function duplicatedMotionModeMessage(mode: string): string {
  if (mode === "G2" || mode === "G3") {
    return `Block repeats ${mode} in one line; remove redundant arc mode token.`;
  }
  return `Block repeats ${mode} in one line; keep one command per motion mode per block.`;
}

function gModalInts(block: { words: Array<{ letter: string; value: string }> }): number[] {
  return block.words
    .filter((w) => w.letter === "G")
    .map((w) => Math.trunc(Number.parseFloat(w.value)))
    .filter((n) => Number.isFinite(n));
}

function hasUnmatchedParentheses(raw: string): boolean {
  let depth = 0;
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    if (ch === ";" && depth === 0) {
      // Treat semicolon as end-of-code/comment start.
      break;
    }
    if (ch === "(") {
      depth += 1;
    } else if (ch === ")") {
      if (depth === 0) return true;
      depth -= 1;
    }
  }
  return depth !== 0;
}

function hasUnbalancedBrackets(raw: string): boolean {
  let depth = 0;
  let inComment = 0;
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    if (ch === ";" && inComment === 0) break;
    if (ch === "(") {
      inComment += 1;
      continue;
    }
    if (ch === ")" && inComment > 0) {
      inComment -= 1;
      continue;
    }
    if (inComment > 0) continue;
    if (ch === "[") depth += 1;
    else if (ch === "]") {
      if (depth === 0) return true;
      depth -= 1;
    }
  }
  return depth !== 0;
}


export function simpleLint(ast: ProgramAst): LintIssue[] {
  const issues: LintIssue[] = [];

  if (ast.blocks.length === 0) {
    issues.push({
      severity: "warning",
      message: "Program must start with a standalone % line.",
      blockIndex: 0
    });
    issues.push({
      severity: "warning",
      message: "Program must end with a standalone % line.",
      blockIndex: 0
    });
    return issues;
  }

  const firstRaw = ast.blocks[0]?.raw.trim() ?? "";
  if (firstRaw !== "%") {
    issues.push({
      severity: "warning",
      message: "Program must start with a standalone % line.",
      blockIndex: 0
    });
  }
  const lastIndex = ast.blocks.length - 1;
  const lastRaw = ast.blocks[lastIndex]?.raw.trim() ?? "";
  if (lastRaw !== "%") {
    issues.push({
      severity: "warning",
      message: "Program must end with a standalone % line.",
      blockIndex: lastIndex
    });
  }

  issues.push(...collectControllerProgramEnvelopeIssues(ast));

  ast.blocks.forEach((block, index) => {
    const raw = block.raw.trim();
    if (raw.includes("%") && raw !== "%") {
      issues.push({
        severity: "warning",
        message: "Percent delimiter lines must contain only '%'.",
        blockIndex: index
      });
    }
    if (raw === "%") {
      return;
    }
    if (block.words.length === 0 && !isLikelyMacroControlFlowLine(block.raw)) {
      issues.push({
        severity: "warning",
        message: "Block has no parseable words.",
        blockIndex: index
      });
    }
    if (hasUnmatchedParentheses(block.raw)) {
      issues.push({
        severity: "warning",
        message:
          "Unmatched parenthesis in block comment syntax — Haas/Fanuc program comments use paired '(' and ')'.",
        blockIndex: index
      });
    }
    if (hasUnbalancedBrackets(block.raw)) {
      issues.push({
        severity: "warning",
        message:
          "Unbalanced bracket expression — controller may alarm or evaluate incorrectly.",
        blockIndex: index
      });
    }

    const mCount = block.words.filter((w) => w.letter === "M").length;
    if (mCount > 1) {
      issues.push({
        severity: "warning",
        message:
          "More than one M code in a single block — ISO-style controls (Haas, Fanuc) typically allow only one M function per block.",
        blockIndex: index
      });
    }

    const gModes = gModalInts(block);
    const hasG = (code: number): boolean => gModes.includes(code);
    if (hasG(20) && hasG(21)) {
      issues.push({
        severity: "warning",
        message:
          "G20 and G21 in the same block — conflicting inch/metric modes typically alarm on Haas/Fanuc-class controls.",
        blockIndex: index
      });
    }
    if (hasG(90) && hasG(91)) {
      issues.push({
        severity: "warning",
        message:
          "G90 and G91 in the same block — conflicting absolute/incremental modes typically alarm or behave unpredictably on the machine.",
        blockIndex: index
      });
    }
    issues.push(...collectControllerGrammarIssues(ast, block, index));

    const code = stripLintComments(block.raw).toUpperCase();
    const pair = motionModeConflictLabel(code);
    if (pair) {
      issues.push({
        severity: "warning",
        message: motionModeConflictMessage(pair),
        blockIndex: index
      });
    }
    for (const duplicatedMode of duplicatedMotionModeLabels(code)) {
      issues.push({
        severity: "warning",
        message: duplicatedMotionModeMessage(duplicatedMode),
        blockIndex: index
      });
    }
  });

  return issues;
}
