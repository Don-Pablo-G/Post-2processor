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

function hasSpindleOff(block: { words: Word[] }): boolean {
  return hasWordM(block, 5);
}

function hasCoolantOff(block: { words: Word[] }): boolean {
  return hasWordM(block, 9);
}

function hasExactG49(block: { words: Word[] }): boolean {
  return block.words.some((w) => {
    if (w.letter !== "G") return false;
    return Number.parseFloat(w.value) === 49;
  });
}

function hasExactG90(block: { words: Word[] }): boolean {
  return block.words.some((w) => {
    if (w.letter !== "G") return false;
    return Number.parseFloat(w.value) === 90;
  });
}

function hasExactG91(block: { words: Word[] }): boolean {
  return block.words.some((w) => {
    if (w.letter !== "G") return false;
    return Number.parseFloat(w.value) === 91;
  });
}

function hasExactG0(block: { words: Word[] }): boolean {
  return block.words.some((w) => {
    if (w.letter !== "G") return false;
    return Number.parseFloat(w.value) === 0;
  });
}

function hasExactG53(block: { words: Word[] }): boolean {
  return block.words.some((w) => {
    if (w.letter !== "G") return false;
    return Number.parseFloat(w.value) === 53;
  });
}

const WORK_OFFSET_G_CODES = new Set([54, 55, 56, 57, 58, 59, 154]);

function hasWorkOffset(block: { words: Word[] }): boolean {
  return block.words.some((w) => {
    if (w.letter !== "G") return false;
    return WORK_OFFSET_G_CODES.has(Number.parseFloat(w.value));
  });
}

function hasAxisWord(block: { words: Word[] }): boolean {
  return hasLetter(block, "X") || hasLetter(block, "Y") || hasLetter(block, "Z");
}

function hasExactPlane(block: { words: Word[] }): 17 | 18 | 19 | undefined {
  for (const w of block.words) {
    if (w.letter !== "G") continue;
    const v = Number.parseFloat(w.value);
    if (v === 17) return 17;
    if (v === 18) return 18;
    if (v === 19) return 19;
  }
  return undefined;
}

function hasExactG65(block: { words: Word[] }): boolean {
  return block.words.some((w) => {
    if (w.letter !== "G") return false;
    return Number.parseFloat(w.value) === 65;
  });
}

function hasExactG4(block: { words: Word[] }): boolean {
  return block.words.some((w) => {
    if (w.letter !== "G") return false;
    return Number.parseFloat(w.value) === 4;
  });
}

function hasExactG28(block: { words: Word[] }): boolean {
  return block.words.some((w) => {
    if (w.letter !== "G") return false;
    return Number.parseFloat(w.value) === 28;
  });
}

function hasExactG30(block: { words: Word[] }): boolean {
  return block.words.some((w) => {
    if (w.letter !== "G") return false;
    return Number.parseFloat(w.value) === 30;
  });
}

function hasExactG68(block: { words: Word[] }): boolean {
  return block.words.some((w) => {
    if (w.letter !== "G") return false;
    return Number.parseFloat(w.value) === 68;
  });
}

function hasExactG69(block: { words: Word[] }): boolean {
  return block.words.some((w) => {
    if (w.letter !== "G") return false;
    return Number.parseFloat(w.value) === 69;
  });
}

function hasExactG51(block: { words: Word[] }): boolean {
  return block.words.some((w) => {
    if (w.letter !== "G") return false;
    return Number.parseFloat(w.value) === 51;
  });
}

function hasExactG50(block: { words: Word[] }): boolean {
  return block.words.some((w) => {
    if (w.letter !== "G") return false;
    return Number.parseFloat(w.value) === 50;
  });
}

function hasExactTappingCycle(block: { words: Word[] }): boolean {
  return block.words.some((w) => {
    if (w.letter !== "G") return false;
    const v = Number.parseFloat(w.value);
    return v === 74 || v === 84;
  });
}

function hasExactPeckCycle(block: { words: Word[] }): boolean {
  return block.words.some((w) => {
    if (w.letter !== "G") return false;
    const v = Number.parseFloat(w.value);
    return v === 73 || v === 83;
  });
}

function exactCutterSide(block: { words: Word[] }): 41 | 42 | undefined {
  let side: 41 | 42 | undefined;
  for (const w of block.words) {
    if (w.letter !== "G") continue;
    const v = Number.parseFloat(w.value);
    if (v === 41) side = 41;
    if (v === 42) side = 42;
  }
  return side;
}

function hasExactG94Or95(block: { words: Word[] }): 94 | 95 | undefined {
  for (const w of block.words) {
    if (w.letter !== "G") continue;
    const v = Number.parseFloat(w.value);
    if (v === 94) return 94;
    if (v === 95) return 95;
  }
  return undefined;
}

function hasExactG61Or64(block: { words: Word[] }): 61 | 64 | undefined {
  for (const w of block.words) {
    if (w.letter !== "G") continue;
    const v = Number.parseFloat(w.value);
    if (v === 61) return 61;
    if (v === 64) return 64;
  }
  return undefined;
}

function hasSpindleDirectionConflict(block: { words: Word[] }): boolean {
  let cw = false;
  let ccw = false;
  for (const w of block.words) {
    if (w.letter !== "M") continue;
    const m = Math.trunc(Number.parseFloat(w.value));
    if (m === 3 || m === 13) cw = true;
    if (m === 4 || m === 14) ccw = true;
  }
  return cw && ccw;
}

function workOffsetCode(block: { words: Word[] }): number | undefined {
  for (const w of block.words) {
    if (w.letter !== "G") continue;
    const v = Number.parseFloat(w.value);
    if (WORK_OFFSET_G_CODES.has(v)) return v;
  }
  return undefined;
}

function axisWordCount(block: { words: Word[] }): number {
  let n = 0;
  if (hasLetter(block, "X")) n += 1;
  if (hasLetter(block, "Y")) n += 1;
  if (hasLetter(block, "Z")) n += 1;
  return n;
}

function literalToolNumber(raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined;
  const t = raw.trim().toUpperCase();
  if (t.includes("#") || t.includes("[")) return undefined;
  const n = Math.trunc(Number.parseFloat(t));
  return Number.isFinite(n) ? n : undefined;
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

function isLiteralNegativeAxis(raw: string | undefined): boolean {
  if (raw === undefined) return false;
  const t = raw.trim().toUpperCase();
  if (t.includes("#") || t.includes("[")) return false;
  const n = Number.parseFloat(t);
  return Number.isFinite(n) && n < 0;
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
  let spindleActive = false;
  let coolantActive = false;
  let toolLengthActive = false;
  let incrementalActive = false;
  let sawWorkOffset = false;
  let warnedMissingWorkOffset = false;
  let sawAxisMotion = false;
  let sawDistanceMode = false;
  let warnedMissingDistanceMode = false;
  let activeWorkOffset: number | undefined;
  let activeUnitMode: 20 | 21 | undefined;
  let lastToolNumber: number | undefined;
  let scalingActive = false;
  let activePlane: 17 | 18 | 19 | undefined;
  let cutterCompActive = false;
  let cannedActive = false;
  let cannedHasZ = false;
  let cannedHasR = false;
  let rotationActive = false;
  let cutterSide: 41 | 42 | undefined;
  let firstG20Block = -1;
  let firstG21Block = -1;
  let firstG94Block = -1;
  let firstG95Block = -1;
  let firstG61Block = -1;
  let firstG64Block = -1;
  let activeFeedMode: 94 | 95 | undefined;
  let sawFeedOrCanned = false;
  let sawProgramO = false;
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

    const tWordEarly = block.words.filter((w) => w.letter === "T").at(-1);
    const tNumEarly = literalToolNumber(tWordEarly?.value);
    if (tNumEarly !== undefined && tNumEarly > 0) {
      lastToolNumber = tNumEarly;
    }

    if (hasSpindleOn(block)) {
      sawSpindleOn = true;
      spindleActive = true;
    }
    if (hasSpindleOff(block)) {
      spindleActive = false;
    }

    if (hasSpindleOn(block) && hasSpindleOff(block)) {
      issues.push({
        severity: "warning",
        message: "Spindle start and stop on the same block (M3/M4/M13/M14 with M5).",
        blockIndex: index
      });
    }

    if (hasCoolantOn(block)) {
      coolantActive = true;
    }
    if (hasCoolantOff(block)) {
      coolantActive = false;
    }

    if (hasCoolantOn(block) && hasCoolantOff(block)) {
      issues.push({
        severity: "warning",
        message: "Coolant on and off on the same block (M7/M8 with M9).",
        blockIndex: index
      });
    }

    if (hasG43Classic(block)) {
      toolLengthActive = true;
    }
    if (hasExactG49(block)) {
      toolLengthActive = false;
    }

    if (hasG43Classic(block) && hasExactG49(block)) {
      issues.push({
        severity: "warning",
        message: "G43 and G49 on the same block — cancel or apply tool length, not both.",
        blockIndex: index
      });
    }

    if (hasExactG91(block)) {
      incrementalActive = true;
      sawDistanceMode = true;
    }
    if (hasExactG90(block)) {
      incrementalActive = false;
      sawDistanceMode = true;
    }

    const plane = hasExactPlane(block);
    if (plane !== undefined) {
      if (sawAxisMotion && activePlane !== undefined && activePlane !== plane) {
        issues.push({
          severity: "warning",
          message: "Plane mode changed after axis motion — verify intentional G17/G18/G19 switch mid-program.",
          blockIndex: index
        });
      }
      activePlane = plane;
    }

    if (hasWorkOffset(block)) {
      const nextOffset = workOffsetCode(block);
      if (
        sawAxisMotion &&
        activeWorkOffset !== undefined &&
        nextOffset !== undefined &&
        nextOffset !== activeWorkOffset
      ) {
        issues.push({
          severity: "warning",
          message:
            "Work offset changed after axis motion — verify intentional G54-G59/G154 switch mid-program.",
          blockIndex: index
        });
      }
      sawWorkOffset = true;
      if (nextOffset !== undefined) activeWorkOffset = nextOffset;
    }

    if (
      !warnedMissingWorkOffset &&
      (hasExactG0(block) || hasExactFeedMotion(block) || hasCannedCycle(block)) &&
      hasAxisWord(block) &&
      !sawWorkOffset &&
      !hasExactG53(block)
    ) {
      issues.push({
        severity: "warning",
        message:
          "Axis motion before any work offset (G54-G59/G154) — select a work coordinate system first.",
        blockIndex: index
      });
      warnedMissingWorkOffset = true;
    }

    if (
      !warnedMissingDistanceMode &&
      (hasExactG0(block) || hasExactFeedMotion(block) || hasCannedCycle(block)) &&
      hasAxisWord(block) &&
      !sawDistanceMode
    ) {
      issues.push({
        severity: "warning",
        message: "Axis motion before G90/G91 — set absolute or incremental distance mode first.",
        blockIndex: index
      });
      warnedMissingDistanceMode = true;
    }

    if (
      (hasExactG0(block) || hasExactFeedMotion(block) || hasCannedCycle(block)) &&
      hasAxisWord(block)
    ) {
      sawAxisMotion = true;
    }

    const unitModeEarly = hasExactG20Or21(block);
    if (unitModeEarly !== undefined) {
      if (
        sawAxisMotion &&
        activeUnitMode !== undefined &&
        activeUnitMode !== unitModeEarly
      ) {
        issues.push({
          severity: "warning",
          message: "Unit mode changed after axis motion — verify intentional G20/G21 switch mid-program.",
          blockIndex: index
        });
      }
      activeUnitMode = unitModeEarly;
    }

    if (hasExactFeedMotion(block) || hasCannedCycle(block)) {
      sawFeedOrCanned = true;
    }

    const feedModeEarly = hasExactG94Or95(block);
    if (feedModeEarly !== undefined) {
      if (
        sawFeedOrCanned &&
        activeFeedMode !== undefined &&
        activeFeedMode !== feedModeEarly
      ) {
        issues.push({
          severity: "warning",
          message: "Feed mode changed after cutting motion — verify intentional G94/G95 switch mid-program.",
          blockIndex: index
        });
      }
      activeFeedMode = feedModeEarly;
    }

    if (hasExactG53(block) && incrementalActive) {
      issues.push({
        severity: "warning",
        message: "G53 with incremental mode (G91) active — use G90 with G53 machine coordinates.",
        blockIndex: index
      });
    }

    if (hasWordM(block, 6) && spindleActive) {
      issues.push({
        severity: "warning",
        message: "M6 while spindle is still on — stop spindle with M5 before the tool change.",
        blockIndex: index
      });
    }

    if (hasExactFeedMotion(block) && !spindleActive) {
      issues.push({
        severity: "warning",
        message: "G1/G2/G3 while spindle is off — start spindle (M3/M4) before feed motion.",
        blockIndex: index
      });
    }

    if (hasExactTappingCycle(block) && !spindleActive) {
      issues.push({
        severity: "warning",
        message: "Tapping cycle (G74/G84) while spindle is off — start spindle before tapping.",
        blockIndex: index
      });
    }

    if (
      hasExactG0(block) &&
      isLiteralNegativeAxis(lastWordValue(block, "Z")) &&
      !toolLengthActive
    ) {
      issues.push({
        severity: "warning",
        message:
          "G0 with negative Z while tool length compensation (G43) is inactive — verify clearance before plunging.",
        blockIndex: index
      });
    }

    if (hasWordM(block, 98) && !hasLetter(block, "P")) {
      issues.push({
        severity: "warning",
        message: "M98 without P — subprogram call needs an explicit program number.",
        blockIndex: index
      });
    }

    if (hasWordM(block, 97) && !hasLetter(block, "P")) {
      issues.push({
        severity: "warning",
        message: "M97 without P — local subprogram call needs an explicit N-target number.",
        blockIndex: index
      });
    }

    if (hasExactG65(block) && !hasLetter(block, "P")) {
      issues.push({
        severity: "warning",
        message: "G65 without P — macro call needs an explicit program number.",
        blockIndex: index
      });
    }

    if (hasExactG4(block) && !hasLetter(block, "P") && !hasLetter(block, "X")) {
      issues.push({
        severity: "warning",
        message: "G4 dwell without P or X — specify dwell time explicitly.",
        blockIndex: index
      });
    }

    if (hasExactG28(block) && axisWordCount(block) > 1) {
      issues.push({
        severity: "warning",
        message:
          "G28 with multiple axes on one block — prefer single-axis G28 moves for safer homing.",
        blockIndex: index
      });
    }

    if (hasExactG30(block) && axisWordCount(block) > 1) {
      issues.push({
        severity: "warning",
        message:
          "G30 with multiple axes on one block — prefer single-axis G30 moves for safer secondary homing.",
        blockIndex: index
      });
    }

    if (hasSpindleDirectionConflict(block)) {
      issues.push({
        severity: "warning",
        message: "Conflicting spindle directions on one block (M3/M13 with M4/M14).",
        blockIndex: index
      });
    }

    if (hasG43Classic(block)) {
      const hNum = literalToolNumber(lastWordValue(block, "H"));
      if (
        hNum !== undefined &&
        hNum > 0 &&
        lastToolNumber !== undefined &&
        lastToolNumber > 0 &&
        hNum !== lastToolNumber
      ) {
        issues.push({
          severity: "warning",
          message: `G43 H${hNum} does not match last tool T${lastToolNumber} — verify H offset pairing.`,
          blockIndex: index
        });
      }
      if (lastToolNumber === undefined || lastToolNumber <= 0) {
        issues.push({
          severity: "warning",
          message: "G43 before any tool selection (T) — select Tn before applying tool length compensation.",
          blockIndex: index
        });
      }
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

    const hasG40 = block.words.some((w) => {
      if (w.letter !== "G") return false;
      return Number.parseFloat(w.value) === 40;
    });
    if (hasG40) {
      cutterCompActive = false;
      cutterSide = undefined;
    }

    const nextCutterSide = exactCutterSide(block);
    if (nextCutterSide !== undefined) {
      if (cutterSide !== undefined && cutterSide !== nextCutterSide && !hasG40) {
        issues.push({
          severity: "warning",
          message: `Cutter compensation flipped G${cutterSide} to G${nextCutterSide} without G40 — cancel compensation before changing sides.`,
          blockIndex: index
        });
      }
      cutterSide = nextCutterSide;
      cutterCompActive = true;
    }

    if (hasExactG0(block) && cutterCompActive) {
      issues.push({
        severity: "warning",
        message: "G0 rapid while cutter compensation (G41/G42) is active — cancel with G40 or use feed motion.",
        blockIndex: index
      });
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

    if (
      hasExactArcMotion(block) &&
      hasLetter(block, "R") &&
      (hasLetter(block, "I") || hasLetter(block, "J") || hasLetter(block, "K"))
    ) {
      issues.push({
        severity: "warning",
        message: "G2/G3 arc specifies both R and I/J/K — use one arc center style, not both.",
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
      if (!hasLetter(block, "F") && !sawAnyFeedRate) {
        issues.push({
          severity: "warning",
          message:
            "Canned cycle (G73/G74/G76/G81-G89) without F and no prior F — set feed on the cycle block or earlier.",
          blockIndex: index
        });
      }
      if (hasExactPeckCycle(block) && !hasLetter(block, "Q")) {
        issues.push({
          severity: "warning",
          message: "Peck canned cycle (G73/G83) without Q — set peck depth Q explicitly.",
          blockIndex: index
        });
      }
      if (hasLetter(block, "Z")) cannedHasZ = true;
      if (hasLetter(block, "R")) cannedHasR = true;
      if (hasLetter(block, "F")) sawAnyFeedRate = true;
      cannedActive = true;
    }

    if (hasExactG68(block)) {
      rotationActive = true;
    }
    if (hasExactG69(block)) {
      rotationActive = false;
    }

    if (hasExactG51(block)) {
      scalingActive = true;
    }
    if (hasExactG50(block)) {
      scalingActive = false;
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

    const feedMode = hasExactG94Or95(block);
    if (feedMode === 94 && firstG94Block < 0) firstG94Block = index;
    if (feedMode === 95 && firstG95Block < 0) firstG95Block = index;

    const pathMode = hasExactG61Or64(block);
    if (pathMode === 61 && firstG61Block < 0) firstG61Block = index;
    if (pathMode === 64 && firstG64Block < 0) firstG64Block = index;

    if (block.words.some((w) => w.letter === "O")) {
      sawProgramO = true;
    }

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
      toolLengthActive &&
      (hasWordM(block, 2) || hasWordM(block, 30)) &&
      index === ast.blocks.length - 1
    ) {
      issues.push({
        severity: "warning",
        message: "Program ends with tool length compensation (G43) still active — cancel with G49 before end.",
        blockIndex: index
      });
    }

    if (
      spindleActive &&
      (hasWordM(block, 2) || hasWordM(block, 30)) &&
      index === ast.blocks.length - 1
    ) {
      issues.push({
        severity: "warning",
        message: "Program ends with spindle still on — stop spindle with M5 before end.",
        blockIndex: index
      });
    }

    if (
      coolantActive &&
      (hasWordM(block, 2) || hasWordM(block, 30)) &&
      index === ast.blocks.length - 1
    ) {
      issues.push({
        severity: "warning",
        message: "Program ends with coolant still on — turn coolant off with M9 before end.",
        blockIndex: index
      });
    }

    if (
      incrementalActive &&
      (hasWordM(block, 2) || hasWordM(block, 30)) &&
      index === ast.blocks.length - 1
    ) {
      issues.push({
        severity: "warning",
        message: "Program ends in incremental mode (G91) — restore G90 before end.",
        blockIndex: index
      });
    }

    if (
      (activePlane === 18 || activePlane === 19) &&
      (hasWordM(block, 2) || hasWordM(block, 30)) &&
      index === ast.blocks.length - 1
    ) {
      issues.push({
        severity: "warning",
        message: `Program ends in G${activePlane} plane — restore G17 (XY) before end for mill programs.`,
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

    if (
      rotationActive &&
      (hasWordM(block, 2) || hasWordM(block, 30)) &&
      index === ast.blocks.length - 1
    ) {
      issues.push({
        severity: "warning",
        message: "Program ends with coordinate rotation (G68) still active — cancel with G69 before end.",
        blockIndex: index
      });
    }

    if (
      scalingActive &&
      (hasWordM(block, 2) || hasWordM(block, 30)) &&
      index === ast.blocks.length - 1
    ) {
      issues.push({
        severity: "warning",
        message: "Program ends with scaling (G51) still active — cancel with G50 before end.",
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

  if (firstG94Block >= 0 && firstG95Block >= 0) {
    issues.push({
      severity: "warning",
      message: "Program contains both G94 and G95 — pick one feed mode (per-minute or per-revolution).",
      blockIndex: Math.min(firstG94Block, firstG95Block)
    });
  }

  if (firstG61Block >= 0 && firstG64Block >= 0) {
    issues.push({
      severity: "warning",
      message: "Program contains both G61 and G64 — pick one path control mode (exact stop or continuous).",
      blockIndex: Math.min(firstG61Block, firstG64Block)
    });
  }

  if (!sawProgramO && ast.blocks.length > 0) {
    issues.push({
      severity: "warning",
      message: "Program has no O header — Haas NGC programs usually start with O####.",
      blockIndex: 0
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
