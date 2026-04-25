import {
  applyProveout,
  analyzeProgram,
  buildSetupSheet,
  buildTimelineFindingsExportBundle,
  format,
  getProgramTemplates,
  getTemplateLibrary,
  lint,
  parameterReserveProfiles,
  parameterize,
  parseTemplateLibrary,
  parse,
  proveoutProgram,
  removeProveout,
  runJobCheck,
  simulate,
  toolingReport
} from "./api.js";
import type {
  ApplyShopFixtureAutoFixesInput,
  ApplyShopFixtureAutoFixesResult,
  AnalyzeShopFixturesInput,
  AnalyzeShopFixturesResult,
  ExportArtifactsInput,
  ExportArtifactsResult,
  ImportShopFixtureInput,
  ImportShopFixtureResult,
  PreviewShopFixtureAutoFixesInput,
  PreviewShopFixtureAutoFixesResult,
  RestoreShopFixtureManifestBackupInput,
  RestoreShopFixtureManifestBackupResult,
  RunShopRegressionTestsInput,
  RunShopRegressionTestsResult,
  ValidateShopFixturesInput,
  ValidateShopFixturesResult
} from "./types.js";

const BROWSER_ONLY_ERROR =
  "This function requires Node.js filesystem/process access and is not available from @cnc/core/browser.";

function rejectNodeOnly(functionName: string): never {
  throw new Error(`${functionName}: ${BROWSER_ONLY_ERROR}`);
}

export {
  applyProveout,
  analyzeProgram,
  buildSetupSheet,
  buildTimelineFindingsExportBundle,
  format,
  getProgramTemplates,
  getTemplateLibrary,
  lint,
  parameterReserveProfiles,
  parameterize,
  parseTemplateLibrary,
  parse,
  proveoutProgram,
  removeProveout,
  runJobCheck,
  simulate,
  toolingReport
};

export function isNodeCapable(): boolean {
  return false;
}

export async function exportWorkshopFiles(_input: ExportArtifactsInput): Promise<ExportArtifactsResult> {
  return rejectNodeOnly("exportWorkshopFiles");
}

export async function importShopFixture(_input: ImportShopFixtureInput): Promise<ImportShopFixtureResult> {
  return rejectNodeOnly("importShopFixture");
}

export async function validateShopFixturesManifest(
  _input: ValidateShopFixturesInput
): Promise<ValidateShopFixturesResult> {
  return rejectNodeOnly("validateShopFixturesManifest");
}

export async function runShopRegressionTests(_input: RunShopRegressionTestsInput): Promise<RunShopRegressionTestsResult> {
  return rejectNodeOnly("runShopRegressionTests");
}

export async function analyzeShopFixtureHealth(_input: AnalyzeShopFixturesInput): Promise<AnalyzeShopFixturesResult> {
  return rejectNodeOnly("analyzeShopFixtureHealth");
}

export async function previewShopFixtureAutoFixes(
  _input: PreviewShopFixtureAutoFixesInput
): Promise<PreviewShopFixtureAutoFixesResult> {
  return rejectNodeOnly("previewShopFixtureAutoFixes");
}

export async function applyShopFixtureAutoFixes(
  _input: ApplyShopFixtureAutoFixesInput
): Promise<ApplyShopFixtureAutoFixesResult> {
  return rejectNodeOnly("applyShopFixtureAutoFixes");
}

export async function restoreShopFixtureManifestBackup(
  _input: RestoreShopFixtureManifestBackupInput
): Promise<RestoreShopFixtureManifestBackupResult> {
  return rejectNodeOnly("restoreShopFixtureManifestBackup");
}
export type {
  Block,
  CriticalEvent,
  FormatStyle,
  LintIssue,
  ParameterReserveProfile,
  ParameterizeOptions,
  ParameterSuggestion,
  ParameterizeResult,
  ProgramAdvisorOptions,
  ProgramAdvisorReport,
  ProgramAst,
  ProgramTemplate,
  OptionalStopSuggestion,
  ExportArtifactsInput,
  ExportArtifactsResult,
  ExportedArtifact,
  ApplyShopFixtureAutoFixesInput,
  ApplyShopFixtureAutoFixesResult,
  ImportShopFixtureInput,
  ImportShopFixtureResult,
  AnalyzeShopFixturesInput,
  AnalyzeShopFixturesResult,
  FixtureHealthItem,
  PreviewShopFixtureAutoFixesInput,
  PreviewShopFixtureAutoFixesResult,
  RestoreShopFixtureManifestBackupInput,
  RestoreShopFixtureManifestBackupResult,
  ShopFixtureAutoFixChange,
  RunShopRegressionTestsInput,
  RunShopRegressionTestsResult,
  ValidateShopFixturesInput,
  ValidateShopFixturesResult,
  RunJobCheckInput,
  RunJobCheckResult,
  ProveoutPatchResult,
  ProveoutResult,
  SafetyFinding,
  SimulationResult,
  SimulatorLimits,
  SetupSheet,
  SetupOptimization,
  TimelineFindingsExportBundle,
  TimelineFindingsExportBundleInput,
  TemplateLibrary,
  ToolUsage,
  ToolingReport,
  ToolingReportOptions,
  Word
} from "./types.js";
export type { ControllerProfile } from "./api.js";
