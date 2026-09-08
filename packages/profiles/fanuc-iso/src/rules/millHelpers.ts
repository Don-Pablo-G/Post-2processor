import type { Word } from "@cnc/core";
import { FANUC_MILL_DIALECT } from "../millDialect.js";

const WORK_OFFSET_G_CODES = new Set<number>(FANUC_MILL_DIALECT.workOffsetGCodes);
const SPINDLE_ON_M_CODES = new Set<number>(FANUC_MILL_DIALECT.spindleOnMCodes);

export function hasWordM(block: { words: Word[] }, code: number): boolean {
  return block.words.some((w) => w.letter === "M" && Math.trunc(Number.parseFloat(w.value)) === code);
}

export function hasExactG43(block: { words: Word[] }): boolean {
  return hasExactG(block, 43);
}

export function hasLetter(block: { words: Word[] }, letter: string): boolean {
  return block.words.some((w) => w.letter === letter);
}

export function hasExactG(block: { words: Word[] }, code: number): boolean {
  return block.words.some((w) => {
    if (w.letter !== "G") return false;
    return Number.parseFloat(w.value) === code;
  });
}

/** True only for plain G41 / G42 (not G41.1 etc.). */
export function hasExactG41Or42(block: { words: Word[] }): boolean {
  return block.words.some((w) => {
    if (w.letter !== "G") return false;
    const v = Number.parseFloat(w.value);
    return v === 41 || v === 42;
  });
}

/** True for plain G1 / G2 / G3 feed motion (not G10/G11/G21/...). */
export function hasExactFeedMotion(block: { words: Word[] }): boolean {
  return block.words.some((w) => {
    if (w.letter !== "G") return false;
    const v = Number.parseFloat(w.value);
    return v === 1 || v === 2 || v === 3;
  });
}

const CANNED_CYCLE_G_CODES = new Set([73, 74, 76, 81, 82, 83, 84, 85, 86, 87, 88, 89]);

/** Fanuc/Haas-style drilling/tapping canned cycles (exact Gnn, not G73.1). */
export function hasCannedCycle(block: { words: Word[] }): boolean {
  return block.words.some((w) => {
    if (w.letter !== "G") return false;
    return CANNED_CYCLE_G_CODES.has(Number.parseFloat(w.value));
  });
}

export function hasExactTappingCycle(block: { words: Word[] }): boolean {
  return block.words.some((w) => {
    if (w.letter !== "G") return false;
    const v = Number.parseFloat(w.value);
    return v === 74 || v === 84;
  });
}

export function hasExactG80(block: { words: Word[] }): boolean {
  return hasExactG(block, 80);
}

export function hasExactG28(block: { words: Word[] }): boolean {
  return hasExactG(block, 28);
}

export function hasExactG53(block: { words: Word[] }): boolean {
  return hasExactG(block, 53);
}

export function hasExactG40(block: { words: Word[] }): boolean {
  return hasExactG(block, 40);
}

export function hasExactG90Or91(block: { words: Word[] }): 90 | 91 | undefined {
  let mode: 90 | 91 | undefined;
  for (const w of block.words) {
    if (w.letter !== "G") continue;
    const v = Number.parseFloat(w.value);
    if (v === 90) mode = 90;
    if (v === 91) mode = 91;
  }
  return mode;
}

export function hasCoolantOn(block: { words: Word[] }): boolean {
  return block.words.some((w) => {
    if (w.letter !== "M") return false;
    const m = Math.trunc(Number.parseFloat(w.value));
    return m === 7 || m === 8;
  });
}

export function hasSpindleOn(block: { words: Word[] }): boolean {
  return block.words.some((w) => {
    if (w.letter !== "M") return false;
    return SPINDLE_ON_M_CODES.has(Math.trunc(Number.parseFloat(w.value)));
  });
}

export function hasSpindleOff(block: { words: Word[] }): boolean {
  return hasWordM(block, 5);
}

export function hasCoolantOff(block: { words: Word[] }): boolean {
  return hasWordM(block, 9);
}

export function hasExactG49(block: { words: Word[] }): boolean {
  return hasExactG(block, 49);
}

export function hasExactG68(block: { words: Word[] }): boolean {
  return hasExactG(block, 68);
}

export function hasExactG69(block: { words: Word[] }): boolean {
  return hasExactG(block, 69);
}

export function hasExactG51(block: { words: Word[] }): boolean {
  return hasExactG(block, 51);
}

export function hasExactG50(block: { words: Word[] }): boolean {
  return hasExactG(block, 50);
}

export function hasWorkOffset(block: { words: Word[] }): boolean {
  return block.words.some((w) => {
    if (w.letter !== "G") return false;
    return WORK_OFFSET_G_CODES.has(Number.parseFloat(w.value));
  });
}
