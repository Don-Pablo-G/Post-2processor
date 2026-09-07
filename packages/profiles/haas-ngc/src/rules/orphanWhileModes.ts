import type { LintIssue, Word } from "@cnc/core";
import {
  hasCannedCycle,
  hasCoolantOff,
  hasExactG40,
  hasExactG49,
  hasExactG50,
  hasExactG65,
  hasExactG69,
  hasExactG80,
  hasWordM
} from "./millHelpers.js";
import type { MillModalBlockContext } from "./millModalState.js";

export type OrphanWhileModeDef = {
  idSuffix: string;
  /** True when the modal condition applies at check time. */
  isActive: (ctx: MillModalBlockContext) => boolean;
  /** True when this block clears the modal (skip the warning). */
  isClearedOnBlock: (block: { words: Word[] }) => boolean;
  /** Imperative phrase after the em dash, e.g. "cancel with G40 before …". */
  remedy: string;
};

/**
 * Shared modal conditions for orphan letter×while-state rules.
 * Letter families (L/Q/R/…) supply wording; modes stay table-driven.
 */
export const ORPHAN_WHILE_MODES: readonly OrphanWhileModeDef[] = [
  {
    idSuffix: "cutter-comp",
    isActive: (ctx) => ctx.cutterCompActive,
    isClearedOnBlock: hasExactG40,
    remedy: "cancel with G40"
  },
  {
    idSuffix: "canned",
    isActive: (ctx) => ctx.cannedActive,
    isClearedOnBlock: (block) => hasExactG80(block) || hasCannedCycle(block),
    remedy: "cancel with G80"
  },
  {
    idSuffix: "rotation",
    isActive: (ctx) => ctx.rotationActive,
    isClearedOnBlock: hasExactG69,
    remedy: "cancel with G69"
  },
  {
    idSuffix: "scaling",
    isActive: (ctx) => ctx.scalingActive,
    isClearedOnBlock: hasExactG50,
    remedy: "cancel with G50"
  },
  {
    idSuffix: "incremental",
    isActive: (ctx) => ctx.incrementalActive,
    isClearedOnBlock: () => false,
    remedy: "restore G90"
  },
  {
    idSuffix: "coolant-on",
    isActive: (ctx) => ctx.coolantActive,
    isClearedOnBlock: hasCoolantOff,
    remedy: "turn coolant off with M9"
  },
  {
    idSuffix: "tool-length",
    isActive: (ctx) => ctx.toolLengthActive,
    isClearedOnBlock: hasExactG49,
    remedy: "cancel with G49"
  }
];

export function orphanWhileModeCodes(letterPrefix: string): string[] {
  return ORPHAN_WHILE_MODES.map((m) => `haas.${letterPrefix}-while-${m.idSuffix}`);
}

export function pushOrphanWhileModes(
  issues: LintIssue[],
  disabled: ReadonlySet<string> | undefined,
  options: {
    letterPrefix: string;
    wordLabel: string;
    contextHint: string;
    ctx: MillModalBlockContext;
    /** Restrict to a subset of mode suffixes (default: all). */
    modeSuffixes?: readonly string[];
  }
): void {
  const allowed =
    options.modeSuffixes === undefined
      ? undefined
      : new Set(options.modeSuffixes);
  for (const mode of ORPHAN_WHILE_MODES) {
    if (allowed && !allowed.has(mode.idSuffix)) continue;
    if (!mode.isActive(options.ctx)) continue;
    if (mode.isClearedOnBlock(options.ctx.block)) continue;
    const code = `haas.${options.letterPrefix}-while-${mode.idSuffix}`;
    if (disabled?.has(code)) continue;
    const activePhrase =
      mode.idSuffix === "cutter-comp"
        ? "cutter compensation (G41/G42) is still active"
        : mode.idSuffix === "canned"
          ? "a canned cycle is still active"
          : mode.idSuffix === "rotation"
            ? "coordinate rotation (G68) is still active"
            : mode.idSuffix === "scaling"
              ? "scaling (G51) is still active"
              : mode.idSuffix === "incremental"
                ? "incremental mode (G91) is active"
                : mode.idSuffix === "coolant-on"
                  ? "coolant is still on"
                  : "tool length compensation (G43) is still active";
    issues.push({
      severity: "warning",
      code,
      message: `${options.wordLabel} while ${activePhrase} — ${mode.remedy} before using ${options.wordLabel} ${options.contextHint}.`,
      blockIndex: options.ctx.index
    });
  }
}

/** L is legitimate on M98 (repeat), G65 macros, and G10 data setting. */
export function hasLWordContext(block: { words: Word[] }): boolean {
  return (
    hasWordM(block, 98) ||
    hasExactG65(block) ||
    block.words.some((w) => w.letter === "G" && Number.parseFloat(w.value) === 10)
  );
}
