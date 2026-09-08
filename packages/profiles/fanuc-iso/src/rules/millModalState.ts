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
  hasExactG68,
  hasExactG69,
  hasExactG80,
  hasExactG90Or91,
  hasSpindleOff,
  hasSpindleOn
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
};

type MillModalState = Omit<MillModalBlockContext, "block" | "index" | "isLast">;

function snapshot(state: MillModalState): MillModalState {
  return { ...state };
}

function applyEarlyUpdates(state: MillModalState, block: Block): void {
  if (hasSpindleOn(block)) {
    state.spindleActive = true;
  }
  if (hasSpindleOff(block)) {
    state.spindleActive = false;
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
}

function applyLateUpdates(state: MillModalState, block: Block): void {
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

function initialState(): MillModalState {
  return {
    cutterCompActive: false,
    cannedActive: false,
    rotationActive: false,
    scalingActive: false,
    incrementalActive: false,
    coolantActive: false,
    toolLengthActive: false,
    spindleActive: false
  };
}

export function walkMillModalState(
  ast: ProgramAst,
  onBlock: (ctx: MillModalBlockContext) => void
): void {
  const state = initialState();
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

export function walkMillModalStateAfter(
  ast: ProgramAst,
  onBlock: (ctx: MillModalBlockContext) => void
): void {
  const state = initialState();
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
