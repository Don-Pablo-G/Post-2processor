import type { LintIssue, ProgramAst, Word } from "@cnc/core";
import { lintFanucIsoMillLint } from "./fanucIsoMillLint.js";

function hasOHeader(words: Word[]): boolean {
  return words.some((w) => w.letter === "O");
}

function isMeaningfulBlock(words: Word[]): boolean {
  return words.some((w) => w.letter !== "N");
}

function hasG65Call(words: Word[]): boolean {
  return words.some(
    (w) => w.letter === "G" && Math.trunc(Number.parseFloat(w.value)) === 65
  );
}

function findWord(words: Word[], letter: string): Word | undefined {
  return words.find((w) => w.letter === letter);
}

function isMacroOrExpressionValue(rawValue: string): boolean {
  // Fanuc macro vars (#100) and bracketed expressions ([#100+1.]) are dynamic;
  // the controller resolves them at run time, so the static lint must NOT
  // treat them as integer-violating.
  const trimmed = rawValue.trim();
  return trimmed.includes("#") || trimmed.includes("[");
}

/**
 * Fanuc ISO mill-oriented checks. Conservative: only rules that are clearly
 * Fanuc-specific and not already covered by `simpleLint` or controller-grammar
 * rules in core.
 */
export function lintFanucIsoMill(ast: ProgramAst): LintIssue[] {
  const issues: LintIssue[] = [];

  let seenOHeader = false;
  let firstMeaningfulBlockIndex = -1;
  for (let i = 0; i < ast.blocks.length; i += 1) {
    const block = ast.blocks[i];
    if (block.words.length === 0) continue;
    if (hasOHeader(block.words)) {
      seenOHeader = true;
      break;
    }
    if (isMeaningfulBlock(block.words)) {
      firstMeaningfulBlockIndex = i;
      break;
    }
  }
  if (!seenOHeader && firstMeaningfulBlockIndex >= 0) {
    issues.push({
      severity: "warning",
      message:
        "Fanuc program lacks an explicit O#### program-number header before the first motion block — most Fanuc controls expect O followed by a numeric program ID.",
      blockIndex: firstMeaningfulBlockIndex
    });
  }

  let sawRealToolSelection = false;
  ast.blocks.forEach((block, index) => {
    if (hasG65Call(block.words)) {
      const pWord = findWord(block.words, "P");
      if (!pWord) {
        issues.push({
          severity: "warning",
          message:
            "Fanuc G65 macro call missing P (program number) — controller will alarm without an explicit program target.",
          blockIndex: index
        });
      }
      const lWord = findWord(block.words, "L");
      if (lWord && !isMacroOrExpressionValue(lWord.value)) {
        const numeric = Number.parseFloat(lWord.value);
        const isNonNegativeInteger =
          Number.isFinite(numeric) && numeric >= 0 && Number.isInteger(numeric);
        if (!isNonNegativeInteger) {
          issues.push({
            severity: "warning",
            message:
              "Fanuc G65 L (loop count) must be a non-negative integer — fractional or negative values will alarm at the controller.",
            blockIndex: index
          });
        }
      }
    }

    const tWord = findWord(block.words, "T");
    if (tWord) {
      const numeric = Number.parseFloat(tWord.value);
      if (Number.isFinite(numeric) && Math.trunc(numeric) === 0) {
        if (!sawRealToolSelection) {
          issues.push({
            severity: "warning",
            message:
              "T0 (tool cancel) issued before any real tool selection — Fanuc tool-life manager will alarm; pair with a prior Tn (n>0).",
            blockIndex: index
          });
        }
      } else if (Number.isFinite(numeric) && Math.trunc(numeric) > 0) {
        sawRealToolSelection = true;
      }
    }
  });

  return [...issues, ...lintFanucIsoMillLint(ast)];
}
