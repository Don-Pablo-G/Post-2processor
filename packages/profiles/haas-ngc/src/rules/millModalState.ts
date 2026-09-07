import type { Block, ProgramAst } from "@cnc/core";
import {
  hasCannedCycle,
  hasCoolantOff,
  hasCoolantOn,
  hasExactG40,
  hasExactG41Or42,
  hasExactG43,
  hasExactG49,
  hasExactG50,
  hasExactG51,
  hasExactG52,
  hasExactG61Or64,
  hasExactG68,
  hasExactG69,
  hasExactG80,
  hasExactG90Or91,
  hasExactG92,
  hasExactG93Or94Or95,
  hasExactPlane,
  hasLetter,
  hasSpindleOff,
  hasSpindleOn,
  hasWordM,
  isZeroOffsetWord,
  lastWordValue
} from "./millHelpers.js";

export type MillModalBlockContext = {
  block: Block;
  index: number;
  isLast: boolean;
  // prior-block / active-at-check-time flags:
  cutterCompActive: boolean;
  cannedActive: boolean;
  rotationActive: boolean;
  scalingActive: boolean;
  incrementalActive: boolean;
  coolantActive: boolean;
  toolLengthActive: boolean;
  spindleActive: boolean;
  spindleOrientActive: boolean;
  throughSpindleCoolantActive: boolean;
  activePlane: 17 | 18 | 19 | undefined;
  activeFeedMode: 93 | 94 | 95 | undefined;
  activePathMode: 61 | 64 | undefined;
  g52LocalActive: boolean;
  sawG92Shift: boolean;
  sawG10DataSetting: boolean;
};

type MillModalState = {
  cutterCompActive: boolean;
  cannedActive: boolean;
  rotationActive: boolean;
  scalingActive: boolean;
  incrementalActive: boolean;
  coolantActive: boolean;
  toolLengthActive: boolean;
  spindleActive: boolean;
  spindleOrientActive: boolean;
  throughSpindleCoolantActive: boolean;
  activePlane: 17 | 18 | 19 | undefined;
  activeFeedMode: 93 | 94 | 95 | undefined;
  activePathMode: 61 | 64 | undefined;
  g52LocalActive: boolean;
  sawG92Shift: boolean;
  sawG10DataSetting: boolean;
};

function snapshot(state: MillModalState): Omit<MillModalBlockContext, "block" | "index" | "isLast"> {
  return { ...state };
}

/**
 * Early updates that happen in ngcMillLint *before* the Q/R/P/IJK while-checks.
 * Callback sees this post-early / pre-late state (matches orphan-word timing).
 */
function applyEarlyUpdates(state: MillModalState, block: Block): void {
  if (hasWordM(block, 19)) {
    state.spindleOrientActive = true;
  }
  if (hasSpindleOn(block)) {
    state.spindleActive = true;
    state.spindleOrientActive = false;
  }
  if (hasSpindleOff(block)) {
    state.spindleActive = false;
    state.spindleOrientActive = false;
  }
  if (hasWordM(block, 88)) {
    state.throughSpindleCoolantActive = true;
  }
  if (hasWordM(block, 89) || hasCoolantOff(block)) {
    state.throughSpindleCoolantActive = false;
  }
  if (hasCoolantOn(block)) {
    state.coolantActive = true;
  }
  if (hasCoolantOff(block)) {
    state.coolantActive = false;
  }
  if (hasExactG43(block)) {
    state.toolLengthActive = true;
  }
  if (hasExactG49(block)) {
    state.toolLengthActive = false;
  }
  const distanceMode = hasExactG90Or91(block);
  if (distanceMode !== undefined) {
    state.incrementalActive = distanceMode === 91;
  }
  const plane = hasExactPlane(block);
  if (plane !== undefined) {
    state.activePlane = plane;
  }
  const feedMode = hasExactG93Or94Or95(block);
  if (feedMode !== undefined) {
    state.activeFeedMode = feedMode;
  }
  const pathMode = hasExactG61Or64(block);
  if (pathMode !== undefined) {
    state.activePathMode = pathMode;
  }
}

/**
 * Late updates that happen in ngcMillLint *after* the Q/R/P/IJK while-checks
 * (and before program-end hygiene).
 */
function applyLateUpdates(state: MillModalState, block: Block): void {
  if (hasExactG92(block)) {
    state.sawG92Shift = true;
  }
  if (block.words.some((w) => w.letter === "G" && Number.parseFloat(w.value) === 10)) {
    state.sawG10DataSetting = true;
  }
  if (hasExactG52(block)) {
    const g52Axes = (["X", "Y", "Z"] as const).filter((letter) => hasLetter(block, letter));
    if (g52Axes.length === 0 || g52Axes.every((letter) => isZeroOffsetWord(lastWordValue(block, letter)))) {
      state.g52LocalActive = false;
    } else if (g52Axes.some((letter) => !isZeroOffsetWord(lastWordValue(block, letter)))) {
      state.g52LocalActive = true;
    }
  }
  if (hasExactG40(block)) {
    state.cutterCompActive = false;
  }
  if (hasExactG41Or42(block)) {
    state.cutterCompActive = true;
  }
  if (hasExactG80(block)) {
    state.cannedActive = false;
  }
  if (hasCannedCycle(block)) {
    state.cannedActive = true;
  }
  if (hasExactG68(block)) {
    state.rotationActive = true;
  }
  if (hasExactG69(block)) {
    state.rotationActive = false;
  }
  if (hasExactG51(block)) {
    state.scalingActive = true;
  }
  if (hasExactG50(block)) {
    state.scalingActive = false;
  }
}

/**
 * Walk blocks while maintaining modal flags needed by orphan-word-while and
 * end-hygiene. Callback receives active-at-check-time state (after early
 * same-block updates, before late cutter/canned/rotation/scaling/G52/G92
 * updates) — matching ngcMillLint's Q/R/P/IJK while-check timing.
 *
 * Late updates run after the callback so the next block (and end-hygiene
 * consumers that re-walk with post-late state) see the correct carry-forward.
 */
export function walkMillModalState(
  ast: ProgramAst,
  onBlock: (ctx: MillModalBlockContext) => void
): void {
  const state: MillModalState = {
    cutterCompActive: false,
    cannedActive: false,
    rotationActive: false,
    scalingActive: false,
    incrementalActive: false,
    coolantActive: false,
    toolLengthActive: false,
    spindleActive: false,
    spindleOrientActive: false,
    throughSpindleCoolantActive: false,
    activePlane: undefined,
    activeFeedMode: undefined,
    activePathMode: undefined,
    g52LocalActive: false,
    sawG92Shift: false,
    sawG10DataSetting: false
  };

  const lastIndex = ast.blocks.length - 1;
  ast.blocks.forEach((block, index) => {
    applyEarlyUpdates(state, block);
    onBlock({
      block,
      index,
      isLast: index === lastIndex,
      ...snapshot(state)
    });
    applyLateUpdates(state, block);
  });
}

/**
 * Like walkMillModalState, but the callback sees state *after* both early and
 * late updates for the block (matches program-end hygiene timing).
 */
export function walkMillModalStateAfter(
  ast: ProgramAst,
  onBlock: (ctx: MillModalBlockContext) => void
): void {
  const state: MillModalState = {
    cutterCompActive: false,
    cannedActive: false,
    rotationActive: false,
    scalingActive: false,
    incrementalActive: false,
    coolantActive: false,
    toolLengthActive: false,
    spindleActive: false,
    spindleOrientActive: false,
    throughSpindleCoolantActive: false,
    activePlane: undefined,
    activeFeedMode: undefined,
    activePathMode: undefined,
    g52LocalActive: false,
    sawG92Shift: false,
    sawG10DataSetting: false
  };

  const lastIndex = ast.blocks.length - 1;
  ast.blocks.forEach((block, index) => {
    applyEarlyUpdates(state, block);
    applyLateUpdates(state, block);
    onBlock({
      block,
      index,
      isLast: index === lastIndex,
      ...snapshot(state)
    });
  });
}
