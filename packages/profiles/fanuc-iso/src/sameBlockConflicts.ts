import type { LintIssue, Word } from "@cnc/core";
import { hasCannedCycle, hasExactG } from "./rules/millHelpers.js";

export type SameBlockToken = "g43" | "g49" | "g40" | "g41Or42" | "g80" | "cannedCycle";

type Conflict = readonly [SameBlockToken, SameBlockToken, string, string];

export function detectSameBlockTokens(block: { words: Word[] }): Set<SameBlockToken> {
  const tokens = new Set<SameBlockToken>();
  if (hasExactG(block, 43)) tokens.add("g43");
  if (hasExactG(block, 49)) tokens.add("g49");
  if (hasExactG(block, 40)) tokens.add("g40");
  if (hasExactG(block, 80)) tokens.add("g80");
  if (hasCannedCycle(block)) tokens.add("cannedCycle");
  if (
    block.words.some((w) => {
      if (w.letter !== "G") return false;
      const v = Number.parseFloat(w.value);
      return v === 41 || v === 42;
    })
  ) {
    tokens.add("g41Or42");
  }
  return tokens;
}

export const SAME_BLOCK_RESIDUAL_CONFLICTS: readonly Conflict[] = [
  [
    "g43",
    "g49",
    "fanuc.g43-and-g49-same-block",
    "G43 and G49 on the same block — split tool length apply/cancel into separate blocks."
  ],
  [
    "g40",
    "g41Or42",
    "fanuc.g40-and-cutter-comp-same-block",
    "G40 and G41/G42 on the same block — split cutter compensation apply/cancel into separate blocks."
  ],
  [
    "g80",
    "cannedCycle",
    "fanuc.g80-and-canned-same-block",
    "G80 and a canned cycle on the same block — split canned-cycle start/cancel into separate blocks."
  ]
];

export function collectFanucSameBlockConflictIssues(
  block: { words: Word[] },
  blockIndex: number
): LintIssue[] {
  const tokens = detectSameBlockTokens(block);
  if (tokens.size < 2) return [];

  const issues: LintIssue[] = [];
  for (const [a, b, code, message] of SAME_BLOCK_RESIDUAL_CONFLICTS) {
    if (tokens.has(a) && tokens.has(b)) {
      issues.push({ severity: "warning", code, message, blockIndex });
    }
  }
  return issues;
}
