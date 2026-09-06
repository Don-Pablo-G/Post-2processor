export {
  applyProveout,
  applyShopFixtureAutoFixes,
  analyzeProgram,
  analyzeShopFixtureHealth,
  buildSetupSheet,
  buildTimelineFindingsExportBundle,
  exportWorkshopFiles,
  format,
  getProgramTemplates,
  getTemplateLibrary,
  importShopFixture,
  lint,
  lintWithProvenance,
  parameterReserveProfiles,
  parameterize,
  parseTemplateLibrary,
  parse,
  previewShopFixtureAutoFixes,
  proveoutProgram,
  removeProveout,
  restoreShopFixtureManifestBackup,
  runShopRegressionTests,
  runJobCheck,
  simulate,
  summarizeParseDiagnostics,
  toolingReport,
  validateShopFixturesManifest
} from "./api.node.js";

export {
  PARSE_DIAGNOSTICS_POLICY_PRESET_IDS,
  resolveParseDiagnosticsPolicyPreset
} from "./workshop/parseDiagnosticsPresets.js";

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

export { buildSetupSheetPdf } from "./workshop/setupSheetPdf.js";
export type { BuildSetupSheetPdfOptions } from "./workshop/setupSheetPdf.js";

export { createStoreZip, createZip, crc32, deflateRaw } from "./workshop/storeZip.js";
export type { StoreZipEntry, CreateZipOptions } from "./workshop/storeZip.js";

export type { ParseDiagnosticsPolicyPresetId } from "./workshop/parseDiagnosticsPresets.js";

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

export {
  SAFETY_FINDING_FIXES,
  getSafetyFindingFix
} from "./workshop/safetyFindingFixes.js";
export type { SafetyFindingFix } from "./workshop/safetyFindingFixes.js";

export { filterDeprecatedProfileLintIssues } from "./lints/profileRuleDeprecation.js";

export {
  CLI_SCHEMA_VERSION,
  applyStrictControllerCodesGate,
  buildBatchBlockReasonAggregation,
  buildBatchEnvelope,
  buildBatchLintIssuesByControllerCodeAggregation,
  buildBatchLintIssuesByParseDiagCodeAggregation,
  buildBatchLintIssuesBySourceAggregation,
  buildBatchParseDiagnosticsAttribution,
  buildBatchParseDiagnosticsByCodeAggregation,
  buildBatchParseDiagnosticsPolicyBreachesAggregation,
  buildBatchSafetyBlockerCodesAggregation,
  buildBatchSafetyFindingsAttribution,
  buildBatchSafetyFindingsByCodeAggregation,
  buildBatchStrictControllerCodesGatedAggregation,
  buildJobCheckEnvelope,
  buildSafetyFindingsByCode,
  formatBatchJson,
  formatBatchNdjson,
  formatBatchAggregationsAsCsv,
  formatBatchFixCandidatesAsSarifLite,
  buildBatchFixTemplateCandidates,
  buildBatchExportManifest,
  classifyBatchExportPath,
  formatBatchExportManifest,
  formatJobCheckJson,
  formatJobCheckNdjsonLine
} from "./cli/jobCheckEnvelope.js";

export type {
  CliJobCheckEnvelope,
  CliBatchEnvelope,
  CliBatchEntry,
  CliBatchWalk,
  CliBatchWalkExport,
  CliBatchControllerCodeAttribution,
  CliBatchBlockReasonAggregation,
  CliBatchLintIssuesByParseDiagCodeAggregation,
  CliBatchLintIssuesByControllerCodeAggregation,
  CliBatchParseDiagnosticsAttribution,
  CliBatchParseDiagnosticsByCodeAggregation,
  CliBatchStrictControllerCodesGatedAggregation,
  CliBatchParseDiagnosticsPolicyBreachesAggregation,
  CliBatchSafetyFindingsByCodeAggregation,
  CliBatchSafetyFindingsAttribution,
  CliBatchLintIssuesBySourceAggregation,
  CliBlockReason,
  CliLintIssuesByControllerCodeEntry,
  CliLintIssuesBySourceEntry,
  CliLintIssuesByParseDiagCodeEntry,
  CliParseDiagnosticsByCodeEntry,
  CliSafetyFindingsByCodeEntry,
  CliSafetyFindingSource,
  BatchFixCandidateRow,
  BatchFixCandidateKind,
  BatchExportManifest,
  BatchExportManifestEntry,
  BatchExportManifestPathInput
} from "./cli/jobCheckEnvelope.js";

export {
  BATCH_INPUT_EXTENSIONS,
  classifyBatchRelativePath,
  compileGlobToRegExp,
  matchesAnyGlob
} from "./cli/batchPathGlob.js";

export function isNodeCapable(): boolean {
  return true;
}

export type * from "./types.js";
export type { ControllerProfile } from "./api.node.js";
