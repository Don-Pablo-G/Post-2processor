import { buildTimelineFindingsExportBundle } from "./exportBundle.js";
import { buildProveoutProgram } from "./proveout.js";
import { generateSetupSheet } from "./setupSheet.js";
import { analyzeProgram } from "./advisor.js";
import { simpleSimulate } from "../simulator/simpleSimulator.js";
import type {
  RunJobCheckInput,
  RunJobCheckResult,
  SafetyFinding,
  SimulationFindingPolicy,
  ExportBlockingPolicy,
  JobCheckPolicyPreset
} from "../types.js";

const dynamicImport = new Function("path", "return import(path);") as (path: string) => Promise<unknown>;

const conservativeShopSafetyPolicy: SimulationFindingPolicy = {
  macroAlarm: { enabled: true, severity: "blocker" },
  mainM99: { enabled: true, severity: "blocker" },
  callDepthLimit: { enabled: true, severity: "warning" },
  unfinishedReturnPath: { enabled: true, severity: "blocker" },
  functionDomainError: { enabled: true, severity: "warning" },
  controlFlowOrphanEnd: { enabled: true, severity: "warning" },
  cycleParameterIssue: { enabled: true, severity: "warning" },
  unsupportedM97: { enabled: true, severity: "warning" },
  unsupportedFunction: { enabled: true, severity: "warning" },
  subprogramTargetMiss: { enabled: true, severity: "warning" },
  rapidZPlunge: { enabled: true, severity: "warning" },
  gotoTargetMiss: { enabled: true, severity: "warning" },
  maxStepsLimit: { enabled: true, severity: "warning" }
};

const conservativeExportBlockingPolicy: ExportBlockingPolicy = {
  includeAllBlockers: true,
  blockedFindingCodes: [
    "SIM_RAPID_Z_PLUNGE",
    "SIM_GOTO_TARGET_MISS",
    "SIM_MAX_STEPS_LIMIT",
    "SIM_FUNCTION_DOMAIN_ERROR",
    "SIM_CONTROL_FLOW_ORPHAN_END",
    "SIM_CYCLE_PARAMETER_ISSUE",
    "SIM_SUBPROGRAM_TARGET_MISS",
    "SIM_UNSUPPORTED_M97",
    "SIM_UNSUPPORTED_FUNCTION"
  ]
};

const simulationPolicyByPreset: Record<JobCheckPolicyPreset, SimulationFindingPolicy> = {
  strict: {
    ...conservativeShopSafetyPolicy,
    rapidZPlunge: { enabled: true, severity: "blocker" },
    functionDomainError: { enabled: true, severity: "blocker" },
    cycleParameterIssue: { enabled: true, severity: "blocker" },
    gotoTargetMiss: { enabled: true, severity: "blocker" },
    controlFlowOrphanEnd: { enabled: true, severity: "blocker" }
  },
  balanced: conservativeShopSafetyPolicy,
  permissive: {
    ...conservativeShopSafetyPolicy,
    rapidZPlunge: { enabled: true, severity: "warning" },
    functionDomainError: { enabled: true, severity: "warning" },
    cycleParameterIssue: { enabled: true, severity: "warning" },
    gotoTargetMiss: { enabled: true, severity: "warning" },
    controlFlowOrphanEnd: { enabled: false, severity: "warning" },
    maxStepsLimit: { enabled: false, severity: "warning" }
  }
};

const exportBlockingPolicyByPreset: Record<JobCheckPolicyPreset, ExportBlockingPolicy> = {
  strict: {
    includeAllBlockers: true,
    blockedFindingCodes: [
      "SIM_RAPID_Z_PLUNGE",
      "SIM_FUNCTION_DOMAIN_ERROR",
      "SIM_CYCLE_PARAMETER_ISSUE",
      "SIM_GOTO_TARGET_MISS",
      "SIM_CONTROL_FLOW_ORPHAN_END",
      "SIM_SUBPROGRAM_TARGET_MISS",
      "SIM_UNSUPPORTED_M97",
      "SIM_UNSUPPORTED_FUNCTION",
      "SIM_MAX_STEPS_LIMIT"
    ]
  },
  balanced: conservativeExportBlockingPolicy,
  permissive: {
    includeAllBlockers: false,
    blockedFindingCodes: []
  }
};

function resolveSimulationFindingPolicy(input: RunJobCheckInput): SimulationFindingPolicy {
  const preset = input.policyPreset ?? "balanced";
  const basePolicy = simulationPolicyByPreset[preset];
  const override = input.simulationFindingPolicy;
  if (!override) return basePolicy;
  const merged = { ...basePolicy };
  for (const key of Object.keys(basePolicy) as Array<keyof SimulationFindingPolicy>) {
    const overrideRule = override[key];
    if (overrideRule) {
      merged[key] = { ...merged[key], ...overrideRule };
    }
  }
  return merged;
}

function resolveExportBlockingPolicy(input: RunJobCheckInput): ExportBlockingPolicy {
  const preset = input.policyPreset ?? "balanced";
  const basePolicy = exportBlockingPolicyByPreset[preset];
  const override = input.exportBlockingPolicy;
  if (!override) return basePolicy;
  return {
    includeAllBlockers: override.includeAllBlockers ?? basePolicy.includeAllBlockers,
    blockedFindingCodes: override.blockedFindingCodes ?? basePolicy.blockedFindingCodes
  };
}

export async function runJobCheckWorkflow(input: RunJobCheckInput): Promise<RunJobCheckResult> {
  const initialState = input.initialState ?? {};
  const simulation = simpleSimulate(input.ast, initialState, {
    maxSteps: input.simulationLimits?.maxSteps ?? 10000,
    maxLoopIterations: input.simulationLimits?.maxLoopIterations ?? 1000,
    rapidRateMmPerMin: input.simulationLimits?.rapidRateMmPerMin,
    defaultFeedMmPerMin: input.simulationLimits?.defaultFeedMmPerMin,
    toolChangeSeconds: input.simulationLimits?.toolChangeSeconds,
    controllerMode: input.simulationLimits?.controllerMode,
    subprogramTargetPolicy: input.simulationLimits?.subprogramTargetPolicy
  });
  const advisor = analyzeProgram(input.ast, initialState, input.advisorOptions);
  const setupSheet = generateSetupSheet(input.ast, initialState);
  const proveout = buildProveoutProgram(input.ast, initialState);
  const simulationFindings = buildSimulationFindings(simulation, resolveSimulationFindingPolicy(input));
  const exportBlockingPolicy = resolveExportBlockingPolicy(input);

  const allFindings = [...advisor.safetyFindings, ...simulationFindings];
  const blockerCount = allFindings.filter((f) => f.severity === "blocker").length;
  const warningCount = allFindings.filter((f) => f.severity === "warning").length;
  const allowExportWithBlockers = input.exportOptions?.allowExportWithBlockers ?? false;
  const blockedCodes = new Set(exportBlockingPolicy.blockedFindingCodes);
  const policyBlockedFindings = allFindings.filter(
    (f) =>
      blockedCodes.has(f.code) || (exportBlockingPolicy.includeAllBlockers && f.severity === "blocker")
  );
  const shouldBlock = policyBlockedFindings.length > 0 && !allowExportWithBlockers;
  const messages: string[] = [];
  let exportResult: RunJobCheckResult["exportResult"];

  if (blockerCount > 0) {
    messages.push(`Detected ${blockerCount} blocker(s); resolve before machine run.`);
  }
  if (simulationFindings.length > 0) {
    for (const finding of simulationFindings) {
      const at = finding.blockIndex !== undefined ? ` at block ${finding.blockIndex}` : "";
      messages.push(`Simulation ${finding.severity}: ${finding.code}${at} - ${finding.message}`);
    }
  }
  if (warningCount > 0) {
    messages.push(`Detected ${warningCount} warning(s); review before release.`);
  }
  if (policyBlockedFindings.length > 0) {
    const codes = [...new Set(policyBlockedFindings.map((f) => f.code))].sort().join(", ");
    messages.push(`Export safety gate active due to findings: ${codes}.`);
  }

  if (input.exportOptions?.enabled) {
    if (shouldBlock) {
      messages.push("Export skipped due to blockers (override not enabled).");
    } else {
      const exportMod = (await dynamicImport("./export.js")) as {
        exportWorkshopArtifacts: (input: {
          baseDirectory: string;
          baseName?: string;
          setupSheetTxt: string;
          setupSheetMarkdown: string;
          proveoutCode: string;
          timelineTxt?: string;
          timelineMarkdown?: string;
          findingsTxt?: string;
          findingsMarkdown?: string;
        }) => Promise<NonNullable<RunJobCheckResult["exportResult"]>>;
      };
      const bundle = buildTimelineFindingsExportBundle({
        timestampIso: new Date().toISOString(),
        controller: input.simulationLimits?.controllerMode ?? "haas-ngc",
        policyPreset: input.policyPreset ?? "balanced",
        policyPresetSource: "unknown",
        subprogramTargetPolicy: input.simulationLimits?.subprogramTargetPolicy,
        logSemantics: input.simulationLimits?.logSemantics,
        score: advisor.readyToRunScore,
        timelineEntries: simulation.trace
          .filter((entry) => entry.event)
          .map((entry) => ({
            blockIndex: entry.blockIndex,
            kind: entry.event!.kind,
            message: entry.event!.message
          })),
        findings: allFindings
      });
      exportResult = await exportMod.exportWorkshopArtifacts({
        baseDirectory: input.exportOptions.baseDirectory,
        baseName: input.exportOptions.baseName ?? "program",
        setupSheetTxt: setupSheet.exportTxt,
        setupSheetMarkdown: setupSheet.exportMarkdown,
        proveoutCode: proveout.code,
        timelineTxt: bundle.timelineTxt,
        timelineMarkdown: bundle.timelineMarkdown,
        findingsTxt: bundle.findingsTxt,
        findingsMarkdown: bundle.findingsMarkdown
      });
      messages.push(`Exported ${exportResult.artifacts.length} artifacts.`);
    }
  }

  return {
    readyToRunScore: advisor.readyToRunScore,
    blockerCount,
    warningCount,
    blocked: shouldBlock,
    simulation,
    simulationFindings,
    advisor,
    setupSheet,
    proveout,
    exportResult,
    messages
  };
}

function buildSimulationFindings(
  simulation: RunJobCheckResult["simulation"],
  policy: SimulationFindingPolicy
): SafetyFinding[] {
  const findings: SafetyFinding[] = [];
  let hasCallDepthLimitFinding = false;
  const pushPolicyFinding = (
    key: keyof SimulationFindingPolicy,
    code: string,
    message: string,
    blockIndex?: number
  ): void => {
    const rule = policy[key];
    if (!rule.enabled) return;
    findings.push({ severity: rule.severity, code, message, blockIndex });
  };
  for (const alarm of simulation.alarms) {
    pushPolicyFinding(
      "macroAlarm",
      "SIM_MACRO_ALARM",
      `Macro alarm #${alarm.parameter} code ${alarm.code}: ${alarm.message}`,
      alarm.blockIndex
    );
  }
  for (const entry of simulation.trace) {
    if (!entry.event) continue;
    if (entry.event.kind === "main_m99") {
      pushPolicyFinding("mainM99", "SIM_MAIN_M99", entry.event.message, entry.blockIndex);
    } else if (entry.event.kind === "call_depth_limit") {
      if (!hasCallDepthLimitFinding) {
        pushPolicyFinding("callDepthLimit", "SIM_CALL_DEPTH_LIMIT", entry.event.message, entry.blockIndex);
        hasCallDepthLimitFinding = true;
      }
    }
  }
  if (simulation.warnings.some((w) => w.includes("unfinished subprogram return path"))) {
    pushPolicyFinding(
      "unfinishedReturnPath",
      "SIM_UNFINISHED_RETURN_PATH",
      "Simulation ended with unfinished subprogram return path.",
      simulation.trace.at(-1)?.blockIndex
    );
  }
  for (const functionDomainErrorWarning of simulation.warnings.filter((w) => w.includes("domain error"))) {
    pushPolicyFinding(
      "functionDomainError",
      "SIM_FUNCTION_DOMAIN_ERROR",
      functionDomainErrorWarning,
      simulation.trace.at(-1)?.blockIndex
    );
  }
  const orphanEndWarning = simulation.warnings.find((w) => w.includes("has no matching WHILE"));
  if (orphanEndWarning) {
    pushPolicyFinding(
      "controlFlowOrphanEnd",
      "SIM_CONTROL_FLOW_ORPHAN_END",
      orphanEndWarning,
      simulation.trace.at(-1)?.blockIndex
    );
  }
  for (const cycleParameterWarning of simulation.warnings.filter((w) => w.startsWith("Cycle G"))) {
    pushPolicyFinding(
      "cycleParameterIssue",
      "SIM_CYCLE_PARAMETER_ISSUE",
      cycleParameterWarning,
      simulation.trace.at(-1)?.blockIndex
    );
  }
  if (simulation.warnings.some((w) => w.includes("M97 local subprogram call is not supported in fanuc mode"))) {
    pushPolicyFinding(
      "unsupportedM97",
      "SIM_UNSUPPORTED_M97",
      "Fanuc simulation encountered unsupported M97 local subprogram call.",
      simulation.trace.at(-1)?.blockIndex
    );
  }
  for (const unsupportedFunctionWarning of simulation.warnings.filter(
    (w) => w.startsWith("Function ") && w.includes("is not supported in fanuc mode")
  )) {
    pushPolicyFinding(
      "unsupportedFunction",
      "SIM_UNSUPPORTED_FUNCTION",
      unsupportedFunctionWarning,
      simulation.trace.at(-1)?.blockIndex
    );
  }
  for (const subprogramTargetMissWarning of simulation.warnings.filter(
    (w) => w.includes("target O") && w.includes("not found")
  )) {
    pushPolicyFinding(
      "subprogramTargetMiss",
      "SIM_SUBPROGRAM_TARGET_MISS",
      subprogramTargetMissWarning,
      simulation.trace.at(-1)?.blockIndex
    );
  }
  for (const rapidZPlungeWarning of simulation.warnings.filter((w) => w.includes("rapid (G0) Z move down"))) {
    pushPolicyFinding(
      "rapidZPlunge",
      "SIM_RAPID_Z_PLUNGE",
      rapidZPlungeWarning,
      simulation.trace.at(-1)?.blockIndex
    );
  }
  const gotoTargetMissWarning =
    simulation.warnings.find((w) => w.startsWith("IF GOTO target N") && w.includes("not found")) ??
    simulation.warnings.find((w) => w.startsWith("GOTO target N") && w.includes("not found"));
  if (gotoTargetMissWarning) {
    pushPolicyFinding(
      "gotoTargetMiss",
      "SIM_GOTO_TARGET_MISS",
      gotoTargetMissWarning,
      simulation.trace.at(-1)?.blockIndex
    );
  }
  if (simulation.warnings.some((w) => w.includes("maxSteps limit before program end"))) {
    pushPolicyFinding(
      "maxStepsLimit",
      "SIM_MAX_STEPS_LIMIT",
      "Simulation reached maxSteps limit before program end.",
      simulation.trace.at(-1)?.blockIndex
    );
  }
  return findings;
}

