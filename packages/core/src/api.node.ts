import { simpleFormat } from "./formatter/simpleFormatter.js";
import { simpleLint } from "./lints/simpleLint.js";
import { simpleParameterize } from "./parameterizer/suggest.js";
import { simpleParse } from "./parser/simpleParser.js";
import { simpleSimulate } from "./simulator/simpleSimulator.js";
import { buildToolingReport } from "./tooling/report.js";
import { analyzeProgram as analyzeProgramInternal } from "./workshop/advisor.js";
import { exportWorkshopArtifacts } from "./workshop/export.js";
import { buildTimelineFindingsExportBundle as buildTimelineFindingsExportBundleInternal } from "./workshop/exportBundle.js";
import { getParameterReserveProfiles } from "./workshop/parameterProfiles.js";
import { applyProveoutMarkers, buildProveoutProgram, removeProveoutMarkers } from "./workshop/proveout.js";
import { runJobCheckWorkflow } from "./workshop/runJobCheck.js";
import {
  analyzeShopFixtures as analyzeShopFixturesInternal,
  applyShopFixtureAutoFixes as applyShopFixtureAutoFixesInternal,
  importShopFixture as importShopFixtureInternal,
  previewShopFixtureAutoFixes as previewShopFixtureAutoFixesInternal,
  restoreShopFixtureManifestBackup as restoreShopFixtureManifestBackupInternal,
  runShopRegressionTests as runShopRegressionTestsInternal,
  validateShopFixturesManifest as validateShopFixturesManifestInternal
} from "./workshop/shopFixtures.js";
import { generateSetupSheet } from "./workshop/setupSheet.js";
import { exportTemplateLibrary, importTemplateLibrary, listProgramTemplates } from "./workshop/templates.js";
import type {
  ApplyShopFixtureAutoFixesInput,
  ApplyShopFixtureAutoFixesResult,
  AnalyzeShopFixturesInput,
  AnalyzeShopFixturesResult,
  ExportArtifactsInput,
  ExportArtifactsResult,
  TimelineFindingsExportBundle,
  TimelineFindingsExportBundleInput,
  ImportShopFixtureInput,
  ImportShopFixtureResult,
  PreviewShopFixtureAutoFixesInput,
  PreviewShopFixtureAutoFixesResult,
  RestoreShopFixtureManifestBackupInput,
  RestoreShopFixtureManifestBackupResult,
  RunShopRegressionTestsInput,
  RunShopRegressionTestsResult,
  ValidateShopFixturesInput,
  ValidateShopFixturesResult,
  FormatStyle,
  LintIssue,
  ParameterReserveProfile,
  ParameterizeOptions,
  ParameterizeResult,
  ProgramTemplate,
  ProgramAdvisorOptions,
  ProgramAdvisorReport,
  ProgramAst,
  RunJobCheckInput,
  RunJobCheckResult,
  ProveoutPatchResult,
  ProveoutResult,
  SetupSheet,
  SimulationResult,
  SimulatorLimits,
  TemplateLibrary,
  ToolingReport,
  ToolingReportOptions
} from "./types.js";

export type ControllerProfile = {
  id: string;
  name: string;
  defaultFormatStyle: FormatStyle;
  validateAst?: (ast: ProgramAst) => LintIssue[];
};

export function parse(code: string, profile: ControllerProfile): ProgramAst {
  return simpleParse(code, profile.id);
}

export function format(ast: ProgramAst, profile: ControllerProfile, style?: Partial<FormatStyle>): string {
  return simpleFormat(ast, { ...profile.defaultFormatStyle, ...style });
}

export function parameterize(ast: ProgramAst, options?: ParameterizeOptions): ParameterizeResult {
  return simpleParameterize(ast, options);
}

export function simulate(
  ast: ProgramAst,
  initialState: Record<string, number>,
  limits: SimulatorLimits
): SimulationResult {
  return simpleSimulate(ast, initialState, limits);
}

export function lint(ast: ProgramAst, profile: ControllerProfile): LintIssue[] {
  const commonIssues = simpleLint(ast);
  const profileIssues = profile.validateAst ? profile.validateAst(ast) : [];
  return [...commonIssues, ...profileIssues];
}

export function toolingReport(
  ast: ProgramAst,
  initialState: Record<string, number>,
  options?: ToolingReportOptions
): ToolingReport {
  return buildToolingReport(ast, initialState, options);
}

export function analyzeProgram(
  ast: ProgramAst,
  initialState: Record<string, number>,
  options?: ProgramAdvisorOptions
): ProgramAdvisorReport {
  return analyzeProgramInternal(ast, initialState, options);
}

export function getProgramTemplates(): ProgramTemplate[] {
  return listProgramTemplates();
}

export function getTemplateLibrary(): TemplateLibrary {
  return exportTemplateLibrary();
}

export function parseTemplateLibrary(sourceJson: string): TemplateLibrary {
  return importTemplateLibrary(sourceJson);
}

export function parameterReserveProfiles(): ParameterReserveProfile[] {
  return getParameterReserveProfiles();
}

export function buildSetupSheet(ast: ProgramAst, initialState: Record<string, number>): SetupSheet {
  return generateSetupSheet(ast, initialState);
}

export function proveoutProgram(ast: ProgramAst, initialState: Record<string, number>): ProveoutResult {
  return buildProveoutProgram(ast, initialState);
}

export function applyProveout(code: string, markerLines: string[]): ProveoutPatchResult {
  return applyProveoutMarkers(code, markerLines);
}

export function removeProveout(code: string): ProveoutPatchResult {
  return removeProveoutMarkers(code);
}

export async function exportWorkshopFiles(input: ExportArtifactsInput): Promise<ExportArtifactsResult> {
  return exportWorkshopArtifacts(input);
}

export function buildTimelineFindingsExportBundle(
  input: TimelineFindingsExportBundleInput
): TimelineFindingsExportBundle {
  return buildTimelineFindingsExportBundleInternal(input);
}

export async function runJobCheck(input: RunJobCheckInput): Promise<RunJobCheckResult> {
  return runJobCheckWorkflow(input);
}

export async function importShopFixture(input: ImportShopFixtureInput): Promise<ImportShopFixtureResult> {
  return importShopFixtureInternal(input);
}

export async function validateShopFixturesManifest(
  input: ValidateShopFixturesInput
): Promise<ValidateShopFixturesResult> {
  return validateShopFixturesManifestInternal(input);
}

export async function runShopRegressionTests(
  input: RunShopRegressionTestsInput
): Promise<RunShopRegressionTestsResult> {
  return runShopRegressionTestsInternal(input);
}

export async function analyzeShopFixtureHealth(
  input: AnalyzeShopFixturesInput
): Promise<AnalyzeShopFixturesResult> {
  return analyzeShopFixturesInternal(input);
}

export async function previewShopFixtureAutoFixes(
  input: PreviewShopFixtureAutoFixesInput
): Promise<PreviewShopFixtureAutoFixesResult> {
  return previewShopFixtureAutoFixesInternal(input);
}

export async function applyShopFixtureAutoFixes(
  input: ApplyShopFixtureAutoFixesInput
): Promise<ApplyShopFixtureAutoFixesResult> {
  return applyShopFixtureAutoFixesInternal(input);
}

export async function restoreShopFixtureManifestBackup(
  input: RestoreShopFixtureManifestBackupInput
): Promise<RestoreShopFixtureManifestBackupResult> {
  return restoreShopFixtureManifestBackupInternal(input);
}
