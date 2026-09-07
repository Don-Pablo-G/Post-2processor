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

const Q_WHILE_CODES = [
  "haas.q-while-cutter-comp",
  "haas.q-while-canned",
  "haas.q-while-rotation",
  "haas.q-while-scaling",
  "haas.q-while-incremental",
  "haas.q-while-coolant-on"
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
  if (skipQ && skipR && skipP && skipIjk) return [];

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
