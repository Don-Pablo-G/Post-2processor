import type { LintIssue, Word } from "@cnc/core";
import { hasCannedCycle, hasExactG, hasWordM } from "./rules/millHelpers.js";

export type SameBlockToken =
  | "g43"
  | "g49"
  | "g40"
  | "g41"
  | "g42"
  | "g41Or42"
  | "g80"
  | "cannedCycle"
  | "g68"
  | "g69"
  | "g50"
  | "g51"
  | "g4"
  | "m6";

type Conflict = readonly [SameBlockToken, SameBlockToken, string, string];

export function detectSameBlockTokens(block: { words: Word[] }): Set<SameBlockToken> {
  const tokens = new Set<SameBlockToken>();
  if (hasExactG(block, 43)) tokens.add("g43");
  if (hasExactG(block, 49)) tokens.add("g49");
  if (hasExactG(block, 40)) tokens.add("g40");
  if (hasExactG(block, 80)) tokens.add("g80");
  if (hasExactG(block, 68)) tokens.add("g68");
  if (hasExactG(block, 69)) tokens.add("g69");
  if (hasExactG(block, 50)) tokens.add("g50");
  if (hasExactG(block, 51)) tokens.add("g51");
  if (hasExactG(block, 4)) tokens.add("g4");
  if (hasCannedCycle(block)) tokens.add("cannedCycle");
  if (hasExactG(block, 41)) tokens.add("g41");
  if (hasExactG(block, 42)) tokens.add("g42");
  if (
    block.words.some((w) => {
      if (w.letter !== "G") return false;
      const v = Number.parseFloat(w.value);
      return v === 41 || v === 42;
    })
  ) {
    tokens.add("g41Or42");
  }
  if (hasWordM(block, 6)) tokens.add("m6");
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
  ],
  [
    "g68",
    "g69",
    "fanuc.g68-and-g69-same-block",
    "G68 and G69 on the same block — split coordinate rotation apply/cancel into separate blocks."
  ],
  [
    "g51",
    "g50",
    "fanuc.g50-and-g51-same-block",
    "G51 and G50 on the same block — split scaling apply/cancel into separate blocks."
  ],
  [
    "g41",
    "g42",
    "fanuc.g41-and-g42-same-block",
    "G41 and G42 on the same block — pick one cutter-compensation side, not both."
  ],
  [
    "g43",
    "g41Or42",
    "fanuc.g43-and-g41-same-block",
    "G43 and G41/G42 on the same block — apply tool length and cutter compensation on separate blocks."
  ],
  [
    "g68",
    "g51",
    "fanuc.g68-and-g51-same-block",
    "G68 and G51 on the same block — do not apply coordinate rotation and scaling together."
  ],
  [
    "g4",
    "m6",
    "fanuc.g4-and-m6-same-block",
    "G4 dwell and M6 on the same block — dwell and tool change separately."
  ],
  [
    "g43",
    "g80",
    "fanuc.g43-and-g80-same-block",
    "G43 and G80 on the same block — apply tool length and cancel canned cycle on separate blocks."
  ],
  [
    "g41Or42",
    "g80",
    "fanuc.g41-and-g80-same-block",
    "G41/G42 and G80 on the same block — apply cutter compensation and cancel canned cycle on separate blocks."
  ],
  [
    "g68",
    "g80",
    "fanuc.g68-and-g80-same-block",
    "G68 and G80 on the same block — apply coordinate rotation and cancel canned cycle on separate blocks."
  ],
  [
    "g51",
    "g80",
    "fanuc.g51-and-g80-same-block",
    "G51 and G80 on the same block — apply scaling and cancel canned cycle on separate blocks."
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
