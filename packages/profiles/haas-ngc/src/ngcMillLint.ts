import type { LintIssue, ProgramAst, Word } from "@cnc/core";

function hasWordM(block: { words: Word[] }, code: number): boolean {
  return block.words.some((w) => w.letter === "M" && Number(w.value) === code);
}

function hasG43Classic(block: { words: Word[] }): boolean {
  return block.words.some((w) => {
    if (w.letter !== "G") return false;
    const n = Number.parseFloat(w.value);
    return n === 43;
  });
}

function hasLetter(block: { words: Word[] }, letter: string): boolean {
  return block.words.some((w) => w.letter === letter);
}

/** True only for plain G41 / G42 (not G41.1 etc.). */
function hasExactG41Or42(block: { words: Word[] }): boolean {
  return block.words.some((w) => {
    if (w.letter !== "G") return false;
    const v = Number.parseFloat(w.value);
    return v === 41 || v === 42;
  });
}

function hasSpindleOn(block: { words: Word[] }): boolean {
  return block.words.some((w) => {
    if (w.letter !== "M") return false;
    const m = Math.trunc(Number.parseFloat(w.value));
    return m === 3 || m === 4 || m === 13 || m === 14;
  });
}

function lastWordValue(block: { words: Word[] }, letter: string): string | undefined {
  const w = block.words.filter((x) => x.letter === letter).at(-1);
  return w?.value;
}

/**
 * Haas NGC mill-oriented checks that do not depend on a specific control software revision.
 * Conservative: favor warnings over errors except clear structural mistakes.
 */
export function lintHaasNgcMill(ast: ProgramAst): LintIssue[] {
  const issues: LintIssue[] = [];
  let sawFirstG43Activation = false;

  ast.blocks.forEach((block, index) => {
    if (block.raw.includes("M30") && index !== ast.blocks.length - 1) {
      issues.push({
        severity: "warning",
        message: "M30 appears before the last block.",
        blockIndex: index
      });
    }

    if (hasG43Classic(block) && !hasLetter(block, "H")) {
      issues.push({
        severity: "warning",
        message: "G43 without H on the same block — Haas NGC expects tool length H (e.g. G43 H1 Z…).",
        blockIndex: index
      });
    }
    if (hasG43Classic(block) && !sawFirstG43Activation) {
      sawFirstG43Activation = true;
      const zVal = lastWordValue(block, "Z");
      const parsedZ = zVal === undefined ? Number.NaN : Number.parseFloat(zVal);
      const hasZeroLiteralZ = zVal !== undefined && Number.isFinite(parsedZ) && parsedZ === 0;
      if (zVal === undefined || hasZeroLiteralZ) {
        issues.push({
          severity: "warning",
          message:
            "First G43 activation has no meaningful Z move — include a safe clearance/retract Z on the same block.",
          blockIndex: index
        });
      }
    }

    if (hasWordM(block, 6) && !hasLetter(block, "T")) {
      issues.push({
        severity: "warning",
        message: "M6 without T on the same block — use Tn M6 (or M6 Tn) for a clear tool change.",
        blockIndex: index
      });
    }

    if (hasSpindleOn(block) && !hasLetter(block, "S")) {
      issues.push({
        severity: "warning",
        message: "Spindle start (M3/M4/M13/M14) without S on the same block — set RPM explicitly.",
        blockIndex: index
      });
    }

    const sVal = lastWordValue(block, "S");
    if (hasSpindleOn(block) && sVal !== undefined && Number.parseFloat(sVal) === 0) {
      issues.push({
        severity: "warning",
        message: "Spindle start with S0 — verify intentional stop or missing speed.",
        blockIndex: index
      });
    }

    if (hasExactG41Or42(block) && !hasLetter(block, "D")) {
      issues.push({
        severity: "warning",
        message: "G41/G42 without D on the same block — cutter comp normally requires a D offset.",
        blockIndex: index
      });
    }

    const tWord = block.words.filter((w) => w.letter === "T").at(-1);
    if (tWord && Math.trunc(Number.parseFloat(tWord.value)) === 0) {
      issues.push({
        severity: "warning",
        message: "T0 selects tool zero — usually invalid for a real tool change.",
        blockIndex: index
      });
    }
  });

  const nOcc = new Map<string, number[]>();
  const oOcc = new Map<string, number[]>();
  ast.blocks.forEach((block, index) => {
    const nWord = block.words.find((w) => w.letter === "N");
    if (nWord) {
      const key = nWord.value.trim();
      const arr = nOcc.get(key) ?? [];
      arr.push(index);
      nOcc.set(key, arr);
    }
    const oWord = block.words.find((w) => w.letter === "O");
    if (oWord) {
      const key = oWord.value.trim();
      const arr = oOcc.get(key) ?? [];
      arr.push(index);
      oOcc.set(key, arr);
    }
  });
  for (const [nVal, indices] of nOcc) {
    if (indices.length <= 1) continue;
    for (const idx of indices.slice(1)) {
      issues.push({
        severity: "warning",
        message: `Duplicate sequence number N${nVal} — GOTO/M97 targets may be ambiguous.`,
        blockIndex: idx
      });
    }
  }
  for (const [oVal, indices] of oOcc) {
    if (indices.length <= 1) continue;
    for (const idx of indices.slice(1)) {
      issues.push({
        severity: "warning",
        message: `Duplicate program label O${oVal} — subprogram/call targets may be ambiguous.`,
        blockIndex: idx
      });
    }
  }

  const m30Blocks = ast.blocks
    .map((b, i) => (hasWordM(b, 30) ? i : -1))
    .filter((i) => i >= 0);
  if (m30Blocks.length > 1) {
    for (const idx of m30Blocks.slice(1)) {
      issues.push({
        severity: "error",
        message: "Duplicate M30 — program should end once with M30.",
        blockIndex: idx
      });
    }
  }

  let firstM02 = -1;
  let firstM30 = -1;
  ast.blocks.forEach((b, i) => {
    if (hasWordM(b, 2) && firstM02 < 0) firstM02 = i;
    if (hasWordM(b, 30) && firstM30 < 0) firstM30 = i;
  });
  if (firstM02 >= 0 && firstM30 >= 0) {
    issues.push({
      severity: "warning",
      message: "Program contains both M02 and M30 — pick one program-end convention.",
      blockIndex: Math.min(firstM02, firstM30)
    });
  }

  const last = ast.blocks.length - 1;
  if (last >= 0) {
    const end = ast.blocks[last];
    const endsOk = hasWordM(end, 2) || hasWordM(end, 30) || hasWordM(end, 99);
    if (!endsOk) {
      issues.push({
        severity: "warning",
        message: "Last block has no M02, M30, or M99 — verify program end for Haas NGC.",
        blockIndex: last
      });
    }
  }

  return issues;
}
