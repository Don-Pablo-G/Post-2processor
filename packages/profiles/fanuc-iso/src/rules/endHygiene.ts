import type { LintIssue, ProgramAst } from "@cnc/core";
import { hasWordM } from "./millHelpers.js";
import { walkMillModalStateAfter } from "./millModalState.js";

const END_HYGIENE_CODES = [
  "fanuc.cutter-comp-active-at-end",
  "fanuc.g43-active-at-end",
  "fanuc.spindle-on-at-end",
  "fanuc.coolant-on-at-end",
  "fanuc.g91-active-at-end",
  "fanuc.canned-active-at-end",
  "fanuc.g68-active-at-end",
  "fanuc.g51-active-at-end"
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

export function lintFanucEndHygiene(
  ast: ProgramAst,
  options?: { disabledRuleIds?: ReadonlySet<string> }
): LintIssue[] {
  const disabled = options?.disabledRuleIds;
  if (familyDisabled(disabled, END_HYGIENE_CODES)) return [];

  const issues: LintIssue[] = [];

  walkMillModalStateAfter(ast, (ctx) => {
    if (!ctx.isLast) return;
    const { block, index } = ctx;
    if (!hasWordM(block, 2) && !hasWordM(block, 30)) return;

    if (ctx.cutterCompActive) {
      pushIfEnabled(issues, disabled, "fanuc.cutter-comp-active-at-end", {
        severity: "warning",
        message:
          "Program ends with cutter compensation (G41/G42) still active — cancel with G40 before end.",
        blockIndex: index
      });
    }

    if (ctx.toolLengthActive) {
      pushIfEnabled(issues, disabled, "fanuc.g43-active-at-end", {
        severity: "warning",
        message:
          "Program ends with tool length compensation (G43) still active — cancel with G49 before end.",
        blockIndex: index
      });
    }

    if (ctx.spindleActive) {
      pushIfEnabled(issues, disabled, "fanuc.spindle-on-at-end", {
        severity: "warning",
        message: "Program ends with spindle still on — stop spindle with M5 before end.",
        blockIndex: index
      });
    }

    if (ctx.coolantActive) {
      pushIfEnabled(issues, disabled, "fanuc.coolant-on-at-end", {
        severity: "warning",
        message: "Program ends with coolant still on — turn coolant off with M9 before end.",
        blockIndex: index
      });
    }

    if (ctx.incrementalActive) {
      pushIfEnabled(issues, disabled, "fanuc.g91-active-at-end", {
        severity: "warning",
        message: "Program ends in incremental mode (G91) — restore G90 before end.",
        blockIndex: index
      });
    }

    if (ctx.cannedActive) {
      pushIfEnabled(issues, disabled, "fanuc.canned-active-at-end", {
        severity: "warning",
        message: "Program ends with a canned cycle still active — cancel with G80 before end.",
        blockIndex: index
      });
    }

    if (ctx.rotationActive) {
      pushIfEnabled(issues, disabled, "fanuc.g68-active-at-end", {
        severity: "warning",
        message:
          "Program ends with coordinate rotation (G68) still active — cancel with G69 before end.",
        blockIndex: index
      });
    }

    if (ctx.scalingActive) {
      pushIfEnabled(issues, disabled, "fanuc.g51-active-at-end", {
        severity: "warning",
        message: "Program ends with scaling (G51) still active — cancel with G50 before end.",
        blockIndex: index
      });
    }
  });

  return issues;
}
