import type { LintIssue, ProgramAst } from "@cnc/core";
import { collectFanucSameBlockConflictIssues } from "./sameBlockConflicts.js";
import {
  hasCannedCycle,
  hasExactFeedMotion,
  hasExactG0,
  hasExactG28,
  hasExactG30,
  hasExactG40,
  hasExactG43,
  hasExactG49,
  hasExactG50,
  hasExactG53,
  hasExactG65,
  hasExactG69,
  hasExactG80,
  hasExactG90Or91,
  hasExactTappingCycle,
  hasCoolantOff,
  hasCoolantOn,
  hasLetter,
  hasSpindleOff,
  hasSpindleOn,
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

const STOP_GUARDS = [
  { m: 0, label: "M00", kind: "program stop", codePrefix: "fanuc.m00" },
  { m: 1, label: "M01", kind: "optional stop", codePrefix: "fanuc.m01" },
  { m: 2, label: "M02", kind: "program end", codePrefix: "fanuc.m02" },
  { m: 30, label: "M30", kind: "program end", codePrefix: "fanuc.m30" }
] as const;

export function lintFanucIsoMillLint(ast: ProgramAst): LintIssue[] {
  const issues: LintIssue[] = [];
  let sawFeedRate = false;
  let sawSpindleOn = false;
  let cannedHasZ = false;
  let cannedHasR = false;

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

    for (const stop of STOP_GUARDS) {
      if (!hasWordM(block, stop.m)) continue;

      if (ctx.coolantActive && !hasCoolantOff(block) && !hasCoolantOn(block)) {
        push(
          issues,
          `${stop.codePrefix}-while-coolant-on`,
          `${stop.label} while coolant is still on — turn coolant off with M9 before ${stop.kind}.`,
          index
        );
      }
      if (ctx.cutterCompActive && !hasExactG40(block)) {
        push(
          issues,
          `${stop.codePrefix}-while-cutter-comp`,
          `${stop.label} while cutter compensation (G41/G42) is still active — cancel with G40 before ${stop.kind}.`,
          index
        );
      }
      if (ctx.cannedActive && !hasExactG80(block)) {
        push(
          issues,
          `${stop.codePrefix}-while-canned`,
          `${stop.label} while a canned cycle is still active — cancel with G80 before ${stop.kind}.`,
          index
        );
      }
      if (ctx.toolLengthActive && !hasExactG49(block)) {
        push(
          issues,
          `${stop.codePrefix}-while-tool-length`,
          `${stop.label} while tool length compensation (G43) is still active — cancel with G49 before ${stop.kind}.`,
          index
        );
      }
      if (ctx.rotationActive && !hasExactG69(block)) {
        push(
          issues,
          `${stop.codePrefix}-while-rotation`,
          `${stop.label} while coordinate rotation (G68) is still active — cancel with G69 before ${stop.kind}.`,
          index
        );
      }
      if (ctx.scalingActive && !hasExactG50(block)) {
        push(
          issues,
          `${stop.codePrefix}-while-scaling`,
          `${stop.label} while scaling (G51) is still active — cancel with G50 before ${stop.kind}.`,
          index
        );
      }
      if (ctx.incrementalActive && hasExactG90Or91(block) !== 90) {
        push(
          issues,
          `${stop.codePrefix}-while-incremental`,
          `${stop.label} while incremental mode (G91) is active — restore G90 before ${stop.kind}.`,
          index
        );
      }
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

    if (hasWordM(block, 6) && ctx.rotationActive && !hasExactG69(block)) {
      push(
        issues,
        "fanuc.m6-while-rotation",
        "M6 while coordinate rotation (G68) is still active — cancel with G69 before a tool change.",
        index
      );
    }

    if (hasWordM(block, 6) && ctx.scalingActive && !hasExactG50(block)) {
      push(
        issues,
        "fanuc.m6-while-scaling",
        "M6 while scaling (G51) is still active — cancel with G50 before a tool change.",
        index
      );
    }

    if (hasExactG28(block) && ctx.cutterCompActive && !hasExactG40(block)) {
      push(
        issues,
        "fanuc.g28-while-cutter-comp",
        "G28 while cutter compensation (G41/G42) is still active — cancel with G40 before reference return.",
        index
      );
    }

    if (hasExactG28(block) && ctx.cannedActive && !hasExactG80(block)) {
      push(
        issues,
        "fanuc.g28-while-canned",
        "G28 while a canned cycle is still active — cancel with G80 before reference return.",
        index
      );
    }

    if (hasExactG28(block) && ctx.toolLengthActive && !hasExactG49(block)) {
      push(
        issues,
        "fanuc.g28-while-tool-length",
        "G28 while tool length compensation (G43) is still active — cancel with G49 before reference return.",
        index
      );
    }

    if (hasExactG28(block) && ctx.rotationActive && !hasExactG69(block)) {
      push(
        issues,
        "fanuc.g28-while-rotation",
        "G28 while coordinate rotation (G68) is still active — cancel with G69 before reference return.",
        index
      );
    }

    if (hasExactG28(block) && ctx.scalingActive && !hasExactG50(block)) {
      push(
        issues,
        "fanuc.g28-while-scaling",
        "G28 while scaling (G51) is still active — cancel with G50 before reference return.",
        index
      );
    }

    if (hasExactG30(block) && ctx.cutterCompActive && !hasExactG40(block)) {
      push(
        issues,
        "fanuc.g30-while-cutter-comp",
        "G30 while cutter compensation (G41/G42) is still active — cancel with G40 before secondary reference return.",
        index
      );
    }

    if (hasExactG30(block) && ctx.cannedActive && !hasExactG80(block)) {
      push(
        issues,
        "fanuc.g30-while-canned",
        "G30 while a canned cycle is still active — cancel with G80 before secondary reference return.",
        index
      );
    }

    if (hasExactG30(block) && ctx.toolLengthActive && !hasExactG49(block)) {
      push(
        issues,
        "fanuc.g30-while-tool-length",
        "G30 while tool length compensation (G43) is still active — cancel with G49 before secondary reference return.",
        index
      );
    }

    if (hasExactG30(block) && ctx.rotationActive && !hasExactG69(block)) {
      push(
        issues,
        "fanuc.g30-while-rotation",
        "G30 while coordinate rotation (G68) is still active — cancel with G69 before secondary reference return.",
        index
      );
    }

    if (hasExactG53(block) && ctx.cutterCompActive && !hasExactG40(block)) {
      push(
        issues,
        "fanuc.g53-while-cutter-comp",
        "G53 while cutter compensation (G41/G42) is still active — cancel with G40 before machine move.",
        index
      );
    }

    if (hasExactG53(block) && ctx.cannedActive && !hasExactG80(block)) {
      push(
        issues,
        "fanuc.g53-while-canned",
        "G53 while a canned cycle is still active — cancel with G80 before machine move.",
        index
      );
    }

    if (hasExactG53(block) && ctx.toolLengthActive && !hasExactG49(block)) {
      push(
        issues,
        "fanuc.g53-while-tool-length",
        "G53 while tool length compensation (G43) is still active — cancel with G49 before machine move.",
        index
      );
    }

    if (hasExactG53(block) && ctx.rotationActive && !hasExactG69(block)) {
      push(
        issues,
        "fanuc.g53-while-rotation",
        "G53 while coordinate rotation (G68) is still active — cancel with G69 before machine move.",
        index
      );
    }

    if (hasExactG53(block) && ctx.scalingActive && !hasExactG50(block)) {
      push(
        issues,
        "fanuc.g53-while-scaling",
        "G53 while scaling (G51) is still active — cancel with G50 before machine move.",
        index
      );
    }

    if (hasSpindleOff(block)) {
      if (ctx.coolantActive && !hasCoolantOff(block)) {
        push(
          issues,
          "fanuc.m5-while-coolant-on",
          "M5 while coolant is still on — turn coolant off with M9 when stopping the spindle.",
          index
        );
      }
      if (ctx.cutterCompActive && !hasExactG40(block)) {
        push(
          issues,
          "fanuc.m5-while-cutter-comp",
          "M5 while cutter compensation (G41/G42) is still active — cancel with G40 when stopping the spindle.",
          index
        );
      }
      if (ctx.toolLengthActive && !hasExactG49(block)) {
        push(
          issues,
          "fanuc.m5-while-tool-length",
          "M5 while tool length compensation (G43) is still active — cancel with G49 when stopping the spindle.",
          index
        );
      }
      if (ctx.rotationActive && !hasExactG69(block)) {
        push(
          issues,
          "fanuc.m5-while-rotation",
          "M5 while coordinate rotation (G68) is still active — cancel with G69 when stopping the spindle.",
          index
        );
      }
      if (ctx.scalingActive && !hasExactG50(block)) {
        push(
          issues,
          "fanuc.m5-while-scaling",
          "M5 while scaling (G51) is still active — cancel with G50 when stopping the spindle.",
          index
        );
      }
    }

    if (hasExactG0(block) && ctx.cutterCompActive && !hasExactG40(block)) {
      push(
        issues,
        "fanuc.g0-while-cutter-comp",
        "G0 rapid while cutter compensation (G41/G42) is active — cancel with G40 or use feed motion.",
        index
      );
    }

    if (hasExactG0(block) && ctx.cannedActive && !hasExactG80(block)) {
      push(
        issues,
        "fanuc.g0-while-canned",
        "G0 rapid while a canned cycle is still active — cancel with G80 before rapid moves.",
        index
      );
    }

    if (hasExactG0(block) && ctx.toolLengthActive && !hasExactG49(block)) {
      push(
        issues,
        "fanuc.g0-while-tool-length",
        "G0 rapid while tool length compensation (G43) is still active — cancel with G49 before rapid moves.",
        index
      );
    }

    if (hasExactG65(block) && ctx.cutterCompActive && !hasExactG40(block)) {
      push(
        issues,
        "fanuc.g65-while-cutter-comp",
        "G65 while cutter compensation (G41/G42) is still active — cancel with G40 before the macro call.",
        index
      );
    }

    if (hasExactG65(block) && ctx.cannedActive && !hasExactG80(block)) {
      push(
        issues,
        "fanuc.g65-while-canned",
        "G65 while a canned cycle is still active — cancel with G80 before the macro call.",
        index
      );
    }

    if (hasExactG80(block)) {
      cannedHasZ = false;
      cannedHasR = false;
    }

    if (hasCannedCycle(block)) {
      if (!hasLetter(block, "Z") && !cannedHasZ) {
        push(
          issues,
          "fanuc.canned-without-z",
          "Canned cycle (G73/G74/G76/G81-G89) without Z depth — set Z on the cycle block or earlier in the cycle.",
          index
        );
      }
      if (!hasLetter(block, "R") && !cannedHasR) {
        push(
          issues,
          "fanuc.canned-without-r",
          "Canned cycle (G73/G74/G76/G81-G89) without R plane — set R on the cycle block or earlier in the cycle.",
          index
        );
      }
      if (hasLetter(block, "Z")) cannedHasZ = true;
      if (hasLetter(block, "R")) cannedHasR = true;
    }

    if (hasCoolantOn(block) && sawSpindleOn && !ctx.spindleActive && !hasSpindleOn(block)) {
      push(
        issues,
        "fanuc.coolant-on-while-spindle-off",
        "Coolant on (M7/M8) while spindle is off — restart spindle or turn coolant off.",
        index
      );
    }

    if (hasWordM(block, 98) && !hasLetter(block, "P")) {
      push(
        issues,
        "fanuc.m98-without-p",
        "M98 without P on the same block — Fanuc subprogram calls need P (program number).",
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

    if (hasSpindleOn(block)) {
      sawSpindleOn = true;
    }

    if (hasLetter(block, "F")) {
      sawFeedRate = true;
    }
  });

  issues.push(...lintFanucEndHygiene(ast));

  return issues;
}
