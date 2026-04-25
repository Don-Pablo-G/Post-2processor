import { exportWorkshopArtifacts } from "./export.js";
import { buildTimelineFindingsExportBundle } from "./exportBundle.js";
import { buildProveoutProgram } from "./proveout.js";
import { generateSetupSheet } from "./setupSheet.js";
import { analyzeProgram } from "./advisor.js";
import { simpleSimulate } from "../simulator/simpleSimulator.js";
import type { RunJobCheckInput, RunJobCheckResult, SafetyFinding } from "../types.js";

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
  const simulationFindings = buildSimulationFindings(simulation);

  const allFindings = [...advisor.safetyFindings, ...simulationFindings];
  const blockerCount = allFindings.filter((f) => f.severity === "blocker").length;
  const warningCount = allFindings.filter((f) => f.severity === "warning").length;
  const allowExportWithBlockers = input.exportOptions?.allowExportWithBlockers ?? false;
  const shouldBlock = blockerCount > 0 && !allowExportWithBlockers;
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

  if (input.exportOptions?.enabled) {
    if (shouldBlock) {
      messages.push("Export skipped due to blockers (override not enabled).");
    } else {
      const bundle = buildTimelineFindingsExportBundle({
        timestampIso: new Date().toISOString(),
        controller: input.simulationLimits?.controllerMode ?? "haas-ngc",
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
      exportResult = await exportWorkshopArtifacts({
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

function buildSimulationFindings(simulation: RunJobCheckResult["simulation"]): SafetyFinding[] {
  const findings: SafetyFinding[] = [];
  for (const alarm of simulation.alarms) {
    findings.push({
      severity: "blocker",
      code: "SIM_MACRO_ALARM",
      message: `Macro alarm #${alarm.parameter} code ${alarm.code}: ${alarm.message}`,
      blockIndex: alarm.blockIndex
    });
  }
  for (const entry of simulation.trace) {
    if (!entry.event) continue;
    if (entry.event.kind === "main_m99") {
      findings.push({
        severity: "blocker",
        code: "SIM_MAIN_M99",
        message: entry.event.message,
        blockIndex: entry.blockIndex
      });
    } else if (entry.event.kind === "call_depth_limit") {
      findings.push({
        severity: "warning",
        code: "SIM_CALL_DEPTH_LIMIT",
        message: entry.event.message,
        blockIndex: entry.blockIndex
      });
    }
  }
  if (simulation.warnings.some((w) => w.includes("unfinished subprogram return path"))) {
    findings.push({
      severity: "blocker",
      code: "SIM_UNFINISHED_RETURN_PATH",
      message: "Simulation ended with unfinished subprogram return path.",
      blockIndex: simulation.trace.at(-1)?.blockIndex
    });
  }
  return findings;
}

