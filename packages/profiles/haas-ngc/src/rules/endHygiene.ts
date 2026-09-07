import type { LintIssue, ProgramAst } from "@cnc/core";
import { hasWordM } from "./millHelpers.js";
import { walkMillModalStateAfter } from "./millModalState.js";

const END_HYGIENE_CODES = [
  "haas.cutter-comp-active-at-end",
  "haas.g43-active-at-end",
  "haas.spindle-on-at-end",
  "haas.coolant-on-at-end",
  "haas.g91-active-at-end",
  "haas.non-xy-plane-at-end",
  "haas.canned-active-at-end",
  "haas.g68-active-at-end",
  "haas.g51-active-at-end",
  "haas.feed-mode-active-at-end",
  "haas.path-mode-active-at-end",
  "haas.g52-active-at-end",
  "haas.g92-used-at-end",
  "haas.g10-used-at-end",
  "haas.g93-active-at-end",
  "haas.m19-orient-at-end",
  "haas.m88-active-at-end"
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

export function lintHaasEndHygiene(
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
      pushIfEnabled(issues, disabled, "haas.cutter-comp-active-at-end", {
        severity: "warning",
        message:
          "Program ends with cutter compensation (G41/G42) still active — cancel with G40 before end.",
        blockIndex: index
      });
    }

    if (ctx.toolLengthActive) {
      pushIfEnabled(issues, disabled, "haas.g43-active-at-end", {
        severity: "warning",
        message:
          "Program ends with tool length compensation (G43) still active — cancel with G49 before end.",
        blockIndex: index
      });
    }

    if (ctx.spindleActive) {
      pushIfEnabled(issues, disabled, "haas.spindle-on-at-end", {
        severity: "warning",
        message: "Program ends with spindle still on — stop spindle with M5 before end.",
        blockIndex: index
      });
    }

    if (ctx.coolantActive) {
      pushIfEnabled(issues, disabled, "haas.coolant-on-at-end", {
        severity: "warning",
        message: "Program ends with coolant still on — turn coolant off with M9 before end.",
        blockIndex: index
      });
    }

    if (ctx.incrementalActive) {
      pushIfEnabled(issues, disabled, "haas.g91-active-at-end", {
        severity: "warning",
        message: "Program ends in incremental mode (G91) — restore G90 before end.",
        blockIndex: index
      });
    }

    if (ctx.activePlane === 18 || ctx.activePlane === 19) {
      pushIfEnabled(issues, disabled, "haas.non-xy-plane-at-end", {
        severity: "warning",
        message: `Program ends in G${ctx.activePlane} plane — restore G17 (XY) before end for mill programs.`,
        blockIndex: index
      });
    }

    if (ctx.cannedActive) {
      pushIfEnabled(issues, disabled, "haas.canned-active-at-end", {
        severity: "warning",
        message: "Program ends with a canned cycle still active — cancel with G80 before end.",
        blockIndex: index
      });
    }

    if (ctx.rotationActive) {
      pushIfEnabled(issues, disabled, "haas.g68-active-at-end", {
        severity: "warning",
        message:
          "Program ends with coordinate rotation (G68) still active — cancel with G69 before end.",
        blockIndex: index
      });
    }

    if (ctx.scalingActive) {
      pushIfEnabled(issues, disabled, "haas.g51-active-at-end", {
        severity: "warning",
        message: "Program ends with scaling (G51) still active — cancel with G50 before end.",
        blockIndex: index
      });
    }

    if (ctx.activeFeedMode === 95) {
      pushIfEnabled(issues, disabled, "haas.feed-mode-active-at-end", {
        severity: "warning",
        message: "Program ends in feed per revolution (G95) — restore G94 before end.",
        blockIndex: index
      });
    }

    if (ctx.activeFeedMode === 93) {
      pushIfEnabled(issues, disabled, "haas.g93-active-at-end", {
        severity: "warning",
        message: "Program ends in inverse-time feed mode (G93) — restore G94 before end.",
        blockIndex: index
      });
    }

    if (ctx.spindleOrientActive) {
      pushIfEnabled(issues, disabled, "haas.m19-orient-at-end", {
        severity: "warning",
        message: "Program ends with spindle orientation (M19) still latched — clear with M3, M4, or M5 before end.",
        blockIndex: index
      });
    }

    if (ctx.throughSpindleCoolantActive) {
      pushIfEnabled(issues, disabled, "haas.m88-active-at-end", {
        severity: "warning",
        message: "Program ends with through-spindle coolant (M88) still active — turn it off with M89 before end.",
        blockIndex: index
      });
    }

    if (ctx.activePathMode === 61) {
      pushIfEnabled(issues, disabled, "haas.path-mode-active-at-end", {
        severity: "warning",
        message: "Program ends in exact stop mode (G61) — restore G64 before end.",
        blockIndex: index
      });
    }

    if (ctx.g52LocalActive) {
      pushIfEnabled(issues, disabled, "haas.g52-active-at-end", {
        severity: "warning",
        message:
          "Program ends with G52 local offset still applied — cancel with G52 X0 Y0 Z0 before end.",
        blockIndex: index
      });
    }

    if (ctx.sawG92Shift) {
      pushIfEnabled(issues, disabled, "haas.g92-used-at-end", {
        severity: "warning",
        message:
          "Program ends after G92 was used — verify the coordinate system is restored before end.",
        blockIndex: index
      });
    }

    if (ctx.sawG10DataSetting) {
      pushIfEnabled(issues, disabled, "haas.g10-used-at-end", {
        severity: "warning",
        message:
          "Program ends after G10 data setting — verify offsets/registers are intentional before end.",
        blockIndex: index
      });
    }
  });

  return issues;
}
