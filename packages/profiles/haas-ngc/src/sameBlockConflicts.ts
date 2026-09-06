import type { LintIssue, Word } from "@cnc/core";

/** Tokens used by the Cartesian same-block conflict matrix. */
export type SameBlockToken =
  | "g28"
  | "g30"
  | "g53"
  | "g92"
  | "g52"
  | "g43"
  | "g49"
  | "g40"
  | "g80"
  | "g41Or42"
  | "workOffset"
  | "m6"
  | "g4"
  | "g65"
  | "m98"
  | "m97"
  | "m00"
  | "m01"
  | "m99"
  | "m30"
  | "m02"
  | "g68"
  | "g69"
  | "g50"
  | "g51";

type Conflict = readonly [SameBlockToken, SameBlockToken, string];

const WORK_OFFSET_G_CODES = new Set([54, 55, 56, 57, 58, 59, 154]);

function hasExactG(block: { words: Word[] }, code: number): boolean {
  return block.words.some((w) => {
    if (w.letter !== "G") return false;
    return Number.parseFloat(w.value) === code;
  });
}

function hasWordM(block: { words: Word[] }, code: number): boolean {
  return block.words.some((w) => w.letter === "M" && Number(w.value) === code);
}

/** Detect matrix tokens present on a block (order independent). */
export function detectSameBlockTokens(block: { words: Word[] }): Set<SameBlockToken> {
  const tokens = new Set<SameBlockToken>();
  if (hasExactG(block, 28)) tokens.add("g28");
  if (hasExactG(block, 30)) tokens.add("g30");
  if (hasExactG(block, 53)) tokens.add("g53");
  if (hasExactG(block, 92)) tokens.add("g92");
  if (hasExactG(block, 52)) tokens.add("g52");
  if (hasExactG(block, 43)) tokens.add("g43");
  if (hasExactG(block, 49)) tokens.add("g49");
  if (hasExactG(block, 40)) tokens.add("g40");
  if (hasExactG(block, 80)) tokens.add("g80");
  if (hasExactG(block, 4)) tokens.add("g4");
  if (hasExactG(block, 65)) tokens.add("g65");
  if (hasExactG(block, 68)) tokens.add("g68");
  if (hasExactG(block, 69)) tokens.add("g69");
  if (hasExactG(block, 50)) tokens.add("g50");
  if (hasExactG(block, 51)) tokens.add("g51");
  if (
    block.words.some((w) => {
      if (w.letter !== "G") return false;
      const v = Number.parseFloat(w.value);
      return v === 41 || v === 42;
    })
  ) {
    tokens.add("g41Or42");
  }
  if (
    block.words.some((w) => {
      if (w.letter !== "G") return false;
      return WORK_OFFSET_G_CODES.has(Number.parseFloat(w.value));
    })
  ) {
    tokens.add("workOffset");
  }
  if (hasWordM(block, 6)) tokens.add("m6");
  if (hasWordM(block, 98)) tokens.add("m98");
  if (hasWordM(block, 97)) tokens.add("m97");
  if (hasWordM(block, 0)) tokens.add("m00");
  if (hasWordM(block, 1)) tokens.add("m01");
  if (hasWordM(block, 99)) tokens.add("m99");
  if (hasWordM(block, 30)) tokens.add("m30");
  if (hasWordM(block, 2)) tokens.add("m02");
  return tokens;
}

/**
 * Pairwise same-block conflicts (behavior-preserving messages).
 * Mutual exclusives (G43↔G49, G92↔G52, G28↔G30/G53, …) stay as dedicated checks.
 */
export const SAME_BLOCK_CONFLICTS: readonly Conflict[] = [
  ["g28", "g92", "G28 and G92 on the same block — do not mix reference return with a coordinate shift."],
  ["g53", "g92", "G53 and G92 on the same block — do not mix machine move with a coordinate shift."],
  [
    "g30",
    "g92",
    "G30 and G92 on the same block — do not mix secondary reference return with a coordinate shift."
  ],
  ["g28", "g52", "G28 and G52 on the same block — do not mix reference return with a local offset."],
  ["g53", "g52", "G53 and G52 on the same block — do not mix machine move with a local offset."],
  [
    "g30",
    "g52",
    "G30 and G52 on the same block — do not mix secondary reference return with a local offset."
  ],
  ["m6", "g28", "M6 and G28 on the same block — tool change and reference return separately."],
  ["m6", "g30", "M6 and G30 on the same block — tool change and secondary reference return separately."],
  ["m6", "g53", "M6 and G53 on the same block — tool change and machine move separately."],
  ["g4", "g28", "G4 dwell and G28 on the same block — dwell and reference return separately."],
  ["g4", "g30", "G4 dwell and G30 on the same block — dwell and secondary reference return separately."],
  ["g4", "g53", "G4 dwell and G53 on the same block — dwell and machine move separately."],
  ["m6", "g65", "M6 and G65 on the same block — tool change and macro call separately."],
  ["m98", "g28", "M98 and G28 on the same block — subprogram call and reference return separately."],
  [
    "m97",
    "g28",
    "M97 and G28 on the same block — local subprogram call and reference return separately."
  ],
  ["g65", "g28", "G65 and G28 on the same block — macro call and reference return separately."],
  ["m98", "g53", "M98 and G53 on the same block — subprogram call and machine move separately."],
  [
    "m97",
    "g53",
    "M97 and G53 on the same block — local subprogram call and machine move separately."
  ],
  ["g65", "g53", "G65 and G53 on the same block — macro call and machine move separately."],
  [
    "m98",
    "g30",
    "M98 and G30 on the same block — subprogram call and secondary reference return separately."
  ],
  [
    "m97",
    "g30",
    "M97 and G30 on the same block — local subprogram call and secondary reference return separately."
  ],
  [
    "g65",
    "g30",
    "G65 and G30 on the same block — macro call and secondary reference return separately."
  ],
  ["m00", "g28", "M00 and G28 on the same block — program stop and reference return separately."],
  ["m01", "g28", "M01 and G28 on the same block — optional stop and reference return separately."],
  ["m00", "g53", "M00 and G53 on the same block — program stop and machine move separately."],
  ["m01", "g53", "M01 and G53 on the same block — optional stop and machine move separately."],
  [
    "m00",
    "g30",
    "M00 and G30 on the same block — program stop and secondary reference return separately."
  ],
  [
    "m01",
    "g30",
    "M01 and G30 on the same block — optional stop and secondary reference return separately."
  ],
  ["m99", "g28", "M99 and G28 on the same block — subprogram return and reference return separately."],
  [
    "m99",
    "g30",
    "M99 and G30 on the same block — subprogram return and secondary reference return separately."
  ],
  ["m99", "g53", "M99 and G53 on the same block — subprogram return and machine move separately."],
  ["g4", "g65", "G4 dwell and G65 on the same block — dwell and macro call separately."],
  ["g4", "m98", "G4 dwell and M98 on the same block — dwell and subprogram call separately."],
  ["g4", "m97", "G4 dwell and M97 on the same block — dwell and local subprogram call separately."],
  ["g4", "m00", "G4 dwell and M00 on the same block — dwell and program stop separately."],
  ["g4", "m01", "G4 dwell and M01 on the same block — dwell and optional stop separately."],
  ["g4", "m99", "G4 dwell and M99 on the same block — dwell and subprogram return separately."],
  ["m30", "g28", "M30 and G28 on the same block — program end and reference return separately."],
  [
    "m30",
    "g30",
    "M30 and G30 on the same block — program end and secondary reference return separately."
  ],
  ["m30", "g53", "M30 and G53 on the same block — program end and machine move separately."],
  ["m02", "g28", "M02 and G28 on the same block — program end and reference return separately."],
  [
    "m02",
    "g30",
    "M02 and G30 on the same block — program end and secondary reference return separately."
  ],
  ["m02", "g53", "M02 and G53 on the same block — program end and machine move separately."],
  ["g4", "g92", "G4 dwell and G92 on the same block — dwell and coordinate shift separately."],
  ["g4", "g52", "G4 dwell and G52 on the same block — dwell and local offset separately."],
  ["m6", "g92", "M6 and G92 on the same block — tool change and coordinate shift separately."],
  ["m6", "g52", "M6 and G52 on the same block — tool change and local offset separately."],
  [
    "workOffset",
    "g28",
    "Work offset (G54-G59/G154) and G28 on the same block — select offset and home return separately."
  ],
  [
    "workOffset",
    "g30",
    "Work offset (G54-G59/G154) and G30 on the same block — select offset and secondary home separately."
  ],
  ["g43", "g92", "G43 and G92 on the same block — length compensation and coordinate shift separately."],
  ["g43", "g52", "G43 and G52 on the same block — length compensation and local offset separately."],
  [
    "g49",
    "g92",
    "G49 and G92 on the same block — cancel length compensation and coordinate shift separately."
  ],
  [
    "g49",
    "g52",
    "G49 and G52 on the same block — cancel length compensation and local offset separately."
  ],
  [
    "g40",
    "g92",
    "G40 and G92 on the same block — cancel cutter compensation and coordinate shift separately."
  ],
  [
    "g40",
    "g52",
    "G40 and G52 on the same block — cancel cutter compensation and local offset separately."
  ],
  ["g80", "g92", "G80 and G92 on the same block — cancel canned cycle and coordinate shift separately."],
  ["g80", "g52", "G80 and G52 on the same block — cancel canned cycle and local offset separately."],
  [
    "workOffset",
    "g92",
    "Work offset (G54-G59/G154) and G92 on the same block — select offset and coordinate shift separately."
  ],
  [
    "workOffset",
    "g52",
    "Work offset (G54-G59/G154) and G52 on the same block — select offset and local offset separately."
  ],
  [
    "g41Or42",
    "g92",
    "G41/G42 and G92 on the same block — cutter compensation and coordinate shift separately."
  ],
  [
    "g41Or42",
    "g52",
    "G41/G42 and G52 on the same block — cutter compensation and local offset separately."
  ],
  ["g68", "g92", "G68 and G92 on the same block — coordinate rotation and coordinate shift separately."],
  ["g68", "g52", "G68 and G52 on the same block — coordinate rotation and local offset separately."],
  ["g69", "g92", "G69 and G92 on the same block — cancel rotation and coordinate shift separately."],
  ["g69", "g52", "G69 and G52 on the same block — cancel rotation and local offset separately."],
  ["g51", "g92", "G51 and G92 on the same block — scaling and coordinate shift separately."],
  ["g51", "g52", "G51 and G52 on the same block — scaling and local offset separately."],
  ["g50", "g92", "G50 and G92 on the same block — cancel scaling and coordinate shift separately."],
  ["g50", "g52", "G50 and G52 on the same block — cancel scaling and local offset separately."],
  ["g43", "g28", "G43 and G28 on the same block — length compensation and home return separately."],
  ["g43", "g30", "G43 and G30 on the same block — length compensation and secondary home separately."],
  [
    "g49",
    "g28",
    "G49 and G28 on the same block — cancel length compensation and home return separately."
  ],
  [
    "g49",
    "g30",
    "G49 and G30 on the same block — cancel length compensation and secondary home separately."
  ],
  [
    "g40",
    "g28",
    "G40 and G28 on the same block — cancel cutter compensation and home return separately."
  ],
  [
    "g40",
    "g30",
    "G40 and G30 on the same block — cancel cutter compensation and secondary home separately."
  ],
  ["g80", "g28", "G80 and G28 on the same block — cancel canned cycle and home return separately."],
  ["g80", "g30", "G80 and G30 on the same block — cancel canned cycle and secondary home separately."],
  ["g43", "g53", "G43 and G53 on the same block — length compensation and machine move separately."],
  [
    "g49",
    "g53",
    "G49 and G53 on the same block — cancel length compensation and machine move separately."
  ],
  [
    "g40",
    "g53",
    "G40 and G53 on the same block — cancel cutter compensation and machine move separately."
  ],
  ["g80", "g53", "G80 and G53 on the same block — cancel canned cycle and machine move separately."],
  [
    "g41Or42",
    "g28",
    "G41/G42 and G28 on the same block — cutter compensation and home return separately."
  ],
  [
    "g41Or42",
    "g30",
    "G41/G42 and G30 on the same block — cutter compensation and secondary home separately."
  ],
  ["g68", "g28", "G68 and G28 on the same block — coordinate rotation and home return separately."],
  [
    "g68",
    "g30",
    "G68 and G30 on the same block — coordinate rotation and secondary home separately."
  ],
  ["g69", "g28", "G69 and G28 on the same block — cancel rotation and home return separately."],
  ["g69", "g30", "G69 and G30 on the same block — cancel rotation and secondary home separately."]
];

export function collectSameBlockMatrixIssues(
  block: { words: Word[] },
  blockIndex: number
): LintIssue[] {
  const tokens = detectSameBlockTokens(block);
  if (tokens.size < 2) return [];
  const issues: LintIssue[] = [];
  for (const [a, b, message] of SAME_BLOCK_CONFLICTS) {
    if (tokens.has(a) && tokens.has(b)) {
      issues.push({ severity: "warning", message, blockIndex });
    }
  }
  return issues;
}
