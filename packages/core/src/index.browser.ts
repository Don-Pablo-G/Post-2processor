import {
  applyProveout,
  analyzeProgram,
  buildSetupSheet,
  buildTimelineFindingsExportBundle,
  format,
  getProgramTemplates,
  getTemplateLibrary,
  lint,
  lintWithProvenance,
  parameterReserveProfiles,
  parameterize,
  parseTemplateLibrary,
  parse,
  proveoutProgram,
  removeProveout,
  runJobCheck,
  simulate,
  summarizeParseDiagnostics,
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
  lintWithProvenance,
  parameterReserveProfiles,
  parameterize,
  parseTemplateLibrary,
  parse,
  proveoutProgram,
  removeProveout,
  runJobCheck,
  simulate,
  summarizeParseDiagnostics,
  toolingReport
};

export {
  PARSE_DIAGNOSTICS_POLICY_PRESET_IDS,
  resolveParseDiagnosticsPolicyPreset
} from "./workshop/parseDiagnosticsPresets.js";

export type { ParseDiagnosticsPolicyPresetId } from "./workshop/parseDiagnosticsPresets.js";

export {
  AUDIT_DEPRECATED_RULES_POLICY_PRESET_IDS,
  resolveAuditDeprecatedRulesPreset,
  isAuditDeprecatedRulesPolicyPresetId
} from "./cli/auditDeprecatedRulesPresets.js";

export type {
  AuditDeprecatedRulesPolicyPresetId,
  ResolvedAuditDeprecatedRulesPreset
} from "./cli/auditDeprecatedRulesPresets.js";

export {
  buildDeprecatedRuleAudit,
  parseOlderThanThreshold
} from "./cli/auditDeprecatedRules.js";

export {
  formatDeprecatedRuleAuditAsCsv,
  formatDeprecatedRuleAuditAsJson,
  formatDeprecatedRuleAuditAsText
} from "./cli/deprecatedRuleAuditFormat.js";

export {
  matchesAnyStrictControllerCodePattern,
  resolveStrictControllerCodesGate,
  STRICT_CONTROLLER_GATE_WATCH_PATTERNS
} from "./cli/strictControllerCodesGate.js";

export type { StrictControllerGateWatchPattern } from "./cli/strictControllerCodesGate.js";

export type { DeprecatedRuleAuditRow } from "./cli/auditDeprecatedRules.js";

export {
  blockSpanToRange,
  offsetToLineColumn,
  splitProgramIntoBlockSpans,
  splitProgramIntoBlocks
} from "./parser/blockSplit.js";

export type { BlockSplitOptions, ProgramBlockSpan } from "./parser/blockSplit.js";

export {
  CONTROLLER_GRAMMAR_FIXES,
  CG_DUPLICATE_ADDRESSES_PREFIX,
  getControllerGrammarFix
} from "./lints/controllerGrammarFixes.js";
export type { ControllerGrammarFix } from "./lints/controllerGrammarFixes.js";

export {
  PARSE_DIAGNOSTIC_FIXES,
  getParseDiagnosticFix
} from "./parser/parseDiagnosticFixes.js";
export type { ParseDiagnosticFix } from "./parser/parseDiagnosticFixes.js";

export { filterDeprecatedProfileLintIssues } from "./lints/profileRuleDeprecation.js";

export type {
  CliJobCheckEnvelope,
  CliBatchEnvelope,
  CliBatchEntry,
  CliBatchControllerCodeAttribution,
  CliBatchBlockReasonAggregation,
  CliBatchLintIssuesByParseDiagCodeAggregation,
  CliBatchLintIssuesByControllerCodeAggregation,
  CliBatchParseDiagnosticsByCodeAggregation,
  CliBatchStrictControllerCodesGatedAggregation,
  CliBatchParseDiagnosticsPolicyBreachesAggregation,
  CliBatchSafetyFindingsByCodeAggregation,
  CliBatchLintIssuesBySourceAggregation,
  CliBlockReason,
  CliLintIssuesByControllerCodeEntry,
  CliLintIssuesBySourceEntry,
  CliLintIssuesByParseDiagCodeEntry,
  CliParseDiagnosticsByCodeEntry,
  CliSafetyFindingsByCodeEntry
} from "./cli.js";

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
export type * from "./types.js";
export type { ControllerProfile } from "./api.js";
