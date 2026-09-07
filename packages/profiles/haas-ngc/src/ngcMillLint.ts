import type { LintIssue, ProgramAst, Word } from "@cnc/core";
import { collectSameBlockMatrixIssues } from "./sameBlockConflicts.js";
import {
  hasCannedCycle,
  hasCoolantOff,
  hasCoolantOn,
  hasExactArcMotion,
  hasExactG4,
  hasExactG40,
  hasExactG41Or42,
  hasExactG43 as hasG43Classic,
  hasExactG49,
  hasExactG50,
  hasExactG51,
  hasExactG52,
  hasExactG61Or64,
  hasExactG65,
  hasExactG68,
  hasExactG69,
  hasExactG80,
  hasExactG90Or91,
  hasExactG92,
  hasExactG93,
  hasExactG94,
  hasExactG95,
  hasExactG94Or95,
  hasExactG93Or94Or95,
  hasExactG20Or21,
  exactGCodesOnBlock,
  hasExactPeckCycle,
  hasExactPlane,
  hasLetter,
  hasSpindleOff,
  hasSpindleOn,
  hasWordM,
  isZeroOffsetWord,
  lastWordValue
} from "./rules/millHelpers.js";

/** True for plain G1 / G2 / G3 feed motion (not G10/G11/G21/…). */
function hasExactFeedMotion(block: { words: Word[] }): boolean {
  return block.words.some((w) => {
    if (w.letter !== "G") return false;
    const v = Number.parseFloat(w.value);
    return v === 1 || v === 2 || v === 3;
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

function hasExactTappingCycle(block: { words: Word[] }): boolean {
  return block.words.some((w) => {
    if (w.letter !== "G") return false;
    const v = Number.parseFloat(w.value);
    return v === 74 || v === 84;
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

function hasBothG41AndG42(block: { words: Word[] }): boolean {
  let g41 = false;
  let g42 = false;
  for (const w of block.words) {
    if (w.letter !== "G") continue;
    const v = Number.parseFloat(w.value);
    if (v === 41) g41 = true;
    if (v === 42) g42 = true;
  }
  return g41 && g42;
}

function mWordCount(block: { words: Word[] }): number {
  return block.words.reduce((count, w) => (w.letter === "M" ? count + 1 : count), 0);
}

function spindleDirectionOf(block: { words: Word[] }): "cw" | "ccw" | undefined {
  let dir: "cw" | "ccw" | undefined;
  for (const w of block.words) {
    if (w.letter !== "M") continue;
    const m = Math.trunc(Number.parseFloat(w.value));
    if (m === 3 || m === 13) dir = "cw";
    if (m === 4 || m === 14) dir = "ccw";
  }
  return dir;
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
  let activeSpindleDirection: "cw" | "ccw" | undefined;
  let coolantActive = false;
  let sawCoolantOnEver = false;
  let g52LocalActive = false;
  let sawG92Shift = false;
  let toolLengthActive = false;
  let incrementalActive = false;
  let activeDistanceMode: 90 | 91 | undefined;
  let sawWorkOffset = false;
  let warnedMissingWorkOffset = false;
  let sawAxisMotion = false;
  let sawDistanceMode = false;
  let warnedMissingDistanceMode = false;
  let sawUnitMode = false;
  let warnedMissingUnitMode = false;
  let sawFeedMode = false;
  let warnedMissingFeedMode = false;
  let sawPlaneMode = false;
  let warnedMissingPlaneMode = false;
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
  let firstG93Block = -1;
  let firstG94Block = -1;
  let firstG95Block = -1;
  let firstG61Block = -1;
  let firstG64Block = -1;
  let activeFeedMode: 94 | 95 | undefined;
  let activePathMode: 61 | 64 | undefined;
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
    if (mWordCount(block) > 1) {
      issues.push({
        severity: "warning",
        message:
          "Multiple M codes on the same block — Haas allows only one M function per block.",
        blockIndex: index
      });
    }

    const hasM00 = hasWordM(block, 0);
    const hasM01 = hasWordM(block, 1);
    const hasM02 = hasWordM(block, 2);
    if (hasM00 || hasM01 || hasM02) {
      const stopLabel = hasM00 ? "M00" : hasM01 ? "M01" : "M02";
      const stopKind = hasM00
        ? "program stop"
        : hasM01
          ? "optional stop"
          : "program end";
      if (coolantActive && !hasCoolantOff(block)) {
        issues.push({
          severity: "warning",
          message: `${stopLabel} while coolant is still on — turn coolant off with M9 before ${stopKind}.`,
          blockIndex: index
        });
      }
      if (cutterCompActive && !hasExactG40(block)) {
        issues.push({
          severity: "warning",
          message: `${stopLabel} while cutter compensation (G41/G42) is still active — cancel with G40 before ${stopKind}.`,
          blockIndex: index
        });
      }
      if (cannedActive && !hasExactG80(block)) {
        issues.push({
          severity: "warning",
          message: `${stopLabel} while a canned cycle is still active — cancel with G80 before ${stopKind}.`,
          blockIndex: index
        });
      }
      if (toolLengthActive && !hasExactG49(block)) {
        issues.push({
          severity: "warning",
          message: `${stopLabel} while tool length compensation (G43) is still active — cancel with G49 before ${stopKind}.`,
          blockIndex: index
        });
      }
      if (rotationActive && !hasExactG69(block)) {
        issues.push({
          severity: "warning",
          message: `${stopLabel} while coordinate rotation (G68) is still active — cancel with G69 before ${stopKind}.`,
          blockIndex: index
        });
      }
      if (scalingActive && !hasExactG50(block)) {
        issues.push({
          severity: "warning",
          message: `${stopLabel} while scaling (G51) is still active — cancel with G50 before ${stopKind}.`,
          blockIndex: index
        });
      }
      if (incrementalActive) {
        issues.push({
          severity: "warning",
          message: `${stopLabel} while incremental mode (G91) is active — restore G90 before ${stopKind}.`,
          blockIndex: index
        });
      }
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
      }
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

    if (isLiteralNegativeAxis(sVal)) {
      issues.push({
        severity: "warning",
        message: "Negative spindle speed (S) — RPM cannot be negative.",
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
      if (!hasWordM(block, 6)) {
        if (cutterCompActive && !hasExactG40(block)) {
          issues.push({
            severity: "warning",
            message:
              "Tool select (T) while cutter compensation (G41/G42) is still active — cancel with G40 before staging the next tool.",
            blockIndex: index
          });
        }
        if (cannedActive && !hasExactG80(block)) {
          issues.push({
            severity: "warning",
            message:
              "Tool select (T) while a canned cycle is still active — cancel with G80 before staging the next tool.",
            blockIndex: index
          });
        }
        if (toolLengthActive && !hasExactG49(block)) {
          issues.push({
            severity: "warning",
            message:
              "Tool select (T) while tool length compensation (G43) is still active — cancel with G49 before staging the next tool.",
            blockIndex: index
          });
        }
        if (rotationActive && !hasExactG69(block)) {
          issues.push({
            severity: "warning",
            message:
              "Tool select (T) while coordinate rotation (G68) is still active — cancel with G69 before staging the next tool.",
            blockIndex: index
          });
        }
        if (scalingActive && !hasExactG50(block)) {
          issues.push({
            severity: "warning",
            message:
              "Tool select (T) while scaling (G51) is still active — cancel with G50 before staging the next tool.",
            blockIndex: index
          });
        }
        if (coolantActive && !hasCoolantOff(block)) {
          issues.push({
            severity: "warning",
            message:
              "Tool select (T) while coolant is still on — turn coolant off with M9 before staging the next tool.",
            blockIndex: index
          });
        }
        if (incrementalActive) {
          issues.push({
            severity: "warning",
            message:
              "Tool select (T) while incremental mode (G91) is active — restore G90 before staging the next tool.",
            blockIndex: index
          });
        }
      }
      lastToolNumber = tNumEarly;
    }

    const nextSpindleDirection = spindleDirectionOf(block);
    if (
      nextSpindleDirection !== undefined &&
      spindleActive &&
      activeSpindleDirection !== undefined &&
      nextSpindleDirection !== activeSpindleDirection &&
      !hasSpindleOff(block)
    ) {
      issues.push({
        severity: "warning",
        message:
          "Spindle direction reversed without M5 stop — stop the spindle before switching M3/M4 (or M13/M14).",
        blockIndex: index
      });
    }

    if (hasSpindleOn(block)) {
      if (toolLengthActive && !hasExactG49(block)) {
        issues.push({
          severity: "warning",
          message:
            "Spindle start (M3/M4) while tool length compensation (G43) is still active — cancel with G49 before starting the spindle.",
          blockIndex: index
        });
      }
      if (cannedActive && !hasExactG80(block)) {
        issues.push({
          severity: "warning",
          message:
            "Spindle start (M3/M4) while a canned cycle is still active — cancel with G80 before starting the spindle.",
          blockIndex: index
        });
      }
      if (cutterCompActive && !hasExactG40(block)) {
        issues.push({
          severity: "warning",
          message:
            "Spindle start (M3/M4) while cutter compensation (G41/G42) is still active — cancel with G40 before starting the spindle.",
          blockIndex: index
        });
      }
      if (rotationActive && !hasExactG69(block)) {
        issues.push({
          severity: "warning",
          message:
            "Spindle start (M3/M4) while coordinate rotation (G68) is still active — cancel with G69 before starting the spindle.",
          blockIndex: index
        });
      }
      if (scalingActive && !hasExactG50(block)) {
        issues.push({
          severity: "warning",
          message:
            "Spindle start (M3/M4) while scaling (G51) is still active — cancel with G50 before starting the spindle.",
          blockIndex: index
        });
      }
      if (incrementalActive) {
        issues.push({
          severity: "warning",
          message:
            "Spindle start (M3/M4) while incremental mode (G91) is active — restore G90 before starting the spindle.",
          blockIndex: index
        });
      }
      if (coolantActive && !hasCoolantOff(block)) {
        issues.push({
          severity: "warning",
          message:
            "Spindle start (M3/M4) while coolant is still on — turn coolant off with M9 before starting the spindle.",
          blockIndex: index
        });
      }
      sawSpindleOn = true;
      spindleActive = true;
      if (nextSpindleDirection !== undefined) {
        activeSpindleDirection = nextSpindleDirection;
      }
    }
    if (hasSpindleOff(block)) {
      if (coolantActive && !hasCoolantOff(block)) {
        issues.push({
          severity: "warning",
          message: "M5 while coolant is still on — turn coolant off with M9 when stopping the spindle.",
          blockIndex: index
        });
      }
      if (cutterCompActive && !hasExactG40(block)) {
        issues.push({
          severity: "warning",
          message:
            "M5 while cutter compensation (G41/G42) is still active — cancel with G40 when stopping the spindle.",
          blockIndex: index
        });
      }
      if (cannedActive && !hasExactG80(block)) {
        issues.push({
          severity: "warning",
          message: "M5 while a canned cycle is still active — cancel with G80 when stopping the spindle.",
          blockIndex: index
        });
      }
      if (toolLengthActive && !hasExactG49(block)) {
        issues.push({
          severity: "warning",
          message:
            "M5 while tool length compensation (G43) is still active — cancel with G49 when stopping the spindle.",
          blockIndex: index
        });
      }
      if (rotationActive && !hasExactG69(block)) {
        issues.push({
          severity: "warning",
          message:
            "M5 while coordinate rotation (G68) is still active — cancel with G69 when stopping the spindle.",
          blockIndex: index
        });
      }
      if (scalingActive && !hasExactG50(block)) {
        issues.push({
          severity: "warning",
          message: "M5 while scaling (G51) is still active — cancel with G50 when stopping the spindle.",
          blockIndex: index
        });
      }
      if (incrementalActive) {
        issues.push({
          severity: "warning",
          message: "M5 while incremental mode (G91) is active — restore G90 when stopping the spindle.",
          blockIndex: index
        });
      }
      spindleActive = false;
      activeSpindleDirection = undefined;
    }

    if (hasCoolantOn(block) && sawSpindleOn && !spindleActive && !hasSpindleOn(block)) {
      issues.push({
        severity: "warning",
        message: "Coolant on (M7/M8) while spindle is off — restart spindle or turn coolant off.",
        blockIndex: index
      });
    }

    if (hasCoolantOn(block)) {
      if (toolLengthActive && !hasExactG49(block)) {
        issues.push({
          severity: "warning",
          message:
            "Coolant on (M7/M8) while tool length compensation (G43) is still active — cancel with G49 before coolant.",
          blockIndex: index
        });
      }
      if (rotationActive && !hasExactG69(block)) {
        issues.push({
          severity: "warning",
          message:
            "Coolant on (M7/M8) while coordinate rotation (G68) is still active — cancel with G69 before coolant.",
          blockIndex: index
        });
      }
      if (scalingActive && !hasExactG50(block)) {
        issues.push({
          severity: "warning",
          message: "Coolant on (M7/M8) while scaling (G51) is still active — cancel with G50 before coolant.",
          blockIndex: index
        });
      }
      if (incrementalActive) {
        issues.push({
          severity: "warning",
          message: "Coolant on (M7/M8) while incremental mode (G91) is active — restore G90 before coolant.",
          blockIndex: index
        });
      }
      if (cutterCompActive && !hasExactG40(block)) {
        issues.push({
          severity: "warning",
          message:
            "Coolant on (M7/M8) while cutter compensation (G41/G42) is still active — cancel with G40 before coolant.",
          blockIndex: index
        });
      }
      if (cannedActive && !hasExactG80(block)) {
        issues.push({
          severity: "warning",
          message: "Coolant on (M7/M8) while a canned cycle is still active — cancel with G80 before coolant.",
          blockIndex: index
        });
      }
      coolantActive = true;
      sawCoolantOnEver = true;
    }
    if (hasCoolantOff(block)) {
      if (cutterCompActive && !hasExactG40(block)) {
        issues.push({
          severity: "warning",
          message:
            "M9 while cutter compensation (G41/G42) is still active — cancel with G40 when turning coolant off.",
          blockIndex: index
        });
      }
      if (cannedActive && !hasExactG80(block)) {
        issues.push({
          severity: "warning",
          message: "M9 while a canned cycle is still active — cancel with G80 when turning coolant off.",
          blockIndex: index
        });
      }
      if (toolLengthActive && !hasExactG49(block)) {
        issues.push({
          severity: "warning",
          message:
            "M9 while tool length compensation (G43) is still active — cancel with G49 when turning coolant off.",
          blockIndex: index
        });
      }
      if (rotationActive && !hasExactG69(block)) {
        issues.push({
          severity: "warning",
          message:
            "M9 while coordinate rotation (G68) is still active — cancel with G69 when turning coolant off.",
          blockIndex: index
        });
      }
      if (scalingActive && !hasExactG50(block)) {
        issues.push({
          severity: "warning",
          message: "M9 while scaling (G51) is still active — cancel with G50 when turning coolant off.",
          blockIndex: index
        });
      }
      if (incrementalActive) {
        issues.push({
          severity: "warning",
          message: "M9 while incremental mode (G91) is active — restore G90 when turning coolant off.",
          blockIndex: index
        });
      }
      coolantActive = false;
    }

    if (hasG43Classic(block)) {
      if (cutterCompActive && !hasExactG40(block)) {
        issues.push({
          severity: "warning",
          message:
            "G43 while cutter compensation (G41/G42) is still active — cancel with G40 before applying tool length.",
          blockIndex: index
        });
      }
      if (cannedActive && !hasExactG80(block)) {
        issues.push({
          severity: "warning",
          message: "G43 while a canned cycle is still active — cancel with G80 before applying tool length.",
          blockIndex: index
        });
      }
      if (rotationActive && !hasExactG69(block)) {
        issues.push({
          severity: "warning",
          message:
            "G43 while coordinate rotation (G68) is still active — cancel with G69 before applying tool length.",
          blockIndex: index
        });
      }
      if (scalingActive && !hasExactG50(block)) {
        issues.push({
          severity: "warning",
          message: "G43 while scaling (G51) is still active — cancel with G50 before applying tool length.",
          blockIndex: index
        });
      }
      if (coolantActive && !hasCoolantOff(block)) {
        issues.push({
          severity: "warning",
          message: "G43 while coolant is still on — turn coolant off with M9 before applying tool length.",
          blockIndex: index
        });
      }
      if (incrementalActive) {
        issues.push({
          severity: "warning",
          message: "G43 while incremental mode (G91) is active — restore G90 before applying tool length.",
          blockIndex: index
        });
      }
      toolLengthActive = true;
    }
    if (hasExactG49(block)) {
      if (cutterCompActive && !hasExactG40(block)) {
        issues.push({
          severity: "warning",
          message:
            "G49 while cutter compensation (G41/G42) is still active — cancel with G40 before canceling tool length.",
          blockIndex: index
        });
      }
      if (cannedActive && !hasExactG80(block)) {
        issues.push({
          severity: "warning",
          message: "G49 while a canned cycle is still active — cancel with G80 before canceling tool length.",
          blockIndex: index
        });
      }
      if (rotationActive && !hasExactG69(block)) {
        issues.push({
          severity: "warning",
          message:
            "G49 while coordinate rotation (G68) is still active — cancel with G69 before canceling tool length.",
          blockIndex: index
        });
      }
      if (scalingActive && !hasExactG50(block)) {
        issues.push({
          severity: "warning",
          message: "G49 while scaling (G51) is still active — cancel with G50 before canceling tool length.",
          blockIndex: index
        });
      }
      if (coolantActive && !hasCoolantOff(block)) {
        issues.push({
          severity: "warning",
          message: "G49 while coolant is still on — turn coolant off with M9 before canceling tool length.",
          blockIndex: index
        });
      }
      if (incrementalActive) {
        issues.push({
          severity: "warning",
          message: "G49 while incremental mode (G91) is active — restore G90 before canceling tool length.",
          blockIndex: index
        });
      }
      toolLengthActive = false;
    }

    if (hasG43Classic(block) && hasExactG49(block)) {
      issues.push({
        severity: "warning",
        message: "G43 and G49 on the same block — cancel or apply tool length, not both.",
        blockIndex: index
      });
    }

    const distanceMode = hasExactG90Or91(block);
    if (distanceMode !== undefined) {
      if (
        sawAxisMotion &&
        activeDistanceMode !== undefined &&
        activeDistanceMode !== distanceMode
      ) {
        issues.push({
          severity: "warning",
          message:
            "Distance mode changed after axis motion — verify intentional G90/G91 switch mid-program.",
          blockIndex: index
        });
      }
      if (cutterCompActive && !hasExactG40(block)) {
        issues.push({
          severity: "warning",
          message:
            "Distance mode select (G90/G91) while cutter compensation (G41/G42) is still active — cancel with G40 before changing distance mode.",
          blockIndex: index
        });
      }
      if (cannedActive && !hasExactG80(block)) {
        issues.push({
          severity: "warning",
          message:
            "Distance mode select (G90/G91) while a canned cycle is still active — cancel with G80 before changing distance mode.",
          blockIndex: index
        });
      }
      if (rotationActive && !hasExactG69(block)) {
        issues.push({
          severity: "warning",
          message:
            "Distance mode select (G90/G91) while coordinate rotation (G68) is still active — cancel with G69 before changing distance mode.",
          blockIndex: index
        });
      }
      if (scalingActive && !hasExactG50(block)) {
        issues.push({
          severity: "warning",
          message:
            "Distance mode select (G90/G91) while scaling (G51) is still active — cancel with G50 before changing distance mode.",
          blockIndex: index
        });
      }
      if (coolantActive && !hasCoolantOff(block)) {
        issues.push({
          severity: "warning",
          message:
            "Distance mode select (G90/G91) while coolant is still on — turn coolant off with M9 before changing distance mode.",
          blockIndex: index
        });
      }
      if (toolLengthActive && !hasExactG49(block)) {
        issues.push({
          severity: "warning",
          message:
            "Distance mode select (G90/G91) while tool length compensation (G43) is still active — cancel with G49 before changing distance mode.",
          blockIndex: index
        });
      }
      activeDistanceMode = distanceMode;
      incrementalActive = distanceMode === 91;
      sawDistanceMode = true;
    }

    const plane = hasExactPlane(block);
    if (plane !== undefined) {
      sawPlaneMode = true;
      if (sawAxisMotion && activePlane !== undefined && activePlane !== plane) {
        issues.push({
          severity: "warning",
          message: "Plane mode changed after axis motion — verify intentional G17/G18/G19 switch mid-program.",
          blockIndex: index
        });
      }
      if (cutterCompActive && !hasExactG40(block)) {
        issues.push({
          severity: "warning",
          message:
            "Plane select (G17/G18/G19) while cutter compensation (G41/G42) is still active — cancel with G40 before changing plane.",
          blockIndex: index
        });
      }
      if (cannedActive && !hasExactG80(block)) {
        issues.push({
          severity: "warning",
          message: "Plane select (G17/G18/G19) while a canned cycle is still active — cancel with G80 before changing plane.",
          blockIndex: index
        });
      }
      if (rotationActive && !hasExactG69(block)) {
        issues.push({
          severity: "warning",
          message:
            "Plane select (G17/G18/G19) while coordinate rotation (G68) is still active — cancel with G69 before changing plane.",
          blockIndex: index
        });
      }
      if (scalingActive && !hasExactG50(block)) {
        issues.push({
          severity: "warning",
          message: "Plane select (G17/G18/G19) while scaling (G51) is still active — cancel with G50 before changing plane.",
          blockIndex: index
        });
      }
      if (coolantActive && !hasCoolantOff(block)) {
        issues.push({
          severity: "warning",
          message: "Plane select (G17/G18/G19) while coolant is still on — turn coolant off with M9 before changing plane.",
          blockIndex: index
        });
      }
      if (incrementalActive) {
        issues.push({
          severity: "warning",
          message:
            "Plane select (G17/G18/G19) while incremental mode (G91) is active — restore G90 before changing plane.",
          blockIndex: index
        });
      }
      if (toolLengthActive && !hasExactG49(block)) {
        issues.push({
          severity: "warning",
          message:
            "Plane select (G17/G18/G19) while tool length compensation (G43) is still active — cancel with G49 before changing plane.",
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
      if (cutterCompActive && !hasExactG40(block)) {
        issues.push({
          severity: "warning",
          message:
            "Work offset (G54-G59/G154) while cutter compensation (G41/G42) is still active — cancel with G40 before selecting a work offset.",
          blockIndex: index
        });
      }
      if (cannedActive && !hasExactG80(block)) {
        issues.push({
          severity: "warning",
          message:
            "Work offset (G54-G59/G154) while a canned cycle is still active — cancel with G80 before selecting a work offset.",
          blockIndex: index
        });
      }
      if (rotationActive && !hasExactG69(block)) {
        issues.push({
          severity: "warning",
          message:
            "Work offset (G54-G59/G154) while coordinate rotation (G68) is still active — cancel with G69 before selecting a work offset.",
          blockIndex: index
        });
      }
      if (scalingActive && !hasExactG50(block)) {
        issues.push({
          severity: "warning",
          message:
            "Work offset (G54-G59/G154) while scaling (G51) is still active — cancel with G50 before selecting a work offset.",
          blockIndex: index
        });
      }
      if (toolLengthActive && !hasExactG49(block)) {
        issues.push({
          severity: "warning",
          message:
            "Work offset (G54-G59/G154) while tool length compensation (G43) is still active — cancel with G49 before selecting a work offset.",
          blockIndex: index
        });
      }
      if (coolantActive && !hasCoolantOff(block)) {
        issues.push({
          severity: "warning",
          message:
            "Work offset (G54-G59/G154) while coolant is still on — turn coolant off with M9 before selecting a work offset.",
          blockIndex: index
        });
      }
      if (incrementalActive) {
        issues.push({
          severity: "warning",
          message:
            "Work offset (G54-G59/G154) while incremental mode (G91) is active — restore G90 before selecting a work offset.",
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
      sawUnitMode = true;
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
      if (cutterCompActive && !hasExactG40(block)) {
        issues.push({
          severity: "warning",
          message:
            "Unit select (G20/G21) while cutter compensation (G41/G42) is still active — cancel with G40 before changing units.",
          blockIndex: index
        });
      }
      if (cannedActive && !hasExactG80(block)) {
        issues.push({
          severity: "warning",
          message: "Unit select (G20/G21) while a canned cycle is still active — cancel with G80 before changing units.",
          blockIndex: index
        });
      }
      if (rotationActive && !hasExactG69(block)) {
        issues.push({
          severity: "warning",
          message:
            "Unit select (G20/G21) while coordinate rotation (G68) is still active — cancel with G69 before changing units.",
          blockIndex: index
        });
      }
      if (scalingActive && !hasExactG50(block)) {
        issues.push({
          severity: "warning",
          message: "Unit select (G20/G21) while scaling (G51) is still active — cancel with G50 before changing units.",
          blockIndex: index
        });
      }
      if (coolantActive && !hasCoolantOff(block)) {
        issues.push({
          severity: "warning",
          message: "Unit select (G20/G21) while coolant is still on — turn coolant off with M9 before changing units.",
          blockIndex: index
        });
      }
      if (incrementalActive) {
        issues.push({
          severity: "warning",
          message: "Unit select (G20/G21) while incremental mode (G91) is active — restore G90 before changing units.",
          blockIndex: index
        });
      }
      if (toolLengthActive && !hasExactG49(block)) {
        issues.push({
          severity: "warning",
          message:
            "Unit select (G20/G21) while tool length compensation (G43) is still active — cancel with G49 before changing units.",
          blockIndex: index
        });
      }
      activeUnitMode = unitModeEarly;
    }

    if (
      !warnedMissingUnitMode &&
      (hasExactG0(block) || hasExactFeedMotion(block) || hasCannedCycle(block)) &&
      hasAxisWord(block) &&
      !sawUnitMode
    ) {
      issues.push({
        severity: "warning",
        message: "Axis motion before any unit mode (G20/G21) — select inch or metric units first.",
        blockIndex: index
      });
      warnedMissingUnitMode = true;
    }

    if (hasExactG93Or94Or95(block) !== undefined) {
      sawFeedMode = true;
    }

    if (
      !warnedMissingFeedMode &&
      (hasExactG0(block) || hasExactFeedMotion(block) || hasCannedCycle(block)) &&
      hasAxisWord(block) &&
      !sawFeedMode
    ) {
      issues.push({
        severity: "warning",
        message:
          "Axis motion before any feed mode (G93/G94/G95) — select inverse-time, per-minute, or per-rev feed mode first.",
        blockIndex: index
      });
      warnedMissingFeedMode = true;
    }

    if (
      !warnedMissingPlaneMode &&
      (hasExactG0(block) || hasExactFeedMotion(block) || hasCannedCycle(block)) &&
      hasAxisWord(block) &&
      !sawPlaneMode
    ) {
      issues.push({
        severity: "warning",
        message:
          "Axis motion before any plane mode (G17/G18/G19) — select XY/XZ/YZ plane first.",
        blockIndex: index
      });
      warnedMissingPlaneMode = true;
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
      if (cutterCompActive && !hasExactG40(block)) {
        issues.push({
          severity: "warning",
          message:
            "Feed mode select (G94/G95) while cutter compensation (G41/G42) is still active — cancel with G40 before changing feed mode.",
          blockIndex: index
        });
      }
      if (cannedActive && !hasExactG80(block)) {
        issues.push({
          severity: "warning",
          message:
            "Feed mode select (G94/G95) while a canned cycle is still active — cancel with G80 before changing feed mode.",
          blockIndex: index
        });
      }
      if (rotationActive && !hasExactG69(block)) {
        issues.push({
          severity: "warning",
          message:
            "Feed mode select (G94/G95) while coordinate rotation (G68) is still active — cancel with G69 before changing feed mode.",
          blockIndex: index
        });
      }
      if (scalingActive && !hasExactG50(block)) {
        issues.push({
          severity: "warning",
          message:
            "Feed mode select (G94/G95) while scaling (G51) is still active — cancel with G50 before changing feed mode.",
          blockIndex: index
        });
      }
      if (coolantActive && !hasCoolantOff(block)) {
        issues.push({
          severity: "warning",
          message:
            "Feed mode select (G94/G95) while coolant is still on — turn coolant off with M9 before changing feed mode.",
          blockIndex: index
        });
      }
      if (incrementalActive) {
        issues.push({
          severity: "warning",
          message:
            "Feed mode select (G94/G95) while incremental mode (G91) is active — restore G90 before changing feed mode.",
          blockIndex: index
        });
      }
      if (toolLengthActive && !hasExactG49(block)) {
        issues.push({
          severity: "warning",
          message:
            "Feed mode select (G94/G95) while tool length compensation (G43) is still active — cancel with G49 before changing feed mode.",
          blockIndex: index
        });
      }
      activeFeedMode = feedModeEarly;
    }

    if (hasExactG93(block) && hasExactG94(block)) {
      issues.push({
        severity: "warning",
        message:
          "G93 and G94 on the same block — pick one feed mode (inverse-time or per-minute).",
        blockIndex: index
      });
    }

    if (hasExactG93(block) && hasExactG95(block)) {
      issues.push({
        severity: "warning",
        message:
          "G93 and G95 on the same block — pick one feed mode (inverse-time or per-revolution).",
        blockIndex: index
      });
    }

    if (hasExactG93(block)) {
      if (cutterCompActive && !hasExactG40(block)) {
        issues.push({
          severity: "warning",
          message:
            "G93 while cutter compensation (G41/G42) is still active — cancel with G40 before inverse-time feed mode.",
          blockIndex: index
        });
      }
      if (cannedActive && !hasExactG80(block)) {
        issues.push({
          severity: "warning",
          message:
            "G93 while a canned cycle is still active — cancel with G80 before inverse-time feed mode.",
          blockIndex: index
        });
      }
      if (rotationActive && !hasExactG69(block)) {
        issues.push({
          severity: "warning",
          message:
            "G93 while coordinate rotation (G68) is still active — cancel with G69 before inverse-time feed mode.",
          blockIndex: index
        });
      }
      if (scalingActive && !hasExactG50(block)) {
        issues.push({
          severity: "warning",
          message:
            "G93 while scaling (G51) is still active — cancel with G50 before inverse-time feed mode.",
          blockIndex: index
        });
      }
      if (toolLengthActive && !hasExactG49(block)) {
        issues.push({
          severity: "warning",
          message:
            "G93 while tool length compensation (G43) is still active — cancel with G49 before inverse-time feed mode.",
          blockIndex: index
        });
      }
      if (coolantActive && !hasCoolantOff(block)) {
        issues.push({
          severity: "warning",
          message:
            "G93 while coolant is still on — turn coolant off with M9 before inverse-time feed mode.",
          blockIndex: index
        });
      }
      if (incrementalActive) {
        issues.push({
          severity: "warning",
          message:
            "G93 while incremental mode (G91) is active — restore G90 before inverse-time feed mode.",
          blockIndex: index
        });
      }
    }

    const exactGCodes = exactGCodesOnBlock(block);
    const pushExclusiveGPair = (a: number, b: number, message: string) => {
      if (exactGCodes.has(a) && exactGCodes.has(b)) {
        issues.push({ severity: "warning", message, blockIndex: index });
      }
    };
    pushExclusiveGPair(
      90,
      91,
      "G90 and G91 on the same block — pick one distance mode (absolute or incremental)."
    );
    pushExclusiveGPair(17, 18, "G17 and G18 on the same block — pick one plane.");
    pushExclusiveGPair(17, 19, "G17 and G19 on the same block — pick one plane.");
    pushExclusiveGPair(18, 19, "G18 and G19 on the same block — pick one plane.");
    pushExclusiveGPair(
      20,
      21,
      "G20 and G21 on the same block — pick one unit mode (inch or metric)."
    );
    pushExclusiveGPair(
      94,
      95,
      "G94 and G95 on the same block — pick one feed mode (per-minute or per-revolution)."
    );
    pushExclusiveGPair(
      61,
      64,
      "G61 and G64 on the same block — pick one path mode (exact stop or continuous)."
    );

    if (exactGCodes.has(10)) {
      if (cutterCompActive && !hasExactG40(block)) {
        issues.push({
          severity: "warning",
          message:
            "G10 while cutter compensation (G41/G42) is still active — cancel with G40 before G10 data setting.",
          blockIndex: index
        });
      }
      if (cannedActive && !hasExactG80(block) && !hasCannedCycle(block)) {
        issues.push({
          severity: "warning",
          message:
            "G10 while a canned cycle is still active — cancel with G80 before G10 data setting.",
          blockIndex: index
        });
      }
      if (rotationActive && !hasExactG69(block)) {
        issues.push({
          severity: "warning",
          message:
            "G10 while coordinate rotation (G68) is still active — cancel with G69 before G10 data setting.",
          blockIndex: index
        });
      }
      if (scalingActive && !hasExactG50(block)) {
        issues.push({
          severity: "warning",
          message:
            "G10 while scaling (G51) is still active — cancel with G50 before G10 data setting.",
          blockIndex: index
        });
      }
      if (incrementalActive) {
        issues.push({
          severity: "warning",
          message:
            "G10 while incremental mode (G91) is active — restore G90 before G10 data setting.",
          blockIndex: index
        });
      }
      if (coolantActive && !hasCoolantOff(block)) {
        issues.push({
          severity: "warning",
          message:
            "G10 while coolant is still on — turn coolant off with M9 before G10 data setting.",
          blockIndex: index
        });
      }
      if (toolLengthActive && !hasExactG49(block)) {
        issues.push({
          severity: "warning",
          message:
            "G10 while tool length compensation (G43) is still active — cancel with G49 before G10 data setting.",
          blockIndex: index
        });
      }
    }

    const pathModeEarly = hasExactG61Or64(block);
    if (pathModeEarly !== undefined) {
      if (
        sawAxisMotion &&
        activePathMode !== undefined &&
        activePathMode !== pathModeEarly
      ) {
        issues.push({
          severity: "warning",
          message:
            "Path mode changed after axis motion — verify intentional G61/G64 switch mid-program.",
          blockIndex: index
        });
      }
      if (cutterCompActive && !hasExactG40(block)) {
        issues.push({
          severity: "warning",
          message:
            "Path mode select (G61/G64) while cutter compensation (G41/G42) is still active — cancel with G40 before changing path mode.",
          blockIndex: index
        });
      }
      if (cannedActive && !hasExactG80(block)) {
        issues.push({
          severity: "warning",
          message:
            "Path mode select (G61/G64) while a canned cycle is still active — cancel with G80 before changing path mode.",
          blockIndex: index
        });
      }
      if (rotationActive && !hasExactG69(block)) {
        issues.push({
          severity: "warning",
          message:
            "Path mode select (G61/G64) while coordinate rotation (G68) is still active — cancel with G69 before changing path mode.",
          blockIndex: index
        });
      }
      if (scalingActive && !hasExactG50(block)) {
        issues.push({
          severity: "warning",
          message:
            "Path mode select (G61/G64) while scaling (G51) is still active — cancel with G50 before changing path mode.",
          blockIndex: index
        });
      }
      if (coolantActive && !hasCoolantOff(block)) {
        issues.push({
          severity: "warning",
          message:
            "Path mode select (G61/G64) while coolant is still on — turn coolant off with M9 before changing path mode.",
          blockIndex: index
        });
      }
      if (incrementalActive) {
        issues.push({
          severity: "warning",
          message:
            "Path mode select (G61/G64) while incremental mode (G91) is active — restore G90 before changing path mode.",
          blockIndex: index
        });
      }
      if (toolLengthActive && !hasExactG49(block)) {
        issues.push({
          severity: "warning",
          message:
            "Path mode select (G61/G64) while tool length compensation (G43) is still active — cancel with G49 before changing path mode.",
          blockIndex: index
        });
      }
      activePathMode = pathModeEarly;
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

    if (spindleActive) {
      const spindleOnGuards: Array<{ test: boolean; message: string }> = [
        {
          test: exactGCodes.has(10),
          message:
            "G10 while spindle is still on — stop spindle with M5 before G10 data setting."
        },
        {
          test: hasExactG92(block),
          message:
            "G92 while spindle is still on — stop spindle with M5 before shifting coordinates."
        },
        {
          test: hasExactG52(block),
          message: "G52 while spindle is still on — stop spindle with M5 before a local offset."
        },
        {
          test: hasExactG28(block),
          message:
            "G28 while spindle is still on — stop spindle with M5 before reference return."
        },
        {
          test: hasExactG30(block),
          message:
            "G30 while spindle is still on — stop spindle with M5 before secondary reference return."
        },
        {
          test: hasExactG53(block),
          message: "G53 while spindle is still on — stop spindle with M5 before machine move."
        },
        {
          test: hasExactG68(block),
          message:
            "G68 while spindle is still on — stop spindle with M5 before coordinate rotation."
        },
        {
          test: hasExactG51(block),
          message: "G51 while spindle is still on — stop spindle with M5 before scaling."
        },
        {
          test: hasExactG50(block),
          message: "G50 while spindle is still on — stop spindle with M5 before canceling scaling."
        },
        {
          test: hasExactG69(block),
          message:
            "G69 while spindle is still on — stop spindle with M5 before canceling coordinate rotation."
        },
        {
          test: hasExactG80(block),
          message:
            "G80 while spindle is still on — stop spindle with M5 before canceling the canned cycle."
        }
      ];
      for (const guard of spindleOnGuards) {
        if (guard.test) {
          issues.push({ severity: "warning", message: guard.message, blockIndex: index });
        }
      }
    }

    if (hasWordM(block, 6) && cutterCompActive && !hasExactG40(block)) {
      issues.push({
        severity: "warning",
        message:
          "M6 while cutter compensation (G41/G42) is still active — cancel with G40 before the tool change.",
        blockIndex: index
      });
    }

    if (hasWordM(block, 6) && toolLengthActive && !hasExactG49(block)) {
      issues.push({
        severity: "warning",
        message:
          "M6 while tool length compensation (G43) is still active — cancel with G49 before the tool change.",
        blockIndex: index
      });
    }

    if (hasWordM(block, 6) && coolantActive && !hasCoolantOff(block)) {
      issues.push({
        severity: "warning",
        message: "M6 while coolant is still on — turn coolant off with M9 before the tool change.",
        blockIndex: index
      });
    }

    if (hasWordM(block, 6) && rotationActive && !hasExactG69(block)) {
      issues.push({
        severity: "warning",
        message:
          "M6 while coordinate rotation (G68) is still active — cancel with G69 before the tool change.",
        blockIndex: index
      });
    }

    if (hasWordM(block, 6) && scalingActive && !hasExactG50(block)) {
      issues.push({
        severity: "warning",
        message: "M6 while scaling (G51) is still active — cancel with G50 before the tool change.",
        blockIndex: index
      });
    }

    if (hasWordM(block, 6) && incrementalActive) {
      issues.push({
        severity: "warning",
        message:
          "M6 while incremental mode (G91) is active — restore G90 before the tool change.",
        blockIndex: index
      });
    }

    if (hasWordM(block, 6) && hasExactG4(block)) {
      issues.push({
        severity: "warning",
        message: "G4 dwell and M6 on the same block — dwell and tool change separately.",
        blockIndex: index
      });
    }

    if (hasWordM(block, 19)) {
      const m19Guards: Array<{ test: boolean; message: string }> = [
        {
          test: cutterCompActive && !hasExactG40(block),
          message:
            "M19 while cutter compensation (G41/G42) is still active — cancel with G40 before spindle orientation."
        },
        {
          test: cannedActive && !hasExactG80(block),
          message:
            "M19 while a canned cycle is still active — cancel with G80 before spindle orientation."
        },
        {
          test: rotationActive && !hasExactG69(block),
          message:
            "M19 while coordinate rotation (G68) is still active — cancel with G69 before spindle orientation."
        },
        {
          test: scalingActive && !hasExactG50(block),
          message:
            "M19 while scaling (G51) is still active — cancel with G50 before spindle orientation."
        },
        {
          test: incrementalActive,
          message:
            "M19 while incremental mode (G91) is active — restore G90 before spindle orientation."
        },
        {
          test: coolantActive && !hasCoolantOff(block),
          message:
            "M19 while coolant is still on — turn coolant off with M9 before spindle orientation."
        },
        {
          test: toolLengthActive && !hasExactG49(block),
          message:
            "M19 while tool length compensation (G43) is still active — cancel with G49 before spindle orientation."
        }
      ];
      for (const guard of m19Guards) {
        if (guard.test) {
          issues.push({ severity: "warning", message: guard.message, blockIndex: index });
        }
      }
    }

    if (hasExactFeedMotion(block) && !spindleActive) {
      issues.push({
        severity: "warning",
        message: "G1/G2/G3 while spindle is off — start spindle (M3/M4) before feed motion.",
        blockIndex: index
      });
    }

    if (hasExactFeedMotion(block) && cannedActive && !hasExactG80(block) && !hasCannedCycle(block)) {
      issues.push({
        severity: "warning",
        message:
          "G1/G2/G3 while a canned cycle is still active — cancel with G80 before feed motion.",
        blockIndex: index
      });
    }

    if (
      hasExactFeedMotion(block) &&
      spindleActive &&
      !coolantActive &&
      sawCoolantOnEver &&
      !hasCoolantOn(block)
    ) {
      issues.push({
        severity: "warning",
        message:
          "G1/G2/G3 while coolant is off after coolant was used earlier — turn coolant on (M7/M8) before feed motion.",
        blockIndex: index
      });
    }

    if (hasLetter(block, "S") && !hasSpindleOn(block)) {
      if (cannedActive && !hasExactG80(block)) {
        issues.push({
          severity: "warning",
          message:
            "Spindle speed (S) while a canned cycle is still active — cancel with G80 before changing spindle speed.",
          blockIndex: index
        });
      }
      if (cutterCompActive && !hasExactG40(block)) {
        issues.push({
          severity: "warning",
          message:
            "Spindle speed (S) while cutter compensation (G41/G42) is still active — cancel with G40 before changing spindle speed.",
          blockIndex: index
        });
      }
      if (rotationActive && !hasExactG69(block)) {
        issues.push({
          severity: "warning",
          message:
            "Spindle speed (S) while coordinate rotation (G68) is still active — cancel with G69 before changing spindle speed.",
          blockIndex: index
        });
      }
      if (scalingActive && !hasExactG50(block)) {
        issues.push({
          severity: "warning",
          message:
            "Spindle speed (S) while scaling (G51) is still active — cancel with G50 before changing spindle speed.",
          blockIndex: index
        });
      }
      if (incrementalActive) {
        issues.push({
          severity: "warning",
          message:
            "Spindle speed (S) while incremental mode (G91) is active — restore G90 before changing spindle speed.",
          blockIndex: index
        });
      }
      if (coolantActive && !hasCoolantOff(block)) {
        issues.push({
          severity: "warning",
          message:
            "Spindle speed (S) while coolant is still on — turn coolant off with M9 before changing spindle speed.",
          blockIndex: index
        });
      }
      if (toolLengthActive && !hasExactG49(block)) {
        issues.push({
          severity: "warning",
          message:
            "Spindle speed (S) while tool length compensation (G43) is still active — cancel with G49 before changing spindle speed.",
          blockIndex: index
        });
      }
    }

    if (hasLetter(block, "H") && !hasG43Classic(block)) {
      if (cannedActive && !hasExactG80(block)) {
        issues.push({
          severity: "warning",
          message:
            "H offset word while a canned cycle is still active — cancel with G80 before changing H offsets.",
          blockIndex: index
        });
      }
      if (cutterCompActive && !hasExactG40(block)) {
        issues.push({
          severity: "warning",
          message:
            "H offset word while cutter compensation (G41/G42) is still active — cancel with G40 before changing H offsets.",
          blockIndex: index
        });
      }
      if (rotationActive && !hasExactG69(block)) {
        issues.push({
          severity: "warning",
          message:
            "H offset word while coordinate rotation (G68) is still active — cancel with G69 before changing H offsets.",
          blockIndex: index
        });
      }
      if (scalingActive && !hasExactG50(block)) {
        issues.push({
          severity: "warning",
          message:
            "H offset word while scaling (G51) is still active — cancel with G50 before changing H offsets.",
          blockIndex: index
        });
      }
      if (incrementalActive) {
        issues.push({
          severity: "warning",
          message:
            "H offset word while incremental mode (G91) is active — restore G90 before changing H offsets.",
          blockIndex: index
        });
      }
      if (coolantActive && !hasCoolantOff(block)) {
        issues.push({
          severity: "warning",
          message:
            "H offset word while coolant is still on — turn coolant off with M9 before changing H offsets.",
          blockIndex: index
        });
      }
      if (toolLengthActive && !hasExactG49(block)) {
        issues.push({
          severity: "warning",
          message:
            "H offset word while tool length compensation (G43) is still active — cancel with G49 before changing H offsets.",
          blockIndex: index
        });
      }
    }

    if (hasLetter(block, "D") && !hasExactG41Or42(block)) {
      if (cannedActive && !hasExactG80(block)) {
        issues.push({
          severity: "warning",
          message:
            "D offset word while a canned cycle is still active — cancel with G80 before changing D offsets.",
          blockIndex: index
        });
      }
      if (cutterCompActive && !hasExactG40(block)) {
        issues.push({
          severity: "warning",
          message:
            "D offset word while cutter compensation (G41/G42) is still active — cancel with G40 before changing D offsets.",
          blockIndex: index
        });
      }
      if (rotationActive && !hasExactG69(block)) {
        issues.push({
          severity: "warning",
          message:
            "D offset word while coordinate rotation (G68) is still active — cancel with G69 before changing D offsets.",
          blockIndex: index
        });
      }
      if (scalingActive && !hasExactG50(block)) {
        issues.push({
          severity: "warning",
          message:
            "D offset word while scaling (G51) is still active — cancel with G50 before changing D offsets.",
          blockIndex: index
        });
      }
      if (incrementalActive) {
        issues.push({
          severity: "warning",
          message:
            "D offset word while incremental mode (G91) is active — restore G90 before changing D offsets.",
          blockIndex: index
        });
      }
      if (coolantActive && !hasCoolantOff(block)) {
        issues.push({
          severity: "warning",
          message:
            "D offset word while coolant is still on — turn coolant off with M9 before changing D offsets.",
          blockIndex: index
        });
      }
      if (toolLengthActive && !hasExactG49(block)) {
        issues.push({
          severity: "warning",
          message:
            "D offset word while tool length compensation (G43) is still active — cancel with G49 before changing D offsets.",
          blockIndex: index
        });
      }
    }

    if (hasExactTappingCycle(block) && !spindleActive) {
      issues.push({
        severity: "warning",
        message: "Tapping cycle (G74/G84) while spindle is off — start spindle before tapping.",
        blockIndex: index
      });
    }

    if (hasCannedCycle(block) && !hasExactTappingCycle(block) && !spindleActive) {
      issues.push({
        severity: "warning",
        message:
          "Canned cycle (G73/G76/G81-G83/G85-G89) while spindle is off — start spindle before the cycle.",
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

    if (
      hasExactFeedMotion(block) &&
      isLiteralNegativeAxis(lastWordValue(block, "Z")) &&
      !toolLengthActive
    ) {
      issues.push({
        severity: "warning",
        message:
          "G1/G2/G3 with negative Z while tool length compensation (G43) is inactive — verify tool length before plunging.",
        blockIndex: index
      });
    }

    if (hasWordM(block, 98) && cutterCompActive && !hasExactG40(block)) {
      issues.push({
        severity: "warning",
        message:
          "M98 while cutter compensation (G41/G42) is still active — cancel with G40 before the subprogram call.",
        blockIndex: index
      });
    }

    if (hasWordM(block, 98) && cannedActive && !hasExactG80(block)) {
      issues.push({
        severity: "warning",
        message: "M98 while a canned cycle is still active — cancel with G80 before the subprogram call.",
        blockIndex: index
      });
    }

    if (hasWordM(block, 97) && cutterCompActive && !hasExactG40(block)) {
      issues.push({
        severity: "warning",
        message:
          "M97 while cutter compensation (G41/G42) is still active — cancel with G40 before the local subprogram call.",
        blockIndex: index
      });
    }

    if (hasWordM(block, 97) && cannedActive && !hasExactG80(block)) {
      issues.push({
        severity: "warning",
        message:
          "M97 while a canned cycle is still active — cancel with G80 before the local subprogram call.",
        blockIndex: index
      });
    }

    if (hasWordM(block, 98) && toolLengthActive && !hasExactG49(block)) {
      issues.push({
        severity: "warning",
        message:
          "M98 while tool length compensation (G43) is still active — cancel with G49 before the subprogram call.",
        blockIndex: index
      });
    }

    if (hasWordM(block, 97) && toolLengthActive && !hasExactG49(block)) {
      issues.push({
        severity: "warning",
        message:
          "M97 while tool length compensation (G43) is still active — cancel with G49 before the local subprogram call.",
        blockIndex: index
      });
    }

    if (hasWordM(block, 98) && rotationActive && !hasExactG69(block)) {
      issues.push({
        severity: "warning",
        message:
          "M98 while coordinate rotation (G68) is still active — cancel with G69 before the subprogram call.",
        blockIndex: index
      });
    }

    if (hasWordM(block, 97) && rotationActive && !hasExactG69(block)) {
      issues.push({
        severity: "warning",
        message:
          "M97 while coordinate rotation (G68) is still active — cancel with G69 before the local subprogram call.",
        blockIndex: index
      });
    }

    if (hasWordM(block, 98) && scalingActive && !hasExactG50(block)) {
      issues.push({
        severity: "warning",
        message: "M98 while scaling (G51) is still active — cancel with G50 before the subprogram call.",
        blockIndex: index
      });
    }

    if (hasWordM(block, 97) && scalingActive && !hasExactG50(block)) {
      issues.push({
        severity: "warning",
        message:
          "M97 while scaling (G51) is still active — cancel with G50 before the local subprogram call.",
        blockIndex: index
      });
    }

    if (hasExactG65(block) && cutterCompActive && !hasExactG40(block)) {
      issues.push({
        severity: "warning",
        message:
          "G65 while cutter compensation (G41/G42) is still active — cancel with G40 before the macro call.",
        blockIndex: index
      });
    }

    if (hasExactG65(block) && cannedActive && !hasExactG80(block)) {
      issues.push({
        severity: "warning",
        message: "G65 while a canned cycle is still active — cancel with G80 before the macro call.",
        blockIndex: index
      });
    }

    if (hasExactG65(block) && toolLengthActive && !hasExactG49(block)) {
      issues.push({
        severity: "warning",
        message:
          "G65 while tool length compensation (G43) is still active — cancel with G49 before the macro call.",
        blockIndex: index
      });
    }

    if (hasExactG65(block) && rotationActive && !hasExactG69(block)) {
      issues.push({
        severity: "warning",
        message:
          "G65 while coordinate rotation (G68) is still active — cancel with G69 before the macro call.",
        blockIndex: index
      });
    }

    if (hasExactG65(block) && scalingActive && !hasExactG50(block)) {
      issues.push({
        severity: "warning",
        message: "G65 while scaling (G51) is still active — cancel with G50 before the macro call.",
        blockIndex: index
      });
    }

    if (hasWordM(block, 98) && coolantActive && !hasCoolantOff(block)) {
      issues.push({
        severity: "warning",
        message: "M98 while coolant is still on — turn coolant off with M9 before the subprogram call.",
        blockIndex: index
      });
    }

    if (hasWordM(block, 97) && coolantActive && !hasCoolantOff(block)) {
      issues.push({
        severity: "warning",
        message:
          "M97 while coolant is still on — turn coolant off with M9 before the local subprogram call.",
        blockIndex: index
      });
    }

    if (hasExactG65(block) && coolantActive && !hasCoolantOff(block)) {
      issues.push({
        severity: "warning",
        message: "G65 while coolant is still on — turn coolant off with M9 before the macro call.",
        blockIndex: index
      });
    }

    if (hasWordM(block, 98) && incrementalActive) {
      issues.push({
        severity: "warning",
        message:
          "M98 while incremental mode (G91) is active — restore G90 before the subprogram call.",
        blockIndex: index
      });
    }

    if (hasWordM(block, 97) && incrementalActive) {
      issues.push({
        severity: "warning",
        message:
          "M97 while incremental mode (G91) is active — restore G90 before the local subprogram call.",
        blockIndex: index
      });
    }

    if (hasExactG65(block) && incrementalActive) {
      issues.push({
        severity: "warning",
        message: "G65 while incremental mode (G91) is active — restore G90 before the macro call.",
        blockIndex: index
      });
    }

    if (hasWordM(block, 99) && cutterCompActive && !hasExactG40(block)) {
      issues.push({
        severity: "warning",
        message:
          "M99 while cutter compensation (G41/G42) is still active — cancel with G40 before subprogram return.",
        blockIndex: index
      });
    }

    if (hasWordM(block, 99) && cannedActive && !hasExactG80(block)) {
      issues.push({
        severity: "warning",
        message: "M99 while a canned cycle is still active — cancel with G80 before subprogram return.",
        blockIndex: index
      });
    }

    if (hasWordM(block, 99) && toolLengthActive && !hasExactG49(block)) {
      issues.push({
        severity: "warning",
        message:
          "M99 while tool length compensation (G43) is still active — cancel with G49 before subprogram return.",
        blockIndex: index
      });
    }

    if (hasWordM(block, 99) && rotationActive && !hasExactG69(block)) {
      issues.push({
        severity: "warning",
        message:
          "M99 while coordinate rotation (G68) is still active — cancel with G69 before subprogram return.",
        blockIndex: index
      });
    }

    if (hasWordM(block, 99) && scalingActive && !hasExactG50(block)) {
      issues.push({
        severity: "warning",
        message: "M99 while scaling (G51) is still active — cancel with G50 before subprogram return.",
        blockIndex: index
      });
    }

    if (hasWordM(block, 99) && coolantActive && !hasCoolantOff(block)) {
      issues.push({
        severity: "warning",
        message: "M99 while coolant is still on — turn coolant off with M9 before subprogram return.",
        blockIndex: index
      });
    }

    if (hasWordM(block, 99) && incrementalActive) {
      issues.push({
        severity: "warning",
        message:
          "M99 while incremental mode (G91) is active — restore G90 before subprogram return.",
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

    if (hasExactG65(block) && hasWordM(block, 98)) {
      issues.push({
        severity: "warning",
        message: "G65 and M98 on the same block — pick one call style (macro or subprogram).",
        blockIndex: index
      });
    }

    if (hasExactG65(block) && hasWordM(block, 97)) {
      issues.push({
        severity: "warning",
        message: "G65 and M97 on the same block — pick one call style (macro or local subprogram).",
        blockIndex: index
      });
    }

    if (hasExactG65(block) && hasWordM(block, 99)) {
      issues.push({
        severity: "warning",
        message: "G65 and M99 on the same block — macro call and return conflict.",
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

    if (hasExactG92(block)) {
      sawG92Shift = true;
      issues.push({
        severity: "warning",
        message:
          "G92 coordinate system shift is uncommon and risky on mill programs — prefer work offsets (G54-G59).",
        blockIndex: index
      });
      if (cutterCompActive && !hasExactG40(block)) {
        issues.push({
          severity: "warning",
          message:
            "G92 while cutter compensation (G41/G42) is still active — cancel with G40 before shifting coordinates.",
          blockIndex: index
        });
      }
      if (cannedActive && !hasExactG80(block)) {
        issues.push({
          severity: "warning",
          message: "G92 while a canned cycle is still active — cancel with G80 before shifting coordinates.",
          blockIndex: index
        });
      }
      if (rotationActive && !hasExactG69(block)) {
        issues.push({
          severity: "warning",
          message:
            "G92 while coordinate rotation (G68) is still active — cancel with G69 before shifting coordinates.",
          blockIndex: index
        });
      }
      if (scalingActive && !hasExactG50(block)) {
        issues.push({
          severity: "warning",
          message: "G92 while scaling (G51) is still active — cancel with G50 before shifting coordinates.",
          blockIndex: index
        });
      }
      if (toolLengthActive && !hasExactG49(block)) {
        issues.push({
          severity: "warning",
          message:
            "G92 while tool length compensation (G43) is still active — cancel with G49 before shifting coordinates.",
          blockIndex: index
        });
      }
      if (coolantActive && !hasCoolantOff(block)) {
        issues.push({
          severity: "warning",
          message: "G92 while coolant is still on — turn coolant off with M9 before shifting coordinates.",
          blockIndex: index
        });
      }
      if (incrementalActive) {
        issues.push({
          severity: "warning",
          message: "G92 while incremental mode (G91) is active — restore G90 before shifting coordinates.",
          blockIndex: index
        });
      }
    }

    if (hasExactG52(block)) {
      issues.push({
        severity: "warning",
        message:
          "G52 local coordinate offset — verify intentional use; prefer work offsets (G54-G59) when possible.",
        blockIndex: index
      });
      if (cutterCompActive && !hasExactG40(block)) {
        issues.push({
          severity: "warning",
          message:
            "G52 while cutter compensation (G41/G42) is still active — cancel with G40 before a local offset.",
          blockIndex: index
        });
      }
      if (cannedActive && !hasExactG80(block)) {
        issues.push({
          severity: "warning",
          message: "G52 while a canned cycle is still active — cancel with G80 before a local offset.",
          blockIndex: index
        });
      }
      if (rotationActive && !hasExactG69(block)) {
        issues.push({
          severity: "warning",
          message:
            "G52 while coordinate rotation (G68) is still active — cancel with G69 before a local offset.",
          blockIndex: index
        });
      }
      if (scalingActive && !hasExactG50(block)) {
        issues.push({
          severity: "warning",
          message: "G52 while scaling (G51) is still active — cancel with G50 before a local offset.",
          blockIndex: index
        });
      }
      if (toolLengthActive && !hasExactG49(block)) {
        issues.push({
          severity: "warning",
          message:
            "G52 while tool length compensation (G43) is still active — cancel with G49 before a local offset.",
          blockIndex: index
        });
      }
      if (coolantActive && !hasCoolantOff(block)) {
        issues.push({
          severity: "warning",
          message: "G52 while coolant is still on — turn coolant off with M9 before a local offset.",
          blockIndex: index
        });
      }
      if (incrementalActive) {
        issues.push({
          severity: "warning",
          message: "G52 while incremental mode (G91) is active — restore G90 before a local offset.",
          blockIndex: index
        });
      }
      const g52Axes = (["X", "Y", "Z"] as const).filter((letter) => hasLetter(block, letter));
      if (g52Axes.length === 0 || g52Axes.every((letter) => isZeroOffsetWord(lastWordValue(block, letter)))) {
        g52LocalActive = false;
      } else if (g52Axes.some((letter) => !isZeroOffsetWord(lastWordValue(block, letter)))) {
        g52LocalActive = true;
      }
    }

    if (hasExactG4(block) && !hasLetter(block, "P") && !hasLetter(block, "X")) {
      issues.push({
        severity: "warning",
        message: "G4 dwell without P or X — specify dwell time explicitly.",
        blockIndex: index
      });
    }

    if (
      hasExactG4(block) &&
      (isZeroOffsetWord(lastWordValue(block, "P")) || isZeroOffsetWord(lastWordValue(block, "X")))
    ) {
      issues.push({
        severity: "warning",
        message: "G4 dwell with zero time (P0/X0) — verify intentional zero dwell.",
        blockIndex: index
      });
    }

    if (hasExactG4(block) && (hasExactG0(block) || hasExactFeedMotion(block))) {
      issues.push({
        severity: "warning",
        message: "G4 dwell and axis motion on the same block — dwell and move separately.",
        blockIndex: index
      });
    }

    if (hasExactG4(block) && cutterCompActive && !hasExactG40(block)) {
      issues.push({
        severity: "warning",
        message:
          "G4 while cutter compensation (G41/G42) is still active — cancel with G40 before dwell.",
        blockIndex: index
      });
    }

    if (hasExactG4(block) && cannedActive && !hasExactG80(block)) {
      issues.push({
        severity: "warning",
        message: "G4 while a canned cycle is still active — cancel with G80 before dwell.",
        blockIndex: index
      });
    }

    if (hasExactG4(block) && toolLengthActive && !hasExactG49(block)) {
      issues.push({
        severity: "warning",
        message:
          "G4 while tool length compensation (G43) is still active — cancel with G49 before dwell.",
        blockIndex: index
      });
    }

    if (hasExactG4(block) && rotationActive && !hasExactG69(block)) {
      issues.push({
        severity: "warning",
        message:
          "G4 while coordinate rotation (G68) is still active — cancel with G69 before dwell.",
        blockIndex: index
      });
    }

    if (hasExactG4(block) && scalingActive && !hasExactG50(block)) {
      issues.push({
        severity: "warning",
        message: "G4 while scaling (G51) is still active — cancel with G50 before dwell.",
        blockIndex: index
      });
    }

    if (hasExactG4(block) && coolantActive && !hasCoolantOff(block)) {
      issues.push({
        severity: "warning",
        message: "G4 while coolant is still on — turn coolant off with M9 before dwell.",
        blockIndex: index
      });
    }

    if (hasExactG4(block) && incrementalActive) {
      issues.push({
        severity: "warning",
        message: "G4 while incremental mode (G91) is active — restore G90 before dwell.",
        blockIndex: index
      });
    }

    if (hasExactG28(block) && hasExactG30(block)) {
      issues.push({
        severity: "warning",
        message: "G28 and G30 on the same block — pick one reference-return command.",
        blockIndex: index
      });
    }

    if (hasExactG28(block) && hasExactG53(block)) {
      issues.push({
        severity: "warning",
        message: "G28 and G53 on the same block — pick one machine-positioning style.",
        blockIndex: index
      });
    }

    if (hasExactG30(block) && hasExactG53(block)) {
      issues.push({
        severity: "warning",
        message: "G30 and G53 on the same block — pick one machine-positioning style.",
        blockIndex: index
      });
    }

    if (hasExactG53(block) && axisWordCount(block) === 0) {
      issues.push({
        severity: "warning",
        message: "G53 without an axis word — specify a machine-coordinate move (e.g. G53 Z0).",
        blockIndex: index
      });
    }

    if (hasExactG53(block) && axisWordCount(block) > 1) {
      issues.push({
        severity: "warning",
        message:
          "G53 with multiple axes on one block — prefer single-axis G53 moves for safer machine positioning.",
        blockIndex: index
      });
    }

    if (hasExactG28(block) && !incrementalActive) {
      issues.push({
        severity: "warning",
        message:
          "G28 while absolute mode (G90) is active — use G91 with G28 intermediate points, then restore G90.",
        blockIndex: index
      });
    }

    if (hasExactG30(block) && !incrementalActive) {
      issues.push({
        severity: "warning",
        message:
          "G30 while absolute mode (G90) is active — use G91 with G30 intermediate points, then restore G90.",
        blockIndex: index
      });
    }

    if (hasExactG28(block) && axisWordCount(block) === 0) {
      issues.push({
        severity: "warning",
        message: "G28 without an axis word — specify an intermediate point (e.g. G91 G28 Z0).",
        blockIndex: index
      });
    }

    if (hasExactG30(block) && axisWordCount(block) === 0) {
      issues.push({
        severity: "warning",
        message: "G30 without an axis word — specify an intermediate point (e.g. G91 G30 Z0).",
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

    if (hasExactG28(block) && cutterCompActive && !hasExactG40(block)) {
      issues.push({
        severity: "warning",
        message:
          "G28 while cutter compensation (G41/G42) is still active — cancel with G40 before reference return.",
        blockIndex: index
      });
    }

    if (hasExactG28(block) && cannedActive && !hasExactG80(block)) {
      issues.push({
        severity: "warning",
        message: "G28 while a canned cycle is still active — cancel with G80 before reference return.",
        blockIndex: index
      });
    }

    if (hasExactG28(block) && toolLengthActive && !hasExactG49(block)) {
      issues.push({
        severity: "warning",
        message:
          "G28 while tool length compensation (G43) is still active — cancel with G49 before reference return.",
        blockIndex: index
      });
    }

    if (hasExactG53(block) && cutterCompActive && !hasExactG40(block)) {
      issues.push({
        severity: "warning",
        message:
          "G53 while cutter compensation (G41/G42) is still active — cancel with G40 before machine move.",
        blockIndex: index
      });
    }

    if (hasExactG53(block) && cannedActive && !hasExactG80(block)) {
      issues.push({
        severity: "warning",
        message: "G53 while a canned cycle is still active — cancel with G80 before machine move.",
        blockIndex: index
      });
    }

    if (hasExactG53(block) && toolLengthActive && !hasExactG49(block)) {
      issues.push({
        severity: "warning",
        message:
          "G53 while tool length compensation (G43) is still active — cancel with G49 before machine move.",
        blockIndex: index
      });
    }

    if (hasExactG30(block) && cutterCompActive && !hasExactG40(block)) {
      issues.push({
        severity: "warning",
        message:
          "G30 while cutter compensation (G41/G42) is still active — cancel with G40 before secondary reference return.",
        blockIndex: index
      });
    }

    if (hasExactG30(block) && cannedActive && !hasExactG80(block)) {
      issues.push({
        severity: "warning",
        message:
          "G30 while a canned cycle is still active — cancel with G80 before secondary reference return.",
        blockIndex: index
      });
    }

    if (hasExactG30(block) && toolLengthActive && !hasExactG49(block)) {
      issues.push({
        severity: "warning",
        message:
          "G30 while tool length compensation (G43) is still active — cancel with G49 before secondary reference return.",
        blockIndex: index
      });
    }

    if (hasExactG28(block) && coolantActive && !hasCoolantOff(block)) {
      issues.push({
        severity: "warning",
        message: "G28 while coolant is still on — turn coolant off with M9 before reference return.",
        blockIndex: index
      });
    }

    if (hasExactG30(block) && coolantActive && !hasCoolantOff(block)) {
      issues.push({
        severity: "warning",
        message:
          "G30 while coolant is still on — turn coolant off with M9 before secondary reference return.",
        blockIndex: index
      });
    }

    if (hasExactG53(block) && coolantActive && !hasCoolantOff(block)) {
      issues.push({
        severity: "warning",
        message: "G53 while coolant is still on — turn coolant off with M9 before machine move.",
        blockIndex: index
      });
    }

    if (hasExactG28(block) && rotationActive && !hasExactG69(block)) {
      issues.push({
        severity: "warning",
        message:
          "G28 while coordinate rotation (G68) is still active — cancel with G69 before reference return.",
        blockIndex: index
      });
    }

    if (hasExactG53(block) && rotationActive && !hasExactG69(block)) {
      issues.push({
        severity: "warning",
        message:
          "G53 while coordinate rotation (G68) is still active — cancel with G69 before machine move.",
        blockIndex: index
      });
    }

    if (hasExactG28(block) && scalingActive && !hasExactG50(block)) {
      issues.push({
        severity: "warning",
        message: "G28 while scaling (G51) is still active — cancel with G50 before reference return.",
        blockIndex: index
      });
    }

    if (hasExactG53(block) && scalingActive && !hasExactG50(block)) {
      issues.push({
        severity: "warning",
        message: "G53 while scaling (G51) is still active — cancel with G50 before machine move.",
        blockIndex: index
      });
    }

    if (hasExactG30(block) && rotationActive && !hasExactG69(block)) {
      issues.push({
        severity: "warning",
        message:
          "G30 while coordinate rotation (G68) is still active — cancel with G69 before secondary reference return.",
        blockIndex: index
      });
    }

    if (hasExactG30(block) && scalingActive && !hasExactG50(block)) {
      issues.push({
        severity: "warning",
        message:
          "G30 while scaling (G51) is still active — cancel with G50 before secondary reference return.",
        blockIndex: index
      });
    }

    issues.push(...collectSameBlockMatrixIssues(block, index));

    if (hasExactG92(block) && hasExactG52(block)) {
      issues.push({
        severity: "warning",
        message: "G92 and G52 on the same block — pick one coordinate-shift style.",
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

    if (hasExactG41Or42(block) && !toolLengthActive) {
      issues.push({
        severity: "warning",
        message:
          "G41/G42 while tool length compensation (G43) is inactive — apply G43 before cutter compensation.",
        blockIndex: index
      });
    }

    if (hasExactG41Or42(block) && isZeroOffsetWord(lastWordValue(block, "D"))) {
      issues.push({
        severity: "warning",
        message: "G41/G42 with D0 — cutter comp offset zero is usually invalid.",
        blockIndex: index
      });
    }

    if (hasExactG41Or42(block)) {
      if (cannedActive && !hasExactG80(block)) {
        issues.push({
          severity: "warning",
          message: "G41/G42 while a canned cycle is still active — cancel with G80 before cutter compensation.",
          blockIndex: index
        });
      }
      if (rotationActive && !hasExactG69(block)) {
        issues.push({
          severity: "warning",
          message:
            "G41/G42 while coordinate rotation (G68) is still active — cancel with G69 before cutter compensation.",
          blockIndex: index
        });
      }
      if (scalingActive && !hasExactG50(block)) {
        issues.push({
          severity: "warning",
          message: "G41/G42 while scaling (G51) is still active — cancel with G50 before cutter compensation.",
          blockIndex: index
        });
      }
      if (incrementalActive) {
        issues.push({
          severity: "warning",
          message: "G41/G42 while incremental mode (G91) is active — restore G90 before cutter compensation.",
          blockIndex: index
        });
      }
      if (coolantActive && !hasCoolantOff(block)) {
        issues.push({
          severity: "warning",
          message: "G41/G42 while coolant is still on — turn coolant off with M9 before cutter compensation.",
          blockIndex: index
        });
      }
    }

    if (hasLetter(block, "D")) {
      sawAnyDOffset = true;
    }

    const hasG40 = hasExactG40(block);
    if (hasG40 && hasExactG41Or42(block)) {
      issues.push({
        severity: "warning",
        message: "G40 and G41/G42 on the same block — cancel or apply cutter compensation, not both.",
        blockIndex: index
      });
    }
    if (hasBothG41AndG42(block)) {
      issues.push({
        severity: "warning",
        message: "G41 and G42 on the same block — pick one cutter compensation side.",
        blockIndex: index
      });
    }
    if (hasG40) {
      if (toolLengthActive && !hasExactG49(block)) {
        issues.push({
          severity: "warning",
          message:
            "G40 while tool length compensation (G43) is still active — cancel with G49 before canceling cutter compensation.",
          blockIndex: index
        });
      }
      if (cannedActive && !hasExactG80(block)) {
        issues.push({
          severity: "warning",
          message: "G40 while a canned cycle is still active — cancel with G80 before canceling cutter compensation.",
          blockIndex: index
        });
      }
      if (rotationActive && !hasExactG69(block)) {
        issues.push({
          severity: "warning",
          message:
            "G40 while coordinate rotation (G68) is still active — cancel with G69 before canceling cutter compensation.",
          blockIndex: index
        });
      }
      if (scalingActive && !hasExactG50(block)) {
        issues.push({
          severity: "warning",
          message: "G40 while scaling (G51) is still active — cancel with G50 before canceling cutter compensation.",
          blockIndex: index
        });
      }
      if (coolantActive && !hasCoolantOff(block)) {
        issues.push({
          severity: "warning",
          message: "G40 while coolant is still on — turn coolant off with M9 before canceling cutter compensation.",
          blockIndex: index
        });
      }
      if (incrementalActive) {
        issues.push({
          severity: "warning",
          message:
            "G40 while incremental mode (G91) is active — restore G90 before canceling cutter compensation.",
          blockIndex: index
        });
      }
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

    if (hasExactG0(block) && cannedActive && !hasExactG80(block)) {
      issues.push({
        severity: "warning",
        message: "G0 rapid while a canned cycle is still active — cancel with G80 before rapid moves.",
        blockIndex: index
      });
    }

    if (hasExactG0(block) && rotationActive && !hasExactG69(block)) {
      issues.push({
        severity: "warning",
        message:
          "G0 rapid while coordinate rotation (G68) is still active — cancel with G69 before rapid moves.",
        blockIndex: index
      });
    }

    if (hasExactG0(block) && scalingActive && !hasExactG50(block)) {
      issues.push({
        severity: "warning",
        message: "G0 rapid while scaling (G51) is still active — cancel with G50 before rapid moves.",
        blockIndex: index
      });
    }

    if (hasExactG0(block) && toolLengthActive && !hasExactG49(block)) {
      issues.push({
        severity: "warning",
        message:
          "G0 rapid while tool length compensation (G43) is still active — cancel with G49 before rapid moves.",
        blockIndex: index
      });
    }

    if (hasExactG0(block) && coolantActive && !hasCoolantOff(block)) {
      issues.push({
        severity: "warning",
        message: "G0 rapid while coolant is still on — turn coolant off with M9 before rapid moves.",
        blockIndex: index
      });
    }

    if (hasExactG0(block) && incrementalActive) {
      issues.push({
        severity: "warning",
        message:
          "G0 rapid while incremental mode (G91) is active — restore G90 before rapid moves.",
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
      if (isLiteralNegativeAxis(lastWordValue(block, "F"))) {
        issues.push({
          severity: "warning",
          message: "Negative feed rate (F) — feed cannot be negative.",
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

    if (hasExactG80(block) && hasCannedCycle(block)) {
      issues.push({
        severity: "warning",
        message: "G80 and a canned cycle on the same block — cancel or start a cycle, not both.",
        blockIndex: index
      });
    }

    if (hasExactG80(block)) {
      if (toolLengthActive && !hasExactG49(block)) {
        issues.push({
          severity: "warning",
          message:
            "G80 while tool length compensation (G43) is still active — cancel with G49 before canceling the canned cycle.",
          blockIndex: index
        });
      }
      if (cutterCompActive && !hasExactG40(block)) {
        issues.push({
          severity: "warning",
          message:
            "G80 while cutter compensation (G41/G42) is still active — cancel with G40 before canceling the canned cycle.",
          blockIndex: index
        });
      }
      if (rotationActive && !hasExactG69(block)) {
        issues.push({
          severity: "warning",
          message:
            "G80 while coordinate rotation (G68) is still active — cancel with G69 before canceling the canned cycle.",
          blockIndex: index
        });
      }
      if (scalingActive && !hasExactG50(block)) {
        issues.push({
          severity: "warning",
          message: "G80 while scaling (G51) is still active — cancel with G50 before canceling the canned cycle.",
          blockIndex: index
        });
      }
      if (incrementalActive) {
        issues.push({
          severity: "warning",
          message: "G80 while incremental mode (G91) is active — restore G90 before canceling the canned cycle.",
          blockIndex: index
        });
      }
      if (coolantActive && !hasCoolantOff(block)) {
        issues.push({
          severity: "warning",
          message: "G80 while coolant is still on — turn coolant off with M9 before canceling the canned cycle.",
          blockIndex: index
        });
      }
      cannedActive = false;
      cannedHasZ = false;
      cannedHasR = false;
    }

    if (hasCannedCycle(block)) {
      if (toolLengthActive && !hasExactG49(block)) {
        issues.push({
          severity: "warning",
          message:
            "Canned cycle while tool length compensation (G43) is still active — cancel with G49 before the cycle.",
          blockIndex: index
        });
      }
      if (coolantActive && !hasCoolantOff(block)) {
        issues.push({
          severity: "warning",
          message:
            "Canned cycle while coolant is still on — turn coolant off with M9 before the cycle.",
          blockIndex: index
        });
      }
      if (cutterCompActive && !hasExactG40(block)) {
        issues.push({
          severity: "warning",
          message:
            "Canned cycle while cutter compensation (G41/G42) is still active — cancel with G40 before the cycle.",
          blockIndex: index
        });
      }
      if (rotationActive && !hasExactG69(block)) {
        issues.push({
          severity: "warning",
          message:
            "Canned cycle while coordinate rotation (G68) is still active — cancel with G69 before the cycle.",
          blockIndex: index
        });
      }
      if (scalingActive && !hasExactG50(block)) {
        issues.push({
          severity: "warning",
          message: "Canned cycle while scaling (G51) is still active — cancel with G50 before the cycle.",
          blockIndex: index
        });
      }
      if (incrementalActive) {
        issues.push({
          severity: "warning",
          message: "Canned cycle while incremental mode (G91) is active — restore G90 before the cycle.",
          blockIndex: index
        });
      }
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

    if (hasExactG68(block) && hasExactG69(block)) {
      issues.push({
        severity: "warning",
        message: "G68 and G69 on the same block — cancel or apply coordinate rotation, not both.",
        blockIndex: index
      });
    }

    if (hasExactG68(block)) {
      if (cutterCompActive && !hasExactG40(block)) {
        issues.push({
          severity: "warning",
          message:
            "G68 while cutter compensation (G41/G42) is still active — cancel with G40 before coordinate rotation.",
          blockIndex: index
        });
      }
      if (cannedActive && !hasExactG80(block)) {
        issues.push({
          severity: "warning",
          message: "G68 while a canned cycle is still active — cancel with G80 before coordinate rotation.",
          blockIndex: index
        });
      }
      if (toolLengthActive && !hasExactG49(block)) {
        issues.push({
          severity: "warning",
          message:
            "G68 while tool length compensation (G43) is still active — cancel with G49 before coordinate rotation.",
          blockIndex: index
        });
      }
      if (scalingActive && !hasExactG50(block)) {
        issues.push({
          severity: "warning",
          message: "G68 while scaling (G51) is still active — cancel with G50 before coordinate rotation.",
          blockIndex: index
        });
      }
      if (coolantActive && !hasCoolantOff(block)) {
        issues.push({
          severity: "warning",
          message: "G68 while coolant is still on — turn coolant off with M9 before coordinate rotation.",
          blockIndex: index
        });
      }
      if (incrementalActive) {
        issues.push({
          severity: "warning",
          message: "G68 while incremental mode (G91) is active — restore G90 before coordinate rotation.",
          blockIndex: index
        });
      }
      rotationActive = true;
    }
    if (hasExactG69(block)) {
      if (cutterCompActive && !hasExactG40(block)) {
        issues.push({
          severity: "warning",
          message:
            "G69 while cutter compensation (G41/G42) is still active — cancel with G40 before canceling coordinate rotation.",
          blockIndex: index
        });
      }
      if (cannedActive && !hasExactG80(block)) {
        issues.push({
          severity: "warning",
          message:
            "G69 while a canned cycle is still active — cancel with G80 before canceling coordinate rotation.",
          blockIndex: index
        });
      }
      if (toolLengthActive && !hasExactG49(block)) {
        issues.push({
          severity: "warning",
          message:
            "G69 while tool length compensation (G43) is still active — cancel with G49 before canceling coordinate rotation.",
          blockIndex: index
        });
      }
      if (scalingActive && !hasExactG50(block)) {
        issues.push({
          severity: "warning",
          message: "G69 while scaling (G51) is still active — cancel with G50 before canceling coordinate rotation.",
          blockIndex: index
        });
      }
      if (coolantActive && !hasCoolantOff(block)) {
        issues.push({
          severity: "warning",
          message: "G69 while coolant is still on — turn coolant off with M9 before canceling coordinate rotation.",
          blockIndex: index
        });
      }
      if (incrementalActive) {
        issues.push({
          severity: "warning",
          message:
            "G69 while incremental mode (G91) is active — restore G90 before canceling coordinate rotation.",
          blockIndex: index
        });
      }
      rotationActive = false;
    }

    if (hasExactG51(block) && hasExactG50(block)) {
      issues.push({
        severity: "warning",
        message: "G51 and G50 on the same block — cancel or apply scaling, not both.",
        blockIndex: index
      });
    }

    if (hasExactG51(block)) {
      if (cutterCompActive && !hasExactG40(block)) {
        issues.push({
          severity: "warning",
          message:
            "G51 while cutter compensation (G41/G42) is still active — cancel with G40 before scaling.",
          blockIndex: index
        });
      }
      if (cannedActive && !hasExactG80(block)) {
        issues.push({
          severity: "warning",
          message: "G51 while a canned cycle is still active — cancel with G80 before scaling.",
          blockIndex: index
        });
      }
      if (toolLengthActive && !hasExactG49(block)) {
        issues.push({
          severity: "warning",
          message:
            "G51 while tool length compensation (G43) is still active — cancel with G49 before scaling.",
          blockIndex: index
        });
      }
      if (rotationActive && !hasExactG69(block)) {
        issues.push({
          severity: "warning",
          message:
            "G51 while coordinate rotation (G68) is still active — cancel with G69 before scaling.",
          blockIndex: index
        });
      }
      if (coolantActive && !hasCoolantOff(block)) {
        issues.push({
          severity: "warning",
          message: "G51 while coolant is still on — turn coolant off with M9 before scaling.",
          blockIndex: index
        });
      }
      if (incrementalActive) {
        issues.push({
          severity: "warning",
          message: "G51 while incremental mode (G91) is active — restore G90 before scaling.",
          blockIndex: index
        });
      }
      scalingActive = true;
    }
    if (hasExactG50(block)) {
      if (cutterCompActive && !hasExactG40(block)) {
        issues.push({
          severity: "warning",
          message:
            "G50 while cutter compensation (G41/G42) is still active — cancel with G40 before canceling scaling.",
          blockIndex: index
        });
      }
      if (cannedActive && !hasExactG80(block)) {
        issues.push({
          severity: "warning",
          message: "G50 while a canned cycle is still active — cancel with G80 before canceling scaling.",
          blockIndex: index
        });
      }
      if (toolLengthActive && !hasExactG49(block)) {
        issues.push({
          severity: "warning",
          message:
            "G50 while tool length compensation (G43) is still active — cancel with G49 before canceling scaling.",
          blockIndex: index
        });
      }
      if (rotationActive && !hasExactG69(block)) {
        issues.push({
          severity: "warning",
          message:
            "G50 while coordinate rotation (G68) is still active — cancel with G69 before canceling scaling.",
          blockIndex: index
        });
      }
      if (coolantActive && !hasCoolantOff(block)) {
        issues.push({
          severity: "warning",
          message: "G50 while coolant is still on — turn coolant off with M9 before canceling scaling.",
          blockIndex: index
        });
      }
      if (incrementalActive) {
        issues.push({
          severity: "warning",
          message: "G50 while incremental mode (G91) is active — restore G90 before canceling scaling.",
          blockIndex: index
        });
      }
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

    if (hasExactG93(block) && firstG93Block < 0) firstG93Block = index;
    const feedMode = hasExactG94Or95(block);
    if (feedMode === 94 && firstG94Block < 0) firstG94Block = index;
    if (feedMode === 95 && firstG95Block < 0) firstG95Block = index;

    const pathMode = hasExactG61Or64(block);
    if (pathMode === 61 && firstG61Block < 0) firstG61Block = index;
    if (pathMode === 64 && firstG64Block < 0) firstG64Block = index;

    if (block.words.some((w) => w.letter === "O")) {
      sawProgramO = true;
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

  if (firstG93Block >= 0 && firstG94Block >= 0) {
    issues.push({
      severity: "warning",
      message: "Program contains both G93 and G94 — pick one feed mode (inverse-time or per-minute).",
      blockIndex: Math.min(firstG93Block, firstG94Block)
    });
  }

  if (firstG93Block >= 0 && firstG95Block >= 0) {
    issues.push({
      severity: "warning",
      message:
        "Program contains both G93 and G95 — pick one feed mode (inverse-time or per-revolution).",
      blockIndex: Math.min(firstG93Block, firstG95Block)
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
