import { simpleSimulate } from "../simulator/simpleSimulator.js";
import type {
  Block,
  CriticalEvent,
  OptionalStopSuggestion,
  ProgramAdvisorOptions,
  ProgramAdvisorReport,
  ProgramAst,
  SafetyFinding,
  SetupOptimization,
  Word
} from "../types.js";

export function analyzeProgram(
  ast: ProgramAst,
  initialState: Record<string, number>,
  options?: ProgramAdvisorOptions
): ProgramAdvisorReport {
  const findings = collectSafetyFindings(ast, options);
  const criticalEvents = buildCriticalEvents(ast, initialState);
  const setupOptimizations = suggestSetupOptimizations(ast);
  const checklist = buildChecklist(findings);
  const optionalStopSuggestions = buildOptionalStopSuggestions(ast, criticalEvents);
  const parameterFrontMatter = buildParameterFrontMatter(ast);
  const operatorViewProgram = buildOperatorView(ast);
  const readyToRunScore = computeReadyToRunScore(findings);

  return {
    readyToRunScore,
    safetyFindings: findings,
    checklist,
    criticalEvents,
    setupOptimizations,
    optionalStopSuggestions,
    parameterFrontMatter,
    operatorViewProgram
  };
}

function collectSafetyFindings(ast: ProgramAst, options?: ProgramAdvisorOptions): SafetyFinding[] {
  const findings: SafetyFinding[] = [];
  let seenG43 = false;
  let seenSafeStart = false;
  let seenM30 = false;
  let currentTool: number | null = null;
  const toolHasLengthComp = new Map<number, boolean>();
  const usedToolOffsets = new Map<number, number>();

  ast.blocks.forEach((block, index) => {
    const code = cleanCode(block.raw).toUpperCase();
    const words = parseWords(code, block.words);
    const gCodes = words.filter((w) => w.letter === "G").map((w) => parseIntSafe(w.value));
    const mCodes = words.filter((w) => w.letter === "M").map((w) => parseIntSafe(w.value));
    const t = words.filter((w) => w.letter === "T").at(-1);
    const h = words.filter((w) => w.letter === "H").at(-1);
    const z = words.filter((w) => w.letter === "Z").at(-1);

    if (t) currentTool = parseIntSafe(t.value);
    if (gCodes.includes(43)) {
      seenG43 = true;
      if (currentTool !== null) {
        toolHasLengthComp.set(currentTool, true);
      }
    }
    if (h && currentTool !== null) {
      usedToolOffsets.set(currentTool, parseIntSafe(h.value));
    }
    if (mCodes.includes(30) || mCodes.includes(2)) seenM30 = true;

    if (index <= 5 && gCodes.includes(90) && gCodes.includes(17)) {
      seenSafeStart = true;
    }

    if (z && parseNumeric(z.value) < 0 && !seenG43) {
      findings.push({
        severity: "blocker",
        code: "MISSING_G43_BEFORE_NEGATIVE_Z",
        message: "Negative Z move appears before G43 length compensation.",
        blockIndex: index
      });
    }

    const cycle = gCodes.find((g) => g === 73 || (g >= 81 && g <= 89));
    if (cycle && !words.some((w) => w.letter === "R")) {
      findings.push({
        severity: "warning",
        code: "CANNED_CYCLE_NO_R",
        message: `G${cycle} used without R level.`,
        blockIndex: index
      });
    }
  });

  if (!seenSafeStart) {
    findings.push({
      severity: "warning",
      code: "SAFE_START_NOT_DETECTED",
      message: "Safe-start modal block (G90/G17 etc.) not detected near program start."
    });
  }
  if (!seenM30) {
    findings.push({
      severity: "blocker",
      code: "MISSING_PROGRAM_END",
      message: "Program end M30/M2 not detected."
    });
  }

  for (const [tool, hasComp] of toolHasLengthComp.entries()) {
    if (!hasComp) {
      findings.push({
        severity: "warning",
        code: "TOOL_WITHOUT_G43",
        message: `Tool T${tool} is used but no G43 was detected for it.`
      });
    }
  }
  for (const [tool, h] of usedToolOffsets.entries()) {
    if (tool !== h) {
      findings.push({
        severity: "warning",
        code: "TOOL_H_MISMATCH",
        message: `Tool T${tool} uses H${h}; verify this is intentional.`
      });
    }
  }

  findings.push(...collectEnvelopeFindings(ast, options));
  findings.push(...collectFusionStyleFindings(ast));

  return findings;
}

function buildCriticalEvents(ast: ProgramAst, initialState: Record<string, number>): CriticalEvent[] {
  const sim = simpleSimulate(ast, initialState, { maxSteps: 100000, maxLoopIterations: 10000 });
  const events: CriticalEvent[] = [];
  let firstMotionAdded = false;
  let firstCutAdded = false;
  let firstToolChangeAdded = false;
  let firstWcsAdded = false;
  let deepest: { z: number; block: number } | null = null;

  sim.trace.forEach((entry) => {
    const code = cleanCode(entry.raw).toUpperCase();
    if (!firstMotionAdded && /\b[XYZ]\s*[+\-]?(?:\d+(?:\.\d*)?|\.\d+|#\d+)/.test(code)) {
      events.push({ kind: "first_motion", blockIndex: entry.blockIndex, description: "First motion command." });
      firstMotionAdded = true;
    }
    const z = extractZ(code);
    if (z !== null) {
      if (deepest === null || z < deepest.z) deepest = { z, block: entry.blockIndex };
      if (!firstCutAdded && z < 0) {
        events.push({ kind: "first_cut", blockIndex: entry.blockIndex, description: `First cut below Z0 at Z${z}.` });
        firstCutAdded = true;
      }
    }
    if (!firstToolChangeAdded && /\bM\s*6\b/.test(code)) {
      events.push({ kind: "first_tool_change", blockIndex: entry.blockIndex, description: "First tool change (M6)." });
      firstToolChangeAdded = true;
    }
    if (!firstWcsAdded && /\bG\s*(5[4-9]|154)\b/.test(code)) {
      events.push({ kind: "first_wcs_change", blockIndex: entry.blockIndex, description: "First work offset call." });
      firstWcsAdded = true;
    }
  });

  if (deepest !== null) {
    const deepestEntry = deepest as { z: number; block: number };
    events.push({
      kind: "deepest_z",
      blockIndex: deepestEntry.block,
      description: `Deepest Z reached: ${deepestEntry.z}.`
    });
  }
  if (sim.trace.length > 0) {
    const end = sim.trace[sim.trace.length - 1];
    events.push({ kind: "program_end", blockIndex: end.blockIndex, description: "Program execution end." });
  }
  return events;
}

function suggestSetupOptimizations(ast: ProgramAst): SetupOptimization[] {
  const toolsInOrder: number[] = [];
  ast.blocks.forEach((block) => {
    const code = cleanCode(block.raw).toUpperCase();
    const tMatch = code.match(/\bT\s*(\d+)/);
    if (tMatch) toolsInOrder.push(Number(tMatch[1]));
  });
  if (toolsInOrder.length < 3) return [];

  let changes = 0;
  for (let i = 1; i < toolsInOrder.length; i += 1) {
    if (toolsInOrder[i] !== toolsInOrder[i - 1]) changes += 1;
  }
  const unique = new Set(toolsInOrder).size;
  const theoreticalMin = Math.max(0, unique - 1);
  const saved = Math.max(0, changes - theoreticalMin);
  if (saved <= 0) return [];
  return [
    {
      kind: "group_by_tool",
      message: "Operations can likely be grouped by tool to reduce setup/runtime changeovers.",
      estimatedToolChangesSaved: saved
    }
  ];
}

function buildChecklist(findings: SafetyFinding[]): string[] {
  const list = [
    "Verify tool lengths and offsets against setup sheet.",
    "Verify active WCS and stock Z0 before cycle start.",
    "Run dry test above part (single block / optional stop enabled).",
    "Start first cut with feed override <= 25% and rapid <= 5%.",
    "Confirm coolant/spindle direction on first operation."
  ];
  if (findings.some((f) => f.severity === "blocker")) {
    list.unshift("Resolve all blocker findings before any machine run.");
  }
  if (findings.some((f) => f.code === "CLAMP_ZONE_COLLISION_RISK")) {
    list.unshift("Verify clamp clearances; collision-risk motion detected.");
  }
  return list;
}

function buildOperatorView(ast: ProgramAst): string {
  return ast.blocks
    .map((block) => {
      const raw = block.raw.trim();
      const code = cleanCode(raw).toUpperCase();
      if (/\bM\s*6\b/.test(code)) return `(OPERATOR: TOOL CHANGE CHECK)\n${raw}`;
      if (/\bG\s*43\b/.test(code)) return `(OPERATOR: LENGTH/OFFSET ACTIVE)\n${raw}`;
      if (/\bG\s*(5[4-9]|154)\b/.test(code)) return `(OPERATOR: VERIFY WORK OFFSET)\n${raw}`;
      if (/\bG\s*(81|82|83|84|85|86|87|88|89)\b/.test(code)) return `(OPERATOR: CANNED CYCLE START)\n${raw}`;
      return raw;
    })
    .join("\n");
}

function collectEnvelopeFindings(ast: ProgramAst, options?: ProgramAdvisorOptions): SafetyFinding[] {
  const findings: SafetyFinding[] = [];
  if (!options?.stock && (!options?.clampZones || options.clampZones.length === 0)) return findings;

  ast.blocks.forEach((block, index) => {
    const code = cleanCode(block.raw).toUpperCase();
    const x = extractAxis(code, "X");
    const y = extractAxis(code, "Y");
    const z = extractAxis(code, "Z");

    if (options.stock) {
      if (x !== null && (x < options.stock.minX || x > options.stock.maxX)) {
        findings.push({
          severity: "warning",
          code: "X_OUTSIDE_STOCK",
          message: `X${x} outside declared stock range (${options.stock.minX}..${options.stock.maxX}).`,
          blockIndex: index
        });
      }
      if (y !== null && (y < options.stock.minY || y > options.stock.maxY)) {
        findings.push({
          severity: "warning",
          code: "Y_OUTSIDE_STOCK",
          message: `Y${y} outside declared stock range (${options.stock.minY}..${options.stock.maxY}).`,
          blockIndex: index
        });
      }
      if (z !== null && (z < options.stock.bottomZ || z > options.stock.topZ + 30)) {
        findings.push({
          severity: "warning",
          code: "Z_OUTSIDE_EXPECTED_ENVELOPE",
          message: `Z${z} outside expected envelope (${options.stock.bottomZ}..${options.stock.topZ + 30}).`,
          blockIndex: index
        });
      }
    }

    for (const clamp of options.clampZones ?? []) {
      if (x === null || y === null) continue;
      const inXY = x >= clamp.minX && x <= clamp.maxX && y >= clamp.minY && y <= clamp.maxY;
      const zMin = clamp.minZ ?? -9999;
      const zMax = clamp.maxZ ?? 9999;
      const inZ = z === null ? true : z >= zMin && z <= zMax;
      if (inXY && inZ) {
        findings.push({
          severity: "blocker",
          code: "CLAMP_ZONE_COLLISION_RISK",
          message: `Motion enters clamp zone "${clamp.name}".`,
          blockIndex: index
        });
      }
    }
  });

  return dedupeFindings(findings);
}

function collectFusionStyleFindings(ast: ProgramAst): SafetyFinding[] {
  const findings: SafetyFinding[] = [];
  let hasG94 = false;
  let hasG95 = false;
  let hasMetric = false;
  let hasImperial = false;

  ast.blocks.forEach((block, index) => {
    const code = cleanCode(block.raw).toUpperCase();
    if (/\bG\s*94\b/.test(code)) hasG94 = true;
    if (/\bG\s*95\b/.test(code)) hasG95 = true;
    if (/\bG\s*21\b/.test(code)) hasMetric = true;
    if (/\bG\s*20\b/.test(code)) hasImperial = true;

    if (/\bG\s*43\b/.test(code) && !/\bH\s*/.test(code)) {
      findings.push({
        severity: "warning",
        code: "G43_WITHOUT_H",
        message: "G43 detected without explicit H value.",
        blockIndex: index
      });
    }
  });

  if (hasG94 && hasG95) {
    findings.push({
      severity: "warning",
      code: "MIXED_FEED_MODES",
      message: "Both G94 and G95 are present; verify post intent."
    });
  }
  if (hasMetric && hasImperial) {
    findings.push({
      severity: "blocker",
      code: "MIXED_UNITS",
      message: "Both G20 and G21 are present in one program."
    });
  }

  return findings;
}

function buildOptionalStopSuggestions(ast: ProgramAst, events: CriticalEvent[]): OptionalStopSuggestion[] {
  const suggestions: OptionalStopSuggestion[] = [];
  const firstCut = events.find((e) => e.kind === "first_cut");
  const deepest = events.find((e) => e.kind === "deepest_z");
  const firstCycle = ast.blocks.findIndex((b) => /\bG\s*(81|82|83|84|85|86|87|88|89)\b/i.test(cleanCode(b.raw)));
  if (firstCut) {
    suggestions.push({
      blockIndex: firstCut.blockIndex,
      reason: "Verify first material engagement and offset correctness.",
      suggestedLine: "(OPTIONAL STOP: CHECK FIRST CUT) M01"
    });
  }
  if (firstCycle >= 0) {
    suggestions.push({
      blockIndex: firstCycle,
      reason: "Confirm first canned-cycle entry and R-plane behavior.",
      suggestedLine: "(OPTIONAL STOP: CHECK CANNED CYCLE ENTRY) M01"
    });
  }
  if (deepest) {
    suggestions.push({
      blockIndex: deepest.blockIndex,
      reason: "Pause before deepest cut for clamp/chip evacuation verification.",
      suggestedLine: "(OPTIONAL STOP: BEFORE DEEPEST Z) M01"
    });
  }
  return suggestions;
}

function buildParameterFrontMatter(ast: ProgramAst): string {
  const used = new Set<number>();
  ast.blocks.forEach((b) => {
    for (const m of b.raw.matchAll(/#(\d+)/g)) used.add(Number(m[1]));
  });
  const candidates = [100, 101, 102, 103, 104, 105, 106, 107].filter((n) => !used.has(n));
  const assigned = candidates.slice(0, 4);
  if (assigned.length < 4) return "(INFO: NOT ENOUGH FREE LOCAL MACROS FOR FRONT-MATTER)";
  return [
    "(--- SHOP PARAM FRONT-MATTER ---)",
    `#${assigned[0]} = 0    (STOCK_TOP_Z)`,
    `#${assigned[1]} = 0    (SAFE_CLEARANCE_Z)`,
    `#${assigned[2]} = 0    (FINISH_ALLOWANCE_MM)`,
    `#${assigned[3]} = 0    (PROVEOUT_FEED_FACTOR)`,
    "(-------------------------------)"
  ].join("\n");
}

function computeReadyToRunScore(findings: SafetyFinding[]): number {
  const blockers = findings.filter((f) => f.severity === "blocker").length;
  const warnings = findings.filter((f) => f.severity === "warning").length;
  let score = 100 - blockers * 35 - warnings * 8;
  if (blockers > 0) score = Math.min(score, 49);
  return Math.max(0, Math.min(100, score));
}

function cleanCode(raw: string): string {
  return raw.replace(/\([^)]*\)/g, "").replace(/;.*$/g, "").trim();
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

function parseIntSafe(v: string): number {
  const n = parseFloat(v.replace("#", ""));
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function parseNumeric(v: string): number {
  const n = Number(v.replace("#", ""));
  return Number.isFinite(n) ? n : 0;
}

function extractAxis(code: string, axis: "X" | "Y" | "Z"): number | null {
  const m = code.match(new RegExp(`\\b${axis}\\s*([+\\-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+))`));
  if (!m) return null;
  return Number(m[1]);
}

function extractZ(code: string): number | null {
  const m = code.match(/\bZ\s*([+\-]?(?:\d+(?:\.\d*)?|\.\d+))/);
  if (!m) return null;
  return Number(m[1]);
}

function dedupeFindings(findings: SafetyFinding[]): SafetyFinding[] {
  const seen = new Set<string>();
  const out: SafetyFinding[] = [];
  for (const finding of findings) {
    const key = `${finding.code}:${finding.blockIndex ?? -1}:${finding.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(finding);
  }
  return out;
}
