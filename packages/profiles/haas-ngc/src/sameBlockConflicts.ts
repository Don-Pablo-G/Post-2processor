import type { LintIssue, Word } from "@cnc/core";

/** Tokens used by same-block conflict detection. */
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

export const MACHINE_POSITION_CONFLICT_MESSAGE =
  "Machine positioning conflict on the same block — Haas: split G28/G30/G53 from other modes/calls/stops.";

export const COORD_SHIFT_CONFLICT_MESSAGE =
  "Coordinate shift conflict on the same block — Haas: split G92/G52 from other modes.";

export const CANCEL_CONFLICT_MESSAGE =
  "Cancel family conflict on the same block — split G40/G49/G80/G69/G50 cancels into separate blocks.";

const MACHINE_POSITION: ReadonlySet<SameBlockToken> = new Set(["g28", "g30", "g53"]);

const MACHINE_POSITION_PARTNERS: ReadonlySet<SameBlockToken> = new Set([
  "workOffset",
  "g43",
  "g49",
  "g40",
  "g80",
  "g41Or42",
  "g68",
  "g69",
  "g50",
  "g51",
  "g92",
  "g52",
  "m6",
  "g4",
  "g65",
  "m98",
  "m97",
  "m00",
  "m01",
  "m99",
  "m30",
  "m02"
]);

const COORD_SHIFT: ReadonlySet<SameBlockToken> = new Set(["g92", "g52"]);

const CANCEL_FAMILY: ReadonlySet<SameBlockToken> = new Set(["g40", "g49", "g80", "g69", "g50"]);

const COORD_SHIFT_PARTNERS: ReadonlySet<SameBlockToken> = new Set([
  "workOffset",
  "g43",
  "g49",
  "g40",
  "g80",
  "g41Or42",
  "g68",
  "g69",
  "g50",
  "g51",
  "m6",
  "g4"
]);

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

function setIntersects(a: ReadonlySet<SameBlockToken>, b: ReadonlySet<SameBlockToken>): boolean {
  for (const t of a) {
    if (b.has(t)) return true;
  }
  return false;
}

/**
 * Residual pairwise conflicts not covered by the machine-position / coord-shift families
 * (call/stop × dwell, tool-change × macro).
 */
export const SAME_BLOCK_RESIDUAL_CONFLICTS: readonly Conflict[] = [
  ["m6", "g65", "M6 and G65 on the same block — tool change and macro call separately."],
  ["g4", "g65", "G4 dwell and G65 on the same block — dwell and macro call separately."],
  ["g4", "m98", "G4 dwell and M98 on the same block — dwell and subprogram call separately."],
  ["g4", "m97", "G4 dwell and M97 on the same block — dwell and local subprogram call separately."],
  ["g4", "m00", "G4 dwell and M00 on the same block — dwell and program stop separately."],
  ["g4", "m01", "G4 dwell and M01 on the same block — dwell and optional stop separately."],
  ["g4", "m99", "G4 dwell and M99 on the same block — dwell and subprogram return separately."],
  ["g4", "m02", "G4 dwell and M02 on the same block — dwell and program end separately."],
  ["g4", "m30", "G4 dwell and M30 on the same block — dwell and program end separately."],
  ["g68", "g51", "G68 and G51 on the same block — do not apply coordinate rotation and scaling together."],
  ["g43", "g41Or42", "G43 and G41/G42 on the same block — apply tool length and cutter compensation on separate blocks."],
  ["g43", "g68", "G43 and G68 on the same block — apply tool length and coordinate rotation on separate blocks."],
  ["g43", "g51", "G43 and G51 on the same block — apply tool length and scaling on separate blocks."],
  ["g41Or42", "g68", "G41/G42 and G68 on the same block — apply cutter compensation and coordinate rotation on separate blocks."],
  ["g41Or42", "g51", "G41/G42 and G51 on the same block — apply cutter compensation and scaling on separate blocks."],
  ["g65", "m02", "G65 and M02 on the same block — macro call and program end separately."],
  ["g65", "m30", "G65 and M30 on the same block — macro call and program end separately."],
  ["g43", "g80", "G43 and G80 on the same block — apply tool length and cancel canned cycle on separate blocks."],
  ["g41Or42", "g80", "G41/G42 and G80 on the same block — apply cutter compensation and cancel canned cycle on separate blocks."],
  ["g68", "g80", "G68 and G80 on the same block — apply coordinate rotation and cancel canned cycle on separate blocks."],
  ["g51", "g80", "G51 and G80 on the same block — apply scaling and cancel canned cycle on separate blocks."],
  ["g43", "g40", "G43 and G40 on the same block — apply tool length and cancel cutter compensation on separate blocks."],
  ["g68", "g40", "G68 and G40 on the same block — apply coordinate rotation and cancel cutter compensation on separate blocks."],
  ["g51", "g40", "G51 and G40 on the same block — apply scaling and cancel cutter compensation on separate blocks."],
  ["g41Or42", "g49", "G41/G42 and G49 on the same block — apply cutter compensation and cancel tool length on separate blocks."]
];

export function collectSameBlockMatrixIssues(
  block: { words: Word[] },
  blockIndex: number
): LintIssue[] {
  const tokens = detectSameBlockTokens(block);
  if (tokens.size < 2) return [];
  const issues: LintIssue[] = [];

  if (setIntersects(tokens, MACHINE_POSITION) && setIntersects(tokens, MACHINE_POSITION_PARTNERS)) {
    issues.push({
      severity: "warning",
      message: MACHINE_POSITION_CONFLICT_MESSAGE,
      blockIndex
    });
  }

  if (setIntersects(tokens, COORD_SHIFT) && setIntersects(tokens, COORD_SHIFT_PARTNERS)) {
    issues.push({
      severity: "warning",
      message: COORD_SHIFT_CONFLICT_MESSAGE,
      blockIndex
    });
  }

  let cancelCount = 0;
  for (const token of CANCEL_FAMILY) {
    if (tokens.has(token)) cancelCount += 1;
  }
  if (cancelCount >= 2) {
    issues.push({
      severity: "warning",
      code: "haas.cancel-conflict-same-block",
      message: CANCEL_CONFLICT_MESSAGE,
      blockIndex
    });
  }

  for (const [a, b, message] of SAME_BLOCK_RESIDUAL_CONFLICTS) {
    if (tokens.has(a) && tokens.has(b)) {
      issues.push({ severity: "warning", message, blockIndex });
    }
  }

  return issues;
}
