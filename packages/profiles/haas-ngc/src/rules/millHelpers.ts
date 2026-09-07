import type { Word } from "@cnc/core";

export function hasWordM(block: { words: Word[] }, code: number): boolean {
  return block.words.some((w) => w.letter === "M" && Number(w.value) === code);
}

export function hasExactG43(block: { words: Word[] }): boolean {
  return block.words.some((w) => {
    if (w.letter !== "G") return false;
    const n = Number.parseFloat(w.value);
    return n === 43;
  });
}

export function hasLetter(block: { words: Word[] }, letter: string): boolean {
  return block.words.some((w) => w.letter === letter);
}

/** True only for plain G41 / G42 (not G41.1 etc.). */
export function hasExactG41Or42(block: { words: Word[] }): boolean {
  return block.words.some((w) => {
    if (w.letter !== "G") return false;
    const v = Number.parseFloat(w.value);
    return v === 41 || v === 42;
  });
}

/** True for plain G2 / G3 arc motion (not G20/G21/…). */
export function hasExactArcMotion(block: { words: Word[] }): boolean {
  return block.words.some((w) => {
    if (w.letter !== "G") return false;
    const v = Number.parseFloat(w.value);
    return v === 2 || v === 3;
  });
}

const CANNED_CYCLE_G_CODES = new Set([73, 74, 76, 81, 82, 83, 84, 85, 86, 87, 88, 89]);

/** Haas/Fanuc-style drilling/tapping canned cycles (exact Gnn, not G73.1). */
export function hasCannedCycle(block: { words: Word[] }): boolean {
  return block.words.some((w) => {
    if (w.letter !== "G") return false;
    return CANNED_CYCLE_G_CODES.has(Number.parseFloat(w.value));
  });
}

export function hasExactG80(block: { words: Word[] }): boolean {
  return block.words.some((w) => {
    if (w.letter !== "G") return false;
    return Number.parseFloat(w.value) === 80;
  });
}

export function hasExactG40(block: { words: Word[] }): boolean {
  return block.words.some((w) => {
    if (w.letter !== "G") return false;
    return Number.parseFloat(w.value) === 40;
  });
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

export function hasExactG20Or21(block: { words: Word[] }): 20 | 21 | undefined {
  for (const w of block.words) {
    if (w.letter !== "G") continue;
    const v = Number.parseFloat(w.value);
    if (v === 20) return 20;
    if (v === 21) return 21;
  }
  return undefined;
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
    const m = Math.trunc(Number.parseFloat(w.value));
    return m === 3 || m === 4 || m === 13 || m === 14;
  });
}

export function hasSpindleOff(block: { words: Word[] }): boolean {
  return hasWordM(block, 5);
}

export function hasCoolantOff(block: { words: Word[] }): boolean {
  return hasWordM(block, 9);
}

export function hasExactG49(block: { words: Word[] }): boolean {
  return block.words.some((w) => {
    if (w.letter !== "G") return false;
    return Number.parseFloat(w.value) === 49;
  });
}

export function hasExactPlane(block: { words: Word[] }): 17 | 18 | 19 | undefined {
  for (const w of block.words) {
    if (w.letter !== "G") continue;
    const v = Number.parseFloat(w.value);
    if (v === 17) return 17;
    if (v === 18) return 18;
    if (v === 19) return 19;
  }
  return undefined;
}

export function hasExactG65(block: { words: Word[] }): boolean {
  return block.words.some((w) => {
    if (w.letter !== "G") return false;
    return Number.parseFloat(w.value) === 65;
  });
}

export function hasExactG4(block: { words: Word[] }): boolean {
  return block.words.some((w) => {
    if (w.letter !== "G") return false;
    return Number.parseFloat(w.value) === 4;
  });
}

export function hasExactG68(block: { words: Word[] }): boolean {
  return block.words.some((w) => {
    if (w.letter !== "G") return false;
    return Number.parseFloat(w.value) === 68;
  });
}

export function hasExactG69(block: { words: Word[] }): boolean {
  return block.words.some((w) => {
    if (w.letter !== "G") return false;
    return Number.parseFloat(w.value) === 69;
  });
}

export function hasExactG51(block: { words: Word[] }): boolean {
  return block.words.some((w) => {
    if (w.letter !== "G") return false;
    return Number.parseFloat(w.value) === 51;
  });
}

export function hasExactG50(block: { words: Word[] }): boolean {
  return block.words.some((w) => {
    if (w.letter !== "G") return false;
    return Number.parseFloat(w.value) === 50;
  });
}

export function hasExactG92(block: { words: Word[] }): boolean {
  return block.words.some((w) => {
    if (w.letter !== "G") return false;
    return Number.parseFloat(w.value) === 92;
  });
}

export function hasExactG52(block: { words: Word[] }): boolean {
  return block.words.some((w) => {
    if (w.letter !== "G") return false;
    return Number.parseFloat(w.value) === 52;
  });
}

export function hasExactPeckCycle(block: { words: Word[] }): boolean {
  return block.words.some((w) => {
    if (w.letter !== "G") return false;
    const v = Number.parseFloat(w.value);
    return v === 73 || v === 83;
  });
}

/** R is legitimate on canned cycles, arcs, and G68 rotation angle. */
export function hasRWordContext(block: { words: Word[] }): boolean {
  return hasCannedCycle(block) || hasExactArcMotion(block) || hasExactG68(block);
}

/** P is legitimate on subprogram/macro calls, dwell, scaling, and canned dwell. */
export function hasPWordContext(block: { words: Word[] }): boolean {
  return (
    hasWordM(block, 98) ||
    hasWordM(block, 97) ||
    hasExactG65(block) ||
    hasExactG4(block) ||
    hasExactG51(block) ||
    hasCannedCycle(block)
  );
}

/** I/J/K are legitimate on arc motion (center offsets). */
export function hasIjkWordContext(block: { words: Word[] }): boolean {
  return hasExactArcMotion(block);
}

export function hasIjkWord(block: { words: Word[] }): boolean {
  return hasLetter(block, "I") || hasLetter(block, "J") || hasLetter(block, "K");
}

export function hasExactG94Or95(block: { words: Word[] }): 94 | 95 | undefined {
  for (const w of block.words) {
    if (w.letter !== "G") continue;
    const v = Number.parseFloat(w.value);
    if (v === 94) return 94;
    if (v === 95) return 95;
  }
  return undefined;
}

export function hasExactG93(block: { words: Word[] }): boolean {
  return block.words.some((w) => {
    if (w.letter !== "G") return false;
    return Number.parseFloat(w.value) === 93;
  });
}

export function hasExactG94(block: { words: Word[] }): boolean {
  return block.words.some((w) => {
    if (w.letter !== "G") return false;
    return Number.parseFloat(w.value) === 94;
  });
}

export function hasExactG95(block: { words: Word[] }): boolean {
  return block.words.some((w) => {
    if (w.letter !== "G") return false;
    return Number.parseFloat(w.value) === 95;
  });
}

export function hasExactG93Or94Or95(block: { words: Word[] }): 93 | 94 | 95 | undefined {
  let mode: 93 | 94 | 95 | undefined;
  for (const w of block.words) {
    if (w.letter !== "G") continue;
    const v = Number.parseFloat(w.value);
    if (v === 93 || v === 94 || v === 95) mode = v;
  }
  return mode;
}

export function hasExactG61Or64(block: { words: Word[] }): 61 | 64 | undefined {
  let mode: 61 | 64 | undefined;
  for (const w of block.words) {
    if (w.letter !== "G") continue;
    const v = Number.parseFloat(w.value);
    if (v === 61) mode = 61;
    if (v === 64) mode = 64;
  }
  return mode;
}

/**
 * Set of plain integer G codes present on the block (exact float equals, so
 * G17 is included but G17.1 is not, and G10 is distinct from G100). Useful for
 * detecting same-block mutually exclusive modal pairs without pairwise ladders.
 */
export function exactGCodesOnBlock(block: { words: Word[] }): Set<number> {
  const codes = new Set<number>();
  for (const w of block.words) {
    if (w.letter !== "G") continue;
    const v = Number.parseFloat(w.value);
    if (Number.isInteger(v)) codes.add(v);
  }
  return codes;
}

export function lastWordValue(block: { words: Word[] }, letter: string): string | undefined {
  const w = block.words.filter((x) => x.letter === letter).at(-1);
  return w?.value;
}

export function isZeroOffsetWord(raw: string | undefined): boolean {
  if (raw === undefined) return false;
  const t = raw.trim().toUpperCase();
  if (t.includes("#") || t.includes("[")) return false;
  const n = Number.parseFloat(t);
  return Number.isFinite(n) && n === 0;
}
