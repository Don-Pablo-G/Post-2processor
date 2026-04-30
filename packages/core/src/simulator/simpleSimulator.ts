import type { Block, ProgramAst, SimulationResult, SimulatorLimits, Word } from "../types.js";

type AxisPosition = { X: number; Y: number; Z: number };
type LoopFrame = { doLabel: number; startBlockIndex: number; condition: string; iterations: number };
type ModalState = { motionMode: "G0" | "G1" | "G2" | "G3"; feedMmPerMin: number; returnToInitialZ: boolean };
type CallFrame = {
  subprogram: number;
  subprogramStartBlock: number;
  returnBlock: number;
  repeatRemaining: number;
  localSnapshot: Record<string, number>;
};
type ControllerMode = "haas-ngc" | "haas-legacy" | "fanuc";
type MacroRuntimeProfile = {
  mode: ControllerMode;
  supportedFunctions: Set<string>;
  logSemantics: "natural" | "base10";
};
type SubprogramRefStyle = "o_label" | "n_label";
type ParsedCall = { program: number; repeats: number; style: SubprogramRefStyle };
type SubprogramTargetPolicy = "shop_friendly" | "strict_controller";
const MACRO_FN_NAMES = ["ABS", "ROUND", "FIX", "FUP", "SQRT", "SIN", "COS", "TAN", "ATAN", "LN", "LOG", "EXP"] as const;

const AXES = ["X", "Y", "Z"] as const;

export function simpleSimulate(
  ast: ProgramAst,
  initialState: Record<string, number>,
  limits: SimulatorLimits
): SimulationResult {
  const controllerMode: ControllerMode = limits.controllerMode ?? "haas-ngc";
  const profile = getMacroRuntimeProfile(controllerMode, limits.logSemantics ?? "controller_default");
  const rapidRate = limits.rapidRateMmPerMin ?? 12000;
  const defaultFeed = limits.defaultFeedMmPerMin ?? 500;
  const toolChangeSeconds = limits.toolChangeSeconds ?? 3;
  const maxCallDepth = limits.maxCallDepth ?? 8;
  const subprogramTargetPolicy: SubprogramTargetPolicy = limits.subprogramTargetPolicy ?? "shop_friendly";
  const trace: SimulationResult["trace"] = [];
  const alarms: SimulationResult["alarms"] = [];
  const warnings: string[] = [];
  const variables = { ...initialState };
  const position: AxisPosition = { X: 0, Y: 0, Z: 0 };
  const loopStack: LoopFrame[] = [];
  const callStack: CallFrame[] = [];
  const labelMap = buildLabelMap(ast.blocks);
  const subprogramMap = buildSubprogramMaps(ast.blocks);
  const initialZ = position.Z;
  const modal: ModalState = {
    motionMode: "G0",
    feedMmPerMin: defaultFeed,
    returnToInitialZ: true
  };

  let steps = 0;
  let currentBlock = 0;
  let halted = false;
  let elapsedSeconds = 0;

  while (currentBlock >= 0 && currentBlock < ast.blocks.length && steps < limits.maxSteps && !halted) {
    const block = ast.blocks[currentBlock];
    let code = applyHaasNgcIfThenLine(
      cleanCode(block.raw).toUpperCase(),
      variables,
      warnings,
      currentBlock,
      profile
    );
    let blockTimeSeconds = 0;
    let nextBlock = currentBlock + 1;
    let blockEvent: SimulationResult["trace"][number]["event"];

    applyAssignments(code, variables, warnings, currentBlock, profile);
    const alarmEvent = detectAlarmEvent(block.raw, variables, warnings, currentBlock, profile);
    if (alarmEvent) {
      alarms.push(alarmEvent);
      blockEvent = {
        kind: alarmEvent.parameter === 3000 ? "alarm" : "message_stop",
        parameter: alarmEvent.parameter,
        code: alarmEvent.code,
        message: alarmEvent.message
      };
      halted = true;
    }

    if (!halted) {
      const words = parseWords(code, block.words);
      const gWords = words
        .filter((w) => w.letter === "G")
        .map((w) => Math.trunc(evalNumeric(w.value, variables, warnings, currentBlock, profile)));
      const mWords = words
        .filter((w) => w.letter === "M")
        .map((w) => Math.trunc(evalNumeric(w.value, variables, warnings, currentBlock, profile)));

      if (words.some((w) => w.letter === "F")) {
        const lastF = words.filter((w) => w.letter === "F").at(-1);
        if (lastF) {
          modal.feedMmPerMin = Math.max(1, evalNumeric(lastF.value, variables, warnings, currentBlock, profile));
        }
      }

      if (gWords.includes(0)) modal.motionMode = "G0";
      if (gWords.includes(1)) modal.motionMode = "G1";
      if (gWords.includes(2)) modal.motionMode = "G2";
      if (gWords.includes(3)) modal.motionMode = "G3";
      if (gWords.includes(98)) modal.returnToInitialZ = true;
      if (gWords.includes(99)) modal.returnToInitialZ = false;

      if (mWords.includes(99)) {
        const frame = callStack.at(-1);
        if (!frame) {
          halted = true;
          if (profile.mode === "fanuc") {
            warnings.push(`Fanuc mode: M99 in main program at block ${currentBlock} is invalid; halting.`);
          } else {
            warnings.push(`M99 encountered in main program at block ${currentBlock}; halting.`);
          }
          blockEvent = chooseBlockEvent(blockEvent, {
            kind: "main_m99",
            message:
              profile.mode === "fanuc"
                ? "Fanuc main-level M99 detected (invalid in this context); program halted."
                : "Main-level M99 detected; program halted."
          });
        } else if (frame.repeatRemaining > 1) {
          frame.repeatRemaining -= 1;
          blockEvent = chooseBlockEvent(blockEvent, {
            kind: "subprogram_repeat",
            message: `Repeat subprogram ${frame.subprogram}, remaining ${frame.repeatRemaining}.`,
            program: frame.subprogram,
            remainingRepeats: frame.repeatRemaining
          });
          nextBlock = frame.subprogramStartBlock;
        } else {
          restoreMacroLocals(variables, frame.localSnapshot);
          callStack.pop();
          blockEvent = chooseBlockEvent(blockEvent, {
            kind: "subprogram_return",
            message: `Return from subprogram ${frame.subprogram} to block ${frame.returnBlock}.`,
            program: frame.subprogram,
            returnBlock: frame.returnBlock
          });
          nextBlock = frame.returnBlock;
        }
      }

      const whileInfo = parseWhile(code);
      if (whileInfo) {
        const condition = evaluateCondition(whileInfo.condition, variables, warnings, currentBlock, profile);
        if (condition) {
          loopStack.push({
            doLabel: whileInfo.doLabel,
            startBlockIndex: currentBlock,
            condition: whileInfo.condition,
            iterations: 0
          });
        } else {
          const endIndex = findMatchingEnd(ast.blocks, currentBlock + 1, whileInfo.doLabel);
          if (endIndex >= 0) nextBlock = endIndex + 1;
          else warnings.push(`Missing END${whileInfo.doLabel} for WHILE at block ${currentBlock}.`);
        }
      }

      const endLabel = parseEnd(code);
      if (endLabel !== null) {
        const loopFrame = [...loopStack].reverse().find((f) => f.doLabel === endLabel);
        if (loopFrame) {
          if (loopFrame.iterations >= limits.maxLoopIterations) {
            warnings.push(`Loop DO${endLabel} exceeded maxLoopIterations (${limits.maxLoopIterations}).`);
          } else if (evaluateCondition(loopFrame.condition, variables, warnings, currentBlock, profile)) {
            loopFrame.iterations += 1;
            nextBlock = loopFrame.startBlockIndex + 1;
          } else {
            const idx = loopStack.indexOf(loopFrame);
            if (idx >= 0) loopStack.splice(idx, 1);
          }
        } else {
          warnings.push(`END${endLabel} has no matching WHILE.`);
        }
      }

      const conditionalGoto = parseConditionalGoto(code, variables, warnings, currentBlock, profile);
      if (conditionalGoto !== null && conditionalGoto.passes) {
        const target = labelMap.get(conditionalGoto.target);
        if (target === undefined) {
          warnings.push(`IF GOTO target N${conditionalGoto.target} not found (block ${currentBlock}).`);
        }
        else nextBlock = target;
      }

      const gotoTarget =
        conditionalGoto === null ? parseGotoTarget(code, variables, warnings, currentBlock, profile) : null;
      if (gotoTarget !== null) {
        const target = labelMap.get(gotoTarget);
        if (target === undefined) warnings.push(`GOTO target N${gotoTarget} not found (block ${currentBlock}).`);
        else nextBlock = target;
      }

      const m97Call = parseM97Call(words, variables, warnings, currentBlock, profile);
      if (m97Call) {
        if (profile.mode === "fanuc") {
          warnings.push(`M97 local subprogram call is not supported in fanuc mode (block ${currentBlock}).`);
        } else {
          const target = resolveSubprogramTarget(subprogramMap, m97Call, profile.mode, subprogramTargetPolicy);
          if (target === undefined) {
            warnings.push(`M97 target N${m97Call.program} not found (block ${currentBlock}).`);
          } else if (callStack.length >= maxCallDepth) {
            warnings.push(`Max call depth ${maxCallDepth} reached at M97 P${m97Call.program} (block ${currentBlock}).`);
            blockEvent = chooseBlockEvent(blockEvent, {
              kind: "call_depth_limit",
              message: `Call depth limit reached at M97 P${m97Call.program}.`,
              via: "M97",
              program: m97Call.program,
              maxCallDepth
            });
          } else {
            callStack.push({
              subprogram: m97Call.program,
              subprogramStartBlock: target,
              returnBlock: currentBlock + 1,
              repeatRemaining: m97Call.repeats,
              localSnapshot: snapshotMacroLocals(variables)
            });
            blockEvent = chooseBlockEvent(blockEvent, {
              kind: "subprogram_call",
              message: `Call subprogram ${m97Call.program} via M97.`,
              via: "M97",
              program: m97Call.program,
              returnBlock: currentBlock + 1
            });
            nextBlock = target;
          }
        }
      }

      const m98Call = parseM98Call(words, variables, warnings, currentBlock, profile);
      if (m98Call) {
        const target = resolveSubprogramTarget(subprogramMap, m98Call, profile.mode, subprogramTargetPolicy);
        if (target === undefined) {
          warnings.push(`M98 target ${m98Call.style === "o_label" ? "O" : "N"}${m98Call.program} not found (block ${currentBlock}).`);
        } else if (callStack.length >= maxCallDepth) {
          warnings.push(
            `Max call depth ${maxCallDepth} reached at M98 P${m98Call.program} (${m98Call.style === "o_label" ? "O" : "N"} lookup, block ${currentBlock}).`
          );
          blockEvent = chooseBlockEvent(blockEvent, {
            kind: "call_depth_limit",
            message: `Call depth limit reached at M98 P${m98Call.program}.`,
            via: "M98",
            program: m98Call.program,
            maxCallDepth
          });
        } else {
          callStack.push({
            subprogram: m98Call.program,
            subprogramStartBlock: target,
            returnBlock: currentBlock + 1,
            repeatRemaining: m98Call.repeats,
            localSnapshot: snapshotMacroLocals(variables)
          });
          blockEvent = chooseBlockEvent(blockEvent, {
            kind: "subprogram_call",
            message: `Call subprogram ${m98Call.program} via M98.`,
            via: "M98",
            program: m98Call.program,
            returnBlock: currentBlock + 1
          });
          nextBlock = target;
        }
      }

      const g65Call = parseG65Call(words, variables, warnings, currentBlock, profile);
      if (g65Call) {
        const target = resolveSubprogramTarget(subprogramMap, g65Call, profile.mode, subprogramTargetPolicy);
        if (target === undefined) {
          if (profile.mode === "fanuc" && subprogramTargetPolicy === "strict_controller") {
            warnings.push(
              `G65 target O${g65Call.program} not found in strict fanuc mode (N${g65Call.program} fallback disabled, block ${currentBlock}).`
            );
          } else {
            warnings.push(`G65 target O${g65Call.program} not found (block ${currentBlock}).`);
          }
        } else if (callStack.length >= maxCallDepth) {
          warnings.push(`Max call depth ${maxCallDepth} reached at G65 O${g65Call.program} (block ${currentBlock}).`);
          blockEvent = chooseBlockEvent(blockEvent, {
            kind: "call_depth_limit",
            message: `Call depth limit reached at G65 P${g65Call.program}.`,
            via: "G65",
            program: g65Call.program,
            maxCallDepth
          });
        } else {
          const localSnapshot = snapshotMacroLocals(variables);
          applyG65Arguments(g65Call.arguments, variables);
          callStack.push({
            subprogram: g65Call.program,
            subprogramStartBlock: target,
            returnBlock: currentBlock + 1,
            repeatRemaining: g65Call.repeats,
            localSnapshot
          });
          blockEvent = chooseBlockEvent(blockEvent, {
            kind: "subprogram_call",
            message: `Call subprogram ${g65Call.program} via G65.`,
            via: "G65",
            program: g65Call.program,
            returnBlock: currentBlock + 1
          });
          nextBlock = target;
        }
      }

      if (hasToolChange(mWords)) {
        blockTimeSeconds += toolChangeSeconds;
      }

      if (hasDwell(gWords)) {
        blockTimeSeconds += getDwellSeconds(words, variables, warnings, currentBlock, profile);
      }

      const cycle = findCannedCycle(gWords);
      if (cycle !== null) {
        blockTimeSeconds += estimateCannedCycleSeconds(
          cycle,
          words,
          position,
          modal,
          initialZ,
          variables,
          rapidRate,
          warnings,
          currentBlock,
          profile
        );
      } else {
        blockTimeSeconds += estimateMotionSeconds(
          words,
          modal,
          position,
          variables,
          rapidRate,
          warnings,
          currentBlock,
          profile
        );
      }

      if (mWords.includes(30) || mWords.includes(2)) {
        halted = true;
      }
    }

    elapsedSeconds += blockTimeSeconds;
    trace.push({
      blockIndex: currentBlock,
      raw: block.raw,
      variableSnapshot: { ...variables },
      blockTimeSeconds,
      elapsedSeconds,
      event: blockEvent
    });

    steps += 1;
    currentBlock = nextBlock;
  }

  if (steps >= limits.maxSteps && currentBlock < ast.blocks.length && !halted) {
    warnings.push("Simulation reached maxSteps limit before program end.");
  }
  if (callStack.length > 0) {
    const pending = callStack.map((f) => f.subprogram).join(", ");
    warnings.push(
      `Simulation ended with unfinished subprogram return path (pending: ${pending}). Check M99/M30 flow in called programs.`
    );
  }

  return {
    trace,
    alarms,
    warnings,
    estimatedCycleTimeSeconds: elapsedSeconds,
    state: {
      variables,
      currentBlock,
      steps,
      halted: halted || currentBlock >= ast.blocks.length
    }
  };
}

function cleanCode(raw: string): string {
  return raw
    .replace(/\r/g, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/;.*$/g, "")
    .trim();
}

function parseWords(code: string, fallback: Word[]): Word[] {
  const parsed = Array.from(
    code.matchAll(/([A-Z])\s*([+\-]?(?:\d+(?:\.\d*)?|\.\d+|\#\d+|\[[^\]]+\]))/g)
  ).map((m) => ({
    letter: m[1],
    value: m[2]
  }));
  return parsed.length > 0 ? parsed : fallback;
}

function applyAssignments(
  code: string,
  variables: Record<string, number>,
  warnings: string[],
  blockIndex: number,
  profile: MacroRuntimeProfile
): void {
  const assignmentRe = /#(\d+)\s*=\s*([^;]+)/g;
  for (const match of code.matchAll(assignmentRe)) {
    const varId = `#${match[1]}`;
    const rhs = match[2].trim();
    const value = evalNumeric(rhs, variables, warnings, blockIndex, profile);
    if (Number.isFinite(value)) variables[varId] = value;
    else warnings.push(`Invalid assignment ${varId}=${rhs} at block ${blockIndex}.`);
  }
}

function evalNumeric(
  token: string,
  variables: Record<string, number>,
  warnings: string[],
  blockIndex: number,
  profile: MacroRuntimeProfile
): number {
  const expr = token.trim();
  if (/^[+\-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(expr)) return Number(expr);
  if (/^#\d+$/.test(expr)) return variables[expr] ?? 0;
  return evaluateExpression(expr, variables, warnings, blockIndex, profile);
}

function evaluateExpression(
  expr: string,
  variables: Record<string, number>,
  warnings: string[],
  blockIndex: number,
  profile: MacroRuntimeProfile
): number {
  let normalized = resolveMacroFunctions(expr, variables, warnings, blockIndex, profile);
  normalized = normalized.replace(/\[/g, "(").replace(/\]/g, ")");
  normalized = normalized.replace(/#(\d+)/g, (_, id) => String(variables[`#${id}`] ?? 0));
  normalized = normalized
    .replace(/\bEQ\b/g, "==")
    .replace(/\bNE\b/g, "!=")
    .replace(/\bGT\b/g, ">")
    .replace(/\bGE\b/g, ">=")
    .replace(/\bLT\b/g, "<")
    .replace(/\bLE\b/g, "<=")
    .replace(/\bAND\b/g, "&&")
    .replace(/\bOR\b/g, "||")
    .replace(/\bMOD\b/g, "%");

  if (!/^[0-9+\-*/().<>=!&|%\s]+$/.test(normalized)) return Number.NaN;
  try {
    const result = Function(`"use strict"; return (${normalized});`)();
    return Number(result);
  } catch {
    return Number.NaN;
  }
}

function resolveMacroFunctions(
  expr: string,
  variables: Record<string, number>,
  warnings: string[],
  blockIndex: number,
  profile: MacroRuntimeProfile
): string {
  let result = expr;
  for (;;) {
    const next = findNextFunctionCall(result, MACRO_FN_NAMES as unknown as string[]);
    if (!next) return result;
    const argExpr = result.slice(next.openBracket + 1, next.closeBracket);
    const arg = evaluateExpression(argExpr, variables, warnings, blockIndex, profile);
    const value = applyMacroFunction(next.name, arg, warnings, blockIndex, profile);
    const replacement = Number.isFinite(value) ? String(value) : "NaN";
    result = `${result.slice(0, next.start)}${replacement}${result.slice(next.closeBracket + 1)}`;
  }
}

function findNextFunctionCall(
  expr: string,
  names: string[]
): { name: string; start: number; openBracket: number; closeBracket: number } | null {
  const upper = expr.toUpperCase();
  let best: { name: string; start: number; openBracket: number } | null = null;
  for (const name of names) {
    const idx = upper.search(new RegExp(`\\b${name}\\s*\\[`));
    if (idx >= 0 && (!best || idx < best.start)) {
      const openBracket = upper.indexOf("[", idx);
      if (openBracket >= 0) best = { name, start: idx, openBracket };
    }
  }
  if (!best) return null;
  const closeBracket = findMatchingBracket(expr, best.openBracket);
  if (closeBracket < 0) return null;
  return { ...best, closeBracket };
}

function findMatchingBracket(value: string, openIdx: number): number {
  let depth = 0;
  for (let i = openIdx; i < value.length; i += 1) {
    const ch = value[i];
    if (ch === "[") depth += 1;
    if (ch === "]") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function applyMacroFunction(
  name: string,
  arg: number,
  warnings: string[],
  blockIndex: number,
  profile: MacroRuntimeProfile
): number {
  if (!profile.supportedFunctions.has(name)) {
    warnings.push(`Function ${name} is not supported in ${profile.mode} mode (block ${blockIndex}).`);
    return Number.NaN;
  }
  if (!Number.isFinite(arg)) return Number.NaN;
  switch (name) {
    case "ABS":
      return Math.abs(arg);
    case "ROUND":
      return Math.round(arg);
    case "FIX":
      return Math.floor(arg);
    case "FUP":
      return Math.ceil(arg);
    case "SQRT":
      return arg < 0 ? Number.NaN : Math.sqrt(arg);
    case "SIN":
      return Math.sin((arg * Math.PI) / 180);
    case "COS":
      return Math.cos((arg * Math.PI) / 180);
    case "TAN":
      return Math.tan((arg * Math.PI) / 180);
    case "ATAN":
      return (Math.atan(arg) * 180) / Math.PI;
    case "LN":
      if (arg <= 0) {
        warnings.push(`Function ${name} domain error at block ${blockIndex}: argument must be > 0.`);
        return Number.NaN;
      }
      return Math.log(arg);
    case "LOG":
      if (arg <= 0) {
        warnings.push(`Function ${name} domain error at block ${blockIndex}: argument must be > 0.`);
        return Number.NaN;
      }
      return profile.logSemantics === "base10" ? Math.log10(arg) : Math.log(arg);
    case "EXP":
      return Math.exp(arg);
    default:
      return Number.NaN;
  }
}

function evaluateCondition(
  expr: string,
  variables: Record<string, number>,
  warnings: string[],
  blockIndex: number,
  profile: MacroRuntimeProfile
): boolean {
  const value = evaluateExpression(expr, variables, warnings, blockIndex, profile);
  return Number.isFinite(value) && value !== 0;
}

/** Haas NGC: single-line `IF [cond] THEN #n = expr` (processed before other `#=` assignments on the line). */
function applyHaasNgcIfThenLine(
  codeUpper: string,
  variables: Record<string, number>,
  warnings: string[],
  blockIndex: number,
  profile: MacroRuntimeProfile
): string {
  if (profile.mode !== "haas-ngc") return codeUpper;
  const re = /\bIF\s*(\[[^\]]+\])\s*THEN\s*#(\d+)\s*=\s*/;
  const m = re.exec(codeUpper);
  if (!m) return codeUpper;
  const [, cond, idStr] = m;
  const assignmentStart = m.index;
  const rhsStart = assignmentStart + m[0].length;
  const rhsParsed = parseIfThenRhs(codeUpper, rhsStart);
  if (!rhsParsed) {
    warnings.push(`IF…THEN assignment RHS invalid at block ${blockIndex}.`);
    return codeUpper.slice(0, assignmentStart).trim();
  }
  const { rhsExpression, rhsEnd } = rhsParsed;
  const passes = evaluateCondition(cond, variables, warnings, blockIndex, profile);
  if (passes) {
    const value = evalNumeric(rhsExpression, variables, warnings, blockIndex, profile);
    if (Number.isFinite(value)) variables[`#${idStr}`] = value;
    else warnings.push(`IF…THEN assignment RHS invalid at block ${blockIndex}.`);
  }
  const before = codeUpper.slice(0, assignmentStart).trimEnd();
  const after = codeUpper.slice(rhsEnd).trimStart();
  return [before, after].filter(Boolean).join(" ").trim();
}

function parseIfThenRhs(
  codeUpper: string,
  rhsStart: number
): { rhsExpression: string; rhsEnd: number } | null {
  const rhsChunk = codeUpper.slice(rhsStart).trimStart();
  const leadingWhitespace = codeUpper.slice(rhsStart).length - rhsChunk.length;
  const absoluteStart = rhsStart + leadingWhitespace;
  if (!rhsChunk) return null;

  if (rhsChunk.startsWith("[")) {
    let depth = 0;
    for (let i = 0; i < rhsChunk.length; i += 1) {
      const c = rhsChunk[i];
      if (c === "[") depth += 1;
      if (c === "]") depth -= 1;
      if (depth === 0) {
        return {
          rhsExpression: rhsChunk.slice(0, i + 1).trim(),
          rhsEnd: absoluteStart + i + 1
        };
      }
    }
    return null;
  }

  const tokenMatch = rhsChunk.match(/^[+\-]?(?:\d+(?:\.\d*)?|\.\d+|#\d+)/);
  if (!tokenMatch) return null;
  return {
    rhsExpression: tokenMatch[0].trim(),
    rhsEnd: absoluteStart + tokenMatch[0].length
  };
}

function parseWhile(code: string): { condition: string; doLabel: number } | null {
  const match = code.match(/\bWHILE\s*(\[[^\]]+\])\s*DO\s*([0-9]+)/);
  if (!match) return null;
  return { condition: match[1], doLabel: Number(match[2]) };
}

function parseEnd(code: string): number | null {
  const match = code.match(/\bEND\s*([0-9]+)/);
  return match ? Number(match[1]) : null;
}

function parseGotoTarget(
  code: string,
  variables: Record<string, number>,
  warnings: string[],
  blockIndex: number,
  profile: MacroRuntimeProfile
): number | null {
  if (/\bIF\b.*\bGOTO\b/.test(code)) return null;
  const match = code.match(/\bGOTO\s*([+\-]?(?:\d+|#\d+|\[[^\]]+\]))/);
  if (!match) return null;
  return Math.trunc(evalNumeric(match[1], variables, warnings, blockIndex, profile));
}

function parseConditionalGoto(
  code: string,
  variables: Record<string, number>,
  warnings: string[],
  blockIndex: number,
  profile: MacroRuntimeProfile
): { passes: boolean; target: number } | null {
  const match = code.match(/\bIF\s*(\[[^\]]+\])\s*GOTO\s*([+\-]?(?:\d+|#\d+|\[[^\]]+\]))/);
  if (!match) return null;
  return {
    passes: evaluateCondition(match[1], variables, warnings, blockIndex, profile),
    target: Math.trunc(evalNumeric(match[2], variables, warnings, blockIndex, profile))
  };
}

function findMatchingEnd(blocks: Block[], from: number, doLabel: number): number {
  for (let i = from; i < blocks.length; i += 1) {
    const code = cleanCode(blocks[i].raw).toUpperCase();
    if (parseEnd(code) === doLabel) return i;
  }
  return -1;
}

function buildLabelMap(blocks: Block[]): Map<number, number> {
  const map = new Map<number, number>();
  blocks.forEach((block, index) => {
    const code = cleanCode(block.raw).toUpperCase();
    const n = code.match(/\bN\s*([0-9]+)/);
    if (n) map.set(Number(n[1]), index);
  });
  return map;
}

function buildSubprogramMaps(blocks: Block[]): { oLabels: Map<number, number>; nLabels: Map<number, number> } {
  const oLabels = new Map<number, number>();
  const nLabels = new Map<number, number>();
  blocks.forEach((block, index) => {
    const code = cleanCode(block.raw).toUpperCase();
    const oMatch = code.match(/\bO\s*([0-9]+)/);
    if (oMatch) oLabels.set(Number(oMatch[1]), index);
    const nMatch = code.match(/\bN\s*([0-9]+)/);
    if (nMatch) nLabels.set(Number(nMatch[1]), index);
  });
  return { oLabels, nLabels };
}

function snapshotMacroLocals(variables: Record<string, number>): Record<string, number> {
  const snapshot: Record<string, number> = {};
  for (let i = 1; i <= 33; i += 1) {
    const key = `#${i}`;
    if (key in variables) snapshot[key] = variables[key];
  }
  return snapshot;
}

function restoreMacroLocals(variables: Record<string, number>, snapshot: Record<string, number>): void {
  for (let i = 1; i <= 33; i += 1) {
    const key = `#${i}`;
    delete variables[key];
  }
  for (const [key, value] of Object.entries(snapshot)) {
    variables[key] = value;
  }
}

function parseM98Call(
  words: Word[],
  variables: Record<string, number>,
  warnings: string[],
  blockIndex: number,
  profile: MacroRuntimeProfile
): ParsedCall | null {
  const hasM98 = words.some(
    (w) => w.letter === "M" && Math.trunc(evalNumeric(w.value, variables, warnings, blockIndex, profile)) === 98
  );
  if (!hasM98) return null;
  const p = words.filter((w) => w.letter === "P").at(-1);
  if (!p) return null;
  const l = words.filter((w) => w.letter === "L").at(-1);
  return {
    program: Math.trunc(evalNumeric(p.value, variables, warnings, blockIndex, profile)),
    repeats: Math.max(1, l ? Math.trunc(evalNumeric(l.value, variables, warnings, blockIndex, profile)) : 1),
    style: "o_label"
  };
}

function parseM97Call(
  words: Word[],
  variables: Record<string, number>,
  warnings: string[],
  blockIndex: number,
  profile: MacroRuntimeProfile
): ParsedCall | null {
  const hasM97 = words.some(
    (w) => w.letter === "M" && Math.trunc(evalNumeric(w.value, variables, warnings, blockIndex, profile)) === 97
  );
  if (!hasM97) return null;
  const p = words.filter((w) => w.letter === "P").at(-1);
  if (!p) return null;
  const l = words.filter((w) => w.letter === "L").at(-1);
  return {
    program: Math.trunc(evalNumeric(p.value, variables, warnings, blockIndex, profile)),
    repeats: Math.max(1, l ? Math.trunc(evalNumeric(l.value, variables, warnings, blockIndex, profile)) : 1),
    style: "n_label"
  };
}

function parseG65Call(
  words: Word[],
  variables: Record<string, number>,
  warnings: string[],
  blockIndex: number,
  profile: MacroRuntimeProfile
): { program: number; repeats: number; arguments: Record<string, number>; style: SubprogramRefStyle } | null {
  const hasG65 = words.some(
    (w) => w.letter === "G" && Math.trunc(evalNumeric(w.value, variables, warnings, blockIndex, profile)) === 65
  );
  if (!hasG65) return null;
  const p = words.filter((w) => w.letter === "P").at(-1);
  if (!p) return null;
  const l = words.filter((w) => w.letter === "L").at(-1);
  const reserved = new Set(["G", "P", "L", "M", "N", "O"]);
  const args: Record<string, number> = {};
  for (const word of words) {
    if (reserved.has(word.letter)) continue;
    args[word.letter] = evalNumeric(word.value, variables, warnings, blockIndex, profile);
  }
  return {
    program: Math.trunc(evalNumeric(p.value, variables, warnings, blockIndex, profile)),
    repeats: Math.max(1, l ? Math.trunc(evalNumeric(l.value, variables, warnings, blockIndex, profile)) : 1),
    arguments: args,
    style: "o_label"
  };
}

function resolveSubprogramTarget(
  maps: { oLabels: Map<number, number>; nLabels: Map<number, number> },
  call: ParsedCall | { program: number; style: SubprogramRefStyle },
  mode: ControllerMode,
  policy: SubprogramTargetPolicy
): number | undefined {
  if (call.style === "n_label") return maps.nLabels.get(call.program);
  if (policy === "shop_friendly") return maps.oLabels.get(call.program) ?? maps.nLabels.get(call.program);

  // strict_controller:
  // - Fanuc: O-label only for M98/G65
  // - Haas: allow O first with N fallback for practical compatibility
  if (mode === "fanuc") return maps.oLabels.get(call.program);
  return maps.oLabels.get(call.program) ?? maps.nLabels.get(call.program);
}

function applyG65Arguments(args: Record<string, number>, variables: Record<string, number>): void {
  const map: Record<string, number> = {
    A: 1,
    B: 2,
    C: 3,
    I: 4,
    J: 5,
    K: 6,
    D: 7,
    E: 8,
    F: 9,
    H: 11,
    Q: 17,
    R: 18,
    S: 19,
    T: 20,
    U: 21,
    V: 22,
    W: 23,
    X: 24,
    Y: 25,
    Z: 26
  };
  for (const [letter, value] of Object.entries(args)) {
    const target = map[letter];
    if (!target || !Number.isFinite(value)) continue;
    variables[`#${target}`] = value;
  }
}

function estimateMotionSeconds(
  words: Word[],
  modal: ModalState,
  position: AxisPosition,
  variables: Record<string, number>,
  rapidRateMmPerMin: number,
  warnings: string[],
  blockIndex: number,
  profile: MacroRuntimeProfile
): number {
  const target: AxisPosition = { ...position };
  for (const axis of AXES) {
    const axisTarget = getAxisTargetWithContext(words, axis, variables, warnings, blockIndex, profile);
    if (axisTarget !== null && Number.isFinite(axisTarget)) target[axis] = axisTarget;
  }

  const distance = Math.hypot(target.X - position.X, target.Y - position.Y, target.Z - position.Z);
  if (distance <= 0) return 0;

  const dzRapid = target.Z - position.Z;
  const rate = modal.motionMode === "G0" ? rapidRateMmPerMin : Math.max(1, modal.feedMmPerMin);
  position.X = target.X;
  position.Y = target.Y;
  position.Z = target.Z;
  if (profile.mode === "haas-ngc" && modal.motionMode === "G0" && dzRapid < -5) {
    warnings.push(
      `Haas NGC: rapid (G0) Z move down ~${Math.abs(dzRapid).toFixed(3)} mm at block ${blockIndex} — confirm clearance / retract plane.`
    );
  }
  return (distance / rate) * 60;
}

function findCannedCycle(gWords: number[]): number | null {
  const match = gWords.find((g) => g === 73 || (g >= 81 && g <= 89));
  return match ?? null;
}

function estimateCannedCycleSeconds(
  cycle: number,
  words: Word[],
  position: AxisPosition,
  modal: ModalState,
  initialZ: number,
  variables: Record<string, number>,
  rapidRateMmPerMin: number,
  warnings: string[],
  blockIndex: number,
  profile: MacroRuntimeProfile
): number {
  const x = getAxisTargetWithContext(words, "X", variables, warnings, blockIndex, profile) ?? position.X;
  const y = getAxisTargetWithContext(words, "Y", variables, warnings, blockIndex, profile) ?? position.Y;
  const z = getAxisTargetWithContext(words, "Z", variables, warnings, blockIndex, profile) ?? position.Z;
  const rWord = words.filter((w) => w.letter === "R").at(-1);
  const pWord = words.filter((w) => w.letter === "P").at(-1);
  const lWord = words.filter((w) => w.letter === "L").at(-1);
  const qWord = words.filter((w) => w.letter === "Q").at(-1);

  const r = rWord ? evalNumeric(rWord.value, variables, warnings, blockIndex, profile) : position.Z;
  const repeats = Math.max(
    1,
    lWord ? Math.trunc(evalNumeric(lWord.value, variables, warnings, blockIndex, profile)) : 1
  );
  const dwellSeconds = pWord ? Math.max(0, evalNumeric(pWord.value, variables, warnings, blockIndex, profile) / 1000) : 0;
  const q = qWord ? Math.max(0.1, Math.abs(evalNumeric(qWord.value, variables, warnings, blockIndex, profile))) : 0;
  validateCycleInputs(cycle, words, z, r, modal.feedMmPerMin, q, warnings, blockIndex);

  const xyDistance = Math.hypot(x - position.X, y - position.Y);
  const rapidToXYSeconds = (xyDistance / rapidRateMmPerMin) * 60;
  const feedRate = Math.max(1, modal.feedMmPerMin);
  const rapidToRSeconds = (Math.abs(position.Z - r) / rapidRateMmPerMin) * 60;
  const depth = Math.abs(r - z);
  const feedDownSeconds = (depth / feedRate) * 60;
  const retractTarget = modal.returnToInitialZ ? initialZ : r;
  const rapidRetractSeconds = (Math.abs(retractTarget - z) / rapidRateMmPerMin) * 60;
  const feedRetractSeconds = (Math.abs(retractTarget - z) / feedRate) * 60;
  const chipBreakRetractMm = 1;
  const chipBreakSeconds = (chipBreakRetractMm / rapidRateMmPerMin) * 60;

  const peckCount = q > 0 ? Math.max(1, Math.ceil(depth / q)) : 1;
  const peckFeedSeconds = (depth / feedRate) * 60;
  const peckRapidReturnSeconds = peckCount * ((Math.abs(r - z) / rapidRateMmPerMin) * 60);

  let singleCycleSeconds = rapidToXYSeconds + rapidToRSeconds + feedDownSeconds + rapidRetractSeconds;
  switch (cycle) {
    case 81:
      singleCycleSeconds = rapidToXYSeconds + rapidToRSeconds + feedDownSeconds + rapidRetractSeconds;
      break;
    case 82:
      singleCycleSeconds = rapidToXYSeconds + rapidToRSeconds + feedDownSeconds + dwellSeconds + rapidRetractSeconds;
      break;
    case 83:
      singleCycleSeconds =
        rapidToXYSeconds + rapidToRSeconds + peckFeedSeconds + peckRapidReturnSeconds + dwellSeconds + rapidRetractSeconds;
      break;
    case 84:
      singleCycleSeconds = rapidToXYSeconds + rapidToRSeconds + feedDownSeconds + feedRetractSeconds;
      break;
    case 85:
      singleCycleSeconds = rapidToXYSeconds + rapidToRSeconds + feedDownSeconds + feedRetractSeconds;
      break;
    case 86:
      singleCycleSeconds = rapidToXYSeconds + rapidToRSeconds + feedDownSeconds + dwellSeconds + rapidRetractSeconds;
      break;
    case 87:
      singleCycleSeconds = rapidToXYSeconds + rapidToRSeconds + feedDownSeconds + rapidRetractSeconds;
      break;
    case 88:
      singleCycleSeconds = rapidToXYSeconds + rapidToRSeconds + feedDownSeconds + dwellSeconds + 10;
      break;
    case 89:
      singleCycleSeconds = rapidToXYSeconds + rapidToRSeconds + feedDownSeconds + dwellSeconds + feedRetractSeconds;
      break;
    case 73:
      singleCycleSeconds =
        rapidToXYSeconds + rapidToRSeconds + peckFeedSeconds + peckCount * chipBreakSeconds + rapidRetractSeconds;
      break;
    default:
      break;
  }

  position.X = x;
  position.Y = y;
  position.Z = retractTarget;

  return repeats * singleCycleSeconds;
}

function validateCycleInputs(
  cycle: number,
  words: Word[],
  z: number,
  r: number,
  feedMmPerMin: number,
  q: number,
  warnings: string[],
  blockIndex: number
): void {
  const hasWord = (letter: string) => words.some((w) => w.letter === letter);

  if (!hasWord("Z")) warnings.push(`Cycle G${cycle} missing Z at block ${blockIndex}.`);
  if (!hasWord("R")) warnings.push(`Cycle G${cycle} missing R at block ${blockIndex}.`);
  if (!hasWord("F")) warnings.push(`Cycle G${cycle} uses modal F=${feedMmPerMin.toFixed(3)} at block ${blockIndex}.`);
  if (z > r) warnings.push(`Cycle G${cycle} has Z above R (air cut) at block ${blockIndex}.`);

  if ((cycle === 73 || cycle === 83) && !hasWord("Q")) {
    warnings.push(`Cycle G${cycle} missing Q peck value at block ${blockIndex}.`);
  }
  if ((cycle === 73 || cycle === 83) && q <= 0) {
    warnings.push(`Cycle G${cycle} has invalid Q value at block ${blockIndex}.`);
  }
  if ((cycle === 82 || cycle === 86 || cycle === 89) && !hasWord("P")) {
    warnings.push(`Cycle G${cycle} without P dwell at block ${blockIndex}; assuming 0ms.`);
  }
}

function hasToolChange(mWords: number[]): boolean {
  return mWords.includes(6);
}

function hasDwell(gWords: number[]): boolean {
  return gWords.includes(4);
}

function getDwellSeconds(
  words: Word[],
  variables: Record<string, number>,
  warnings: string[],
  blockIndex: number,
  profile: MacroRuntimeProfile
): number {
  const p = words.filter((w) => w.letter === "P").at(-1);
  if (!p) return 0;
  return Math.max(0, evalNumeric(p.value, variables, warnings, blockIndex, profile) / 1000);
}

function getAxisTargetWithContext(
  words: Word[],
  axis: "X" | "Y" | "Z",
  variables: Record<string, number>,
  warnings: string[],
  blockIndex: number,
  profile: MacroRuntimeProfile
): number | null {
  const axisWord = words.filter((w) => w.letter === axis).at(-1);
  if (!axisWord) return null;
  return evalNumeric(axisWord.value, variables, warnings, blockIndex, profile);
}

function getMacroRuntimeProfile(
  mode: ControllerMode,
  logPreference: "controller_default" | "natural" | "base10"
): MacroRuntimeProfile {
  const resolveLogSemantics = (): "natural" | "base10" => {
    if (logPreference === "natural") return "natural";
    if (logPreference === "base10") return "base10";
    return mode === "fanuc" ? "base10" : "natural";
  };
  const logSemantics = resolveLogSemantics();
  switch (mode) {
    case "fanuc":
      return {
        mode,
        // Conservative initial profile: extend as controller parity work proceeds.
        supportedFunctions: new Set(["ABS", "ROUND", "FIX", "SQRT", "SIN", "COS", "TAN", "ATAN", "LN", "LOG"]),
        logSemantics
      };
    case "haas-legacy":
      return {
        mode,
        supportedFunctions: new Set(["ABS", "ROUND", "FIX", "FUP", "SQRT", "SIN", "COS", "TAN", "ATAN", "LN", "LOG"]),
        logSemantics
      };
    case "haas-ngc":
    default:
      return {
        mode: "haas-ngc",
        supportedFunctions: new Set(["ABS", "ROUND", "FIX", "FUP", "SQRT", "SIN", "COS", "TAN", "ATAN", "LN", "LOG", "EXP"]),
        logSemantics
      };
  }
}

function detectAlarmEvent(
  raw: string,
  variables: Record<string, number>,
  warnings: string[],
  blockIndex: number,
  profile: MacroRuntimeProfile
): SimulationResult["alarms"][number] | null {
  const upper = raw.toUpperCase();
  const match = upper.match(/#(3000|3006)\s*=\s*([+\-]?(?:\d+(?:\.\d*)?|\.\d+|#\d+|\[[^\]]+\]))/);
  if (!match) return null;
  const parameter = Number(match[1]) as 3000 | 3006;
  const code = Math.trunc(evalNumeric(match[2], variables, warnings, blockIndex, profile));
  const parenMessage = raw.match(/\(([^)]*)\)/)?.[1]?.trim();
  const semicolonMessage = raw.match(/;\s*(.*)$/)?.[1]?.trim();
  const message = parenMessage || semicolonMessage || (parameter === 3000 ? "Macro alarm triggered" : "Macro message stop");
  return {
    blockIndex,
    parameter,
    code: Number.isFinite(code) ? code : 0,
    message
  };
}

function chooseBlockEvent(
  current: SimulationResult["trace"][number]["event"],
  next: NonNullable<SimulationResult["trace"][number]["event"]>
): NonNullable<SimulationResult["trace"][number]["event"]> {
  return current ?? next;
}
