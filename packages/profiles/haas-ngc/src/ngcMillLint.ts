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

/** True for plain G1 / G2 / G3 feed motion (not G10/G11/G21/…). */
function hasExactFeedMotion(block: { words: Word[] }): boolean {
  return block.words.some((w) => {
    if (w.letter !== "G") return false;
    const v = Number.parseFloat(w.value);
    return v === 1 || v === 2 || v === 3;
  });
}

/** True for plain G2 / G3 arc motion (not G20/G21/…). */
function hasExactArcMotion(block: { words: Word[] }): boolean {
  return block.words.some((w) => {
    if (w.letter !== "G") return false;
    const v = Number.parseFloat(w.value);
    return v === 2 || v === 3;
  });
}

const CANNED_CYCLE_G_CODES = new Set([73, 74, 76, 81, 82, 83, 84, 85, 86, 87, 88, 89]);

/** Haas/Fanuc-style drilling/tapping canned cycles (exact Gnn, not G73.1). */
function hasCannedCycle(block: { words: Word[] }): boolean {
  return block.words.some((w) => {
    if (w.letter !== "G") return false;
    return CANNED_CYCLE_G_CODES.has(Number.parseFloat(w.value));
  });
}

function hasExactG80(block: { words: Word[] }): boolean {
  return block.words.some((w) => {
    if (w.letter !== "G") return false;
    return Number.parseFloat(w.value) === 80;
  });
}

function hasExactG20Or21(block: { words: Word[] }): 20 | 21 | undefined {
  for (const w of block.words) {
    if (w.letter !== "G") continue;
    const v = Number.parseFloat(w.value);
    if (v === 20) return 20;
    if (v === 21) return 21;
  }
  return undefined;
}

function hasCoolantOn(block: { words: Word[] }): boolean {
  return block.words.some((w) => {
    if (w.letter !== "M") return false;
    const m = Math.trunc(Number.parseFloat(w.value));
    return m === 7 || m === 8;
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

function isZeroOffsetWord(raw: string | undefined): boolean {
  if (raw === undefined) return false;
  const t = raw.trim().toUpperCase();
  if (t.includes("#") || t.includes("[")) return false;
  const n = Number.parseFloat(t);
  return Number.isFinite(n) && n === 0;
}

function isMeaningfulFirstG43Z(zWordRaw: string | undefined): boolean {
  if (zWordRaw === undefined) return false;
  const z = zWordRaw.trim().toUpperCase();
  if (z.includes("#") || z.includes("[")) return true;
  const parsed = Number.parseFloat(z);
  if (!Number.isFinite(parsed)) return false;
  return parsed !== 0;
}

/**
 * Haas NGC mill-oriented checks that do not depend on a specific control software revision.
 * Conservative: favor warnings over errors except clear structural mistakes.
 */
export function lintHaasNgcMill(ast: ProgramAst): LintIssue[] {
  const issues: LintIssue[] = [];
  let sawFirstG43Activation = false;
  let sawAnyDOffset = false;
  let sawAnyFeedRate = false;
  let sawSpindleOn = false;
  let cutterCompActive = false;
  let cannedActive = false;
  let cannedHasZ = false;
  let cannedHasR = false;
  let firstG20Block = -1;
  let firstG21Block = -1;
  let activeStopResumeSafety:
    | {
        stopBlockIndex: number;
        stopCode: 0 | 1;
        spindleRestartSeen: boolean;
      }
    | undefined;

  ast.blocks.forEach((block, index) => {
    const hasM00 = hasWordM(block, 0);
    const hasM01 = hasWordM(block, 1);
    if (hasM00 || hasM01) {
      const hasRestartSpindleSameBlock = block.words.some((w) => {
        if (w.letter !== "M") return false;
        const m = Math.trunc(Number.parseFloat(w.value));
        return m === 3 || m === 4;
      });
      activeStopResumeSafety = {
        stopBlockIndex: index,
        stopCode: hasM00 ? 0 : 1,
        spindleRestartSeen: hasRestartSpindleSameBlock
      };
    } else if (activeStopResumeSafety) {
      const hasRestartSpindle = block.words.some((w) => {
        if (w.letter !== "M") return false;
        const m = Math.trunc(Number.parseFloat(w.value));
        return m === 3 || m === 4;
      });
      if (hasRestartSpindle) {
        activeStopResumeSafety.spindleRestartSeen = true;
      }

      if (activeStopResumeSafety.spindleRestartSeen) {
        // A spindle restart clears this specific safety concern window.
        activeStopResumeSafety = undefined;
      } else {
        const zWord = block.words.filter((w) => w.letter === "Z").at(-1);
        const zValue = zWord ? Number.parseFloat(zWord.value) : Number.NaN;
        if (Number.isFinite(zValue) && zValue < 0) {
          const stopLabel = activeStopResumeSafety.stopCode === 0 ? "M00" : "M01";
          issues.push({
            severity: "warning",
            message: `${stopLabel} is followed by a move below Z0 before spindle restart (M3/M4) — verify safe restart procedure.`,
            blockIndex: index
          });
          activeStopResumeSafety = undefined;
        }
      }
    }

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
    if (hasG43Classic(block) && isZeroOffsetWord(lastWordValue(block, "H"))) {
      issues.push({
        severity: "warning",
        message: "G43 with H0 — tool length offset zero is usually invalid for a real tool.",
        blockIndex: index
      });
    }
    if (hasG43Classic(block) && !sawFirstG43Activation) {
      sawFirstG43Activation = true;
      const zWordRaw = lastWordValue(block, "Z");
      if (!isMeaningfulFirstG43Z(zWordRaw)) {
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

    if (hasCoolantOn(block) && !sawSpindleOn && !hasSpindleOn(block)) {
      issues.push({
        severity: "warning",
        message: "Coolant on (M7/M8) before any spindle start (M3/M4/M13/M14) — verify intentional order.",
        blockIndex: index
      });
    }

    if (hasSpindleOn(block)) {
      sawSpindleOn = true;
    }

    if (hasExactG41Or42(block) && !hasLetter(block, "D")) {
      if (!sawAnyDOffset) {
        issues.push({
          severity: "warning",
          message: "G41/G42 without D and no prior D offset active — set D explicitly or confirm carried offset state.",
          blockIndex: index
        });
      }
    }

    if (hasExactG41Or42(block) && isZeroOffsetWord(lastWordValue(block, "D"))) {
      issues.push({
        severity: "warning",
        message: "G41/G42 with D0 — cutter comp offset zero is usually invalid.",
        blockIndex: index
      });
    }

    if (hasLetter(block, "D")) {
      sawAnyDOffset = true;
    }

    if (hasExactG41Or42(block)) {
      cutterCompActive = true;
    }
    if (
      block.words.some((w) => {
        if (w.letter !== "G") return false;
        return Number.parseFloat(w.value) === 40;
      })
    ) {
      cutterCompActive = false;
    }

    if (hasExactFeedMotion(block) && !hasLetter(block, "F") && !sawAnyFeedRate) {
      issues.push({
        severity: "warning",
        message:
          "G1/G2/G3 without F and no prior F in the program — set feed explicitly on the block or earlier.",
        blockIndex: index
      });
    }

    if (hasLetter(block, "F")) {
      sawAnyFeedRate = true;
      if (isZeroOffsetWord(lastWordValue(block, "F"))) {
        issues.push({
          severity: "warning",
          message: "F0 feed rate — verify intentional zero feed or missing feed value.",
          blockIndex: index
        });
      }
    }

    if (
      hasExactArcMotion(block) &&
      !hasLetter(block, "R") &&
      !hasLetter(block, "I") &&
      !hasLetter(block, "J") &&
      !hasLetter(block, "K")
    ) {
      issues.push({
        severity: "warning",
        message: "G2/G3 arc without R or I/J/K — arc center/radius is required.",
        blockIndex: index
      });
    }

    if (hasExactG80(block)) {
      cannedActive = false;
      cannedHasZ = false;
      cannedHasR = false;
    }

    if (hasCannedCycle(block)) {
      if (!hasLetter(block, "Z") && !cannedHasZ) {
        issues.push({
          severity: "warning",
          message: "Canned cycle (G73/G74/G76/G81-G89) without Z depth — set Z on the cycle block or earlier in the cycle.",
          blockIndex: index
        });
      }
      if (!hasLetter(block, "R") && !cannedHasR) {
        issues.push({
          severity: "warning",
          message: "Canned cycle (G73/G74/G76/G81-G89) without R plane — set R on the cycle block or earlier in the cycle.",
          blockIndex: index
        });
      }
      if (hasLetter(block, "Z")) cannedHasZ = true;
      if (hasLetter(block, "R")) cannedHasR = true;
      cannedActive = true;
    }

    if (hasWordM(block, 6) && cannedActive) {
      issues.push({
        severity: "warning",
        message: "M6 while a canned cycle is still active — cancel with G80 before the tool change.",
        blockIndex: index
      });
    }

    const unitMode = hasExactG20Or21(block);
    if (unitMode === 20 && firstG20Block < 0) firstG20Block = index;
    if (unitMode === 21 && firstG21Block < 0) firstG21Block = index;

    if (
      cutterCompActive &&
      (hasWordM(block, 2) || hasWordM(block, 30)) &&
      index === ast.blocks.length - 1
    ) {
      issues.push({
        severity: "warning",
        message: "Program ends with cutter compensation (G41/G42) still active — cancel with G40 before end.",
        blockIndex: index
      });
    }

    if (
      cannedActive &&
      (hasWordM(block, 2) || hasWordM(block, 30)) &&
      index === ast.blocks.length - 1
    ) {
      issues.push({
        severity: "warning",
        message: "Program ends with a canned cycle still active — cancel with G80 before end.",
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

  if (firstG20Block >= 0 && firstG21Block >= 0) {
    issues.push({
      severity: "warning",
      message: "Program contains both G20 and G21 — pick one unit mode (inch or metric).",
      blockIndex: Math.min(firstG20Block, firstG21Block)
    });
  }

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
