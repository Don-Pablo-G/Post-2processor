import type { LintIssue, ProgramAst } from "@cnc/core";
import { collectFanucSameBlockConflictIssues } from "./sameBlockConflicts.js";
import {
  hasExactFeedMotion,
  hasExactG40,
  hasExactG43,
  hasExactG49,
  hasExactG80,
  hasExactTappingCycle,
  hasLetter,
  hasWordM
} from "./rules/millHelpers.js";
import { lintFanucEndHygiene } from "./rules/endHygiene.js";
import { walkMillModalState } from "./rules/millModalState.js";
import { FANUC_MILL_DIALECT } from "./millDialect.js";

function push(
  issues: LintIssue[],
  code: string,
  message: string,
  blockIndex: number
): void {
  issues.push({ severity: "warning", code, message, blockIndex });
}

export function lintFanucIsoMillLint(ast: ProgramAst): LintIssue[] {
  const issues: LintIssue[] = [];
  let sawFeedRate = false;

  walkMillModalState(ast, (ctx) => {
    const { block, index } = ctx;

    if (hasWordM(block, 6) && !hasLetter(block, "T")) {
      push(
        issues,
        "fanuc.m6-without-t",
        "M6 without T on the same block — pair tool change with Tn.",
        index
      );
    }

    if (hasExactG43(block) && !hasLetter(block, "H")) {
      push(
        issues,
        "fanuc.g43-without-h",
        "G43 without H on the same block — tool length requires H.",
        index
      );
    }

    if (hasExactFeedMotion(block) && !hasLetter(block, "F") && !sawFeedRate) {
      push(
        issues,
        "fanuc.g1-without-f",
        "G1/G2/G3 without F and no prior F in the program — set feed explicitly on the block or earlier.",
        index
      );
    }

    if (hasExactFeedMotion(block) && !ctx.spindleActive) {
      push(
        issues,
        "fanuc.feed-while-spindle-off",
        "G1/G2/G3 while spindle is off — start spindle (M3/M4) before feed motion.",
        index
      );
    }

    if (hasExactTappingCycle(block) && !ctx.spindleActive) {
      push(
        issues,
        "fanuc.tapping-while-spindle-off",
        "Tapping cycle (G74/G84) while spindle is off — start spindle before tapping.",
        index
      );
    }

    if (hasWordM(block, 6) && ctx.cutterCompActive && !hasExactG40(block)) {
      push(
        issues,
        "fanuc.m6-while-cutter-comp",
        "M6 while cutter compensation (G41/G42) is still active — cancel with G40 before a tool change.",
        index
      );
    }

    if (hasWordM(block, 6) && ctx.toolLengthActive && !hasExactG49(block)) {
      push(
        issues,
        "fanuc.m6-while-tool-length",
        "M6 while tool length compensation (G43) is still active — cancel with G49 before a tool change.",
        index
      );
    }

    if (hasWordM(block, 6) && ctx.coolantActive && !hasWordM(block, 9)) {
      push(
        issues,
        "fanuc.m6-while-coolant-on",
        "M6 while coolant is still on — turn coolant off with M9 before a tool change.",
        index
      );
    }

    if (FANUC_MILL_DIALECT.warnOnM97 && hasWordM(block, 97)) {
      push(
        issues,
        "fanuc.m97-unsupported",
        "M97 local subprogram call is not standard Fanuc ISO — use M98/G65 instead.",
        index
      );
    }

    issues.push(...collectFanucSameBlockConflictIssues(block, index));

    if (hasLetter(block, "F")) {
      sawFeedRate = true;
    }
  });

  issues.push(...lintFanucEndHygiene(ast));

  return issues;
}
