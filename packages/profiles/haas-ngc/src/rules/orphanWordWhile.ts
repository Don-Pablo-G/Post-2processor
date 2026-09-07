import type { LintIssue, ProgramAst } from "@cnc/core";
import {
  hasCannedCycle,
  hasCoolantOff,
  hasExactG40,
  hasExactG49,
  hasExactG50,
  hasExactG69,
  hasExactG80,
  hasExactPeckCycle,
  hasIjkWord,
  hasIjkWordContext,
  hasLetter,
  hasPWordContext,
  hasRWordContext
} from "./millHelpers.js";
import { walkMillModalState } from "./millModalState.js";
import {
  hasLWordContext,
  hasRotaryWordContext,
  orphanWhileModeCodes,
  pushOrphanWhileModes
} from "./orphanWhileModes.js";

const Q_WHILE_CODES = [
  "haas.q-while-cutter-comp",
  "haas.q-while-canned",
  "haas.q-while-rotation",
  "haas.q-while-scaling",
  "haas.q-while-incremental",
  "haas.q-while-coolant-on",
  "haas.q-while-tool-length"
] as const;

const R_WHILE_CODES = [
  "haas.r-while-cutter-comp",
  "haas.r-while-rotation",
  "haas.r-while-scaling",
  "haas.r-while-incremental",
  "haas.r-while-coolant-on",
  "haas.r-while-tool-length"
] as const;

const P_WHILE_CODES = [
  "haas.p-while-cutter-comp",
  "haas.p-while-rotation",
  "haas.p-while-scaling",
  "haas.p-while-tool-length",
  "haas.p-while-incremental",
  "haas.p-while-coolant-on"
] as const;

const IJK_WHILE_CODES = [
  "haas.ijk-while-cutter-comp",
  "haas.ijk-while-rotation",
  "haas.ijk-while-scaling",
  "haas.ijk-while-incremental",
  "haas.ijk-while-coolant-on",
  "haas.ijk-while-tool-length",
  "haas.ijk-while-canned"
] as const;

const L_WHILE_CODES = orphanWhileModeCodes("l");

const ROTARY_ORPHAN_FAMILIES = [
  { letter: "A", prefix: "a", modes: ["cutter-comp", "canned", "rotation"] },
  { letter: "B", prefix: "b", modes: ["cutter-comp", "canned"] },
  { letter: "C", prefix: "c", modes: ["cutter-comp", "canned"] }
] as const;

const ROTARY_WHILE_CODES = ROTARY_ORPHAN_FAMILIES.flatMap(({ prefix, modes }) =>
  modes.map((mode) => `haas.${prefix}-while-${mode}`)
);

function familyDisabled(disabled: ReadonlySet<string> | undefined, codes: readonly string[]): boolean {
  if (!disabled || disabled.size === 0) return false;
  return codes.every((code) => disabled.has(code));
}

function pushIfEnabled(
  issues: LintIssue[],
  disabled: ReadonlySet<string> | undefined,
  code: string,
  issue: Omit<LintIssue, "code">
): void {
  if (disabled?.has(code)) return;
  issues.push({ ...issue, code });
}

export function lintHaasOrphanWordWhile(
  ast: ProgramAst,
  options?: { disabledRuleIds?: ReadonlySet<string> }
): LintIssue[] {
  const disabled = options?.disabledRuleIds;
  const skipQ = familyDisabled(disabled, Q_WHILE_CODES);
  const skipR = familyDisabled(disabled, R_WHILE_CODES);
  const skipP = familyDisabled(disabled, P_WHILE_CODES);
  const skipIjk = familyDisabled(disabled, IJK_WHILE_CODES);
  const skipL = familyDisabled(disabled, L_WHILE_CODES);
  const skipRotary = familyDisabled(disabled, ROTARY_WHILE_CODES);
  if (skipQ && skipR && skipP && skipIjk && skipL && skipRotary) return [];

  const issues: LintIssue[] = [];

  walkMillModalState(ast, (ctx) => {
    const {
      block,
      index,
      cutterCompActive,
      cannedActive,
      rotationActive,
      scalingActive,
      incrementalActive,
      coolantActive,
      toolLengthActive
    } = ctx;

    if (!skipL && hasLetter(block, "L") && !hasLWordContext(block)) {
      pushOrphanWhileModes(issues, disabled, {
        letterPrefix: "l",
        wordLabel: "L word",
        contextHint: "outside M98/G65/G10 context",
        ctx
      });
    }

    if (!skipRotary && !hasRotaryWordContext(block)) {
      for (const family of ROTARY_ORPHAN_FAMILIES) {
        if (!hasLetter(block, family.letter)) continue;
        pushOrphanWhileModes(issues, disabled, {
          letterPrefix: family.prefix,
          wordLabel: `${family.letter} rotary word`,
          contextHint: "outside explicit G0/G1/G2/G3 or canned-cycle motion",
          ctx,
          modeSuffixes: family.modes
        });
      }
    }

    if (!skipQ && hasLetter(block, "Q") && !hasExactPeckCycle(block)) {
      if (cutterCompActive && !hasExactG40(block)) {
        pushIfEnabled(issues, disabled, "haas.q-while-cutter-comp", {
          severity: "warning",
          message:
            "Q word while cutter compensation (G41/G42) is still active — cancel with G40 before using Q outside a peck cycle.",
          blockIndex: index
        });
      }
      if (cannedActive && !hasExactG80(block) && !hasCannedCycle(block)) {
        pushIfEnabled(issues, disabled, "haas.q-while-canned", {
          severity: "warning",
          message:
            "Q word while a canned cycle is still active — cancel with G80 before using Q outside a peck cycle.",
          blockIndex: index
        });
      }
      if (rotationActive && !hasExactG69(block)) {
        pushIfEnabled(issues, disabled, "haas.q-while-rotation", {
          severity: "warning",
          message:
            "Q word while coordinate rotation (G68) is still active — cancel with G69 before using Q outside a peck cycle.",
          blockIndex: index
        });
      }
      if (scalingActive && !hasExactG50(block)) {
        pushIfEnabled(issues, disabled, "haas.q-while-scaling", {
          severity: "warning",
          message:
            "Q word while scaling (G51) is still active — cancel with G50 before using Q outside a peck cycle.",
          blockIndex: index
        });
      }
      if (incrementalActive) {
        pushIfEnabled(issues, disabled, "haas.q-while-incremental", {
          severity: "warning",
          message:
            "Q word while incremental mode (G91) is active — restore G90 before using Q outside a peck cycle.",
          blockIndex: index
        });
      }
      if (coolantActive && !hasCoolantOff(block)) {
        pushIfEnabled(issues, disabled, "haas.q-while-coolant-on", {
          severity: "warning",
          message:
            "Q word while coolant is still on — turn coolant off with M9 before using Q outside a peck cycle.",
          blockIndex: index
        });
      }
      pushOrphanWhileModes(issues, disabled, {
        letterPrefix: "q",
        wordLabel: "Q word",
        contextHint: "outside a peck cycle",
        ctx,
        modeSuffixes: ["tool-length"]
      });
    }

    if (!skipR && hasLetter(block, "R") && !hasRWordContext(block)) {
      if (cutterCompActive && !hasExactG40(block)) {
        pushIfEnabled(issues, disabled, "haas.r-while-cutter-comp", {
          severity: "warning",
          message:
            "R word while cutter compensation (G41/G42) is still active — cancel with G40 before using R outside canned/arc/rotation context.",
          blockIndex: index
        });
      }
      if (rotationActive && !hasExactG69(block)) {
        pushIfEnabled(issues, disabled, "haas.r-while-rotation", {
          severity: "warning",
          message:
            "R word while coordinate rotation (G68) is still active — cancel with G69 before using R outside canned/arc/rotation context.",
          blockIndex: index
        });
      }
      if (scalingActive && !hasExactG50(block)) {
        pushIfEnabled(issues, disabled, "haas.r-while-scaling", {
          severity: "warning",
          message:
            "R word while scaling (G51) is still active — cancel with G50 before using R outside canned/arc/rotation context.",
          blockIndex: index
        });
      }
      if (incrementalActive) {
        pushIfEnabled(issues, disabled, "haas.r-while-incremental", {
          severity: "warning",
          message:
            "R word while incremental mode (G91) is active — restore G90 before using R outside canned/arc/rotation context.",
          blockIndex: index
        });
      }
      if (coolantActive && !hasCoolantOff(block)) {
        pushIfEnabled(issues, disabled, "haas.r-while-coolant-on", {
          severity: "warning",
          message:
            "R word while coolant is still on — turn coolant off with M9 before using R outside canned/arc/rotation context.",
          blockIndex: index
        });
      }
      if (toolLengthActive && !hasExactG49(block)) {
        pushIfEnabled(issues, disabled, "haas.r-while-tool-length", {
          severity: "warning",
          message:
            "R word while tool length compensation (G43) is still active — cancel with G49 before using R outside canned/arc/rotation context.",
          blockIndex: index
        });
      }
    }

    if (!skipP && hasLetter(block, "P") && !hasPWordContext(block)) {
      if (cutterCompActive && !hasExactG40(block)) {
        pushIfEnabled(issues, disabled, "haas.p-while-cutter-comp", {
          severity: "warning",
          message:
            "P word while cutter compensation (G41/G42) is still active — cancel with G40 before using P outside call/dwell/scaling/canned context.",
          blockIndex: index
        });
      }
      if (rotationActive && !hasExactG69(block)) {
        pushIfEnabled(issues, disabled, "haas.p-while-rotation", {
          severity: "warning",
          message:
            "P word while coordinate rotation (G68) is still active — cancel with G69 before using P outside call/dwell/scaling/canned context.",
          blockIndex: index
        });
      }
      if (scalingActive && !hasExactG50(block)) {
        pushIfEnabled(issues, disabled, "haas.p-while-scaling", {
          severity: "warning",
          message:
            "P word while scaling (G51) is still active — cancel with G50 before using P outside call/dwell/scaling/canned context.",
          blockIndex: index
        });
      }
      if (toolLengthActive && !hasExactG49(block)) {
        pushIfEnabled(issues, disabled, "haas.p-while-tool-length", {
          severity: "warning",
          message:
            "P word while tool length compensation (G43) is still active — cancel with G49 before using P outside call/dwell/scaling/canned context.",
          blockIndex: index
        });
      }
      if (incrementalActive) {
        pushIfEnabled(issues, disabled, "haas.p-while-incremental", {
          severity: "warning",
          message:
            "P word while incremental mode (G91) is active — restore G90 before using P outside call/dwell/scaling/canned context.",
          blockIndex: index
        });
      }
      if (coolantActive && !hasCoolantOff(block)) {
        pushIfEnabled(issues, disabled, "haas.p-while-coolant-on", {
          severity: "warning",
          message:
            "P word while coolant is still on — turn coolant off with M9 before using P outside call/dwell/scaling/canned context.",
          blockIndex: index
        });
      }
    }

    if (!skipIjk && hasIjkWord(block) && !hasIjkWordContext(block)) {
      if (cutterCompActive && !hasExactG40(block)) {
        pushIfEnabled(issues, disabled, "haas.ijk-while-cutter-comp", {
          severity: "warning",
          message:
            "I/J/K word while cutter compensation (G41/G42) is still active — cancel with G40 before using I/J/K outside arc context.",
          blockIndex: index
        });
      }
      if (rotationActive && !hasExactG69(block)) {
        pushIfEnabled(issues, disabled, "haas.ijk-while-rotation", {
          severity: "warning",
          message:
            "I/J/K word while coordinate rotation (G68) is still active — cancel with G69 before using I/J/K outside arc context.",
          blockIndex: index
        });
      }
      if (scalingActive && !hasExactG50(block)) {
        pushIfEnabled(issues, disabled, "haas.ijk-while-scaling", {
          severity: "warning",
          message:
            "I/J/K word while scaling (G51) is still active — cancel with G50 before using I/J/K outside arc context.",
          blockIndex: index
        });
      }
      if (incrementalActive) {
        pushIfEnabled(issues, disabled, "haas.ijk-while-incremental", {
          severity: "warning",
          message:
            "I/J/K word while incremental mode (G91) is active — restore G90 before using I/J/K outside arc context.",
          blockIndex: index
        });
      }
      if (coolantActive && !hasCoolantOff(block)) {
        pushIfEnabled(issues, disabled, "haas.ijk-while-coolant-on", {
          severity: "warning",
          message:
            "I/J/K word while coolant is still on — turn coolant off with M9 before using I/J/K outside arc context.",
          blockIndex: index
        });
      }
      if (toolLengthActive && !hasExactG49(block)) {
        pushIfEnabled(issues, disabled, "haas.ijk-while-tool-length", {
          severity: "warning",
          message:
            "I/J/K word while tool length compensation (G43) is still active — cancel with G49 before using I/J/K outside arc context.",
          blockIndex: index
        });
      }
      if (cannedActive && !hasExactG80(block) && !hasCannedCycle(block)) {
        pushIfEnabled(issues, disabled, "haas.ijk-while-canned", {
          severity: "warning",
          message:
            "I/J/K word while a canned cycle is still active — cancel with G80 before using I/J/K outside arc context.",
          blockIndex: index
        });
      }
    }
  });

  return issues;
}
