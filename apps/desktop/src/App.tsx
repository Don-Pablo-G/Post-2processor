import {
  applyProveout,
  analyzeProgram,
  analyzeShopFixtureHealth,
  applyShopFixtureAutoFixes,
  buildSetupSheet,
  buildTimelineFindingsExportBundle,
  exportWorkshopFiles,
  format,
  getTemplateLibrary,
  importShopFixture,
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
  isNodeCapable,
  toolingReport,
  validateShopFixturesManifest
} from "@cnc/core/browser";
import type {
  AnalyzeShopFixturesResult,
  PreviewShopFixtureAutoFixesResult,
  RunJobCheckResult
} from "@cnc/core/browser";
import { haasNgcProfile } from "@cnc/profile-haas-ngc";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  addPolicyPresetContextToSetupSheetBundle,
  buildPolicyUiEventPayload,
  defaultPolicyPresetForController,
  derivePolicyDriftWarning,
  derivePolicyUiEventEmissionDecision,
  derivePolicyPresetVisualState,
  filterPolicyAuditTrailByCategory,
  hydrateAuditEntriesFromTemplate,
  isAuditTrailExportFormat,
  resolvePolicyPresetHintState,
  resolvePolicyPresetShortcutAction,
  selectPersistableAuditEntries,
  selectPolicyAuditTrailExportPayload,
  summarizePolicyAuditTrail,
  type AuditTrailExportFormat,
  type PolicyAuditTrailCategory,
  type PolicyUiEventExtras,
  type PolicyUiEventPayload
} from "./policyPresetHint";
import { downloadPolicyAuditTrail } from "./auditTrailDownload";
import {
  DEFAULT_PARSE_DIAGNOSTICS_GROUP_CAP,
  DIAGNOSTICS_DEMO_PROGRAM,
  PARSE_DIAGNOSTICS_POLICY_PRESETS,
  applyDiagnosticsCap,
  applyParseDiagnosticsPolicyPreset,
  buildAllFixesPayload,
  buildAllLintFixesPayload,
  buildDiagnosticsSummaryChip,
  buildLintFixLine,
  buildLintIssuesSummaryChip,
  buildParseDiagBreachSeveritiesBriefField,
  buildParseDiagBreachesBriefField,
  buildParseDiagnosticsBreachContext,
  buildParseDiagnosticsPolicyBriefField,
  buildParseFixLine,
  groupAndSortDiagnostics,
  groupLintIssuesBySource,
  resolveParseDiagnosticsPolicy,
  formatLintIssuesSummaryChip,
  selectLintDemoProgram,
  selectMatchingParseDiagnosticsPolicyPreset,
  serializeParseDiagnosticsPolicy,
  summarizeLintIssuesBySource,
  summarizeParseDiagBreachSeverities,
  type LintIssueLike,
  type LintIssueProvenanceSource,
  type LintIssuesSummaryLike,
  type ParseDiagnosticLike,
  type ParseDiagnosticsPolicyPreset,
  type ParseDiagnosticsPolicyResolved,
  type ParseDiagnosticsPolicyUiState
} from "./parseDiagnosticsView";
import {
  DEPRECATED_RULES_AUDIT_POLICY_PRESETS,
  deprecatedRulesAuditPresetLabel,
  formatDeprecatedRulesAuditChip,
  formatDeprecatedRulesAuditForExport,
  runDeprecatedRulesAudit,
  type DeprecatedRulesAuditPolicyPresetId
} from "./deprecatedRulesAuditView";
import { downloadDeprecatedRulesAuditReport } from "./deprecatedRulesAuditDownload";
import {
  evaluateStrictControllerGate,
  formatStrictControllerGateChip,
  formatStrictControllerGateForExport,
  STRICT_CONTROLLER_GATE_WATCH_PRESETS,
  strictControllerGatePatternLabel,
  type StrictControllerGateWatchPattern
} from "./strictControllerGateView";
import {
  formatPolicyBreachRollupChip,
  formatPolicyBreachesForExport
} from "./policyBreachView";
import {
  buildSafetyFindingsByCodeFromFindings,
  formatSafetyFindingsChip,
  formatSafetyFindingsForExport
} from "./safetyFindingsView";

const SAMPLE = `O1001 (NGC SAMPLE)
G90 G54 G17
G0 X0. Y0.
G1 X10. Y5. F250.
X10.
M30`;

type UiLanguage = "pl" | "en";
type ControllerProfileKey = "haas-ngc" | "haas-legacy" | "fanuc";
type SubprogramTargetPolicy = "shop_friendly" | "strict_controller";
type LogSemantics = "controller_default" | "natural" | "base10";
type JobCheckPolicyPreset = "strict" | "balanced" | "permissive";
type TimelineFilterKey = "alarms" | "flow" | "control";

declare global {
  interface Window {
    __CNC_E2E_EXPORT_MOCK__?: {
      exportDirectory: string;
      artifactCount: number;
    };
  }
}

const UI_TEXT: Record<
  UiLanguage,
  {
    title: string;
    subtitle: string;
    languageLabel: string;
    operatorReviewMode: string;
    programInput: string;
    formattedOutput: string;
    removeStandaloneOptionalStops: string;
    parameterSuggestions: string;
    parameterPreset: string;
    lintIssues: string;
    simulation: string;
    simulationTimeline: string;
    noSimulationEvents: string;
    timelineFilters: string;
    filterAlarms: string;
    filterFlow: string;
    filterControl: string;
    logSemantics: string;
    logSemanticsControllerDefault: string;
    logSemanticsNatural: string;
    logSemanticsBase10: string;
    subprogramTargetPolicy: string;
    shopFriendlyPolicy: string;
    strictControllerPolicy: string;
    setterReport: string;
    workshopAdvisor: string;
    readyToRun: string;
    checklist: string;
    safetyFindings: string;
    blockers: string;
    warningsOnly: string;
    showOnlyBlockers: string;
    suggestedFix: string;
    criticalEvents: string;
    firstCutRiskBrief: string;
    setupOptimization: string;
    optionalStops: string;
    frontMatter: string;
    operatorView: string;
    templates: string;
    setupSheet: string;
    proveout: string;
    dCallStyle: string;
    parameterBlacklist: string;
    exportFolder: string;
    exportBaseName: string;
    exportNow: string;
    includeTimelineFindingsExport: string;
    saveParamPrefs: string;
    savePolicyPresetNow: string;
    savePolicyPresetAndRunCheck: string;
    copyPolicyContext: string;
    copyFullExportContext: string;
    copyJobCheckStatus: string;
    copyJobCheckWithFindings: string;
    copyOperatorHandoffBundle: string;
    copyMachineSafeStartupBrief: string;
    copyFirstCutRiskBrief: string;
    copyFirstCutRiskBriefWithPolicy: string;
    copyFirstCutRiskBriefWithJobCheck: string;
    policyUiEventsEnabled: string;
    policyLockManualChanges: string;
    revertPolicyPresetToControllerDefault: string;
    resetUiPrefs: string;
    runJobCheck: string;
    policyPreset: string;
    policyPresetStrict: string;
    policyPresetBalanced: string;
    policyPresetPermissive: string;
    policyPresetHelp: string;
    policyPresetSourceLabel: string;
    policyPresetSourceSaved: string;
    policyPresetSourceBootstrap: string;
    policyPresetSourceManual: string;
    policyPresetSourceHelpTooltip: string;
    policyDriftWarning: string;
    policyQuickReference: string;
    policyQuickReferencePresets: string;
    policyQuickReferenceSources: string;
    policyQuickReferenceShortcuts: string;
    policyQuickReferenceActions: string;
    policyAuditTrail: string;
    policyAuditTrailEmpty: string;
    policyPresetPersistedHint: string;
    policyPresetUnsavedOverrideHint: string;
    allowExportWithBlockers: string;
    runJobCheckStatus: string;
    jobCheckCopyStatus: string;
    lastCopiedJobCheckFindingsSummary: string;
    lastCopiedOperatorHandoffBundle: string;
    lastCopiedMachineSafeStartupBrief: string;
    lastCopiedPolicyContext: string;
    lastCopiedFullExportContext: string;
    firstCutRiskBriefCopyStatusPlain: string;
    firstCutRiskBriefCopyStatusPolicy: string;
    firstCutRiskBriefCopyStatusJobCheck: string;
    jobCheckCard: string;
    jobCheckLintSummaryLabel: string;
    jobCheckLintSummaryDetailsLabel: string;
    parseDiagnosticsSummaryLabel: string;
    parseDiagnosticsChipEmpty: string;
    parseDiagnosticsLoadDemo: string;
    parseDiagnosticsLoadDemoStatus: string;
    parseDiagnosticsPolicyHeading: string;
    parseDiagnosticsPolicyEnabledLabel: string;
    parseDiagnosticsPolicySeverityLabel: string;
    parseDiagnosticsPolicyBlockExportLabel: string;
    parseDiagnosticsPolicyThresholdsLabel: string;
    parseDiagnosticsPolicyThresholdsHint: string;
    parseDiagnosticsPolicyInvalidEntriesLabel: string;
    parseDiagnosticsPolicyCopyContext: string;
    parseDiagnosticsPolicyCopiedStatus: string;
    parseDiagnosticsPolicyCopyFallback: string;
    parseDiagnosticsPolicySeverityWarning: string;
    parseDiagnosticsPolicySeverityBlocker: string;
    parseDiagnosticsBreachLabel: string;
    parseDiagnosticsBreachJumpLabel: string;
    parseDiagnosticsBreachCopy: string;
    parseDiagnosticsBreachCopiedStatus: string;
    parseDiagnosticsBreachCopyFallback: string;
    policyBreachCopyJson: string;
    policyBreachCopiedJson: string;
    policyBreachCopyJsonFallback: string;
    policyBreachCopyCsv: string;
    policyBreachCopiedCsv: string;
    policyBreachCopyCsvFallback: string;
    safetyFindingsChipLabel: string;
    safetyFindingsCopyJson: string;
    safetyFindingsCopiedJson: string;
    safetyFindingsCopyJsonFallback: string;
    parseDiagnosticsPolicyPresetsLabel: string;
    parseDiagnosticsPolicyPresetStrict: string;
    parseDiagnosticsPolicyPresetBalanced: string;
    parseDiagnosticsPolicyPresetPermissive: string;
    parseDiagnosticsPolicyActiveLabel: string;
    parseDiagnosticsPolicyActiveCustom: string;
    deprecatedRulesAuditPresetsLabel: string;
    deprecatedRulesAuditPresetInformational: string;
    deprecatedRulesAuditPresetSixMonthStrict: string;
    deprecatedRulesAuditPresetYearlyStrict: string;
    deprecatedRulesAuditActiveLabel: string;
    deprecatedRulesAuditExportJson: string;
    deprecatedRulesAuditExportCsv: string;
    deprecatedRulesAuditCopyJson: string;
    deprecatedRulesAuditCopiedJson: string;
    deprecatedRulesAuditCopyJsonFallback: string;
    deprecatedRulesAuditExported: string;
    deprecatedRulesAuditExportFailed: string;
    strictGateWatchLabel: string;
    strictGatePatternNAndO: string;
    strictGatePatternDuplicateO: string;
    strictGatePatternDuplicateAddresses: string;
    strictGateCopyJson: string;
    strictGateCopiedJson: string;
    strictGateCopyJsonFallback: string;
    strictGateCopyCsv: string;
    strictGateCopiedCsv: string;
    strictGateCopyCsvFallback: string;
    deprecatedRulesAuditCopyCsv: string;
    deprecatedRulesAuditCopiedCsv: string;
    deprecatedRulesAuditCopyCsvFallback: string;
    confirmResetUiPrefs: string;
    resetUiPrefsCancelled: string;
    confirmResetFixturePrefs: string;
    resetFixturePrefsCancelled: string;
    copyPolicyAuditTrail: string;
    copiedPolicyAuditTrail: string;
    copyPolicyAuditTrailFallback: string;
    policyAuditTrailNoEntries: string;
    copyPolicyAuditTrailParseOnly: string;
    copiedPolicyAuditTrailParseOnly: string;
    copyPolicyAuditTrailParseOnlyFallback: string;
    auditTrailExportFormatLabel: string;
    auditTrailExportFormatText: string;
    auditTrailExportFormatMarkdown: string;
    auditTrailExportFormatCsv: string;
    auditTrailExportFormatNdjson: string;
    auditTrailDownloadButtonLabel: string;
    auditTrailDownloadStatus: (filename: string, rowCount: number) => string;
    auditTrailDownloadFallback: string;
    auditTrailDownloadSidecarLabel: string;
    auditTrailDownloadSidecarStatus: (
      filename: string,
      sidecarFilename: string,
      rowCount: number
    ) => string;
    auditTrailHmacSecretLabel: string;
    auditTrailDownloadHmacLabel: string;
    auditTrailDownloadHmacStatus: (
      filename: string,
      hmacSidecarFilename: string,
      rowCount: number
    ) => string;
    auditTrailDownloadHmacMissingSecret: string;
    auditTrailEncryptionSecretLabel: string;
    auditTrailDownloadEncryptionLabel: string;
    auditTrailDownloadEncryptionStatus: (
      filename: string,
      encryptedFilename: string,
      rowCount: number
    ) => string;
    auditTrailDownloadEncryptionMissingSecret: string;
    clearAuditTrail: string;
    confirmClearAuditTrail: string;
    auditTrailClearedStatus: string;
    auditTrailFilterAll: string;
    auditTrailFilterParseLint: string;
    auditTrailFilterReset: string;
    auditTrailFilterPolicy: string;
    auditTrailCountChip: (n: number) => string;
    auditTrailHydratedChip: (n: number) => string;
    openExportFolder: string;
    jumpToBlockers: string;
    exportStatus: string;
    fixtureImport: string;
    fixturesRoot: string;
    fixtureId: string;
    fixtureController: string;
    fixtureFilename: string;
    fixtureExpectMainM99: string;
    fixtureExpectSimWarnings: string;
    fixtureExpectSimFindings: string;
    fixtureExpectedFindingCodes: string;
    fixturePreviewPaths: string;
    autoValidateAfterImport: string;
    autoRunTestsAfterImport: string;
    importCancelled: string;
    resetFixturePrefs: string;
    fixtureImportNow: string;
    validateFixtures: string;
    testsWorkspaceRoot: string;
    runFixtureTests: string;
    fixtureOpsInProgress: string;
    fixtureDefaultsLoadedFor: string;
    fixtureHealth: string;
    refreshFixtureHealth: string;
    upgradeToStrict: string;
    fixtureDetectedController: string;
    showOnlyIssueFixtures: string;
    useDetectedController: string;
    normalizeFixtureId: string;
    previewAutoFixes: string;
    applyAutoFixes: string;
    includeControllerFixes: string;
    includeStrictFixes: string;
    autoRunTestsAfterApply: string;
    minControllerFixConfidence: string;
    confidenceHigh: string;
    confidenceMedium: string;
    confidenceLow: string;
    rollbackFromBackup: string;
    previewRequired: string;
    postApplyReport: string;
    restoreHint: string;
    strictD: string;
    allowCompD: string;
    polish: string;
    english: string;
    parseDiagnostics: string;
    parseDiagnosticsEmpty: string;
    parseDiagnosticsBlockLabel: string;
    suggestedFixesLabel: string;
    copyFixText: string;
    copyAllFixesInGroup: string;
    parseDiagnosticsShowMore: string;
    parseDiagnosticsHiddenSuffix: string;
    parseDiagnosticsCapNote: string;
    parseDiagnosticsCopiedFix: string;
    parseDiagnosticsCopiedAllFixes: string;
    parseDiagnosticsNoFixesToCopy: string;
    parseDiagnosticsCopyFallback: string;
    lintIssuesEmpty: string;
    lintIssuesGroupSourceLabels: Record<LintIssueProvenanceSource, string>;
    lintCopyFixText: string;
    lintCopyAllFixesInGroup: string;
    lintCopiedFix: string;
    lintCopiedAllFixes: string;
    lintNoFixesToCopy: string;
    lintIssuesChipEmpty: string;
    lintIssuesLoadDemo: string;
    lintIssuesLoadDemoStatus: string;
    lintDemoControllerLabel: string;
    lintDemoControllerAuto: string;
  }
> = {
  pl: {
    title: "CNC Workbench - Szkielet Haas NGC",
    subtitle: "Formatuj kod, parametryzuj i symuluj makra w bezpiecznym środowisku lokalnym.",
    languageLabel: "Język interfejsu",
    operatorReviewMode: "Tryb przeglądu operatora",
    programInput: "Wejściowy program",
    formattedOutput: "Sformatowany wynik",
    removeStandaloneOptionalStops: "Usuń samodzielne linie M01/M1 bez komentarza",
    parameterSuggestions: "Sugestie parametryzacji",
    parameterPreset: "Preset rezerwacji parametrów",
    lintIssues: "Uwagi lintera",
    simulation: "Symulacja",
    simulationTimeline: "Timeline zdarzeń",
    noSimulationEvents: "Brak zdarzeń call/return/repeat.",
    timelineFilters: "Filtry timeline",
    filterAlarms: "Alarmy / komunikaty",
    filterFlow: "Call / return / repeat",
    filterControl: "Limity / M99",
    logSemantics: "Semantyka LOG",
    logSemanticsControllerDefault: "Domyślna wg sterowania",
    logSemanticsNatural: "Naturalna (ln)",
    logSemanticsBase10: "Dziesiętna (log10)",
    subprogramTargetPolicy: "Polityka celu podprogramu",
    shopFriendlyPolicy: "Warsztatowa (O -> N fallback)",
    strictControllerPolicy: "Ścisła wg sterowania",
    setterReport: "Raport ustawiającego (80mm)",
    workshopAdvisor: "Asystent warsztatowy",
    readyToRun: "Gotowość uruchomienia",
    checklist: "Checklist pierwszego uruchomienia",
    safetyFindings: "Znaleziska bezpieczeństwa",
    blockers: "Blockery",
    warningsOnly: "Ostrzeżenia",
    showOnlyBlockers: "Pokaż tylko blockery",
    suggestedFix: "Sugerowana poprawka",
    criticalEvents: "Krytyczne punkty programu",
    firstCutRiskBrief: "Brief ryzyka pierwszego cięcia",
    setupOptimization: "Sugestie skrócenia przezbrojenia",
    optionalStops: "Sugerowane punkty M01",
    frontMatter: "Proponowany nagłówek parametrów",
    operatorView: "Wersja programu dla operatora",
    templates: "Szablony warsztatowe",
    setupSheet: "Arkusz ustawienia",
    proveout: "Program trybu proveout",
    dCallStyle: "Styl wywołania D",
    parameterBlacklist: "Czarna lista parametrów (# lub liczby, po przecinku)",
    exportFolder: "Folder eksportu",
    exportBaseName: "Nazwa bazowa plików",
    exportNow: "Eksportuj pliki",
    includeTimelineFindingsExport: "Dołącz timeline i findingi do eksportu",
    saveParamPrefs: "Zapisz ustawienia parametrów do JSON",
    savePolicyPresetNow: "Zapisz ten preset jako domyślny",
    savePolicyPresetAndRunCheck: "Zapisz preset i uruchom Job Check",
    copyPolicyContext: "Kopiuj kontekst polityki",
    copyFullExportContext: "Kopiuj pełny kontekst eksportu",
    copyJobCheckStatus: "Kopiuj status Job Check",
    copyJobCheckWithFindings: "Kopiuj status Job Check + findingi",
    copyOperatorHandoffBundle: "Kopiuj pełny pakiet przekazania operatora",
    copyMachineSafeStartupBrief: "Kopiuj bezpieczny brief startowy",
    copyFirstCutRiskBrief: "Kopiuj brief ryzyka pierwszego cięcia",
    copyFirstCutRiskBriefWithPolicy: "Kopiuj brief ryzyka + kontekst polityki",
    copyFirstCutRiskBriefWithJobCheck: "Kopiuj brief ryzyka + status Job Check",
    policyUiEventsEnabled: "Włącz lokalne eventy UI polityki",
    policyLockManualChanges: "Zablokuj ręczne zmiany presetu",
    revertPolicyPresetToControllerDefault: "Przywróć domyślny preset sterowania",
    resetUiPrefs: "Resetuj ustawienia UI dla tego sterowania",
    runJobCheck: "Uruchom pełny Job Check",
    policyPreset: "Preset polityki bezpieczeństwa",
    policyPresetStrict: "Ścisły",
    policyPresetBalanced: "Zrównoważony",
    policyPresetPermissive: "Permisywny",
    policyPresetHelp:
      "Ścisły: więcej blokerów i ostrzejsze bramkowanie eksportu. Zrównoważony: domyślna konserwatywna polityka shop. Permisywny: mniej blokad, do kontrolowanego debugowania.",
    policyPresetSourceLabel: "Źródło presetu",
    policyPresetSourceSaved: "zapisany",
    policyPresetSourceBootstrap: "bootstrap",
    policyPresetSourceManual: "ręczny",
    policyPresetSourceHelpTooltip:
      "zapisany = z template.json, bootstrap = domyślny wg sterowania, ręczny = zmieniony w bieżącej sesji",
    policyDriftWarning: "Uwaga: ręczny preset może być nieaktualny po zmianie wykrytego sterowania",
    policyQuickReference: "Szybkie odniesienie polityki",
    policyQuickReferencePresets:
      "Presety: Ścisły = najmocniejsze bramkowanie, Zrównoważony = domyślny warsztatowy, Permisywny = debug.",
    policyQuickReferenceSources: "Źródła: zapisany (template.json), bootstrap (domyślny wg sterowania), ręczny (sesja).",
    policyQuickReferenceShortcuts: "Skróty: Ctrl+Shift+R = przywróć domyślny, Ctrl+Shift+J = zapisz + Job Check.",
    policyQuickReferenceActions: "Akcje: kopiuj kontekst polityki, eksport zawiera preset/source/controller.",
    policyAuditTrail: "Historia polityki (sesja)",
    policyAuditTrailEmpty: "Brak wpisów w tej sesji.",
    policyPresetPersistedHint: "Aktywny zapisany domyślny preset dla sterowania",
    policyPresetUnsavedOverrideHint: "Aktywny tymczasowy preset (inny niż zapisany domyślny)",
    allowExportWithBlockers: "Pozwól na eksport mimo blockerów",
    runJobCheckStatus: "Status Job Check",
    jobCheckCopyStatus: "Ostatnio skopiowany status Job Check",
    lastCopiedJobCheckFindingsSummary: "Ostatnio: Job Check + findingi",
    lastCopiedOperatorHandoffBundle: "Ostatnio: pakiet przekazania operatora",
    lastCopiedMachineSafeStartupBrief: "Ostatnio: brief startowy maszyny",
    lastCopiedPolicyContext: "Ostatnio: kontekst polityki",
    lastCopiedFullExportContext: "Ostatnio: pełny kontekst eksportu",
    firstCutRiskBriefCopyStatusPlain: "Ostatnio: brief ryzyka (podstawowy)",
    firstCutRiskBriefCopyStatusPolicy: "Ostatnio: brief ryzyka (polityka)",
    firstCutRiskBriefCopyStatusJobCheck: "Ostatnio: brief ryzyka (Job Check)",
    jobCheckCard: "Wynik Job Check",
    jobCheckLintSummaryLabel: "Lint",
    jobCheckLintSummaryDetailsLabel: "Rozbicie wg źródła",
    parseDiagnosticsSummaryLabel: "Diagnostyka parsera",
    parseDiagnosticsChipEmpty: "diagnostyka parsera: total=0",
    parseDiagnosticsLoadDemo: "Wczytaj demo diagnostyki",
    parseDiagnosticsLoadDemoStatus: "Wczytano przykładowy program diagnostyczny.",
    parseDiagnosticsPolicyHeading: "Polityka progów diagnostyki parsera",
    parseDiagnosticsPolicyEnabledLabel: "Włącz politykę progów",
    parseDiagnosticsPolicySeverityLabel: "Nasilenie",
    parseDiagnosticsPolicyBlockExportLabel: "Blokuj eksport po przekroczeniu",
    parseDiagnosticsPolicyThresholdsLabel: "Progi (KOD=N)",
    parseDiagnosticsPolicyThresholdsHint: "np. TOTAL=10, ADDRESS_MISSING_VALUE=3",
    parseDiagnosticsPolicyInvalidEntriesLabel: "Nieprawidłowe wpisy zignorowane",
    parseDiagnosticsPolicyCopyContext: "Kopiuj kontekst progów diagnostyki",
    parseDiagnosticsPolicyCopiedStatus: "Skopiowano kontekst progów diagnostyki",
    parseDiagnosticsPolicyCopyFallback: "Skopiuj kontekst progów diagnostyki ręcznie",
    parseDiagnosticsPolicySeverityWarning: "ostrzeżenie",
    parseDiagnosticsPolicySeverityBlocker: "blocker",
    parseDiagnosticsBreachLabel: "Przekroczenie progu diagnostyki",
    parseDiagnosticsBreachJumpLabel: "Skocz do pierwszego",
    parseDiagnosticsBreachCopy: "Kopiuj kontekst przekroczeń",
    parseDiagnosticsBreachCopiedStatus: "Skopiowano kontekst przekroczeń",
    parseDiagnosticsBreachCopyFallback: "Skopiuj kontekst przekroczeń ręcznie",
    policyBreachCopyJson: "Kopiuj JSON przekroczeń",
    policyBreachCopiedJson: "Skopiowano przekroczenia polityki (JSON)",
    policyBreachCopyJsonFallback: "Kopiuj przekroczenia polityki JSON ręcznie",
    policyBreachCopyCsv: "Kopiuj CSV przekroczeń",
    policyBreachCopiedCsv: "Skopiowano przekroczenia polityki (CSV)",
    policyBreachCopyCsvFallback: "Kopiuj przekroczenia polityki CSV ręcznie",
    safetyFindingsChipLabel: "Bezpieczeństwo",
    safetyFindingsCopyJson: "Kopiuj JSON bezpieczeństwa",
    safetyFindingsCopiedJson: "Skopiowano rollup bezpieczeństwa (JSON)",
    safetyFindingsCopyJsonFallback: "Kopiuj rollup bezpieczeństwa ręcznie",
    parseDiagnosticsPolicyPresetsLabel: "Szybkie progi",
    parseDiagnosticsPolicyPresetStrict: "Rygorystyczny",
    parseDiagnosticsPolicyPresetBalanced: "Zrównoważony",
    parseDiagnosticsPolicyPresetPermissive: "Pobłażliwy",
    parseDiagnosticsPolicyActiveLabel: "Dopasowany preset",
    parseDiagnosticsPolicyActiveCustom: "własne ustawienia",
    deprecatedRulesAuditPresetsLabel: "Audyt reguł wycofywanych",
    deprecatedRulesAuditPresetInformational: "Informacyjny",
    deprecatedRulesAuditPresetSixMonthStrict: "6 mies. strict",
    deprecatedRulesAuditPresetYearlyStrict: "12 mies. strict",
    deprecatedRulesAuditActiveLabel: "Aktywny preset audytu",
    deprecatedRulesAuditExportJson: "Eksport JSON",
    deprecatedRulesAuditExportCsv: "Eksport CSV",
    deprecatedRulesAuditCopyJson: "Kopiuj JSON",
    deprecatedRulesAuditCopiedJson: "Skopiowano audyt reguł wycofywanych (JSON)",
    deprecatedRulesAuditCopyJsonFallback: "Kopiuj audyt reguł wycofywanych ręcznie",
    deprecatedRulesAuditExported: "Wyeksportowano audyt reguł wycofywanych",
    deprecatedRulesAuditExportFailed: "Eksport audytu nie powiódł się — skopiuj ręcznie",
    strictGateWatchLabel: "Strażnik kodów CG_*",
    strictGatePatternNAndO: "N+O mixed",
    strictGatePatternDuplicateO: "Duplicate O",
    strictGatePatternDuplicateAddresses: "Duplicate addr.*",
    strictGateCopyJson: "Kopiuj JSON",
    strictGateCopiedJson: "Skopiowano podsumowanie strażnika CG_*",
    strictGateCopyJsonFallback: "Kopiuj podsumowanie strażnika ręcznie",
    strictGateCopyCsv: "Kopiuj CSV",
    strictGateCopiedCsv: "Skopiowano podsumowanie strażnika CG_* (CSV)",
    strictGateCopyCsvFallback: "Kopiuj podsumowanie strażnika CSV ręcznie",
    deprecatedRulesAuditCopyCsv: "Kopiuj CSV",
    deprecatedRulesAuditCopiedCsv: "Skopiowano audyt reguł wycofywanych (CSV)",
    deprecatedRulesAuditCopyCsvFallback: "Kopiuj audyt CSV ręcznie",
    confirmResetUiPrefs: "Zresetować ustawienia UI dla bieżącego profilu sterownika? Tej operacji nie można cofnąć.",
    resetUiPrefsCancelled: "Reset ustawień UI anulowany.",
    confirmResetFixturePrefs:
      "Zresetować ustawienia importu fixturek dla bieżącego profilu sterownika? Tej operacji nie można cofnąć.",
    resetFixturePrefsCancelled: "Reset ustawień fixturek anulowany.",
    copyPolicyAuditTrail: "Kopiuj historię polityki",
    copiedPolicyAuditTrail: "Skopiowano historię polityki",
    copyPolicyAuditTrailFallback: "Skopiuj historię polityki ręcznie",
    policyAuditTrailNoEntries: "Brak wpisów do skopiowania.",
    copyPolicyAuditTrailParseOnly: "Kopiuj historię diagnostyki (parse + lint)",
    copiedPolicyAuditTrailParseOnly: "Skopiowano historię diagnostyki (parse + lint)",
    copyPolicyAuditTrailParseOnlyFallback: "Skopiuj historię diagnostyki ręcznie",
    auditTrailExportFormatLabel: "Format eksportu",
    auditTrailExportFormatText: "Tekst",
    auditTrailExportFormatMarkdown: "Markdown",
    auditTrailExportFormatCsv: "CSV",
    auditTrailExportFormatNdjson: "NDJSON",
    auditTrailDownloadButtonLabel: "Pobierz dziennik audytu",
    auditTrailDownloadStatus: (filename, rowCount) =>
      `Pobrano ${filename} (${rowCount}).`,
    auditTrailDownloadFallback: "Pobranie dziennika audytu nie powiodło się.",
    auditTrailDownloadSidecarLabel: "Dołącz sumę SHA-256",
    auditTrailDownloadSidecarStatus: (filename, sidecarFilename, rowCount) =>
      `Pobrano ${filename} oraz ${sidecarFilename} (${rowCount}).`,
    auditTrailHmacSecretLabel: "Sekret HMAC",
    auditTrailDownloadHmacLabel: "Dołącz sygnaturę HMAC-SHA-256",
    auditTrailDownloadHmacStatus: (filename, hmacSidecarFilename, rowCount) =>
      `Pobrano ${filename} oraz ${hmacSidecarFilename} (${rowCount}).`,
    auditTrailDownloadHmacMissingSecret:
      "Sygnatura HMAC pominięta — wprowadź wspólny sekret aby ją wygenerować.",
    auditTrailEncryptionSecretLabel: "Hasło szyfrowania (AES-GCM)",
    auditTrailDownloadEncryptionLabel: "Dołącz zaszyfrowaną kopię (AES-256-GCM)",
    auditTrailDownloadEncryptionStatus: (filename, encryptedFilename, rowCount) =>
      `Pobrano ${filename} oraz ${encryptedFilename} (${rowCount}).`,
    auditTrailDownloadEncryptionMissingSecret:
      "Zaszyfrowana kopia pominięta — wprowadź hasło aby wygenerować plik AES-GCM.",
    clearAuditTrail: "Wyczyść historię",
    confirmClearAuditTrail:
      "Wyczyścić historię polityki w sesji? Wpis 'policy_audit_trail_cleared' pozostanie jako zapis tej operacji.",
    auditTrailClearedStatus: "Wyczyszczono historię polityki w sesji.",
    auditTrailFilterAll: "Wszystkie",
    auditTrailFilterParseLint: "Parse + lint",
    auditTrailFilterReset: "Resety",
    auditTrailFilterPolicy: "Polityka",
    auditTrailCountChip: (n: number) => `${n} wpisów`,
    auditTrailHydratedChip: (n: number) => `${n} przywróconych`,
    openExportFolder: "Otwórz folder eksportu",
    jumpToBlockers: "Przejdź do blockerów",
    exportStatus: "Status eksportu",
    fixtureImport: "Import fixture regresji (shop)",
    fixturesRoot: "Root fixtures",
    fixtureId: "ID fixture",
    fixtureController: "Sterowanie fixture",
    fixtureFilename: "Nazwa pliku fixture (opcjonalnie)",
    fixtureExpectMainM99: "Oczekuje main-level M99",
    fixtureExpectSimWarnings: "Oczekuje warningów symulacji",
    fixtureExpectSimFindings: "Oczekuje findingów symulacji",
    fixtureExpectedFindingCodes: "Oczekiwane kody findingów (opcjonalnie, po przecinku)",
    fixturePreviewPaths: "Podgląd ścieżek zapisu",
    autoValidateAfterImport: "Po imporcie automatycznie waliduj manifest",
    autoRunTestsAfterImport: "Po imporcie automatycznie uruchom testy regresji shop",
    importCancelled: "Import anulowany.",
    resetFixturePrefs: "Resetuj ustawienia importu fixture dla tego sterowania",
    fixtureImportNow: "Importuj fixture",
    validateFixtures: "Waliduj manifest fixture",
    testsWorkspaceRoot: "Root workspace dla testów",
    runFixtureTests: "Uruchom testy regresji shop",
    fixtureOpsInProgress: "Operacja fixture w toku...",
    fixtureDefaultsLoadedFor: "Załadowane domyślne ustawienia fixture dla",
    fixtureHealth: "Zdrowie fixture",
    refreshFixtureHealth: "Odśwież zdrowie fixture",
    upgradeToStrict: "Ustaw ścisły tryb z aktualnych findingów",
    fixtureDetectedController: "Wykryte sterowanie programu",
    showOnlyIssueFixtures: "Pokaż tylko fixture z problemami",
    useDetectedController: "Użyj wykrytego sterowania",
    normalizeFixtureId: "Normalizuj ID fixture",
    previewAutoFixes: "Podgląd auto-poprawek",
    applyAutoFixes: "Zastosuj auto-poprawki",
    includeControllerFixes: "Uwzględnij poprawki sterowania",
    includeStrictFixes: "Uwzględnij ścisłe kody z symulacji",
    autoRunTestsAfterApply: "Po auto-poprawkach uruchom testy regresji shop",
    minControllerFixConfidence: "Minimalna pewność poprawki sterowania",
    confidenceHigh: "Wysoka",
    confidenceMedium: "Średnia",
    confidenceLow: "Niska",
    rollbackFromBackup: "Przywróć manifest z backupu",
    previewRequired: "Najpierw wykonaj świeży podgląd auto-poprawek dla aktualnych ustawień.",
    postApplyReport: "Raport po zastosowaniu auto-poprawek",
    restoreHint: "Przywrócenie backupu",
    strictD: "Haas - D razem z G43 H (bez D na G41/G42)",
    allowCompD: "Fanuc - D na G41/G42 i G40 D00",
    polish: "Polski",
    english: "English",
    parseDiagnostics: "Diagnostyka parsera",
    parseDiagnosticsEmpty: "Brak diagnostyki parsera.",
    parseDiagnosticsBlockLabel: "blok",
    suggestedFixesLabel: "Sugerowane poprawki",
    copyFixText: "Kopiuj tekst poprawki",
    copyAllFixesInGroup: "Kopiuj wszystkie poprawki w grupie",
    parseDiagnosticsShowMore: "Pokaż wszystkie",
    parseDiagnosticsHiddenSuffix: "ukrytych",
    parseDiagnosticsCapNote: "Lista skrócona dla czytelności; akcje kopiowania działają na pełnej grupie.",
    parseDiagnosticsCopiedFix: "Skopiowano poprawkę parsera",
    parseDiagnosticsCopiedAllFixes: "Skopiowano poprawki parsera dla",
    parseDiagnosticsNoFixesToCopy: "Brak poprawek do skopiowania dla",
    parseDiagnosticsCopyFallback: "Skopiuj ręcznie poprawkę parsera",
    lintIssuesEmpty: "Brak uwag lintera.",
    lintIssuesGroupSourceLabels: {
      lexer: "Lekser",
      expression_parser: "Parser wyrażeń",
      controller_grammar: "Gramatyka sterownika",
      common_lint: "Wspólny lint",
      profile_lint: "Lint profilu"
    },
    lintCopyFixText: "Kopiuj poprawkę lintera",
    lintCopyAllFixesInGroup: "Kopiuj wszystkie poprawki lintera w grupie",
    lintCopiedFix: "Skopiowano poprawkę lintera",
    lintCopiedAllFixes: "Skopiowano poprawki lintera dla",
    lintNoFixesToCopy: "Brak poprawek lintera do skopiowania dla",
    lintIssuesChipEmpty: "lint: total=0",
    lintIssuesLoadDemo: "Wczytaj demo lintera",
    lintIssuesLoadDemoStatus: "Wczytano przykładowy program lintera.",
    lintDemoControllerLabel: "Wariant demo lintera",
    lintDemoControllerAuto: "auto (wykryty kontroler)"
  },
  en: {
    title: "CNC Workbench - Haas NGC Scaffold",
    subtitle: "Reformat, parameterize, and simulate macros in a safe local environment.",
    languageLabel: "UI language",
    operatorReviewMode: "Operator Review Mode",
    programInput: "Program Input",
    formattedOutput: "Formatted Output",
    removeStandaloneOptionalStops: "Remove standalone M01/M1 lines without comments",
    parameterSuggestions: "Parameter Suggestions",
    parameterPreset: "Parameter reserve preset",
    lintIssues: "Lint Issues",
    simulation: "Simulation",
    simulationTimeline: "Event timeline",
    noSimulationEvents: "No call/return/repeat events.",
    timelineFilters: "Timeline filters",
    filterAlarms: "Alarms / messages",
    filterFlow: "Call / return / repeat",
    filterControl: "Limits / M99",
    logSemantics: "LOG semantics",
    logSemanticsControllerDefault: "Controller default",
    logSemanticsNatural: "Natural (ln)",
    logSemanticsBase10: "Base-10 (log10)",
    subprogramTargetPolicy: "Subprogram target policy",
    shopFriendlyPolicy: "Shop-friendly (O -> N fallback)",
    strictControllerPolicy: "Strict by controller",
    setterReport: "Setter Report (80mm)",
    workshopAdvisor: "Workshop Advisor",
    readyToRun: "Ready-to-run",
    checklist: "First-run checklist",
    safetyFindings: "Safety findings",
    blockers: "Blockers",
    warningsOnly: "Warnings",
    showOnlyBlockers: "Show only blockers",
    suggestedFix: "Suggested fix",
    criticalEvents: "Critical events",
    firstCutRiskBrief: "First-cut risk brief",
    setupOptimization: "Setup-time optimization hints",
    optionalStops: "Suggested M01 points",
    frontMatter: "Suggested parameter front-matter",
    operatorView: "Operator-friendly program view",
    templates: "Workshop templates",
    setupSheet: "Setup sheet",
    proveout: "Proveout mode program",
    dCallStyle: "D call style",
    parameterBlacklist: "Parameter blacklist (# or numbers, comma-separated)",
    exportFolder: "Export folder",
    exportBaseName: "Export file base name",
    exportNow: "Export files",
    includeTimelineFindingsExport: "Include timeline and findings in export",
    saveParamPrefs: "Save parameter preferences to JSON",
    savePolicyPresetNow: "Save this preset as default",
    savePolicyPresetAndRunCheck: "Save preset and run Job Check",
    copyPolicyContext: "Copy policy context",
    copyFullExportContext: "Copy full export context",
    copyJobCheckStatus: "Copy Job Check status",
    copyJobCheckWithFindings: "Copy Job Check + findings summary",
    copyOperatorHandoffBundle: "Copy full operator handoff bundle",
    copyMachineSafeStartupBrief: "Copy machine-safe startup brief",
    copyFirstCutRiskBrief: "Copy first-cut risk brief",
    copyFirstCutRiskBriefWithPolicy: "Copy first-cut risk brief + policy context",
    copyFirstCutRiskBriefWithJobCheck: "Copy first-cut risk brief + Job Check status",
    policyUiEventsEnabled: "Enable local policy UI events",
    policyLockManualChanges: "Lock manual preset changes",
    revertPolicyPresetToControllerDefault: "Revert to controller default preset",
    resetUiPrefs: "Reset UI defaults for this controller",
    runJobCheck: "Run full Job Check",
    policyPreset: "Safety policy preset",
    policyPresetStrict: "Strict",
    policyPresetBalanced: "Balanced",
    policyPresetPermissive: "Permissive",
    policyPresetHelp:
      "Strict: more blockers and tighter export gates. Balanced: conservative default shop policy. Permissive: fewer blocks, for controlled debugging only.",
    policyPresetSourceLabel: "Preset source",
    policyPresetSourceSaved: "saved",
    policyPresetSourceBootstrap: "bootstrap",
    policyPresetSourceManual: "manual",
    policyPresetSourceHelpTooltip:
      "saved = loaded from template.json, bootstrap = controller default, manual = changed in current session",
    policyDriftWarning: "Warning: manual preset may be stale after detected controller change",
    policyQuickReference: "Policy quick reference",
    policyQuickReferencePresets:
      "Presets: Strict = strongest gating, Balanced = default shop posture, Permissive = debugging posture.",
    policyQuickReferenceSources: "Sources: saved (template.json), bootstrap (controller default), manual (session override).",
    policyQuickReferenceShortcuts: "Shortcuts: Ctrl+Shift+R = revert default, Ctrl+Shift+J = save + Job Check.",
    policyQuickReferenceActions: "Actions: copy policy context, exports include preset/source/controller context.",
    policyAuditTrail: "Policy history (session)",
    policyAuditTrailEmpty: "No entries in this session.",
    policyPresetPersistedHint: "Saved controller default preset is active",
    policyPresetUnsavedOverrideHint: "Unsaved preset override is active",
    allowExportWithBlockers: "Allow export with blockers",
    runJobCheckStatus: "Job Check status",
    jobCheckCopyStatus: "Last copied Job Check status",
    lastCopiedJobCheckFindingsSummary: "Last copied Job Check + findings",
    lastCopiedOperatorHandoffBundle: "Last copied operator handoff",
    lastCopiedMachineSafeStartupBrief: "Last copied startup brief",
    lastCopiedPolicyContext: "Last copied policy context",
    lastCopiedFullExportContext: "Last copied export context",
    firstCutRiskBriefCopyStatusPlain: "Last copied risk brief (plain)",
    firstCutRiskBriefCopyStatusPolicy: "Last copied risk brief (policy)",
    firstCutRiskBriefCopyStatusJobCheck: "Last copied risk brief (Job Check)",
    jobCheckCard: "Job Check result",
    jobCheckLintSummaryLabel: "Lint",
    jobCheckLintSummaryDetailsLabel: "Per-source breakdown",
    parseDiagnosticsSummaryLabel: "Parse diagnostics",
    parseDiagnosticsChipEmpty: "parseDiagnostics: total=0",
    parseDiagnosticsLoadDemo: "Load diagnostics demo",
    parseDiagnosticsLoadDemoStatus: "Loaded sample diagnostics program.",
    parseDiagnosticsPolicyHeading: "Parse diagnostics threshold policy",
    parseDiagnosticsPolicyEnabledLabel: "Enable threshold policy",
    parseDiagnosticsPolicySeverityLabel: "Severity",
    parseDiagnosticsPolicyBlockExportLabel: "Block export on breach",
    parseDiagnosticsPolicyThresholdsLabel: "Thresholds (CODE=N)",
    parseDiagnosticsPolicyThresholdsHint: "e.g. TOTAL=10, ADDRESS_MISSING_VALUE=3",
    parseDiagnosticsPolicyInvalidEntriesLabel: "Invalid entries (ignored)",
    parseDiagnosticsPolicyCopyContext: "Copy diagnostics threshold context",
    parseDiagnosticsPolicyCopiedStatus: "Copied diagnostics threshold context",
    parseDiagnosticsPolicyCopyFallback: "Copy diagnostics threshold context manually",
    parseDiagnosticsPolicySeverityWarning: "warning",
    parseDiagnosticsPolicySeverityBlocker: "blocker",
    parseDiagnosticsBreachLabel: "Diagnostics threshold breach",
    parseDiagnosticsBreachJumpLabel: "Jump to first",
    parseDiagnosticsBreachCopy: "Copy diagnostics breach context",
    parseDiagnosticsBreachCopiedStatus: "Copied diagnostics breach context",
    parseDiagnosticsBreachCopyFallback: "Copy diagnostics breach context manually",
    policyBreachCopyJson: "Copy breach JSON",
    policyBreachCopiedJson: "Copied policy breaches (JSON)",
    policyBreachCopyJsonFallback: "Copy policy breaches JSON manually",
    policyBreachCopyCsv: "Copy breach CSV",
    policyBreachCopiedCsv: "Copied policy breaches (CSV)",
    policyBreachCopyCsvFallback: "Copy policy breaches CSV manually",
    safetyFindingsChipLabel: "Safety",
    safetyFindingsCopyJson: "Copy safety JSON",
    safetyFindingsCopiedJson: "Copied safety findings rollup (JSON)",
    safetyFindingsCopyJsonFallback: "Copy safety findings rollup manually",
    parseDiagnosticsPolicyPresetsLabel: "Quick thresholds",
    parseDiagnosticsPolicyPresetStrict: "Strict",
    parseDiagnosticsPolicyPresetBalanced: "Balanced",
    parseDiagnosticsPolicyPresetPermissive: "Permissive",
    parseDiagnosticsPolicyActiveLabel: "Active preset",
    parseDiagnosticsPolicyActiveCustom: "custom",
    deprecatedRulesAuditPresetsLabel: "Deprecated rules audit",
    deprecatedRulesAuditPresetInformational: "Informational",
    deprecatedRulesAuditPresetSixMonthStrict: "6-month strict",
    deprecatedRulesAuditPresetYearlyStrict: "Yearly strict",
    deprecatedRulesAuditActiveLabel: "Active audit preset",
    deprecatedRulesAuditExportJson: "Export JSON",
    deprecatedRulesAuditExportCsv: "Export CSV",
    deprecatedRulesAuditCopyJson: "Copy JSON",
    deprecatedRulesAuditCopiedJson: "Copied deprecated rules audit (JSON)",
    deprecatedRulesAuditCopyJsonFallback: "Copy deprecated rules audit manually",
    deprecatedRulesAuditExported: "Exported deprecated rules audit",
    deprecatedRulesAuditExportFailed: "Deprecated rules audit export failed — copy manually",
    strictGateWatchLabel: "Strict CG_* gate watch",
    strictGatePatternNAndO: "N+O mixed",
    strictGatePatternDuplicateO: "Duplicate O",
    strictGatePatternDuplicateAddresses: "Duplicate addr.*",
    strictGateCopyJson: "Copy JSON",
    strictGateCopiedJson: "Copied strict CG_* gate summary",
    strictGateCopyJsonFallback: "Copy strict gate summary manually",
    strictGateCopyCsv: "Copy CSV",
    strictGateCopiedCsv: "Copied strict CG_* gate summary (CSV)",
    strictGateCopyCsvFallback: "Copy strict gate summary CSV manually",
    deprecatedRulesAuditCopyCsv: "Copy CSV",
    deprecatedRulesAuditCopiedCsv: "Copied deprecated rules audit (CSV)",
    deprecatedRulesAuditCopyCsvFallback: "Copy deprecated rules audit CSV manually",
    confirmResetUiPrefs:
      "Reset UI defaults for the current controller profile? This cannot be undone.",
    resetUiPrefsCancelled: "UI defaults reset cancelled.",
    confirmResetFixturePrefs:
      "Reset fixture import defaults for the current controller profile? This cannot be undone.",
    resetFixturePrefsCancelled: "Fixture defaults reset cancelled.",
    copyPolicyAuditTrail: "Copy policy audit trail",
    copiedPolicyAuditTrail: "Copied policy audit trail",
    copyPolicyAuditTrailFallback: "Copy policy audit trail manually",
    policyAuditTrailNoEntries: "No entries to copy.",
    copyPolicyAuditTrailParseOnly: "Copy diagnostics audit subset (parse + lint)",
    copiedPolicyAuditTrailParseOnly: "Copied diagnostics audit subset (parse + lint)",
    copyPolicyAuditTrailParseOnlyFallback: "Copy diagnostics audit subset manually",
    auditTrailExportFormatLabel: "Export format",
    auditTrailExportFormatText: "Text",
    auditTrailExportFormatMarkdown: "Markdown",
    auditTrailExportFormatCsv: "CSV",
    auditTrailExportFormatNdjson: "NDJSON",
    auditTrailDownloadButtonLabel: "Download audit trail",
    auditTrailDownloadStatus: (filename, rowCount) =>
      `Downloaded ${filename} (${rowCount}).`,
    auditTrailDownloadFallback: "Audit trail download failed.",
    auditTrailDownloadSidecarLabel: "Attach SHA-256 sidecar",
    auditTrailDownloadSidecarStatus: (filename, sidecarFilename, rowCount) =>
      `Downloaded ${filename} + ${sidecarFilename} (${rowCount}).`,
    auditTrailHmacSecretLabel: "HMAC secret key",
    auditTrailDownloadHmacLabel: "Attach HMAC-SHA-256 sidecar",
    auditTrailDownloadHmacStatus: (filename, hmacSidecarFilename, rowCount) =>
      `Downloaded ${filename} + ${hmacSidecarFilename} (${rowCount}).`,
    auditTrailDownloadHmacMissingSecret:
      "HMAC sidecar skipped — enter a shared secret to sign it.",
    auditTrailEncryptionSecretLabel: "Encryption password (AES-GCM)",
    auditTrailDownloadEncryptionLabel: "Attach encrypted copy (AES-256-GCM)",
    auditTrailDownloadEncryptionStatus: (filename, encryptedFilename, rowCount) =>
      `Downloaded ${filename} + ${encryptedFilename} (${rowCount}).`,
    auditTrailDownloadEncryptionMissingSecret:
      "Encrypted copy skipped — enter a password to derive the AES-GCM key.",
    clearAuditTrail: "Clear audit trail",
    confirmClearAuditTrail:
      "Clear the policy audit trail for this session? The 'policy_audit_trail_cleared' entry stays as proof of this action.",
    auditTrailClearedStatus: "Cleared session policy audit trail.",
    auditTrailFilterAll: "All",
    auditTrailFilterParseLint: "Parse + lint",
    auditTrailFilterReset: "Resets",
    auditTrailFilterPolicy: "Policy",
    auditTrailCountChip: (n: number) => `${n} entries`,
    auditTrailHydratedChip: (n: number) => `${n} hydrated`,
    openExportFolder: "Open export folder",
    jumpToBlockers: "Jump to blockers",
    exportStatus: "Export status",
    fixtureImport: "Shop regression fixture import",
    fixturesRoot: "Fixtures root",
    fixtureId: "Fixture id",
    fixtureController: "Fixture controller",
    fixtureFilename: "Fixture filename (optional)",
    fixtureExpectMainM99: "Expects main-level M99",
    fixtureExpectSimWarnings: "Expects simulation warnings",
    fixtureExpectSimFindings: "Expects simulation findings",
    fixtureExpectedFindingCodes: "Expected finding codes (optional, comma-separated)",
    fixturePreviewPaths: "Write path preview",
    autoValidateAfterImport: "Auto-validate manifest after import",
    autoRunTestsAfterImport: "Auto-run shop regression tests after import",
    importCancelled: "Import cancelled.",
    resetFixturePrefs: "Reset fixture import defaults for this controller",
    fixtureImportNow: "Import fixture",
    validateFixtures: "Validate fixtures manifest",
    testsWorkspaceRoot: "Tests workspace root",
    runFixtureTests: "Run shop regression tests",
    fixtureOpsInProgress: "Fixture operation in progress...",
    fixtureDefaultsLoadedFor: "Fixture defaults loaded for",
    fixtureHealth: "Fixture health",
    refreshFixtureHealth: "Refresh fixture health",
    upgradeToStrict: "Upgrade to strict mode from current findings",
    fixtureDetectedController: "Detected program controller",
    showOnlyIssueFixtures: "Show only fixtures with issues",
    useDetectedController: "Use detected controller",
    normalizeFixtureId: "Normalize fixture id",
    previewAutoFixes: "Preview auto-fixes",
    applyAutoFixes: "Apply auto-fixes",
    includeControllerFixes: "Include controller fixes",
    includeStrictFixes: "Include strict codes from simulation",
    autoRunTestsAfterApply: "Run shop regression tests after auto-fixes",
    minControllerFixConfidence: "Minimum controller-fix confidence",
    confidenceHigh: "High",
    confidenceMedium: "Medium",
    confidenceLow: "Low",
    rollbackFromBackup: "Rollback manifest from backup",
    previewRequired: "Run a fresh auto-fix preview for current settings before apply.",
    postApplyReport: "Post auto-fix report",
    restoreHint: "Backup restore hint",
    strictD: "Haas - D with G43 H (no D on G41/G42)",
    allowCompD: "Fanuc - D on G41/G42 and G40 D00",
    polish: "Polski",
    english: "English",
    parseDiagnostics: "Parse diagnostics",
    parseDiagnosticsEmpty: "No parse diagnostics.",
    parseDiagnosticsBlockLabel: "block",
    suggestedFixesLabel: "Suggested fixes",
    copyFixText: "Copy fix text",
    copyAllFixesInGroup: "Copy all fixes in group",
    parseDiagnosticsShowMore: "Show all",
    parseDiagnosticsHiddenSuffix: "hidden",
    parseDiagnosticsCapNote: "List trimmed for readability; copy actions still operate on the full group.",
    parseDiagnosticsCopiedFix: "Copied parse fix",
    parseDiagnosticsCopiedAllFixes: "Copied parse fixes for",
    parseDiagnosticsNoFixesToCopy: "No suggested fixes to copy for",
    parseDiagnosticsCopyFallback: "Copy parse fix manually",
    lintIssuesEmpty: "No lint issues.",
    lintIssuesGroupSourceLabels: {
      lexer: "Lexer",
      expression_parser: "Expression parser",
      controller_grammar: "Controller grammar",
      common_lint: "Common lint",
      profile_lint: "Profile lint"
    },
    lintCopyFixText: "Copy lint fix",
    lintCopyAllFixesInGroup: "Copy all lint fixes in group",
    lintCopiedFix: "Copied lint fix",
    lintCopiedAllFixes: "Copied lint fixes for",
    lintNoFixesToCopy: "No lint fixes to copy for",
    lintIssuesChipEmpty: "lintIssues: total=0",
    lintIssuesLoadDemo: "Load lint demo",
    lintIssuesLoadDemoStatus: "Loaded sample lint program.",
    lintDemoControllerLabel: "Lint demo variant",
    lintDemoControllerAuto: "auto (detected controller)"
  }
};

export function App() {
  const nodeCapable = isNodeCapable();
  const e2eExportMockAvailable = typeof window !== "undefined" && Boolean(window.__CNC_E2E_EXPORT_MOCK__);
  const nodeOnlyDisabled = !nodeCapable && !e2eExportMockAvailable;
  const nodeOnlyDisabledReason = "Requires Node-capable runtime (@cnc/core/node).";
  const [code, setCode] = useState(SAMPLE);
  const [language, setLanguage] = useState<UiLanguage>("pl");
  const [operatorReviewMode, setOperatorReviewMode] = useState(false);
  const [dOffsetCallStyle, setDOffsetCallStyle] = useState<
    "haas_g43_d_with_h_only" | "fanuc_wear_on_g41_g42_with_g40_d00"
  >(
    "haas_g43_d_with_h_only"
  );
  const [dPolicyManuallySet, setDPolicyManuallySet] = useState(false);
  const [removeStandaloneOptionalStops, setRemoveStandaloneOptionalStops] = useState(false);
  const [parameterPresetId, setParameterPresetId] = useState("haas-ngc-safe");
  const [parameterBlacklistInput, setParameterBlacklistInput] = useState("500,501,502");
  const [toolCommentSelections, setToolCommentSelections] = useState<Record<number, string>>({});
  const [exportFolder, setExportFolder] = useState(".");
  const [exportBaseName, setExportBaseName] = useState("program");
  const [includeTimelineFindingsExport, setIncludeTimelineFindingsExport] = useState(true);
  const [exportStatus, setExportStatus] = useState("");
  const [allowExportWithBlockers, setAllowExportWithBlockers] = useState(false);
  const [jobCheckPolicyPreset, setJobCheckPolicyPreset] = useState<JobCheckPolicyPreset>("balanced");
  const [policyPresetManuallySet, setPolicyPresetManuallySet] = useState(false);
  const [policyUiEventsEnabled, setPolicyUiEventsEnabled] = useState(true);
  const [policyLockManualChanges, setPolicyLockManualChanges] = useState(false);
  const [parseDiagnosticsPolicy, setParseDiagnosticsPolicy] = useState<ParseDiagnosticsPolicyUiState>({
    enabled: false,
    severity: "warning",
    blockExport: false,
    thresholdsText: ""
  });
  const [deprecatedRulesAuditPreset, setDeprecatedRulesAuditPreset] =
    useState<DeprecatedRulesAuditPolicyPresetId>("informational");
  const deprecatedRulesAuditSummary = useMemo(
    () => runDeprecatedRulesAudit(deprecatedRulesAuditPreset),
    [deprecatedRulesAuditPreset]
  );
  const [strictGateWatchPatterns, setStrictGateWatchPatterns] = useState<
    StrictControllerGateWatchPattern[]
  >([...STRICT_CONTROLLER_GATE_WATCH_PRESETS]);
  const [lintDemoControllerOverride, setLintDemoControllerOverride] = useState<
    "auto" | ControllerProfileKey
  >("auto");
  const [auditTrailExportFormat, setAuditTrailExportFormat] =
    useState<AuditTrailExportFormat>("text");
  const [auditTrailDownloadWithSidecar, setAuditTrailDownloadWithSidecar] =
    useState<boolean>(false);
  const [auditTrailDownloadWithHmacSidecar, setAuditTrailDownloadWithHmacSidecar] =
    useState<boolean>(false);
  const [auditTrailHmacSecret, setAuditTrailHmacSecret] = useState<string>("");
  const [auditTrailDownloadWithEncryption, setAuditTrailDownloadWithEncryption] =
    useState<boolean>(false);
  const [auditTrailEncryptionSecret, setAuditTrailEncryptionSecret] = useState<string>("");
  const [subprogramTargetPolicy, setSubprogramTargetPolicy] = useState<SubprogramTargetPolicy>("shop_friendly");
  const [subprogramPolicyManuallySet, setSubprogramPolicyManuallySet] = useState(false);
  const [logSemantics, setLogSemantics] = useState<LogSemantics>("controller_default");
  const [logSemanticsManuallySet, setLogSemanticsManuallySet] = useState(false);
  const [showOnlyBlockers, setShowOnlyBlockers] = useState(false);
  const [timelineFilters, setTimelineFilters] = useState<Record<TimelineFilterKey, boolean>>({
    alarms: true,
    flow: true,
    control: true
  });
  const [jobCheckStatus, setJobCheckStatus] = useState("");
  const [jobCheckCopyStatus, setJobCheckCopyStatus] = useState("");
  const [firstCutRiskBriefCopyStatusPlain, setFirstCutRiskBriefCopyStatusPlain] = useState("");
  const [firstCutRiskBriefCopyStatusPolicy, setFirstCutRiskBriefCopyStatusPolicy] = useState("");
  const [firstCutRiskBriefCopyStatusJobCheck, setFirstCutRiskBriefCopyStatusJobCheck] = useState("");
  const [jobCheckFindingsSummaryCopyStatus, setJobCheckFindingsSummaryCopyStatus] = useState("");
  const [operatorHandoffBundleCopyStatus, setOperatorHandoffBundleCopyStatus] = useState("");
  const [machineSafeStartupBriefCopyStatus, setMachineSafeStartupBriefCopyStatus] = useState("");
  const [policyContextCopyStatus, setPolicyContextCopyStatus] = useState("");
  const [fullExportContextCopyStatus, setFullExportContextCopyStatus] = useState("");
  const [jobCheckResult, setJobCheckResult] = useState<RunJobCheckResult | null>(null);
  const strictGateSummary = useMemo(() => {
    if (!jobCheckResult || strictGateWatchPatterns.length === 0) {
      return {
        patterns: strictGateWatchPatterns,
        matchedCodes: [] as string[],
        wouldBlock: false
      };
    }
    return evaluateStrictControllerGate(jobCheckResult.lintIssues, strictGateWatchPatterns);
  }, [jobCheckResult, strictGateWatchPatterns]);
  const [lastExportContext, setLastExportContext] = useState<{
    directory: string;
    artifactCount: number;
    preset: JobCheckPolicyPreset;
    source: "saved" | "bootstrap" | "manual";
    controller: ControllerProfileKey;
  } | null>(null);
  const [policyAuditTrail, setPolicyAuditTrail] = useState<
    Array<{
      timestampIso: string;
      event: string;
      preset: JobCheckPolicyPreset;
      source: "saved" | "bootstrap" | "manual";
      controller: ControllerProfileKey;
      code?: string;
      blockIndex?: number;
      fixCount?: number;
      count?: number;
      severities?: string;
      hydratedFromTemplate?: boolean;
    }>
  >([]);
  const [auditTrailHydrated, setAuditTrailHydrated] = useState(false);
  const [auditTrailFilterCategory, setAuditTrailFilterCategory] = useState<
    "all" | "parse_lint" | "reset" | "policy"
  >("all");
  const [testsWorkspaceRoot, setTestsWorkspaceRoot] = useState(".");
  const [fixturesRoot, setFixturesRoot] = useState("./packages/test-fixtures");
  const [fixtureId, setFixtureId] = useState("my_shop_fixture");
  const [fixtureIdManuallyEdited, setFixtureIdManuallyEdited] = useState(false);
  const [fixtureController, setFixtureController] = useState<ControllerProfileKey>("haas-ngc");
  const [fixtureControllerManuallySet, setFixtureControllerManuallySet] = useState(false);
  const [fixtureFilename, setFixtureFilename] = useState("");
  const [fixtureExpectMainM99, setFixtureExpectMainM99] = useState(false);
  const [fixtureExpectSimWarnings, setFixtureExpectSimWarnings] = useState(false);
  const [fixtureExpectSimFindings, setFixtureExpectSimFindings] = useState(false);
  const [fixtureExpectedFindingCodes, setFixtureExpectedFindingCodes] = useState("");
  const [autoValidateAfterImport, setAutoValidateAfterImport] = useState(true);
  const [autoRunTestsAfterImport, setAutoRunTestsAfterImport] = useState(false);
  const [fixtureOpsBusy, setFixtureOpsBusy] = useState(false);
  const [fixtureHealth, setFixtureHealth] = useState<AnalyzeShopFixturesResult | null>(null);
  const [showOnlyIssueFixtures, setShowOnlyIssueFixtures] = useState(true);
  const [includeControllerFixes, setIncludeControllerFixes] = useState(true);
  const [includeStrictFixes, setIncludeStrictFixes] = useState(true);
  const [minimumControllerFixConfidence, setMinimumControllerFixConfidence] = useState<"high" | "medium" | "low">(
    "high"
  );
  const [autoRunTestsAfterApply, setAutoRunTestsAfterApply] = useState(false);
  const [autoFixPreview, setAutoFixPreview] = useState<PreviewShopFixtureAutoFixesResult | null>(null);
  const [autoFixPreviewInputSnapshot, setAutoFixPreviewInputSnapshot] = useState<{
    fixturesRootDirectory: string;
    includeControllerMismatchFixes: boolean;
    includeStrictFromSimulationFixes: boolean;
  } | null>(null);
  const [autoFixPostReport, setAutoFixPostReport] = useState<{
    appliedChanges: number;
    backupPath?: string;
    validationOk: boolean;
    fixtureCount?: number;
    testsRun: boolean;
    testsOk?: boolean;
    testsCommand?: string;
    testsError?: string;
    restoreCommand?: string;
  } | null>(null);
  const [lastAutoFixBackupPath, setLastAutoFixBackupPath] = useState<string | undefined>();
  const [advancedQaExpanded, setAdvancedQaExpanded] = useState(true);
  const [policyDriftWarning, setPolicyDriftWarning] = useState("");
  const [templateJson, setTemplateJson] = useState(() => getTemplateLibrary().sourceJson);
  const codeTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const t = UI_TEXT[language];
  const nodeOnlyWithBusyDisabled = nodeOnlyDisabled || fixtureOpsBusy;
  const parameterPresets = useMemo(() => parameterReserveProfiles(), []);
  const selectedPreset = parameterPresets.find((p) => p.id === parameterPresetId);
  const templateLibrary = useMemo(() => parseTemplateLibrary(templateJson), [templateJson]);
  const detectedControllerProfile = useMemo<ControllerProfileKey>(() => detectControllerProfile(code), [code]);
  const previousDetectedControllerRef = useRef<ControllerProfileKey | undefined>(undefined);

  const blacklistedParameters = useMemo(() => parseBlacklistedParameters(parameterBlacklistInput), [parameterBlacklistInput]);

  const ast = useMemo(() => parse(code, haasNgcProfile, { includeExpressionAst: true }), [code]);
  const formatted = useMemo(
    () => format(ast, haasNgcProfile, { removeStandaloneOptionalStops }),
    [ast, removeStandaloneOptionalStops]
  );
  const parameterSuggestions = useMemo(
    () =>
      parameterize(ast, {
        blacklistedParameters,
        startAt: selectedPreset?.startAt ?? 100
      }).suggestions,
    [ast, blacklistedParameters, selectedPreset]
  );
  const lintIssues = useMemo(() => lintWithProvenance(ast, haasNgcProfile), [ast]);
  const lintIssuesBySource = useMemo<Array<[LintIssueProvenanceSource, LintIssueLike[]]>>(
    () => groupLintIssuesBySource(lintIssues as unknown as LintIssueLike[]),
    [lintIssues]
  );
  const lintIssuesSummaryChip = useMemo(
    () =>
      buildLintIssuesSummaryChip(lintIssuesBySource, {
        emptyText: t.lintIssuesChipEmpty
      }),
    [lintIssuesBySource, t.lintIssuesChipEmpty]
  );
  const parseDiagnosticsPolicyResolved = useMemo<{
    policy: ParseDiagnosticsPolicyResolved | undefined;
    invalidEntries: string[];
  }>(() => resolveParseDiagnosticsPolicy(parseDiagnosticsPolicy), [parseDiagnosticsPolicy]);
  const currentMatchingParseDiagnosticsPolicyPreset = useMemo(
    () => selectMatchingParseDiagnosticsPolicyPreset(parseDiagnosticsPolicy),
    [parseDiagnosticsPolicy]
  );
  const policyAuditTrailSummary = useMemo(
    () => summarizePolicyAuditTrail(policyAuditTrail),
    [policyAuditTrail]
  );
  const filteredPolicyAuditTrail = useMemo(
    () => filterPolicyAuditTrailByCategory(policyAuditTrail, auditTrailFilterCategory),
    [policyAuditTrail, auditTrailFilterCategory]
  );
  const parseDiagnosticsPolicyBriefField = useMemo(() => {
    const summary = ast.parseDiagnostics ?? [];
    const observedTotal = summary.length;
    const observedByCode: Record<string, number> = {};
    for (const diag of summary) {
      observedByCode[diag.code] = (observedByCode[diag.code] ?? 0) + 1;
    }
    const thresholds = parseDiagnosticsPolicyResolved.policy?.thresholds ?? {};
    const breaches: { key: string; observed: number; threshold: number }[] = [];
    for (const [key, threshold] of Object.entries(thresholds)) {
      if (threshold === undefined) continue;
      const observed = key === "TOTAL" ? observedTotal : observedByCode[key] ?? 0;
      if (observed > threshold) {
        breaches.push({ key, observed, threshold });
      }
    }
    return buildParseDiagnosticsPolicyBriefField({ state: parseDiagnosticsPolicy, breaches });
  }, [ast, parseDiagnosticsPolicy, parseDiagnosticsPolicyResolved]);
  const parseDiagBreachesBriefField = useMemo(
    () => buildParseDiagBreachesBriefField(jobCheckResult?.parseDiagnosticsPolicyBreaches),
    [jobCheckResult]
  );
  const parseDiagBreachSeveritiesBriefField = useMemo(
    () =>
      buildParseDiagBreachSeveritiesBriefField(
        jobCheckResult?.parseDiagnosticsPolicyBreaches
      ),
    [jobCheckResult]
  );
  const parseDiagBreachSeveritiesSummary = useMemo(
    () =>
      summarizeParseDiagBreachSeverities(
        jobCheckResult?.parseDiagnosticsPolicyBreaches ?? []
      ),
    [jobCheckResult]
  );
  const policyBreachRollupChip = useMemo(
    () => formatPolicyBreachRollupChip(jobCheckResult?.parseDiagnosticsPolicyBreaches),
    [jobCheckResult]
  );
  const parseDiagnostics = useMemo<ParseDiagnosticLike[]>(
    () => (ast.parseDiagnostics ?? []) as ParseDiagnosticLike[],
    [ast]
  );
  const parseDiagnosticsByCode = useMemo(() => groupAndSortDiagnostics(parseDiagnostics), [parseDiagnostics]);
  const parseDiagnosticsSummaryChip = useMemo(
    () =>
      buildDiagnosticsSummaryChip(parseDiagnosticsByCode, {
        emptyText: t.parseDiagnosticsChipEmpty
      }),
    [parseDiagnosticsByCode, t.parseDiagnosticsChipEmpty]
  );
  const [parseDiagnosticsExpandedCodes, setParseDiagnosticsExpandedCodes] = useState<Set<string>>(
    () => new Set<string>()
  );

  function setParseDiagnosticsCodeExpanded(code: string, expanded: boolean): void {
    setParseDiagnosticsExpandedCodes((prev) => {
      const next = new Set(prev);
      if (expanded) next.add(code);
      else next.delete(code);
      return next;
    });
  }
  const simulation = useMemo(
    () => simulate(ast, {}, { maxSteps: 200, maxLoopIterations: 200, subprogramTargetPolicy, logSemantics }),
    [ast, subprogramTargetPolicy, logSemantics]
  );
  const simulationEvents = useMemo(
    () => simulation.trace.filter((entry) => entry.event).map((entry) => ({ blockIndex: entry.blockIndex, ...entry.event! })),
    [simulation]
  );
  const filteredSimulationEvents = useMemo(
    () =>
      simulationEvents.filter((event) => {
        if (isAlarmEvent(event.kind)) return timelineFilters.alarms;
        if (isFlowEvent(event.kind)) return timelineFilters.flow;
        return timelineFilters.control;
      }),
    [simulationEvents, timelineFilters]
  );
  const report = useMemo(
    () =>
      toolingReport(ast, {}, {
        fiveAxis: { enabled: true, machine: "umc" },
        dOffsetCallStyle,
        toolCommentSelections
      }),
    [ast, dOffsetCallStyle, toolCommentSelections]
  );
  const advisor = useMemo(
    () =>
      analyzeProgram(ast, {}, {
        stock: {
          minX: -10,
          maxX: 200,
          minY: -10,
          maxY: 200,
          topZ: 0,
          bottomZ: -80
        },
        clampZones: [
          { name: "LEFT_VISE_JAW", minX: -5, maxX: 15, minY: -5, maxY: 205, minZ: -10, maxZ: 80 }
        ]
      }),
    [ast]
  );
  const safetyFindingsByCodeRows = useMemo(() => {
    const findings = [
      ...(advisor.safetyFindings ?? []),
      ...(jobCheckResult?.simulationFindings ?? [])
    ];
    return buildSafetyFindingsByCodeFromFindings(findings);
  }, [advisor.safetyFindings, jobCheckResult]);
  const safetyFindingsChip = useMemo(
    () => formatSafetyFindingsChip(safetyFindingsByCodeRows),
    [safetyFindingsByCodeRows]
  );
  const templates = useMemo(() => templateLibrary.templates, [templateLibrary]);
  const setupSheet = useMemo(() => buildSetupSheet(ast, {}), [ast]);
  const proveout = useMemo(() => proveoutProgram(ast, {}), [ast]);
  const proveoutApplied = useMemo(
    () => applyProveout(code, proveout.code.split(/\r?\n/).filter((l) => l.includes("OPTIONAL STOP"))),
    [code, proveout.code]
  );
  const proveoutRemoved = useMemo(() => removeProveout(proveoutApplied.code), [proveoutApplied.code]);
  const combinedBlockerFindings = useMemo(
    () => [...advisor.safetyFindings, ...(jobCheckResult?.simulationFindings ?? [])].filter((f) => f.severity === "blocker"),
    [advisor, jobCheckResult]
  );
  const combinedWarningFindings = useMemo(
    () => [...advisor.safetyFindings, ...(jobCheckResult?.simulationFindings ?? [])].filter((f) => f.severity === "warning"),
    [advisor, jobCheckResult]
  );
  const firstCutRiskBriefItems = useMemo(
    () =>
      [...combinedBlockerFindings, ...combinedWarningFindings].slice(0, 3).map((f) => ({
        code: f.code,
        blockIndex: f.blockIndex,
        reason: f.message,
        operatorAction: suggestedFixForFinding(f.code, language)
      })),
    [combinedBlockerFindings, combinedWarningFindings, language]
  );
  const persistedPolicyPreset = useMemo(
    () => readUiDefaultsFromTemplateJson(templateJson, detectedControllerProfile)?.jobCheckPolicyPreset,
    [templateJson, detectedControllerProfile]
  );
  const policyPresetHintState = resolvePolicyPresetHintState({
    persistedPreset: persistedPolicyPreset,
    currentPreset: jobCheckPolicyPreset,
    manuallySet: policyPresetManuallySet
  });
  const policyPresetSourceLabel =
    policyPresetHintState.source === "saved"
      ? t.policyPresetSourceSaved
      : policyPresetHintState.source === "manual"
        ? t.policyPresetSourceManual
        : t.policyPresetSourceBootstrap;
  const policyPresetVisualState = derivePolicyPresetVisualState(policyPresetHintState);
  const policyPresetSourceBadgeStyle =
    policyPresetVisualState.highlightManualSource
      ? {
          marginLeft: 6,
          padding: "1px 6px",
          borderRadius: 10,
          border: "1px solid #8a6f00",
          background: "#fff4cc",
          color: "#5f4b00",
          fontWeight: 600
        }
      : undefined;
  const currentPolicyPresetLabel =
    policyPresetHintState.currentPreset === "strict"
      ? t.policyPresetStrict
      : policyPresetHintState.currentPreset === "permissive"
        ? t.policyPresetPermissive
        : t.policyPresetBalanced;
  const persistedPolicyPresetLabel =
    policyPresetHintState.persistedPreset === "strict"
      ? t.policyPresetStrict
      : policyPresetHintState.persistedPreset === "permissive"
        ? t.policyPresetPermissive
        : t.policyPresetBalanced;
  const setupSheetWithPolicyContext = useMemo(
    () =>
      addPolicyPresetContextToSetupSheetBundle(
        setupSheet,
        policyPresetHintState.currentPreset,
        policyPresetHintState.source,
        detectedControllerProfile
      ),
    [setupSheet, policyPresetHintState.currentPreset, policyPresetHintState.source, detectedControllerProfile]
  );
  const fixtureTargetPaths = useMemo(() => {
    const base = fixturesRoot.trim();
    const fileStem = sanitizeFixtureName(fixtureFilename.trim() || fixtureId.trim() || "fixture");
    const fixturePath = `${base}/shop-regressions/${fixtureController}/${fileStem}.nc`;
    const manifestPath = `${base}/shop-regressions/manifest.json`;
    return { fixturePath, manifestPath };
  }, [fixturesRoot, fixtureController, fixtureFilename, fixtureId]);
  const timelineFindingsExportBundle = useMemo(() => {
    return buildTimelineFindingsExportBundle({
      timestampIso: new Date().toISOString(),
      controller: detectedControllerProfile,
      policyPreset: jobCheckPolicyPreset,
      policyPresetSource: policyPresetHintState.source,
      subprogramTargetPolicy,
      logSemantics,
      score: jobCheckResult?.readyToRunScore ?? advisor.readyToRunScore,
      timelineEntries: filteredSimulationEvents.map((event) => ({
        blockIndex: event.blockIndex,
        kind: event.kind,
        message: event.message
      })),
      findings: [...combinedBlockerFindings, ...combinedWarningFindings].map((f) => ({
        ...f,
        message: `${f.message} | Fix: ${suggestedFixForFinding(f.code, language)}`
      })),
      parseDiagnosticsSummary: summarizeParseDiagnostics(ast.parseDiagnostics)
    });
  }, [
    ast,
    filteredSimulationEvents,
    combinedBlockerFindings,
    combinedWarningFindings,
    language,
    detectedControllerProfile,
    jobCheckPolicyPreset,
    policyPresetHintState.source,
    subprogramTargetPolicy,
    logSemantics,
    jobCheckResult,
    advisor
  ]);
  const recordPolicyPresetTransition = (
    eventName: string,
    detail: { controller: ControllerProfileKey; preset: JobCheckPolicyPreset; source: "saved" | "bootstrap" | "manual" },
    extra?: {
      code?: string;
      blockIndex?: number;
      fixCount?: number;
      count?: number;
      severities?: string;
    }
  ): void => {
    const timestampIso = new Date().toISOString();
    const extraEntry = extra
      ? {
          ...(extra.code !== undefined ? { code: extra.code } : {}),
          ...(extra.blockIndex !== undefined ? { blockIndex: extra.blockIndex } : {}),
          ...(extra.fixCount !== undefined ? { fixCount: extra.fixCount } : {}),
          ...(extra.count !== undefined ? { count: extra.count } : {}),
          ...(extra.severities !== undefined ? { severities: extra.severities } : {})
        }
      : {};
    setPolicyAuditTrail((prev) => [{ event: eventName, timestampIso, ...detail, ...extraEntry }, ...prev].slice(0, 30));
    emitPolicyPresetUiEvent(policyUiEventsEnabled, eventName, detail, timestampIso, extra);
  };
  const autoFixPreviewMatchesCurrentSettings = useMemo(() => {
    if (!autoFixPreview || !autoFixPreviewInputSnapshot) return false;
    return (
      autoFixPreviewInputSnapshot.fixturesRootDirectory === fixturesRoot.trim() &&
      autoFixPreviewInputSnapshot.includeControllerMismatchFixes === includeControllerFixes &&
      autoFixPreviewInputSnapshot.includeStrictFromSimulationFixes === includeStrictFixes
    );
  }, [autoFixPreview, autoFixPreviewInputSnapshot, fixturesRoot, includeControllerFixes, includeStrictFixes]);

  useEffect(() => {
    if (fixtureIdManuallyEdited) return;
    const suggested = suggestFixtureIdFromCode(code);
    if (suggested) setFixtureId(suggested);
  }, [code, fixtureIdManuallyEdited]);

  useEffect(() => {
    const defaults = templateLibrary.settings?.parameterDefaults?.[detectedControllerProfile];
    if (!defaults) return;
    if (defaults.presetId && parameterPresets.some((p) => p.id === defaults.presetId)) {
      setParameterPresetId(defaults.presetId);
    }
    if (defaults.blacklistedParameters && defaults.blacklistedParameters.length > 0) {
      setParameterBlacklistInput(defaults.blacklistedParameters.join(","));
    }
  }, [templateLibrary, parameterPresets, detectedControllerProfile]);

  useEffect(() => {
    if (auditTrailHydrated) return;
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(templateJson);
    } catch {
      return;
    }
    const hydrated = hydrateAuditEntriesFromTemplate(parsed);
    if (hydrated.length === 0) return;
    setPolicyAuditTrail((prev) => [
      ...hydrated.map((entry) => ({ ...entry, hydratedFromTemplate: true })),
      ...prev
    ]);
    setAuditTrailHydrated(true);
  }, [templateJson, auditTrailHydrated]);

  useEffect(() => {
    const uiDefaults = readUiDefaultsFromTemplateJson(templateJson, detectedControllerProfile);
    if (!uiDefaults) return;
    if (uiDefaults.subprogramTargetPolicy) {
      setSubprogramTargetPolicy(uiDefaults.subprogramTargetPolicy);
      setSubprogramPolicyManuallySet(true);
    }
    if (uiDefaults.logSemantics) {
      setLogSemantics(uiDefaults.logSemantics);
      setLogSemanticsManuallySet(true);
    }
    if (uiDefaults.dOffsetCallStyle) {
      setDOffsetCallStyle(uiDefaults.dOffsetCallStyle);
      setDPolicyManuallySet(true);
    }
    if (uiDefaults.showOnlyBlockers !== undefined) {
      setShowOnlyBlockers(Boolean(uiDefaults.showOnlyBlockers));
    }
    if (uiDefaults.timelineFilters) {
      setTimelineFilters((prev) => ({
        alarms: uiDefaults.timelineFilters?.alarms ?? prev.alarms,
        flow: uiDefaults.timelineFilters?.flow ?? prev.flow,
        control: uiDefaults.timelineFilters?.control ?? prev.control
      }));
    }
    if (uiDefaults.fixturesRoot) {
      setFixturesRoot(uiDefaults.fixturesRoot);
    }
    if (uiDefaults.testsWorkspaceRoot) {
      setTestsWorkspaceRoot(uiDefaults.testsWorkspaceRoot);
    }
    if (uiDefaults.autoValidateAfterImport !== undefined) {
      setAutoValidateAfterImport(Boolean(uiDefaults.autoValidateAfterImport));
    }
    if (uiDefaults.autoRunTestsAfterImport !== undefined) {
      setAutoRunTestsAfterImport(Boolean(uiDefaults.autoRunTestsAfterImport));
    }
    if (uiDefaults.operatorReviewMode !== undefined) {
      setOperatorReviewMode(Boolean(uiDefaults.operatorReviewMode));
    }
    if (uiDefaults.advancedQaExpanded !== undefined) {
      setAdvancedQaExpanded(Boolean(uiDefaults.advancedQaExpanded));
    }
    if (uiDefaults.policyUiEventsEnabled !== undefined) {
      setPolicyUiEventsEnabled(Boolean(uiDefaults.policyUiEventsEnabled));
    }
    if (uiDefaults.policyLockManualChanges !== undefined) {
      setPolicyLockManualChanges(Boolean(uiDefaults.policyLockManualChanges));
    }
    if (uiDefaults.jobCheckPolicyPreset) {
      setJobCheckPolicyPreset(uiDefaults.jobCheckPolicyPreset);
      setPolicyPresetManuallySet(false);
      recordPolicyPresetTransition("saved_default_loaded", {
        controller: detectedControllerProfile,
        preset: uiDefaults.jobCheckPolicyPreset,
        source: "saved"
      });
    }
    if (uiDefaults.parseDiagnosticsPolicy) {
      setParseDiagnosticsPolicy({
        enabled: Boolean(uiDefaults.parseDiagnosticsPolicy.enabled),
        severity: uiDefaults.parseDiagnosticsPolicy.severity ?? "warning",
        blockExport: Boolean(uiDefaults.parseDiagnosticsPolicy.blockExport),
        thresholdsText: uiDefaults.parseDiagnosticsPolicy.thresholdsText ?? ""
      });
    }
    if (uiDefaults.lintDemoControllerOverride !== undefined) {
      setLintDemoControllerOverride(uiDefaults.lintDemoControllerOverride);
    }
    if (
      uiDefaults.auditTrailExportFormat !== undefined &&
      isAuditTrailExportFormat(uiDefaults.auditTrailExportFormat)
    ) {
      setAuditTrailExportFormat(uiDefaults.auditTrailExportFormat);
    }
  }, [templateJson, detectedControllerProfile, policyUiEventsEnabled]);

  useEffect(() => {
    const uiDefaults = readUiDefaultsFromTemplateJson(templateJson, detectedControllerProfile);
    if (uiDefaults?.jobCheckPolicyPreset || policyPresetManuallySet) return;
    const preset = defaultPolicyPresetForController(detectedControllerProfile);
    setJobCheckPolicyPreset(preset);
    recordPolicyPresetTransition("bootstrap_default_applied", {
      controller: detectedControllerProfile,
      preset,
      source: "bootstrap"
    });
  }, [templateJson, detectedControllerProfile, policyPresetManuallySet, policyUiEventsEnabled]);

  useEffect(() => {
    if (subprogramPolicyManuallySet) return;
    setSubprogramTargetPolicy(detectedControllerProfile === "fanuc" ? "strict_controller" : "shop_friendly");
  }, [detectedControllerProfile, subprogramPolicyManuallySet]);

  useEffect(() => {
    if (dPolicyManuallySet) return;
    setDOffsetCallStyle(
      detectedControllerProfile === "fanuc" ? "fanuc_wear_on_g41_g42_with_g40_d00" : "haas_g43_d_with_h_only"
    );
  }, [detectedControllerProfile, dPolicyManuallySet]);

  useEffect(() => {
    if (logSemanticsManuallySet) return;
    setLogSemantics(detectedControllerProfile === "fanuc" ? "base10" : "natural");
  }, [detectedControllerProfile, logSemanticsManuallySet]);

  useEffect(() => {
    if (fixtureControllerManuallySet) return;
    setFixtureController(detectedControllerProfile);
  }, [detectedControllerProfile, fixtureControllerManuallySet]);

  useEffect(() => {
    const previous = previousDetectedControllerRef.current;
    previousDetectedControllerRef.current = detectedControllerProfile;
    setPolicyDriftWarning(
      derivePolicyDriftWarning({
        previousController: previous,
        nextController: detectedControllerProfile,
        manuallySet: policyPresetManuallySet,
        warningPrefix: t.policyDriftWarning
      })
    );
  }, [detectedControllerProfile, policyPresetManuallySet, t.policyDriftWarning]);

  useEffect(() => {
    if (!policyPresetManuallySet) {
      setPolicyDriftWarning("");
    }
  }, [policyPresetManuallySet]);

  useEffect(() => {
    // Default to collapsed Advanced QA in operator mode unless user explicitly opens it.
    if (operatorReviewMode && advancedQaExpanded) {
      setAdvancedQaExpanded(false);
    }
  }, [operatorReviewMode, advancedQaExpanded]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (policyLockManualChanges) return;
      const action = resolvePolicyPresetShortcutAction({
        key: event.key,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        isTypingContext: isTypingElement(event.target)
      });
      if (action === "revert_to_default") {
        event.preventDefault();
        const preset = defaultPolicyPresetForController(detectedControllerProfile);
        setJobCheckPolicyPreset(preset);
        setPolicyPresetManuallySet(false);
        recordPolicyPresetTransition("reverted_to_controller_default_shortcut", {
          controller: detectedControllerProfile,
          preset,
          source: "bootstrap"
        });
        setExportStatus("Policy preset reverted to controller default (Ctrl+Shift+R).");
      }
      if (action === "save_and_run") {
        event.preventDefault();
        void handleSavePolicyPresetAndRunCheck();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [detectedControllerProfile, policyLockManualChanges, policyUiEventsEnabled]);

  async function handleExport(): Promise<void> {
    try {
      const exported = window.__CNC_E2E_EXPORT_MOCK__
        ? {
            exportDirectory: window.__CNC_E2E_EXPORT_MOCK__.exportDirectory,
            artifacts: Array.from({ length: window.__CNC_E2E_EXPORT_MOCK__.artifactCount }, (_, idx) => ({
              kind: `mock-${idx}`,
              path: `mock-${idx}.txt`
            }))
          }
        : await exportWorkshopFiles({
            baseDirectory: exportFolder,
            baseName: exportBaseName,
            setupSheetTxt: setupSheetWithPolicyContext.exportTxt,
            setupSheetMarkdown: setupSheetWithPolicyContext.exportMarkdown,
            proveoutCode: proveout.code,
            fixtureSummaryTxt: fixtureHealth?.summaryTxt,
            fixtureSummaryMarkdown: fixtureHealth?.summaryMarkdown,
            timelineTxt: includeTimelineFindingsExport ? timelineFindingsExportBundle.timelineTxt : undefined,
            timelineMarkdown: includeTimelineFindingsExport ? timelineFindingsExportBundle.timelineMarkdown : undefined,
            findingsTxt: includeTimelineFindingsExport ? timelineFindingsExportBundle.findingsTxt : undefined,
            findingsMarkdown: includeTimelineFindingsExport ? timelineFindingsExportBundle.findingsMarkdown : undefined
          });
      const policyContext = `preset=${policyPresetHintState.currentPreset} source=${policyPresetHintState.source} controller=${detectedControllerProfile}`;
      setExportStatus(`${exported.exportDirectory} (${exported.artifacts.length} files) | ${policyContext}`);
      setLastExportContext({
        directory: exported.exportDirectory,
        artifactCount: exported.artifacts.length,
        preset: policyPresetHintState.currentPreset,
        source: policyPresetHintState.source,
        controller: detectedControllerProfile
      });
    } catch (error) {
      setExportStatus(
        error instanceof Error
          ? `Export unavailable in current runtime: ${error.message}`
          : "Export unavailable in current runtime."
      );
    }
  }

  async function handleRunJobCheck(): Promise<void> {
    try {
      const result = await runJobCheck({
        ast,
        policyPreset: jobCheckPolicyPreset,
        initialState: {},
        advisorOptions: {
          stock: {
            minX: -10,
            maxX: 200,
            minY: -10,
            maxY: 200,
            topZ: 0,
            bottomZ: -80
          },
          clampZones: [{ name: "LEFT_VISE_JAW", minX: -5, maxX: 15, minY: -5, maxY: 205, minZ: -10, maxZ: 80 }]
        },
        exportOptions: {
          enabled: true,
          allowExportWithBlockers,
          baseDirectory: exportFolder,
          baseName: exportBaseName
        },
        simulationLimits: {
          maxSteps: 10000,
          maxLoopIterations: 1000,
          subprogramTargetPolicy,
          logSemantics
        },
        parseDiagnosticsPolicy: parseDiagnosticsPolicyResolved.policy
      });
      const parseSummary = result.parseDiagnosticsSummary;
      const parseSummaryStatusSuffix =
        parseSummary && parseSummary.total > 0
          ? ` | parseDiagnostics=${parseSummary.total} (top=${parseSummary.topCodes.join(",") || "n/a"})`
          : ` | parseDiagnostics=0`;
      setJobCheckStatus(
        `score=${result.readyToRunScore}, blockers=${result.blockerCount}, warnings=${result.warningCount}, blocked=${result.blocked} | policy=${jobCheckPolicyPreset}, source=${policyPresetHintState.source}, controller=${detectedControllerProfile}${parseSummaryStatusSuffix}`
      );
      setJobCheckResult(result);
      if (result.exportResult) {
        setExportStatus(`${result.exportResult.exportDirectory} (${result.exportResult.artifacts.length} files)`);
      }
    } catch (error) {
      setJobCheckStatus(error instanceof Error ? error.message : "Job check failed.");
      setJobCheckResult(null);
    }
  }

  async function handleImportShopFixture(): Promise<void> {
    if (fixtureOpsBusy) return;
    setFixtureOpsBusy(true);
    const fixtureRoot = fixturesRoot.trim();
    const id = fixtureId.trim();
    const codeSource = code.trim();
    if (!fixtureRoot) {
      setExportStatus("Fixture import failed: Fixtures root is required.");
      setFixtureOpsBusy(false);
      return;
    }
    if (!id) {
      setExportStatus("Fixture import failed: Fixture id is required.");
      setFixtureOpsBusy(false);
      return;
    }
    if (!codeSource) {
      setExportStatus("Fixture import failed: Program code is empty.");
      setFixtureOpsBusy(false);
      return;
    }

    const expectedFindingCodes = parseStringList(fixtureExpectedFindingCodes);
    const baseInput = {
      fixturesRootDirectory: fixtureRoot,
      id,
      controller: fixtureController,
      code,
      filename: fixtureFilename.trim() || undefined,
      expectations: {
        expectsMainM99: fixtureExpectMainM99,
        expectsSimulationWarnings: fixtureExpectSimWarnings,
        expectsSimulationFindings: fixtureExpectSimFindings,
        expectedFindingCodes
      }
    };

    try {
      let result;
      try {
        result = await importShopFixture({
          ...baseInput,
          overwriteExistingFile: false
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!message.includes("Fixture file already exists")) throw error;
        const shouldOverwrite = window.confirm(`${message}\n\nOverwrite existing file?`);
        if (!shouldOverwrite) {
          setExportStatus(t.importCancelled);
          return;
        }
        result = await importShopFixture({
          ...baseInput,
          overwriteExistingFile: true
        });
      }

      const postMessages = [`Fixture imported: ${result.fixtureId} -> ${result.fixturePath}`];
      if (autoValidateAfterImport) {
        const validated = await validateShopFixturesManifest({ fixturesRootDirectory: fixtureRoot });
        postMessages.push(`manifest OK (${validated.fixtureCount})`);
      }
      if (autoRunTestsAfterImport) {
        const tested = await runShopRegressionTests({ workspaceRootDirectory: testsWorkspaceRoot.trim() });
        postMessages.push(`tests OK (${tested.command})`);
        setJobCheckStatus(tested.output.trim() || "Shop regression tests passed.");
      }
      setExportStatus(postMessages.join(" | "));
    } catch (error) {
      setExportStatus(error instanceof Error ? `Fixture import failed: ${error.message}` : "Fixture import failed.");
    } finally {
      setFixtureOpsBusy(false);
    }
  }

  async function handleValidateFixturesManifest(): Promise<void> {
    if (fixtureOpsBusy) return;
    setFixtureOpsBusy(true);
    try {
      const result = await validateShopFixturesManifest({ fixturesRootDirectory: fixturesRoot.trim() });
      setExportStatus(`Fixture manifest OK (${result.fixtureCount} fixtures): ${result.manifestPath}`);
    } catch (error) {
      setExportStatus(
        error instanceof Error ? `Fixture manifest validation failed: ${error.message}` : "Fixture manifest validation failed."
      );
    } finally {
      setFixtureOpsBusy(false);
    }
  }

  async function handleRunFixtureTests(): Promise<void> {
    if (fixtureOpsBusy) return;
    setFixtureOpsBusy(true);
    try {
      const result = await runShopRegressionTests({ workspaceRootDirectory: testsWorkspaceRoot.trim() });
      setExportStatus(`Fixture tests passed (${result.command}).`);
      setJobCheckStatus(result.output.trim() || "Shop regression tests passed.");
    } catch (error) {
      setExportStatus(
        error instanceof Error ? `Fixture tests failed: ${error.message}` : "Fixture tests failed."
      );
    } finally {
      setFixtureOpsBusy(false);
    }
  }

  async function handleRefreshFixtureHealth(): Promise<void> {
    if (fixtureOpsBusy) return;
    setFixtureOpsBusy(true);
    try {
      const result = await analyzeShopFixtureHealth({ fixturesRootDirectory: fixturesRoot.trim() });
      setFixtureHealth(result);
      setExportStatus(`Fixture health refreshed (${result.fixtureCount} fixtures).`);
    } catch (error) {
      setExportStatus(error instanceof Error ? `Fixture health failed: ${error.message}` : "Fixture health failed.");
    } finally {
      setFixtureOpsBusy(false);
    }
  }

  async function handlePreviewAutoFixes(): Promise<void> {
    if (fixtureOpsBusy) return;
    setFixtureOpsBusy(true);
    try {
      const previewInput = {
        fixturesRootDirectory: fixturesRoot.trim(),
        includeControllerMismatchFixes: includeControllerFixes,
        includeStrictFromSimulationFixes: includeStrictFixes
      };
      const preview = await previewShopFixtureAutoFixes({
        fixturesRootDirectory: previewInput.fixturesRootDirectory,
        includeControllerMismatchFixes: previewInput.includeControllerMismatchFixes,
        includeStrictFromSimulationFixes: previewInput.includeStrictFromSimulationFixes
      });
      setAutoFixPreview(preview);
      setAutoFixPreviewInputSnapshot(previewInput);
      setAutoFixPostReport(null);
      setExportStatus(`Auto-fix preview ready (${preview.changes.length} changes).`);
    } catch (error) {
      setExportStatus(error instanceof Error ? `Auto-fix preview failed: ${error.message}` : "Auto-fix preview failed.");
    } finally {
      setFixtureOpsBusy(false);
    }
  }

  async function handleApplyAutoFixes(): Promise<void> {
    if (fixtureOpsBusy) return;
    if (!autoFixPreview || !autoFixPreviewMatchesCurrentSettings) {
      setExportStatus(t.previewRequired);
      return;
    }
    setFixtureOpsBusy(true);
    try {
      const fixtureRoot = fixturesRoot.trim();
      const result = await applyShopFixtureAutoFixes({
        fixturesRootDirectory: fixtureRoot,
        includeControllerMismatchFixes: includeControllerFixes,
        includeStrictFromSimulationFixes: includeStrictFixes,
        createBackup: true,
        minimumControllerFixConfidence,
        expectedPreviewFingerprint: autoFixPreview.fingerprint
      });
      const validation = await validateShopFixturesManifest({ fixturesRootDirectory: fixtureRoot });
      const refreshed = await analyzeShopFixtureHealth({ fixturesRootDirectory: fixtureRoot });
      setFixtureHealth(refreshed);
      let testsOk: boolean | undefined;
      let testsCommand: string | undefined;
      let testsError: string | undefined;
      if (autoRunTestsAfterApply) {
        try {
          const testResult = await runShopRegressionTests({ workspaceRootDirectory: testsWorkspaceRoot.trim() });
          testsOk = true;
          testsCommand = testResult.command;
          setJobCheckStatus(testResult.output.trim() || "Shop regression tests passed.");
        } catch (error) {
          testsOk = false;
          testsError = error instanceof Error ? error.message : "Fixture tests failed.";
        }
      }
      const restoreCommand = result.backupPath
        ? `copy "${result.backupPath}" "${result.manifestPath}"`
        : undefined;
      setAutoFixPostReport({
        appliedChanges: result.appliedChanges,
        backupPath: result.backupPath,
        validationOk: true,
        fixtureCount: validation.fixtureCount,
        testsRun: autoRunTestsAfterApply,
        testsOk,
        testsCommand,
        testsError,
        restoreCommand
      });
      setLastAutoFixBackupPath(result.backupPath);
      const backupNote = result.backupPath ? ` Backup: ${result.backupPath}.` : "";
      const testSuffix = autoRunTestsAfterApply
        ? testsOk
          ? " tests OK."
          : " tests FAILED. Use backup restore hint below."
        : " tests skipped.";
      setExportStatus(
        `Auto-fixes applied: ${result.appliedChanges}. Manifest OK (${validation.fixtureCount}).${testSuffix}${backupNote}`
      );
      setAutoFixPreview(null);
      setAutoFixPreviewInputSnapshot(null);
    } catch (error) {
      setExportStatus(error instanceof Error ? `Auto-fix apply failed: ${error.message}` : "Auto-fix apply failed.");
    } finally {
      setFixtureOpsBusy(false);
    }
  }

  async function handleUpgradeFixtureToStrictMode(): Promise<void> {
    if (fixtureOpsBusy) return;
    setFixtureOpsBusy(true);
    try {
      const result = await runJobCheck({
        ast,
        policyPreset: jobCheckPolicyPreset,
        simulationLimits: { controllerMode: fixtureController },
        exportOptions: { enabled: false, baseDirectory: ".", baseName: "strict_upgrade_preview" }
      });
      const codes = [...new Set(result.simulationFindings.map((f) => f.code))];
      setFixtureExpectedFindingCodes(codes.join(", "));
      setFixtureExpectSimFindings(codes.length > 0);
      setExportStatus(
        codes.length > 0
          ? `Strict codes updated from current findings: ${codes.join(", ")}`
          : "No simulation findings found; strict list cleared."
      );
    } catch (error) {
      setExportStatus(error instanceof Error ? `Strict upgrade failed: ${error.message}` : "Strict upgrade failed.");
    } finally {
      setFixtureOpsBusy(false);
    }
  }

  async function handleRollbackAutoFixBackup(): Promise<void> {
    if (fixtureOpsBusy) return;
    const backupPath = lastAutoFixBackupPath ?? autoFixPostReport?.backupPath;
    if (!backupPath) {
      setExportStatus("No backup available to restore.");
      return;
    }
    setFixtureOpsBusy(true);
    try {
      const manifestPath = `${fixturesRoot.trim()}/shop-regressions/manifest.json`;
      const restored = await restoreShopFixtureManifestBackup({ manifestPath, backupPath });
      const refreshed = await analyzeShopFixtureHealth({ fixturesRootDirectory: fixturesRoot.trim() });
      setFixtureHealth(refreshed);
      setExportStatus(`Manifest restored from backup: ${restored.restoredFrom}`);
      setAutoFixPreview(null);
      setAutoFixPreviewInputSnapshot(null);
    } catch (error) {
      setExportStatus(error instanceof Error ? `Rollback failed: ${error.message}` : "Rollback failed.");
    } finally {
      setFixtureOpsBusy(false);
    }
  }

  function handleUseDetectedController(): void {
    setFixtureController(detectedControllerProfile);
    setFixtureControllerManuallySet(false);
    setExportStatus(`Fixture controller set to detected profile: ${detectedControllerProfile}`);
  }

  function handleNormalizeFixtureId(): void {
    const normalized = sanitizeFixtureName(fixtureId);
    setFixtureId(normalized);
    setFixtureIdManuallyEdited(true);
    setExportStatus(`Fixture id normalized: ${normalized}`);
  }

  function openExportFolderFromResult(): void {
    const dir = jobCheckResult?.exportResult?.exportDirectory;
    if (!dir) return;
    try {
      window.open(`file:///${dir.replace(/\\/g, "/")}`, "_blank");
    } catch {
      setExportStatus(`Open folder manually: ${dir}`);
    }
  }

  function jumpToBlockers(): void {
    const el = document.getElementById("job-check-blockers");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function jumpToSimulationBlock(blockIndex: number): void {
    const textarea = codeTextareaRef.current;
    if (!textarea) return;
    const lineIndex = Math.max(0, Math.min(blockIndex, code.split(/\r?\n/).length - 1));
    const lineStarts = computeLineStarts(code);
    const start = lineStarts[lineIndex] ?? 0;
    const end = lineStarts[lineIndex + 1] ?? code.length;
    textarea.focus();
    textarea.setSelectionRange(start, end);
    const lineHeight = 20;
    textarea.scrollTop = Math.max(0, lineIndex * lineHeight - lineHeight * 2);
  }

  function handleSaveParameterPrefsToTemplateJson(): void {
    try {
      const parsed = JSON.parse(templateJson) as {
        templates?: unknown;
        settings?: {
          parameterDefaults?: Record<
            string,
            { presetId?: string; startAt?: number; blacklistedParameters?: number[] }
          >;
          uiDefaults?: Record<
            string,
            {
              subprogramTargetPolicy?: SubprogramTargetPolicy;
              logSemantics?: LogSemantics;
              dOffsetCallStyle?: "haas_g43_d_with_h_only" | "fanuc_wear_on_g41_g42_with_g40_d00";
              showOnlyBlockers?: boolean;
              timelineFilters?: Partial<Record<TimelineFilterKey, boolean>>;
              fixturesRoot?: string;
              testsWorkspaceRoot?: string;
              autoValidateAfterImport?: boolean;
              autoRunTestsAfterImport?: boolean;
              operatorReviewMode?: boolean;
              advancedQaExpanded?: boolean;
              jobCheckPolicyPreset?: JobCheckPolicyPreset;
              policyUiEventsEnabled?: boolean;
              policyLockManualChanges?: boolean;
              parseDiagnosticsPolicy?: ParseDiagnosticsPolicyUiState;
              lintDemoControllerOverride?: "auto" | ControllerProfileKey;
              auditTrailExportFormat?: AuditTrailExportFormat;
            }
          >;
        };
      };

      const inflightSaveEntry = {
        timestampIso: new Date().toISOString(),
        event: "saved_to_template",
        preset: jobCheckPolicyPreset,
        source: policyPresetHintState.source,
        controller: detectedControllerProfile
      };
      const auditTrailRecent = selectPersistableAuditEntries([
        inflightSaveEntry,
        ...policyAuditTrail
      ]);
      const next = {
        templates: Array.isArray(parsed.templates) ? parsed.templates : templateLibrary.templates,
        settings: {
          parameterDefaults: {
            ...(parsed.settings?.parameterDefaults ?? {}),
            [detectedControllerProfile]: {
              presetId: parameterPresetId,
              startAt: selectedPreset?.startAt ?? 100,
              blacklistedParameters
            }
          },
          uiDefaults: {
            ...(parsed.settings?.uiDefaults ?? {}),
            [detectedControllerProfile]: {
              subprogramTargetPolicy,
              logSemantics,
              dOffsetCallStyle,
              showOnlyBlockers,
              timelineFilters,
              fixturesRoot,
              testsWorkspaceRoot,
              autoValidateAfterImport,
              autoRunTestsAfterImport,
              operatorReviewMode,
              advancedQaExpanded,
              jobCheckPolicyPreset,
              policyUiEventsEnabled,
              policyLockManualChanges,
              parseDiagnosticsPolicy,
              lintDemoControllerOverride,
              auditTrailExportFormat
            }
          },
          auditTrailRecent
        }
      };

      setTemplateJson(JSON.stringify(next, null, 2));
      setAuditTrailHydrated(true);
      recordPolicyPresetTransition("saved_to_template", {
        controller: detectedControllerProfile,
        preset: jobCheckPolicyPreset,
        source: policyPresetHintState.source
      });
      recordPolicyPresetTransition(
        "policy_audit_trail_persisted",
        {
          controller: detectedControllerProfile,
          preset: jobCheckPolicyPreset,
          source: policyPresetHintState.source
        },
        { count: auditTrailRecent.length }
      );
      setExportStatus("Parameter preferences saved into template JSON.");
    } catch {
      setExportStatus("Cannot save preferences: invalid template JSON.");
    }
  }

  async function handleSavePolicyPresetAndRunCheck(): Promise<void> {
    recordPolicyPresetTransition("save_and_run_invoked", {
      controller: detectedControllerProfile,
      preset: jobCheckPolicyPreset,
      source: policyPresetHintState.source
    });
    handleSaveParameterPrefsToTemplateJson();
    await handleRunJobCheck();
  }

  async function handleCopyPolicyContext(): Promise<void> {
    const line = `POLICY PRESET: ${policyPresetHintState.currentPreset} (${policyPresetHintState.source}) | CONTROLLER: ${detectedControllerProfile}`;
    try {
      await navigator.clipboard.writeText(line);
      const timestampIso = new Date().toISOString();
      setPolicyContextCopyStatus(`${timestampIso} | len=${line.length} | checksum=${checksumText(line)}`);
      setExportStatus(`Copied policy context: ${line}`);
    } catch {
      setPolicyContextCopyStatus("");
      setExportStatus(`Copy policy context manually: ${line}`);
    }
  }

  async function handleCopyParseDiagnosticsPolicyContext(): Promise<void> {
    const line = `${serializeParseDiagnosticsPolicy(parseDiagnosticsPolicy)} | controller=${detectedControllerProfile}`;
    try {
      await navigator.clipboard.writeText(line);
      setExportStatus(`${t.parseDiagnosticsPolicyCopiedStatus}: ${line}`);
      recordPolicyPresetTransition("parse_diag_policy_context_copied", {
        controller: detectedControllerProfile,
        preset: jobCheckPolicyPreset,
        source: policyPresetHintState.source
      });
    } catch {
      setExportStatus(`${t.parseDiagnosticsPolicyCopyFallback}: ${line}`);
    }
  }

  async function handleCopyParseDiagnosticsBreachContext(): Promise<void> {
    const breaches = jobCheckResult?.parseDiagnosticsPolicyBreaches ?? [];
    const { payload, count, severities } = buildParseDiagnosticsBreachContext(
      breaches,
      detectedControllerProfile
    );
    if (count === 0) {
      setExportStatus(`${t.parseDiagnosticsBreachCopiedStatus}: ${payload}`);
      return;
    }
    try {
      await navigator.clipboard.writeText(payload);
      setExportStatus(`${t.parseDiagnosticsBreachCopiedStatus}: ${payload}`);
      recordPolicyPresetTransition(
        "parse_breach_copied",
        {
          controller: detectedControllerProfile,
          preset: jobCheckPolicyPreset,
          source: policyPresetHintState.source
        },
        { count, severities }
      );
    } catch {
      setExportStatus(`${t.parseDiagnosticsBreachCopyFallback}: ${payload}`);
    }
  }

  function handleApplyParseDiagnosticsPolicyPreset(preset: ParseDiagnosticsPolicyPreset): void {
    const next = applyParseDiagnosticsPolicyPreset(preset);
    setParseDiagnosticsPolicy(next);
    recordPolicyPresetTransition(
      "parse_diag_policy_preset_applied",
      {
        controller: detectedControllerProfile,
        preset: jobCheckPolicyPreset,
        source: policyPresetHintState.source
      },
      { code: `preset:${preset}` }
    );
  }

  async function handleCopyStrictControllerGateJson(): Promise<void> {
    const payload = formatStrictControllerGateForExport(strictGateSummary, "json");
    try {
      await navigator.clipboard.writeText(payload);
      setExportStatus(t.strictGateCopiedJson);
    } catch {
      setExportStatus(`${t.strictGateCopyJsonFallback}: ${payload}`);
    }
  }

  async function handleCopyStrictControllerGateCsv(): Promise<void> {
    const payload = formatStrictControllerGateForExport(strictGateSummary, "csv");
    try {
      await navigator.clipboard.writeText(payload);
      setExportStatus(t.strictGateCopiedCsv);
    } catch {
      setExportStatus(`${t.strictGateCopyCsvFallback}: ${payload}`);
    }
  }

  async function handleCopyPolicyBreachJson(): Promise<void> {
    const payload = formatPolicyBreachesForExport(
      jobCheckResult?.parseDiagnosticsPolicyBreaches,
      "json"
    );
    try {
      await navigator.clipboard.writeText(payload);
      setExportStatus(t.policyBreachCopiedJson);
    } catch {
      setExportStatus(`${t.policyBreachCopyJsonFallback}: ${payload}`);
    }
  }

  async function handleCopyPolicyBreachCsv(): Promise<void> {
    const payload = formatPolicyBreachesForExport(
      jobCheckResult?.parseDiagnosticsPolicyBreaches,
      "csv"
    );
    try {
      await navigator.clipboard.writeText(payload);
      setExportStatus(t.policyBreachCopiedCsv);
    } catch {
      setExportStatus(`${t.policyBreachCopyCsvFallback}: ${payload}`);
    }
  }

  async function handleCopySafetyFindingsJson(): Promise<void> {
    const payload = formatSafetyFindingsForExport(safetyFindingsByCodeRows, "json");
    try {
      await navigator.clipboard.writeText(payload);
      setExportStatus(t.safetyFindingsCopiedJson);
    } catch {
      setExportStatus(`${t.safetyFindingsCopyJsonFallback}: ${payload}`);
    }
  }

  async function handleCopyDeprecatedRulesAuditCsv(): Promise<void> {
    const payload = formatDeprecatedRulesAuditForExport(deprecatedRulesAuditSummary, "csv");
    try {
      await navigator.clipboard.writeText(payload);
      setExportStatus(
        `${t.deprecatedRulesAuditCopiedCsv} (${deprecatedRulesAuditSummary.deprecatedCount}).`
      );
    } catch {
      setExportStatus(`${t.deprecatedRulesAuditCopyCsvFallback}: ${payload}`);
    }
  }

  async function handleCopyDeprecatedRulesAudit(): Promise<void> {
    const payload = formatDeprecatedRulesAuditForExport(deprecatedRulesAuditSummary, "json");
    try {
      await navigator.clipboard.writeText(payload);
      setExportStatus(
        `${t.deprecatedRulesAuditCopiedJson} (${deprecatedRulesAuditSummary.deprecatedCount}).`
      );
    } catch {
      setExportStatus(`${t.deprecatedRulesAuditCopyJsonFallback}: ${payload}`);
    }
  }

  async function handleExportDeprecatedRulesAudit(format: "json" | "csv"): Promise<void> {
    const payload = formatDeprecatedRulesAuditForExport(deprecatedRulesAuditSummary, format);
    try {
      const result = await downloadDeprecatedRulesAuditReport(
        payload,
        format,
        new Date().toISOString()
      );
      setExportStatus(`${t.deprecatedRulesAuditExported}: ${result.filename}`);
    } catch {
      setExportStatus(`${t.deprecatedRulesAuditExportFailed}: ${payload}`);
    }
  }

  async function handleCopyPolicyAuditTrail(): Promise<void> {
    const { payload, rowCount } = selectPolicyAuditTrailExportPayload(policyAuditTrail, {
      format: auditTrailExportFormat,
      limit: 30
    });
    if (rowCount === 0) {
      setExportStatus(t.policyAuditTrailNoEntries);
      return;
    }
    try {
      await navigator.clipboard.writeText(payload);
      setExportStatus(`${t.copiedPolicyAuditTrail} (${rowCount}).`);
      recordPolicyPresetTransition(
        "policy_audit_trail_copied",
        {
          controller: detectedControllerProfile,
          preset: jobCheckPolicyPreset,
          source: policyPresetHintState.source
        },
        { fixCount: rowCount, severities: `format=${auditTrailExportFormat}` }
      );
    } catch {
      setExportStatus(`${t.copyPolicyAuditTrailFallback}: ${payload}`);
    }
  }

  async function handleCopyPolicyAuditTrailParseOnly(): Promise<void> {
    const { payload, rowCount } = selectPolicyAuditTrailExportPayload(policyAuditTrail, {
      format: auditTrailExportFormat,
      limit: 30,
      categoryFilter: "parse_lint"
    });
    if (rowCount === 0) {
      setExportStatus(t.policyAuditTrailNoEntries);
      return;
    }
    try {
      await navigator.clipboard.writeText(payload);
      setExportStatus(`${t.copiedPolicyAuditTrailParseOnly} (${rowCount}).`);
      recordPolicyPresetTransition(
        "policy_audit_trail_subset_copied",
        {
          controller: detectedControllerProfile,
          preset: jobCheckPolicyPreset,
          source: policyPresetHintState.source
        },
        { count: rowCount, severities: `subset=parse_lint;format=${auditTrailExportFormat}` }
      );
    } catch {
      setExportStatus(`${t.copyPolicyAuditTrailParseOnlyFallback}: ${payload}`);
    }
  }

  async function handleDownloadPolicyAuditTrail(): Promise<void> {
    const { payload, rowCount } = selectPolicyAuditTrailExportPayload(policyAuditTrail, {
      format: auditTrailExportFormat,
      limit: 30
    });
    if (rowCount === 0) {
      setExportStatus(t.policyAuditTrailNoEntries);
      return;
    }
    // We refuse to silently downgrade the HMAC sidecar to plain SHA-256 when
    // the user opts in to HMAC but leaves the secret blank — surface a
    // dedicated UI status and skip the HMAC leg only. Same contract for the
    // AES-GCM encryption opt-in.
    const hmacRequested = auditTrailDownloadWithHmacSidecar;
    const hmacSecretTrimmed = auditTrailHmacSecret.trim();
    const hmacSecretMissing = hmacRequested && hmacSecretTrimmed.length === 0;
    const effectiveHmacOption =
      hmacRequested && !hmacSecretMissing
        ? { secretKey: auditTrailHmacSecret }
        : undefined;
    const encryptionRequested = auditTrailDownloadWithEncryption;
    const encryptionSecretTrimmed = auditTrailEncryptionSecret.trim();
    const encryptionSecretMissing =
      encryptionRequested && encryptionSecretTrimmed.length === 0;
    const effectiveEncryptionOption =
      encryptionRequested && !encryptionSecretMissing
        ? { secretKey: auditTrailEncryptionSecret }
        : undefined;
    try {
      const result = await downloadPolicyAuditTrail(
        payload,
        auditTrailExportFormat,
        new Date().toISOString(),
        {
          withSidecar: auditTrailDownloadWithSidecar,
          ...(effectiveHmacOption ? { withHmacSidecar: effectiveHmacOption } : {}),
          ...(effectiveEncryptionOption
            ? { withEncryption: effectiveEncryptionOption }
            : {})
        }
      );
      const missingFragments: string[] = [];
      if (hmacSecretMissing) missingFragments.push(t.auditTrailDownloadHmacMissingSecret);
      if (encryptionSecretMissing)
        missingFragments.push(t.auditTrailDownloadEncryptionMissingSecret);
      const appendMissing = (base: string): string =>
        missingFragments.length === 0 ? base : `${base} ${missingFragments.join(" ")}`;
      if (result.encryptedFilename) {
        setExportStatus(
          appendMissing(
            t.auditTrailDownloadEncryptionStatus(
              result.filename,
              result.encryptedFilename,
              rowCount
            )
          )
        );
        recordPolicyPresetTransition(
          "policy_audit_trail_downloaded_with_encryption",
          {
            controller: detectedControllerProfile,
            preset: jobCheckPolicyPreset,
            source: policyPresetHintState.source
          },
          {
            count: rowCount,
            severities: `format=${auditTrailExportFormat};encryption=aes-gcm${
              result.hmacSidecarFilename ? ";hmac=sha256" : ""
            }${result.sidecarFilename ? ";sidecar=sha256" : ""}`
          }
        );
      } else if (result.hmacSidecarFilename) {
        setExportStatus(
          appendMissing(
            t.auditTrailDownloadHmacStatus(
              result.filename,
              result.hmacSidecarFilename,
              rowCount
            )
          )
        );
        recordPolicyPresetTransition(
          "policy_audit_trail_downloaded_with_hmac_sidecar",
          {
            controller: detectedControllerProfile,
            preset: jobCheckPolicyPreset,
            source: policyPresetHintState.source
          },
          {
            count: rowCount,
            severities: `format=${auditTrailExportFormat};hmac=sha256${
              result.sidecarFilename ? ";sidecar=sha256" : ""
            }`
          }
        );
      } else if (result.sidecarFilename) {
        setExportStatus(
          appendMissing(
            t.auditTrailDownloadSidecarStatus(
              result.filename,
              result.sidecarFilename,
              rowCount
            )
          )
        );
        recordPolicyPresetTransition(
          "policy_audit_trail_downloaded_with_sidecar",
          {
            controller: detectedControllerProfile,
            preset: jobCheckPolicyPreset,
            source: policyPresetHintState.source
          },
          {
            count: rowCount,
            severities: `format=${auditTrailExportFormat};sidecar=sha256`
          }
        );
      } else {
        setExportStatus(
          appendMissing(t.auditTrailDownloadStatus(result.filename, rowCount))
        );
        recordPolicyPresetTransition(
          "policy_audit_trail_downloaded",
          {
            controller: detectedControllerProfile,
            preset: jobCheckPolicyPreset,
            source: policyPresetHintState.source
          },
          { count: rowCount, severities: `format=${auditTrailExportFormat}` }
        );
      }
    } catch {
      setExportStatus(t.auditTrailDownloadFallback);
    }
  }

  function handleClearAuditTrail(): void {
    if (!window.confirm(t.confirmClearAuditTrail)) return;
    const priorLength = policyAuditTrail.length;
    const timestampIso = new Date().toISOString();
    const detail = {
      controller: detectedControllerProfile,
      preset: jobCheckPolicyPreset,
      source: policyPresetHintState.source
    };
    setPolicyAuditTrail([
      {
        event: "policy_audit_trail_cleared",
        timestampIso,
        ...detail,
        count: priorLength
      }
    ]);
    emitPolicyPresetUiEvent(
      policyUiEventsEnabled,
      "policy_audit_trail_cleared",
      detail,
      timestampIso,
      { count: priorLength }
    );
    setExportStatus(t.auditTrailClearedStatus);
  }

  async function handleCopyParseFix(input: {
    line: string;
    code: string;
    blockIndex: number;
  }): Promise<void> {
    try {
      await navigator.clipboard.writeText(input.line);
      setExportStatus(`${t.parseDiagnosticsCopiedFix}: ${input.line}`);
      recordPolicyPresetTransition(
        "parse_fix_copied",
        {
          controller: detectedControllerProfile,
          preset: jobCheckPolicyPreset,
          source: policyPresetHintState.source
        },
        { code: input.code, blockIndex: input.blockIndex, fixCount: 1 }
      );
    } catch {
      setExportStatus(`${t.parseDiagnosticsCopyFallback}: ${input.line}`);
    }
  }

  async function handleCopyAllParseFixesForCode(
    code: string,
    items: ParseDiagnosticLike[]
  ): Promise<void> {
    const { payload, fixCount } = buildAllFixesPayload(code, items);
    if (fixCount === 0) {
      setExportStatus(`${t.parseDiagnosticsNoFixesToCopy} ${code}.`);
      return;
    }
    try {
      await navigator.clipboard.writeText(payload);
      setExportStatus(`${t.parseDiagnosticsCopiedAllFixes} ${code} (${fixCount}).`);
      recordPolicyPresetTransition(
        "parse_fix_group_copied",
        {
          controller: detectedControllerProfile,
          preset: jobCheckPolicyPreset,
          source: policyPresetHintState.source
        },
        { code, fixCount }
      );
    } catch {
      setExportStatus(`${t.parseDiagnosticsCopyFallback} (${code}): ${payload}`);
    }
  }

  function handleParseDiagnosticsExpandToggle(code: string, items: ParseDiagnosticLike[]): void {
    setParseDiagnosticsCodeExpanded(code, true);
    recordPolicyPresetTransition(
      "parse_fix_group_expanded",
      {
        controller: detectedControllerProfile,
        preset: jobCheckPolicyPreset,
        source: policyPresetHintState.source
      },
      { code, fixCount: items.length }
    );
  }

  function handleLoadDiagnosticsDemo(): void {
    setCode(DIAGNOSTICS_DEMO_PROGRAM);
    setExportStatus(t.parseDiagnosticsLoadDemoStatus);
    recordPolicyPresetTransition(
      "diagnostics_demo_loaded",
      {
        controller: detectedControllerProfile,
        preset: jobCheckPolicyPreset,
        source: policyPresetHintState.source
      }
    );
  }

  function handleLoadLintDemo(): void {
    const effectiveController =
      lintDemoControllerOverride === "auto"
        ? detectedControllerProfile
        : lintDemoControllerOverride;
    const program = selectLintDemoProgram(effectiveController);
    setCode(program);
    setExportStatus(t.lintIssuesLoadDemoStatus);
    recordPolicyPresetTransition(
      "lint_demo_loaded",
      {
        controller: detectedControllerProfile,
        preset: jobCheckPolicyPreset,
        source: policyPresetHintState.source
      },
      { code: `override=${lintDemoControllerOverride}` }
    );
  }

  async function handleCopyLintFix(input: {
    line: string;
    source: LintIssueProvenanceSource;
    blockIndex: number;
  }): Promise<void> {
    try {
      await navigator.clipboard.writeText(input.line);
      setExportStatus(`${t.lintCopiedFix}: ${input.line}`);
      recordPolicyPresetTransition(
        "lint_fix_copied",
        {
          controller: detectedControllerProfile,
          preset: jobCheckPolicyPreset,
          source: policyPresetHintState.source
        },
        { code: input.source, blockIndex: input.blockIndex, fixCount: 1 }
      );
    } catch {
      setExportStatus(`${t.parseDiagnosticsCopyFallback}: ${input.line}`);
    }
  }

  async function handleCopyAllLintFixesForSource(
    source: LintIssueProvenanceSource,
    items: LintIssueLike[]
  ): Promise<void> {
    const { payload, fixCount } = buildAllLintFixesPayload(source, items);
    if (fixCount === 0) {
      setExportStatus(`${t.lintNoFixesToCopy} ${source}.`);
      return;
    }
    try {
      await navigator.clipboard.writeText(payload);
      setExportStatus(`${t.lintCopiedAllFixes} ${source} (${fixCount}).`);
      recordPolicyPresetTransition(
        "lint_fix_group_copied",
        {
          controller: detectedControllerProfile,
          preset: jobCheckPolicyPreset,
          source: policyPresetHintState.source
        },
        { code: source, fixCount }
      );
    } catch {
      setExportStatus(`${t.parseDiagnosticsCopyFallback} (${source}): ${payload}`);
    }
  }

  async function handleCopyFullExportContext(): Promise<void> {
    const exportDir = jobCheckResult?.exportResult?.exportDirectory ?? "n/a";
    const artifactCount = jobCheckResult?.exportResult?.artifacts.length ?? 0;
    const line = `EXPORT CONTEXT | dir=${exportDir} artifacts=${artifactCount} | preset=${policyPresetHintState.currentPreset} source=${policyPresetHintState.source} controller=${detectedControllerProfile}`;
    try {
      await navigator.clipboard.writeText(line);
      const timestampIso = new Date().toISOString();
      setFullExportContextCopyStatus(`${timestampIso} | len=${line.length} | checksum=${checksumText(line)}`);
      setExportStatus(`Copied full export context: ${line}`);
    } catch {
      setFullExportContextCopyStatus("");
      setExportStatus(`Copy full export context manually: ${line}`);
    }
  }

  async function handleCopyJobCheckStatus(): Promise<void> {
    const line = `${t.runJobCheckStatus}: ${jobCheckStatus || "n/a"}`;
    const timestampIso = new Date().toISOString();
    const payloadChecksum = checksumText(line);
    const copySummary = `${timestampIso} | len=${line.length} | checksum=${payloadChecksum}`;
    try {
      await navigator.clipboard.writeText(line);
      setExportStatus(`Copied Job Check status: ${line}`);
      setJobCheckCopyStatus(copySummary);
      recordPolicyPresetTransition("job_check_status_copied", {
        controller: detectedControllerProfile,
        preset: jobCheckPolicyPreset,
        source: policyPresetHintState.source
      });
    } catch {
      setExportStatus(`Copy Job Check status manually: ${line}`);
      setJobCheckCopyStatus("");
    }
  }

  async function handleCopyJobCheckWithFindingsSummary(): Promise<void> {
    const findingCodes = [...combinedBlockerFindings, ...combinedWarningFindings]
      .map((f) => f.code)
      .filter((code, idx, arr) => arr.indexOf(code) === idx)
      .slice(0, 3);
    const line = [
      `${t.runJobCheckStatus}: ${jobCheckStatus || "n/a"}`,
      `blockers=${combinedBlockerFindings.length}`,
      `warnings=${combinedWarningFindings.length}`,
      `topFindingCodes=${findingCodes.length > 0 ? findingCodes.join(",") : "none"}`
    ].join(" | ");
    try {
      await navigator.clipboard.writeText(line);
      const timestampIso = new Date().toISOString();
      setJobCheckFindingsSummaryCopyStatus(`${timestampIso} | len=${line.length} | checksum=${checksumText(line)}`);
      setExportStatus(`Copied Job Check + findings summary: ${line}`);
      recordPolicyPresetTransition("job_check_findings_summary_copied", {
        controller: detectedControllerProfile,
        preset: jobCheckPolicyPreset,
        source: policyPresetHintState.source
      });
    } catch {
      setJobCheckFindingsSummaryCopyStatus("");
      setExportStatus(`Copy Job Check + findings summary manually: ${line}`);
    }
  }

  async function handleCopyOperatorHandoffBundle(): Promise<void> {
    const findingCodes = [...combinedBlockerFindings, ...combinedWarningFindings]
      .map((f) => f.code)
      .filter((code, idx, arr) => arr.indexOf(code) === idx)
      .slice(0, 3);
    const exportDir = jobCheckResult?.exportResult?.exportDirectory ?? "n/a";
    const artifactCount = jobCheckResult?.exportResult?.artifacts.length ?? 0;
    const driftStatus = policyDriftWarning ? `active:${policyDriftWarning}` : "none";
    const line = [
      `${t.runJobCheckStatus}: ${jobCheckStatus || "n/a"}`,
      `findings:blockers=${combinedBlockerFindings.length},warnings=${combinedWarningFindings.length},top=${findingCodes.length > 0 ? findingCodes.join(",") : "none"}`,
      `export:dir=${exportDir},artifacts=${artifactCount}`,
      `drift=${driftStatus}`,
      parseDiagnosticsSummaryChip.briefField,
      parseDiagnosticsPolicyBriefField,
      parseDiagBreachesBriefField,
      parseDiagBreachSeveritiesBriefField
    ].join(" | ");
    try {
      await navigator.clipboard.writeText(line);
      const timestampIso = new Date().toISOString();
      setOperatorHandoffBundleCopyStatus(`${timestampIso} | len=${line.length} | checksum=${checksumText(line)}`);
      setExportStatus(`Copied operator handoff bundle: ${line}`);
      recordPolicyPresetTransition("operator_handoff_bundle_copied", {
        controller: detectedControllerProfile,
        preset: jobCheckPolicyPreset,
        source: policyPresetHintState.source
      });
    } catch {
      setOperatorHandoffBundleCopyStatus("");
      setExportStatus(`Copy operator handoff bundle manually: ${line}`);
    }
  }

  async function handleCopyMachineSafeStartupBrief(): Promise<void> {
    const topFindings = [...combinedBlockerFindings, ...combinedWarningFindings]
      .slice(0, 2)
      .map((f) => `${f.code}${f.blockIndex !== undefined ? `@B${f.blockIndex}` : ""}`);
    const checklistHeadline = advisor.checklist.slice(0, 3).join(" | ");
    const briefLines = [
      "MACHINE SAFE STARTUP BRIEF",
      `ready=${advisor.readyToRunScore}/100 blocked=${combinedBlockerFindings.length > 0 ? "true" : "false"}`,
      `blockers=${combinedBlockerFindings.length} warnings=${combinedWarningFindings.length}`,
      `topFindings=${topFindings.length > 0 ? topFindings.join(",") : "none"}`,
      `checklist=${checklistHeadline || "n/a"}`,
      `policy=${jobCheckPolicyPreset} source=${policyPresetHintState.source} controller=${detectedControllerProfile}`,
      parseDiagnosticsSummaryChip.briefField,
      parseDiagnosticsPolicyBriefField,
      parseDiagBreachesBriefField,
      parseDiagBreachSeveritiesBriefField
    ];
    const line = briefLines.join("\n");
    try {
      await navigator.clipboard.writeText(line);
      const timestampIso = new Date().toISOString();
      setMachineSafeStartupBriefCopyStatus(`${timestampIso} | len=${line.length} | checksum=${checksumText(line)}`);
      setExportStatus(`Copied machine-safe startup brief: ${briefLines[1]} | ${briefLines[2]} | ${briefLines[3]}`);
      recordPolicyPresetTransition("machine_safe_startup_brief_copied", {
        controller: detectedControllerProfile,
        preset: jobCheckPolicyPreset,
        source: policyPresetHintState.source
      });
    } catch {
      setMachineSafeStartupBriefCopyStatus("");
      setExportStatus("Copy machine-safe startup brief manually: see current Job Check and checklist panels.");
    }
  }

  async function handleCopyFirstCutRiskBrief(): Promise<void> {
    const briefLines = [
      "FIRST-CUT RISK BRIEF",
      ...firstCutRiskBriefItems.map(
        (item, idx) =>
          `#${idx + 1} code=${item.code}${item.blockIndex !== undefined ? ` block=B${item.blockIndex}` : ""} | reason=${item.reason} | action=${item.operatorAction}`
      ),
      parseDiagnosticsSummaryChip.briefField
    ];
    const line = briefLines.join("\n");
    try {
      await navigator.clipboard.writeText(line);
      const timestampIso = new Date().toISOString();
      const copySummary = `${timestampIso} | len=${line.length} | checksum=${checksumText(line)}`;
      setFirstCutRiskBriefCopyStatusPlain(copySummary);
      setExportStatus(
        `Copied first-cut risk brief: ${firstCutRiskBriefItems.length > 0 ? firstCutRiskBriefItems.map((item) => item.code).join(",") : "none"}`
      );
      recordPolicyPresetTransition("first_cut_risk_brief_copied", {
        controller: detectedControllerProfile,
        preset: jobCheckPolicyPreset,
        source: policyPresetHintState.source
      });
    } catch {
      setFirstCutRiskBriefCopyStatusPlain("");
      setExportStatus("Copy first-cut risk brief manually: see Workshop Advisor first-cut risk brief section.");
    }
  }

  async function handleCopyFirstCutRiskBriefWithPolicyContext(): Promise<void> {
    const briefLines = [
      "FIRST-CUT RISK BRIEF",
      ...firstCutRiskBriefItems.map(
        (item, idx) =>
          `#${idx + 1} code=${item.code}${item.blockIndex !== undefined ? ` block=B${item.blockIndex}` : ""} | reason=${item.reason} | action=${item.operatorAction}`
      ),
      `POLICY CONTEXT | preset=${jobCheckPolicyPreset} source=${policyPresetHintState.source} controller=${detectedControllerProfile}`,
      parseDiagnosticsSummaryChip.briefField,
      parseDiagnosticsPolicyBriefField,
      parseDiagBreachesBriefField,
      parseDiagBreachSeveritiesBriefField
    ];
    const line = briefLines.join("\n");
    try {
      await navigator.clipboard.writeText(line);
      const timestampIso = new Date().toISOString();
      const copySummary = `${timestampIso} | len=${line.length} | checksum=${checksumText(line)}`;
      setFirstCutRiskBriefCopyStatusPolicy(copySummary);
      setExportStatus(
        `Copied first-cut risk brief + policy context: preset=${jobCheckPolicyPreset} source=${policyPresetHintState.source} controller=${detectedControllerProfile}`
      );
      recordPolicyPresetTransition("first_cut_risk_brief_with_policy_copied", {
        controller: detectedControllerProfile,
        preset: jobCheckPolicyPreset,
        source: policyPresetHintState.source
      });
    } catch {
      setFirstCutRiskBriefCopyStatusPolicy("");
      setExportStatus("Copy first-cut risk brief + policy context manually: see Workshop Advisor and policy panel.");
    }
  }

  async function handleCopyFirstCutRiskBriefWithJobCheckStatus(): Promise<void> {
    const statusLine = `${t.runJobCheckStatus}: ${jobCheckStatus || "n/a"}`;
    const briefLines = [
      "FIRST-CUT RISK BRIEF",
      ...firstCutRiskBriefItems.map(
        (item, idx) =>
          `#${idx + 1} code=${item.code}${item.blockIndex !== undefined ? ` block=B${item.blockIndex}` : ""} | reason=${item.reason} | action=${item.operatorAction}`
      ),
      parseDiagnosticsSummaryChip.briefField,
      parseDiagnosticsPolicyBriefField,
      parseDiagBreachesBriefField,
      parseDiagBreachSeveritiesBriefField
    ];
    const line = [statusLine, "", ...briefLines].join("\n");
    try {
      await navigator.clipboard.writeText(line);
      const timestampIso = new Date().toISOString();
      const copySummary = `${timestampIso} | len=${line.length} | checksum=${checksumText(line)}`;
      setFirstCutRiskBriefCopyStatusJobCheck(copySummary);
      setExportStatus(`Copied first-cut risk brief + Job Check: ${jobCheckStatus || "n/a"}`);
      recordPolicyPresetTransition("first_cut_risk_brief_with_job_check_copied", {
        controller: detectedControllerProfile,
        preset: jobCheckPolicyPreset,
        source: policyPresetHintState.source
      });
    } catch {
      setFirstCutRiskBriefCopyStatusJobCheck("");
      setExportStatus("Copy first-cut risk brief + Job Check manually: see Job Check status and Workshop Advisor.");
    }
  }

  function handleResetUiPrefsForController(): void {
    const confirmed =
      typeof window !== "undefined" && typeof window.confirm === "function"
        ? window.confirm(t.confirmResetUiPrefs)
        : true;
    if (!confirmed) {
      setExportStatus(t.resetUiPrefsCancelled);
      recordPolicyPresetTransition(
        "ui_defaults_reset_aborted",
        {
          controller: detectedControllerProfile,
          preset: jobCheckPolicyPreset,
          source: policyPresetHintState.source
        },
        { code: detectedControllerProfile }
      );
      return;
    }
    try {
      const parsed = JSON.parse(templateJson) as {
        templates?: unknown;
        settings?: {
          parameterDefaults?: Record<
            string,
            { presetId?: string; startAt?: number; blacklistedParameters?: number[] }
          >;
          uiDefaults?: Record<string, unknown>;
        };
      };

      const nextUiDefaults = { ...(parsed.settings?.uiDefaults ?? {}) };
      delete nextUiDefaults[detectedControllerProfile];

      const next = {
        templates: Array.isArray(parsed.templates) ? parsed.templates : templateLibrary.templates,
        settings: {
          parameterDefaults: parsed.settings?.parameterDefaults ?? {},
          uiDefaults: nextUiDefaults
        }
      };

      setTemplateJson(JSON.stringify(next, null, 2));

      // Re-enable controller-driven auto defaults after removing persisted UI prefs.
      setSubprogramPolicyManuallySet(false);
      setLogSemanticsManuallySet(false);
      setDPolicyManuallySet(false);
      setFixtureControllerManuallySet(false);
      setSubprogramTargetPolicy(detectedControllerProfile === "fanuc" ? "strict_controller" : "shop_friendly");
      setLogSemantics(detectedControllerProfile === "fanuc" ? "base10" : "natural");
      setDOffsetCallStyle(
        detectedControllerProfile === "fanuc" ? "fanuc_wear_on_g41_g42_with_g40_d00" : "haas_g43_d_with_h_only"
      );
      setFixtureController(detectedControllerProfile);
      setFixturesRoot("./packages/test-fixtures");
      setTestsWorkspaceRoot(".");
      setAutoValidateAfterImport(true);
      setAutoRunTestsAfterImport(false);
      setOperatorReviewMode(false);
      setAdvancedQaExpanded(true);
      setPolicyPresetManuallySet(false);
      setJobCheckPolicyPreset(defaultPolicyPresetForController(detectedControllerProfile));
      setPolicyUiEventsEnabled(true);
      setPolicyLockManualChanges(false);
      setParseDiagnosticsPolicy({
        enabled: false,
        severity: "warning",
        blockExport: false,
        thresholdsText: ""
      });
      setLintDemoControllerOverride("auto");
      setShowOnlyBlockers(false);
      setTimelineFilters({ alarms: true, flow: true, control: true });
      setExportStatus("UI defaults reset for current controller profile.");
      recordPolicyPresetTransition(
        "ui_defaults_reset_confirmed",
        {
          controller: detectedControllerProfile,
          preset: jobCheckPolicyPreset,
          source: policyPresetHintState.source
        },
        { code: detectedControllerProfile }
      );
    } catch {
      setExportStatus("Cannot reset UI defaults: invalid template JSON.");
    }
  }

  function handleResetFixturePrefsForController(): void {
    const confirmed =
      typeof window !== "undefined" && typeof window.confirm === "function"
        ? window.confirm(t.confirmResetFixturePrefs)
        : true;
    if (!confirmed) {
      setExportStatus(t.resetFixturePrefsCancelled);
      recordPolicyPresetTransition(
        "fixture_prefs_reset_aborted",
        {
          controller: detectedControllerProfile,
          preset: jobCheckPolicyPreset,
          source: policyPresetHintState.source
        },
        { code: detectedControllerProfile }
      );
      return;
    }
    setFixtureControllerManuallySet(false);
    setFixtureController(detectedControllerProfile);
    setFixturesRoot("./packages/test-fixtures");
    setTestsWorkspaceRoot(".");
    setAutoValidateAfterImport(true);
    setAutoRunTestsAfterImport(false);
    setExportStatus("Fixture import defaults reset for current controller profile.");
    recordPolicyPresetTransition(
      "fixture_prefs_reset_confirmed",
      {
        controller: detectedControllerProfile,
        preset: jobCheckPolicyPreset,
        source: policyPresetHintState.source
      },
      { code: detectedControllerProfile }
    );
  }

  return (
    <main style={{ padding: 16, fontFamily: "Segoe UI, sans-serif" }}>
      <h1>{t.title}</h1>
      <p>{t.subtitle}</p>
      <p style={{ marginTop: -6, opacity: 0.85 }}>
        Runtime mode: {nodeCapable ? "Node-capable" : "Browser-only"}
      </p>

      <label style={{ display: "block", marginBottom: 12 }}>
        {t.languageLabel}:{" "}
        <select value={language} onChange={(event) => setLanguage(event.target.value as UiLanguage)}>
          <option value="pl">{t.polish}</option>
          <option value="en">{t.english}</option>
        </select>
      </label>
      <label style={{ display: "block", marginBottom: 12 }}>
        <input
          type="checkbox"
          checked={operatorReviewMode}
          onChange={(event) => setOperatorReviewMode(event.target.checked)}
        />{" "}
        {t.operatorReviewMode}
      </label>

      {jobCheckResult && (
        <section
          style={{
            position: "sticky",
            top: 8,
            zIndex: 20,
            marginBottom: 16,
            padding: 12,
            borderRadius: 8,
            background:
              jobCheckResult.blockerCount > 0 ? "#5a1b1b" : jobCheckResult.warningCount > 0 ? "#5a4a1b" : "#1e5a2b",
            color: "#fff"
          }}
        >
          <h2>{t.jobCheckCard}</h2>
          <p>
            {`score=${jobCheckResult.readyToRunScore}, blockers=${jobCheckResult.blockerCount}, warnings=${jobCheckResult.warningCount}, blocked=${jobCheckResult.blocked}`}
          </p>
          {jobCheckResult.parseDiagnosticsSummary && (
            <p
              data-testid="job-check-parse-diagnostics-summary"
              style={{ fontFamily: "Consolas, monospace", marginTop: -6 }}
            >
              {`${t.parseDiagnosticsSummaryLabel}: total=${jobCheckResult.parseDiagnosticsSummary.total}${
                jobCheckResult.parseDiagnosticsSummary.total > 0
                  ? ` | top=${jobCheckResult.parseDiagnosticsSummary.topCodes.join(",") || "n/a"}`
                  : ""
              }`}
            </p>
          )}
          {jobCheckResult.lintIssuesSummary && (
            <p
              data-testid="job-check-lint-summary-chip"
              style={{ fontFamily: "Consolas, monospace", marginTop: -6 }}
              title={t.jobCheckLintSummaryLabel}
            >
              {formatLintIssuesSummaryChip(
                jobCheckResult.lintIssuesSummary as LintIssuesSummaryLike
              )}
            </p>
          )}
          {jobCheckResult.lintIssuesSummary &&
            jobCheckResult.lintIssuesSummary.total > 0 && (
              <details
                data-testid="job-check-lint-summary-drilldown"
                style={{ marginTop: 4, fontFamily: "Consolas, monospace" }}
              >
                <summary style={{ cursor: "pointer" }}>
                  {t.jobCheckLintSummaryDetailsLabel}
                </summary>
                <ul style={{ marginTop: 4, marginBottom: 4, paddingLeft: 18 }}>
                  {summarizeLintIssuesBySource(
                    jobCheckResult.lintIssuesSummary as LintIssuesSummaryLike
                  ).map(([source, count]) => {
                    const issuesForSource = jobCheckResult.lintIssues.filter(
                      (issue) => issue.provenance.source === source
                    );
                    const blockers = issuesForSource.filter(
                      (issue) => issue.severity === "error"
                    ).length;
                    const warnings = issuesForSource.length - blockers;
                    const sourceLabel = t.lintIssuesGroupSourceLabels[source];
                    return (
                      <li
                        key={source}
                        data-testid={`job-check-lint-summary-source-${source}`}
                      >
                        {`${source}: ${count} (blocker:${blockers}, warning:${warnings}) — ${sourceLabel}`}
                      </li>
                    );
                  })}
                </ul>
              </details>
            )}
          <div
            data-testid="strict-controller-gate-watch"
            style={{ marginTop: 8, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}
          >
            <span style={{ opacity: 0.85, marginRight: 4 }}>
              {`${t.strictGateWatchLabel}:`}
            </span>
            {STRICT_CONTROLLER_GATE_WATCH_PRESETS.map((pattern) => {
              const isActive = strictGateWatchPatterns.includes(pattern);
              return (
                <button
                  key={pattern}
                  type="button"
                  data-testid={`strict-gate-pattern-${pattern}`}
                  aria-pressed={isActive}
                  onClick={() =>
                    setStrictGateWatchPatterns((prev) =>
                      prev.includes(pattern)
                        ? prev.filter((p) => p !== pattern)
                        : [...prev, pattern]
                    )
                  }
                  style={
                    isActive
                      ? {
                          background: strictGateSummary.wouldBlock ? "#5a1b1b" : "#2c4f8a",
                          borderColor: strictGateSummary.wouldBlock ? "#e65b5b" : "#5b8de6",
                          color: "#fff",
                          fontWeight: 600
                        }
                      : undefined
                  }
                >
                  {strictControllerGatePatternLabel(pattern, {
                    nAndO: t.strictGatePatternNAndO,
                    duplicateO: t.strictGatePatternDuplicateO,
                    duplicateAddresses: t.strictGatePatternDuplicateAddresses
                  })}
                </button>
              );
            })}
            <span
              data-testid="strict-controller-gate-chip"
              style={{ opacity: 0.85, marginLeft: 4, fontFamily: "Consolas, monospace" }}
            >
              {formatStrictControllerGateChip(strictGateSummary)}
            </span>
            <button
              type="button"
              data-testid="strict-gate-copy-json"
              onClick={() => void handleCopyStrictControllerGateJson()}
            >
              {t.strictGateCopyJson}
            </button>
            <button
              type="button"
              data-testid="strict-gate-copy-csv"
              onClick={() => void handleCopyStrictControllerGateCsv()}
            >
              {t.strictGateCopyCsv}
            </button>
          </div>
          <div
            data-testid="deprecated-rules-audit-presets"
            style={{ marginTop: 8, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}
          >
            <span style={{ opacity: 0.85, marginRight: 4 }}>
              {`${t.deprecatedRulesAuditPresetsLabel}:`}
            </span>
            {DEPRECATED_RULES_AUDIT_POLICY_PRESETS.map((preset) => {
              const isActive = deprecatedRulesAuditPreset === preset;
              return (
                <button
                  key={preset}
                  type="button"
                  data-testid={`deprecated-rules-audit-preset-${preset}`}
                  aria-pressed={isActive}
                  onClick={() => setDeprecatedRulesAuditPreset(preset)}
                  style={
                    isActive
                      ? {
                          background: "#2c4f8a",
                          borderColor: "#5b8de6",
                          color: "#fff",
                          fontWeight: 600
                        }
                      : undefined
                  }
                >
                  {deprecatedRulesAuditPresetLabel(preset, {
                    informational: t.deprecatedRulesAuditPresetInformational,
                    sixMonthStrict: t.deprecatedRulesAuditPresetSixMonthStrict,
                    yearlyStrict: t.deprecatedRulesAuditPresetYearlyStrict
                  })}
                </button>
              );
            })}
            <span
              data-testid="deprecated-rules-audit-chip"
              style={{ opacity: 0.85, marginLeft: 4, fontFamily: "Consolas, monospace" }}
            >
              {formatDeprecatedRulesAuditChip(deprecatedRulesAuditSummary)}
            </span>
            <button
              type="button"
              data-testid="deprecated-rules-audit-copy-json"
              onClick={() => void handleCopyDeprecatedRulesAudit()}
            >
              {t.deprecatedRulesAuditCopyJson}
            </button>
            <button
              type="button"
              data-testid="deprecated-rules-audit-copy-csv"
              onClick={() => void handleCopyDeprecatedRulesAuditCsv()}
            >
              {t.deprecatedRulesAuditCopyCsv}
            </button>
            <button
              type="button"
              data-testid="deprecated-rules-audit-export-json"
              onClick={() => void handleExportDeprecatedRulesAudit("json")}
            >
              {t.deprecatedRulesAuditExportJson}
            </button>
            <button
              type="button"
              data-testid="deprecated-rules-audit-export-csv"
              onClick={() => void handleExportDeprecatedRulesAudit("csv")}
            >
              {t.deprecatedRulesAuditExportCsv}
            </button>
          </div>
          {(jobCheckResult.parseDiagnosticsPolicyBreaches ?? []).length > 0 && (
            <>
              <span
                data-testid="job-check-parse-diag-breach-summary"
                style={{
                  display: "inline-block",
                  marginTop: 4,
                  marginBottom: 4,
                  fontFamily: "Consolas, monospace",
                  opacity: 0.9
                }}
              >
                {parseDiagBreachSeveritiesSummary.chip}
              </span>
              <span
                data-testid="job-check-policy-breach-rollup-chip"
                style={{
                  display: "inline-block",
                  marginLeft: 8,
                  marginTop: 4,
                  marginBottom: 4,
                  fontFamily: "Consolas, monospace",
                  opacity: 0.9
                }}
              >
                {policyBreachRollupChip}
              </span>
              <ul
                data-testid="job-check-parse-diag-breach-list"
                style={{
                  marginTop: 4,
                  marginBottom: 4,
                  paddingLeft: 18,
                  fontFamily: "Consolas, monospace"
                }}
              >
                {(jobCheckResult.parseDiagnosticsPolicyBreaches ?? []).map((breach) => {
                  const summaryText = `${t.parseDiagnosticsBreachLabel}: ${breach.key}=${breach.observed} > ${breach.threshold} (${breach.severity})`;
                  return (
                    <li
                      key={`breach-${breach.key}`}
                      data-testid={`job-check-parse-diag-breach-${breach.key}`}
                      style={{ marginBottom: 4 }}
                    >
                      {operatorReviewMode ? (
                        <span
                          data-testid={`job-check-parse-diag-breach-readonly-${breach.key}`}
                        >
                          {summaryText}
                        </span>
                      ) : (
                        <>
                          {summaryText}
                          {breach.firstBlockIndex !== undefined && (
                            <button
                              type="button"
                              onClick={() => jumpToSimulationBlock(breach.firstBlockIndex ?? 0)}
                              data-testid={`job-check-parse-diag-breach-jump-${breach.key}`}
                              style={{ marginLeft: 8 }}
                            >
                              {`${t.parseDiagnosticsBreachJumpLabel} ${breach.key}`}
                            </button>
                          )}
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
              {!operatorReviewMode && (
                <>
                  <button
                    type="button"
                    onClick={() => void handleCopyParseDiagnosticsBreachContext()}
                    data-testid="job-check-parse-diag-breach-copy"
                    style={{ marginBottom: 8 }}
                  >
                    {t.parseDiagnosticsBreachCopy}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleCopyPolicyBreachJson()}
                    data-testid="job-check-policy-breach-copy-json"
                    style={{ marginLeft: 8, marginBottom: 8 }}
                  >
                    {t.policyBreachCopyJson}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleCopyPolicyBreachCsv()}
                    data-testid="job-check-policy-breach-copy-csv"
                    style={{ marginLeft: 8, marginBottom: 8 }}
                  >
                    {t.policyBreachCopyCsv}
                  </button>
                </>
              )}
            </>
          )}
          <div
            data-testid="job-check-safety-findings"
            style={{ marginTop: 8, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}
          >
            <span style={{ opacity: 0.85, marginRight: 4 }}>{`${t.safetyFindingsChipLabel}:`}</span>
            <span
              data-testid="job-check-safety-findings-chip"
              style={{ fontFamily: "Consolas, monospace", opacity: 0.9 }}
            >
              {safetyFindingsChip}
            </span>
            <button
              type="button"
              data-testid="job-check-safety-findings-copy-json"
              onClick={() => void handleCopySafetyFindingsJson()}
            >
              {t.safetyFindingsCopyJson}
            </button>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={jumpToBlockers}>{t.jumpToBlockers}</button>
            <button onClick={openExportFolderFromResult} disabled={!jobCheckResult.exportResult}>
              {t.openExportFolder}
            </button>
          </div>
        </section>
      )}

      <section>
        <h2>{t.programInput}</h2>
        <textarea
          ref={codeTextareaRef}
          value={code}
          onChange={(event) => setCode(event.target.value)}
          rows={12}
          style={{ width: "100%", fontFamily: "Consolas, monospace" }}
        />
      </section>

      <section>
        <h2>{t.formattedOutput}</h2>
        <label style={{ display: "block", marginBottom: 8 }}>
          <input
            type="checkbox"
            checked={removeStandaloneOptionalStops}
            onChange={(event) => setRemoveStandaloneOptionalStops(event.target.checked)}
          />{" "}
          {t.removeStandaloneOptionalStops}
        </label>
        <pre>{formatted}</pre>
      </section>

      <section>
        <h2>{t.parameterSuggestions}</h2>
        <label style={{ display: "block", marginBottom: 8 }}>
          {t.parameterPreset}:{" "}
          <select
            value={parameterPresetId}
            onChange={(event) => {
              const nextId = event.target.value;
              setParameterPresetId(nextId);
              const preset = parameterPresets.find((p) => p.id === nextId);
              if (preset) {
                setParameterBlacklistInput(preset.blacklistedParameters.join(","));
              }
            }}
          >
            {parameterPresets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "block", marginBottom: 8 }}>
          {t.parameterBlacklist}:{" "}
          <input
            value={parameterBlacklistInput}
            onChange={(event) => setParameterBlacklistInput(event.target.value)}
            style={{ width: "100%", fontFamily: "Consolas, monospace" }}
          />
        </label>
        <pre>{JSON.stringify(parameterSuggestions, null, 2)}</pre>
      </section>

      {!operatorReviewMode && (
        <section>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <h2 style={{ margin: 0 }}>{t.lintIssues}</h2>
            <span
              data-testid="lint-issues-summary-chip"
              style={{
                fontFamily: "Consolas, monospace",
                fontSize: 12,
                padding: "2px 8px",
                borderRadius: 999,
                border: "1px solid #2e2e2e",
                background: lintIssuesSummaryChip.total > 0 ? "#27361a" : "#1e1e1e"
              }}
            >
              {lintIssuesSummaryChip.text}
            </span>
            <span
              data-testid="parse-diagnostics-summary-chip"
              style={{
                fontFamily: "Consolas, monospace",
                fontSize: 12,
                padding: "2px 8px",
                borderRadius: 999,
                border: "1px solid #2e2e2e",
                background: parseDiagnosticsSummaryChip.total > 0 ? "#3b2a17" : "#1e1e1e"
              }}
            >
              {parseDiagnosticsSummaryChip.text}
            </span>
            <button
              type="button"
              onClick={handleLoadLintDemo}
              data-testid="lint-issues-load-demo"
            >
              {t.lintIssuesLoadDemo}
            </button>
            <label
              style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12 }}
            >
              {t.lintDemoControllerLabel}
              <select
                value={lintDemoControllerOverride}
                onChange={(event) =>
                  setLintDemoControllerOverride(
                    event.target.value as "auto" | ControllerProfileKey
                  )
                }
                data-testid="lint-demo-controller-override"
              >
                <option value="auto">{t.lintDemoControllerAuto}</option>
                <option value="haas-ngc">haas-ngc</option>
                <option value="haas-legacy">haas-legacy</option>
                <option value="fanuc">fanuc</option>
              </select>
            </label>
            <button
              type="button"
              onClick={handleLoadDiagnosticsDemo}
              data-testid="parse-diagnostics-load-demo"
            >
              {t.parseDiagnosticsLoadDemo}
            </button>
          </div>
          {lintIssues.length === 0 ? (
            <pre data-testid="lint-issues-empty">{t.lintIssuesEmpty}</pre>
          ) : (
            <div style={{ display: "grid", gap: 8, marginTop: 8 }} data-testid="lint-issues-list">
              {lintIssuesBySource.map(([source, items]) => {
                const sourceLabel = t.lintIssuesGroupSourceLabels[source];
                return (
                  <details
                    key={source}
                    style={{ border: "1px solid #2e2e2e", borderRadius: 6, padding: 8 }}
                    data-testid={`lint-issues-group-${source}`}
                  >
                    <summary
                      style={{
                        cursor: "pointer",
                        fontFamily: "Consolas, monospace",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 8
                      }}
                    >
                      <span>
                        <strong>{sourceLabel}</strong>
                        {` (${source}) (${items.length})`}
                      </span>
                      <button
                        onClick={(event) => {
                          event.preventDefault();
                          void handleCopyAllLintFixesForSource(source, items);
                        }}
                        data-testid={`lint-issues-copy-all-${source}`}
                      >
                        {t.lintCopyAllFixesInGroup}
                      </button>
                    </summary>
                    <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                      {items.map((issue, index) => (
                        <div
                          key={`${source}-${issue.blockIndex}-${index}`}
                          style={{
                            border: "1px solid #2e2e2e",
                            borderRadius: 6,
                            padding: 8,
                            background: "#121212"
                          }}
                          data-testid={`lint-issues-item-${source}-${index}`}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              gap: 8,
                              alignItems: "center",
                              marginBottom: 4
                            }}
                          >
                            <div style={{ fontFamily: "Consolas, monospace" }}>
                              {`${t.parseDiagnosticsBlockLabel} ${issue.blockIndex} | ${issue.severity}`}
                            </div>
                            <button
                              onClick={() => jumpToSimulationBlock(issue.blockIndex)}
                              data-testid={`lint-issues-jump-${source}-${index}`}
                            >
                              {`Jump to B${issue.blockIndex}`}
                            </button>
                          </div>
                          <div style={{ marginBottom: 4 }}>{issue.message}</div>
                          {issue.suggestedFixes && issue.suggestedFixes.length > 0 && (
                            <div>
                              <strong>{`${t.suggestedFixesLabel}:`}</strong>
                              <ul style={{ marginTop: 4, marginBottom: 0 }}>
                                {issue.suggestedFixes.map((fix, fixIdx) => {
                                  const fixLine = buildLintFixLine({
                                    source,
                                    blockIndex: issue.blockIndex,
                                    fix
                                  });
                                  return (
                                    <li key={`${fix.title}-${fixIdx}`} style={{ marginBottom: 6 }}>
                                      <div>
                                        {fix.replacement ? `${fix.title} -> ${fix.replacement}` : fix.title}
                                      </div>
                                      <button
                                        onClick={() =>
                                          void handleCopyLintFix({
                                            line: fixLine,
                                            source,
                                            blockIndex: issue.blockIndex
                                          })
                                        }
                                        style={{ marginTop: 4 }}
                                        data-testid={`lint-issues-copy-fix-${source}-${index}-${fixIdx}`}
                                      >
                                        {t.lintCopyFixText}
                                      </button>
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </details>
                );
              })}
            </div>
          )}
          <h3 style={{ marginTop: 12 }} data-testid="parse-diagnostics-heading">{t.parseDiagnostics}</h3>
          {parseDiagnostics.length === 0 ? (
            <pre data-testid="parse-diagnostics-empty">{t.parseDiagnosticsEmpty}</pre>
          ) : (
            <div style={{ display: "grid", gap: 8 }} data-testid="parse-diagnostics-list">
              {parseDiagnosticsByCode.map(([code, items]) => {
                const expanded = parseDiagnosticsExpandedCodes.has(code);
                const view = applyDiagnosticsCap(items, {
                  cap: DEFAULT_PARSE_DIAGNOSTICS_GROUP_CAP,
                  expanded
                });
                return (
                  <details
                    key={code}
                    style={{ border: "1px solid #2e2e2e", borderRadius: 6, padding: 8 }}
                    data-testid={`parse-diagnostics-group-${code}`}
                  >
                    <summary
                      style={{
                        cursor: "pointer",
                        fontFamily: "Consolas, monospace",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 8
                      }}
                    >
                      <span>
                        <strong>{code}</strong>
                        {` (${items.length})`}
                      </span>
                      <button
                        onClick={(event) => {
                          event.preventDefault();
                          void handleCopyAllParseFixesForCode(code, items);
                        }}
                        data-testid={`parse-diagnostics-copy-all-${code}`}
                      >
                        {t.copyAllFixesInGroup}
                      </button>
                    </summary>
                    <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                      {view.visible.map((diag, index) => (
                        <div
                          key={`${diag.code}-${diag.blockIndex}-${index}`}
                          style={{
                            border: "1px solid #2e2e2e",
                            borderRadius: 6,
                            padding: 8,
                            background: "#121212"
                          }}
                          data-testid={`parse-diagnostics-item-${code}-${index}`}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              gap: 8,
                              alignItems: "center",
                              marginBottom: 4
                            }}
                          >
                            <div style={{ fontFamily: "Consolas, monospace" }}>
                              {`${t.parseDiagnosticsBlockLabel} ${diag.blockIndex} | ${diag.severity}`}
                            </div>
                            <button
                              onClick={() => jumpToSimulationBlock(diag.blockIndex)}
                              data-testid={`parse-diagnostics-jump-${code}-${index}`}
                            >
                              {`Jump to B${diag.blockIndex}`}
                            </button>
                          </div>
                          <div style={{ marginBottom: 4 }}>{diag.message}</div>
                          {diag.suggestedFixes && diag.suggestedFixes.length > 0 && (
                            <div>
                              <strong>{`${t.suggestedFixesLabel}:`}</strong>
                              <ul style={{ marginTop: 4, marginBottom: 0 }}>
                                {diag.suggestedFixes.map((fix, fixIdx) => {
                                  const fixLine = buildParseFixLine({
                                    code: diag.code,
                                    blockIndex: diag.blockIndex,
                                    fix
                                  });
                                  return (
                                    <li key={`${fix.title}-${fixIdx}`} style={{ marginBottom: 6 }}>
                                      <div>{fix.replacement ? `${fix.title} -> ${fix.replacement}` : fix.title}</div>
                                      <button
                                        onClick={() =>
                                          void handleCopyParseFix({
                                            line: fixLine,
                                            code: diag.code,
                                            blockIndex: diag.blockIndex
                                          })
                                        }
                                        style={{ marginTop: 4 }}
                                        data-testid={`parse-diagnostics-copy-fix-${code}-${index}-${fixIdx}`}
                                      >
                                        {t.copyFixText}
                                      </button>
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          )}
                        </div>
                      ))}
                      {view.truncated && (
                        <div
                          style={{ display: "flex", gap: 8, alignItems: "center" }}
                          data-testid={`parse-diagnostics-cap-${code}`}
                        >
                          <em>{`${view.hiddenCount} ${t.parseDiagnosticsHiddenSuffix}`}</em>
                          <button
                            onClick={() => handleParseDiagnosticsExpandToggle(code, items)}
                            data-testid={`parse-diagnostics-show-all-${code}`}
                          >
                            {t.parseDiagnosticsShowMore}
                          </button>
                          <span style={{ fontStyle: "italic" }}>{t.parseDiagnosticsCapNote}</span>
                        </div>
                      )}
                    </div>
                  </details>
                );
              })}
            </div>
          )}
        </section>
      )}

      <section>
        <h2>{t.simulation}</h2>
        <label style={{ display: "block", marginBottom: 8 }}>
          {t.subprogramTargetPolicy}:{" "}
          <select
            value={subprogramTargetPolicy}
            onChange={(event) => {
              setSubprogramTargetPolicy(event.target.value as SubprogramTargetPolicy);
              setSubprogramPolicyManuallySet(true);
            }}
          >
            <option value="shop_friendly">{t.shopFriendlyPolicy}</option>
            <option value="strict_controller">{t.strictControllerPolicy}</option>
          </select>
        </label>
        <label style={{ display: "block", marginBottom: 8 }}>
          {t.logSemantics}:{" "}
          <select
            value={logSemantics}
            onChange={(event) => {
              setLogSemantics(event.target.value as LogSemantics);
              setLogSemanticsManuallySet(true);
            }}
          >
            <option value="controller_default">{t.logSemanticsControllerDefault}</option>
            <option value="natural">{t.logSemanticsNatural}</option>
            <option value="base10">{t.logSemanticsBase10}</option>
          </select>
        </label>
        <pre>
          {JSON.stringify(
            {
              estimatedCycleTimeSeconds: simulation.estimatedCycleTimeSeconds,
              state: simulation.state,
              warnings: simulation.warnings
            },
            null,
            2
          )}
        </pre>
        {!operatorReviewMode && (
          <>
            <h3>{t.simulationTimeline}</h3>
            <div style={{ marginBottom: 8 }}>
              <strong>{`${t.timelineFilters}: `}</strong>
              <label style={{ marginLeft: 8 }}>
                <input
                  type="checkbox"
                  checked={timelineFilters.alarms}
                  onChange={(event) => setTimelineFilters((prev) => ({ ...prev, alarms: event.target.checked }))}
                />{" "}
                {t.filterAlarms}
              </label>
              <label style={{ marginLeft: 8 }}>
                <input
                  type="checkbox"
                  checked={timelineFilters.flow}
                  onChange={(event) => setTimelineFilters((prev) => ({ ...prev, flow: event.target.checked }))}
                />{" "}
                {t.filterFlow}
              </label>
              <label style={{ marginLeft: 8 }}>
                <input
                  type="checkbox"
                  checked={timelineFilters.control}
                  onChange={(event) => setTimelineFilters((prev) => ({ ...prev, control: event.target.checked }))}
                />{" "}
                {t.filterControl}
              </label>
            </div>
            {filteredSimulationEvents.length > 0 ? (
              <div style={{ display: "grid", gap: 6, marginBottom: 8 }}>
                {filteredSimulationEvents.map((event, idx) => (
                  <button
                    key={`${event.kind}-${event.blockIndex}-${idx}`}
                    onClick={() => jumpToSimulationBlock(event.blockIndex)}
                    style={{
                      textAlign: "left",
                      fontFamily: "Consolas, monospace",
                      borderLeft: `6px solid ${eventColor(event.kind)}`
                    }}
                  >
                    {`B${event.blockIndex}: [${event.kind}] ${event.message}`}
                  </button>
                ))}
              </div>
            ) : (
              <pre>{t.noSimulationEvents}</pre>
            )}
          </>
        )}
      </section>

      <section>
        <h2>{t.setterReport}</h2>
        <label style={{ display: "block", marginBottom: 8 }}>
          {t.dCallStyle}:{" "}
          <select
            value={dOffsetCallStyle}
            onChange={(event) => {
              setDOffsetCallStyle(
                event.target.value as "haas_g43_d_with_h_only" | "fanuc_wear_on_g41_g42_with_g40_d00"
              );
              setDPolicyManuallySet(true);
            }}
          >
            <option value="haas_g43_d_with_h_only">{t.strictD}</option>
            <option value="fanuc_wear_on_g41_g42_with_g40_d00">{t.allowCompD}</option>
          </select>
        </label>
        {report.tools.map((tool) => (
          <label key={tool.toolNumber} style={{ display: "block", marginBottom: 8 }}>
            {`T${tool.toolNumber} comment:`}{" "}
            <select
              value={toolCommentSelections[tool.toolNumber] ?? ""}
              onChange={(event) =>
                setToolCommentSelections((prev) => ({
                  ...prev,
                  [tool.toolNumber]: event.target.value
                }))
              }
            >
              <option value="">(none)</option>
              {tool.toolCommentCandidates.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        ))}
        <pre>{report.printable80mm}</pre>
      </section>

      <section>
        <h2>{t.workshopAdvisor}</h2>
        <p>
          <strong>{t.readyToRun}:</strong> {advisor.readyToRunScore}/100
        </p>
        <h3>{t.checklist}</h3>
        <pre>{advisor.checklist.map((line) => `- ${line}`).join("\n")}</pre>
        <h3>{t.safetyFindings}</h3>
        <div id="job-check-blockers" />
        <label style={{ display: "block", marginBottom: 8 }}>
          <input
            type="checkbox"
            checked={showOnlyBlockers}
            onChange={(event) => setShowOnlyBlockers(event.target.checked)}
          />{" "}
          {t.showOnlyBlockers}
        </label>
        <h4>{`${t.blockers} (${combinedBlockerFindings.length})`}</h4>
        {combinedBlockerFindings.length > 0 ? (
          combinedBlockerFindings.map((f, idx) => (
            <div
              key={`${f.code}-${idx}`}
              style={{
                marginBottom: 8,
                padding: 8,
                borderRadius: 6,
                background: "#5a1b1b",
                color: "#fff"
              }}
            >
              <div style={{ display: "inline-block", padding: "2px 8px", borderRadius: 12, background: "#a10000" }}>
                {f.code}
              </div>
              <div
                style={{
                  display: "inline-block",
                  marginLeft: 8,
                  padding: "2px 8px",
                  borderRadius: 12,
                  background: findingSeverityColor(f.severity)
                }}
              >
                {f.severity.toUpperCase()}
              </div>
              <div>{f.message}</div>
              {f.blockIndex !== undefined && (
                <button onClick={() => jumpToSimulationBlock(f.blockIndex ?? 0)}>{`Jump to B${f.blockIndex}`}</button>
              )}
              <div>
                <strong>{`${t.suggestedFix}: `}</strong>
                {suggestedFixForFinding(f.code, language)}
              </div>
            </div>
          ))
        ) : (
          <pre>- none</pre>
        )}
        {!showOnlyBlockers && (
          <>
            <h4>{`${t.warningsOnly} (${combinedWarningFindings.length})`}</h4>
            {combinedWarningFindings.length > 0 ? (
              combinedWarningFindings.map((f, idx) => (
                <div
                  key={`${f.code}-${idx}`}
                  style={{
                    marginBottom: 8,
                    padding: 8,
                    borderRadius: 6,
                    background: "#5a4a1b",
                    color: "#fff"
                  }}
                >
                  <div style={{ display: "inline-block", padding: "2px 8px", borderRadius: 12, background: "#a17200" }}>
                    {f.code}
                  </div>
                  <div
                    style={{
                      display: "inline-block",
                      marginLeft: 8,
                      padding: "2px 8px",
                      borderRadius: 12,
                      background: findingSeverityColor(f.severity)
                    }}
                  >
                    {f.severity.toUpperCase()}
                  </div>
                  <div>{f.message}</div>
                  {f.blockIndex !== undefined && (
                    <button onClick={() => jumpToSimulationBlock(f.blockIndex ?? 0)}>{`Jump to B${f.blockIndex}`}</button>
                  )}
                  <div>
                    <strong>{`${t.suggestedFix}: `}</strong>
                    {suggestedFixForFinding(f.code, language)}
                  </div>
                </div>
              ))
            ) : (
              <pre>- none</pre>
            )}
          </>
        )}
        {!operatorReviewMode && <pre>{JSON.stringify(advisor.safetyFindings, null, 2)}</pre>}
        <h3>{t.firstCutRiskBrief}</h3>
        <pre>
          {firstCutRiskBriefItems.length > 0
            ? firstCutRiskBriefItems
                .map(
                  (item, idx) =>
                    `- #${idx + 1} ${item.code}${item.blockIndex !== undefined ? ` @B${item.blockIndex}` : ""}\n  reason: ${item.reason}\n  action: ${item.operatorAction}`
                )
                .join("\n")
            : "- none"}
        </pre>
        <h3>{t.criticalEvents}</h3>
        <pre>
          {operatorReviewMode
            ? advisor.criticalEvents.map((e) => `- B${e.blockIndex}: ${e.description}`).join("\n")
            : JSON.stringify(advisor.criticalEvents, null, 2)}
        </pre>
        <h3>{t.setupOptimization}</h3>
        <pre>
          {operatorReviewMode
            ? advisor.setupOptimizations.map((o) => `- ${o.message}`).join("\n") || "- none"
            : JSON.stringify(advisor.setupOptimizations, null, 2)}
        </pre>
        <h3>{t.optionalStops}</h3>
        <pre>
          {operatorReviewMode
            ? advisor.optionalStopSuggestions.map((o) => `- B${o.blockIndex}: ${o.reason}`).join("\n") || "- none"
            : JSON.stringify(advisor.optionalStopSuggestions, null, 2)}
        </pre>
        <h3>{t.frontMatter}</h3>
        <pre>{advisor.parameterFrontMatter}</pre>
        <h3>{t.operatorView}</h3>
        <pre>{advisor.operatorViewProgram}</pre>
        {!operatorReviewMode && (
          <>
            <h3>{t.templates}</h3>
            <pre>{JSON.stringify(templates, null, 2)}</pre>
            <textarea
              data-testid="template-json"
              value={templateJson}
              onChange={(event) => setTemplateJson(event.target.value)}
              rows={10}
              style={{ width: "100%", fontFamily: "Consolas, monospace" }}
            />
            <button
              data-testid="save-parameter-prefs"
              onClick={handleSaveParameterPrefsToTemplateJson}
            >
              {t.saveParamPrefs}
            </button>
            <button
              data-testid="reset-ui-prefs"
              onClick={handleResetUiPrefsForController}
              style={{ marginLeft: 8 }}
            >
              {t.resetUiPrefs}
            </button>
          </>
        )}
        <h3>{t.setupSheet}</h3>
        <pre>{setupSheetWithPolicyContext.printable80mm}</pre>
        <pre>{setupSheetWithPolicyContext.exportTxt}</pre>
        <pre>{setupSheetWithPolicyContext.exportMarkdown}</pre>
        <h3>{t.proveout}</h3>
        <pre>{proveout.code}</pre>
        <pre>{proveoutApplied.code}</pre>
        <pre>{proveoutRemoved.code}</pre>
        <h3>{t.exportNow}</h3>
        <label style={{ display: "block", marginBottom: 8 }}>
          {t.exportFolder}:{" "}
          <input value={exportFolder} onChange={(event) => setExportFolder(event.target.value)} />
        </label>
        <label style={{ display: "block", marginBottom: 8 }}>
          {t.exportBaseName}:{" "}
          <input value={exportBaseName} onChange={(event) => setExportBaseName(event.target.value)} />
        </label>
        <label style={{ display: "block", marginBottom: 8 }}>
          <input
            type="checkbox"
            checked={includeTimelineFindingsExport}
            onChange={(event) => setIncludeTimelineFindingsExport(event.target.checked)}
          />{" "}
          {t.includeTimelineFindingsExport}
        </label>
        <button
          onClick={() => void handleExport()}
          disabled={nodeOnlyDisabled}
          title={nodeOnlyDisabled ? nodeOnlyDisabledReason : undefined}
        >
          {t.exportNow}
        </button>
        {lastExportContext ? (
          <div
            style={{
              marginTop: 8,
              marginBottom: 8,
              padding: 8,
              borderRadius: 6,
              border: "1px solid #2e5b8a",
              background: "#eaf4ff",
              color: "#10395c"
            }}
          >
            <strong>Export policy context</strong>
            <div>{`dir=${lastExportContext.directory}`}</div>
            <div>{`artifacts=${lastExportContext.artifactCount}`}</div>
            <div>{`preset=${lastExportContext.preset}`}</div>
            <div>{`source=${lastExportContext.source}`}</div>
            <div>{`controller=${lastExportContext.controller}`}</div>
          </div>
        ) : null}
        <label style={{ display: "block", marginTop: 8 }}>
          <input
            type="checkbox"
            checked={allowExportWithBlockers}
            onChange={(event) => setAllowExportWithBlockers(event.target.checked)}
          />{" "}
          {t.allowExportWithBlockers}
        </label>
        <label style={{ display: "block", marginTop: 8 }}>
          {t.policyPreset}:{" "}
          <select
            value={jobCheckPolicyPreset}
            disabled={policyLockManualChanges}
            onChange={(event) => {
              const preset = event.target.value as JobCheckPolicyPreset;
              setJobCheckPolicyPreset(preset);
              setPolicyPresetManuallySet(true);
              recordPolicyPresetTransition("manual_selection_changed", {
                controller: detectedControllerProfile,
                preset,
                source: "manual"
              });
            }}
          >
            <option value="strict">{t.policyPresetStrict}</option>
            <option value="balanced">{t.policyPresetBalanced}</option>
            <option value="permissive">{t.policyPresetPermissive}</option>
          </select>
          <button
            onClick={() => {
              const preset = defaultPolicyPresetForController(detectedControllerProfile);
              setJobCheckPolicyPreset(preset);
              setPolicyPresetManuallySet(false);
              recordPolicyPresetTransition("reverted_to_controller_default", {
                controller: detectedControllerProfile,
                preset,
                source: "bootstrap"
              });
            }}
            disabled={policyLockManualChanges}
            style={{ marginLeft: 8 }}
          >
            {t.revertPolicyPresetToControllerDefault}
          </button>
        </label>
        <p style={{ marginTop: 4, marginBottom: 8, opacity: 0.8 }}>{t.policyPresetHelp}</p>
        <details style={{ marginTop: 4, marginBottom: 8 }}>
          <summary style={{ cursor: "pointer", fontWeight: 600 }}>{t.policyQuickReference}</summary>
          <ul style={{ marginTop: 6 }}>
            <li>{t.policyQuickReferencePresets}</li>
            <li>{t.policyQuickReferenceSources}</li>
            <li>{t.policyQuickReferenceShortcuts}</li>
            <li>{t.policyQuickReferenceActions}</li>
          </ul>
        </details>
        <details style={{ marginTop: 4, marginBottom: 8 }}>
          <summary style={{ cursor: "pointer", fontWeight: 600 }}>
            {t.policyAuditTrail}
            <span
              data-testid="policy-audit-trail-count-chip"
              style={{
                marginLeft: 8,
                padding: "1px 6px",
                borderRadius: 8,
                background: "#27313f",
                fontSize: "0.85em",
                fontWeight: 500
              }}
            >
              {`${t.auditTrailCountChip(policyAuditTrailSummary.total)} (${t.auditTrailHydratedChip(policyAuditTrailSummary.hydrated)})`}
            </span>
          </summary>
          {policyAuditTrail.length === 0 ? (
            <p style={{ marginTop: 6, opacity: 0.8 }}>{t.policyAuditTrailEmpty}</p>
          ) : (
            <>
              <div style={{ marginTop: 6, marginBottom: 6, display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                <label
                  style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12 }}
                >
                  <span>{t.auditTrailExportFormatLabel}</span>
                  <select
                    data-testid="policy-audit-trail-export-format"
                    value={auditTrailExportFormat}
                    onChange={(event) => {
                      const next = event.target.value;
                      if (isAuditTrailExportFormat(next)) {
                        setAuditTrailExportFormat(next);
                      }
                    }}
                  >
                    <option value="text">{t.auditTrailExportFormatText}</option>
                    <option value="markdown">{t.auditTrailExportFormatMarkdown}</option>
                    <option value="csv">{t.auditTrailExportFormatCsv}</option>
                    <option value="ndjson">{t.auditTrailExportFormatNdjson}</option>
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => void handleCopyPolicyAuditTrail()}
                  data-testid="policy-audit-trail-copy"
                >
                  {t.copyPolicyAuditTrail}
                </button>
                <button
                  type="button"
                  onClick={() => void handleCopyPolicyAuditTrailParseOnly()}
                  data-testid="policy-audit-trail-copy-parse-only"
                >
                  {t.copyPolicyAuditTrailParseOnly}
                </button>
                <button
                  type="button"
                  onClick={() => void handleDownloadPolicyAuditTrail()}
                  data-testid="policy-audit-trail-download"
                >
                  {t.auditTrailDownloadButtonLabel}
                </button>
                <label>
                  <input
                    type="checkbox"
                    data-testid="policy-audit-trail-download-with-sidecar"
                    checked={auditTrailDownloadWithSidecar}
                    onChange={(event) =>
                      setAuditTrailDownloadWithSidecar(event.target.checked)
                    }
                  />
                  {t.auditTrailDownloadSidecarLabel}
                </label>
                <label>
                  <input
                    type="checkbox"
                    data-testid="policy-audit-trail-download-with-hmac"
                    checked={auditTrailDownloadWithHmacSidecar}
                    onChange={(event) =>
                      setAuditTrailDownloadWithHmacSidecar(event.target.checked)
                    }
                  />
                  {t.auditTrailDownloadHmacLabel}
                </label>
                <label>
                  {t.auditTrailHmacSecretLabel}
                  <input
                    type="password"
                    data-testid="policy-audit-trail-hmac-secret"
                    value={auditTrailHmacSecret}
                    onChange={(event) => setAuditTrailHmacSecret(event.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                    style={{ marginLeft: 4 }}
                  />
                </label>
                <label>
                  <input
                    type="checkbox"
                    data-testid="policy-audit-trail-download-with-encryption"
                    checked={auditTrailDownloadWithEncryption}
                    onChange={(event) =>
                      setAuditTrailDownloadWithEncryption(event.target.checked)
                    }
                  />
                  {t.auditTrailDownloadEncryptionLabel}
                </label>
                <label>
                  {t.auditTrailEncryptionSecretLabel}
                  <input
                    type="password"
                    data-testid="policy-audit-trail-encryption-secret"
                    value={auditTrailEncryptionSecret}
                    onChange={(event) =>
                      setAuditTrailEncryptionSecret(event.target.value)
                    }
                    autoComplete="off"
                    spellCheck={false}
                    style={{ marginLeft: 4 }}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => handleClearAuditTrail()}
                  data-testid="policy-audit-trail-clear"
                >
                  {t.clearAuditTrail}
                </button>
              </div>
              <div
                data-testid="policy-audit-trail-filter"
                style={{ marginBottom: 6, display: "flex", flexWrap: "wrap", gap: 6 }}
              >
                {(
                  [
                    { id: "all", label: t.auditTrailFilterAll },
                    { id: "parse_lint", label: t.auditTrailFilterParseLint },
                    { id: "reset", label: t.auditTrailFilterReset },
                    { id: "policy", label: t.auditTrailFilterPolicy }
                  ] as Array<{ id: PolicyAuditTrailCategory; label: string }>
                ).map((chip) => {
                  const isActive = auditTrailFilterCategory === chip.id;
                  return (
                    <button
                      key={chip.id}
                      type="button"
                      data-testid={`policy-audit-trail-filter-${chip.id}`}
                      aria-pressed={isActive}
                      onClick={() => setAuditTrailFilterCategory(chip.id)}
                      style={
                        isActive
                          ? {
                              background: "#2c4f8a",
                              borderColor: "#5b8de6",
                              color: "#fff",
                              fontWeight: 600
                            }
                          : undefined
                      }
                    >
                      {chip.label}
                    </button>
                  );
                })}
              </div>
              <ul style={{ marginTop: 6 }}>
                {filteredPolicyAuditTrail.map((entry, idx) => {
                  const extras: string[] = [];
                  if (entry.code !== undefined) extras.push(`code=${entry.code}`);
                  if (entry.blockIndex !== undefined) extras.push(`block=${entry.blockIndex}`);
                  if (entry.fixCount !== undefined) extras.push(`fix=${entry.fixCount}`);
                  if (entry.count !== undefined) extras.push(`count=${entry.count}`);
                  if (entry.severities !== undefined) extras.push(`severities=${entry.severities}`);
                  const extrasSuffix = extras.length > 0 ? ` | ${extras.join(" ")}` : "";
                  return (
                    <li
                      key={`${entry.timestampIso}-${idx}`}
                      data-testid={
                        entry.hydratedFromTemplate
                          ? "policy-audit-trail-entry-hydrated"
                          : undefined
                      }
                    >
                      {`${entry.timestampIso} | ${entry.event} | ${entry.preset}/${entry.source} | ${entry.controller}${extrasSuffix}`}
                      {entry.hydratedFromTemplate ? (
                        <span style={{ marginLeft: 6, opacity: 0.6 }}>{"(hydrated)"}</span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </details>
        <p style={{ marginTop: 4, marginBottom: 8, opacity: 0.8 }}>
          {`${t.policyPresetSourceLabel}: `}
          <span style={policyPresetSourceBadgeStyle}>{policyPresetSourceLabel}</span>
          <button onClick={() => void handleCopyPolicyContext()} style={{ marginLeft: 8 }}>
            {t.copyPolicyContext}
          </button>
          <button onClick={() => void handleCopyFullExportContext()} style={{ marginLeft: 8 }}>
            {t.copyFullExportContext}
          </button>
          {policyPresetVisualState.showHelpTooltipIcon ? (
            <span
              title={t.policyPresetSourceHelpTooltip}
              style={{ marginLeft: 6, cursor: "help", opacity: 0.9 }}
              aria-label={t.policyPresetSourceHelpTooltip}
            >
              ⓘ
            </span>
          ) : null}
        </p>
        <label style={{ display: "block", marginTop: 4, marginBottom: 8 }}>
          <input
            type="checkbox"
            checked={policyUiEventsEnabled}
            onChange={(event) => setPolicyUiEventsEnabled(event.target.checked)}
          />{" "}
          {t.policyUiEventsEnabled}
        </label>
        <label style={{ display: "block", marginTop: 4, marginBottom: 8 }}>
          <input
            type="checkbox"
            data-testid="policy-lock-manual-changes"
            checked={policyLockManualChanges}
            onChange={(event) => setPolicyLockManualChanges(event.target.checked)}
          />{" "}
          {t.policyLockManualChanges}
        </label>
        {policyDriftWarning ? (
          <p
            style={{
              marginTop: 4,
              marginBottom: 8,
              padding: "4px 8px",
              borderRadius: 6,
              background: "#fff4cc",
              border: "1px solid #d9b76a",
              color: "#5f4b00"
            }}
          >
            {policyDriftWarning}
          </p>
        ) : null}
        {policyPresetHintState.isPersistedActive ? (
          <p style={{ marginTop: 4, marginBottom: 8, opacity: 0.85 }}>
            {`${t.policyPresetPersistedHint}: ${persistedPolicyPresetLabel}`}
          </p>
        ) : null}
        {policyPresetHintState.hasUnsavedOverride ? (
          <div style={{ marginTop: 4, marginBottom: 8, opacity: 0.85 }}>
            <span>{`${t.policyPresetUnsavedOverrideHint}: ${currentPolicyPresetLabel}`}</span>
            <button onClick={handleSaveParameterPrefsToTemplateJson} style={{ marginLeft: 8, opacity: 1 }}>
              {t.savePolicyPresetNow}
            </button>
            <button onClick={() => void handleSavePolicyPresetAndRunCheck()} style={{ marginLeft: 8, opacity: 1 }}>
              {t.savePolicyPresetAndRunCheck}
            </button>
          </div>
        ) : null}
        <div
          data-testid="parse-diagnostics-policy-presets"
          style={{ marginTop: 8, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}
        >
          <span style={{ opacity: 0.85, marginRight: 4 }}>{`${t.parseDiagnosticsPolicyPresetsLabel}:`}</span>
          {PARSE_DIAGNOSTICS_POLICY_PRESETS.map((preset) => {
            const isActive = currentMatchingParseDiagnosticsPolicyPreset === preset;
            return (
              <button
                key={preset}
                type="button"
                data-testid={`parse-diagnostics-policy-preset-${preset}`}
                aria-pressed={isActive}
                onClick={() => handleApplyParseDiagnosticsPolicyPreset(preset)}
                style={
                  isActive
                    ? {
                        background: "#2c4f8a",
                        borderColor: "#5b8de6",
                        color: "#fff",
                        fontWeight: 600
                      }
                    : undefined
                }
              >
                {preset === "strict"
                  ? t.parseDiagnosticsPolicyPresetStrict
                  : preset === "balanced"
                    ? t.parseDiagnosticsPolicyPresetBalanced
                    : t.parseDiagnosticsPolicyPresetPermissive}
              </button>
            );
          })}
          <span
            data-testid="parse-diagnostics-policy-preset-active"
            style={{ opacity: 0.85, marginLeft: 4 }}
          >
            {`${t.parseDiagnosticsPolicyActiveLabel}: ${
              currentMatchingParseDiagnosticsPolicyPreset === "custom"
                ? t.parseDiagnosticsPolicyActiveCustom
                : currentMatchingParseDiagnosticsPolicyPreset === "strict"
                  ? t.parseDiagnosticsPolicyPresetStrict
                  : currentMatchingParseDiagnosticsPolicyPreset === "balanced"
                    ? t.parseDiagnosticsPolicyPresetBalanced
                    : t.parseDiagnosticsPolicyPresetPermissive
            }`}
          </span>
        </div>
        <fieldset
          data-testid="parse-diagnostics-policy-row"
          style={{ marginTop: 8, marginBottom: 8, padding: 8, border: "1px solid #2e2e2e", borderRadius: 6 }}
        >
          <legend style={{ padding: "0 6px", fontWeight: 600 }}>{t.parseDiagnosticsPolicyHeading}</legend>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, marginRight: 12 }}>
            <input
              type="checkbox"
              data-testid="parse-diagnostics-policy-enabled"
              checked={parseDiagnosticsPolicy.enabled}
              onChange={(event) =>
                setParseDiagnosticsPolicy((prev) => ({ ...prev, enabled: event.target.checked }))
              }
            />
            {t.parseDiagnosticsPolicyEnabledLabel}
          </label>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, marginRight: 12 }}>
            {`${t.parseDiagnosticsPolicySeverityLabel}:`}
            <select
              data-testid="parse-diagnostics-policy-severity"
              value={parseDiagnosticsPolicy.severity}
              onChange={(event) =>
                setParseDiagnosticsPolicy((prev) => ({
                  ...prev,
                  severity: event.target.value === "blocker" ? "blocker" : "warning"
                }))
              }
              disabled={!parseDiagnosticsPolicy.enabled}
            >
              <option value="warning">{t.parseDiagnosticsPolicySeverityWarning}</option>
              <option value="blocker">{t.parseDiagnosticsPolicySeverityBlocker}</option>
            </select>
          </label>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, marginRight: 12 }}>
            <input
              type="checkbox"
              data-testid="parse-diagnostics-policy-block-export"
              checked={parseDiagnosticsPolicy.blockExport}
              onChange={(event) =>
                setParseDiagnosticsPolicy((prev) => ({ ...prev, blockExport: event.target.checked }))
              }
              disabled={!parseDiagnosticsPolicy.enabled}
            />
            {t.parseDiagnosticsPolicyBlockExportLabel}
          </label>
          <label style={{ display: "block", marginTop: 8 }}>
            {`${t.parseDiagnosticsPolicyThresholdsLabel} (${t.parseDiagnosticsPolicyThresholdsHint}):`}
            <input
              type="text"
              data-testid="parse-diagnostics-policy-thresholds"
              value={parseDiagnosticsPolicy.thresholdsText}
              onChange={(event) =>
                setParseDiagnosticsPolicy((prev) => ({ ...prev, thresholdsText: event.target.value }))
              }
              placeholder={t.parseDiagnosticsPolicyThresholdsHint}
              disabled={!parseDiagnosticsPolicy.enabled}
              style={{ marginLeft: 8, width: "60%", fontFamily: "Consolas, monospace" }}
            />
          </label>
          {parseDiagnosticsPolicyResolved.invalidEntries.length > 0 && (
            <p
              data-testid="parse-diagnostics-policy-invalid-entries"
              style={{ marginTop: 6, marginBottom: 0, color: "#c08a00", fontFamily: "Consolas, monospace" }}
            >
              {`${t.parseDiagnosticsPolicyInvalidEntriesLabel}: ${parseDiagnosticsPolicyResolved.invalidEntries.join(", ")}`}
            </p>
          )}
          <p
            data-testid="parse-diagnostics-policy-summary"
            style={{ marginTop: 6, marginBottom: 0, fontFamily: "Consolas, monospace" }}
          >
            {serializeParseDiagnosticsPolicy(parseDiagnosticsPolicy)}
          </p>
          <button
            type="button"
            onClick={() => void handleCopyParseDiagnosticsPolicyContext()}
            data-testid="parse-diagnostics-policy-copy"
            style={{ marginTop: 6 }}
          >
            {t.parseDiagnosticsPolicyCopyContext}
          </button>
        </fieldset>
        <button data-testid="run-job-check" onClick={() => void handleRunJobCheck()}>
          {t.runJobCheck}
        </button>
        <details
          open={advancedQaExpanded}
          onToggle={(event) => setAdvancedQaExpanded((event.currentTarget as HTMLDetailsElement).open)}
        >
          <summary style={{ cursor: "pointer", fontWeight: 600 }}>{t.fixtureImport}</summary>
        <p style={{ marginTop: 4, marginBottom: 8, opacity: 0.85 }}>
          {`${t.fixtureDefaultsLoadedFor}: ${detectedControllerProfile}`}
        </p>
        <p style={{ marginTop: 0, marginBottom: 8, opacity: 0.85 }}>
          {`${t.fixtureDetectedController}: ${detectedControllerProfile}`}
        </p>
        <label style={{ display: "block", marginBottom: 8 }}>
          {t.fixturesRoot}: <input value={fixturesRoot} onChange={(event) => setFixturesRoot(event.target.value)} />
        </label>
        <label style={{ display: "block", marginBottom: 8 }}>
          {t.fixtureId}:{" "}
          <input
            value={fixtureId}
            onChange={(event) => {
              setFixtureId(event.target.value);
              setFixtureIdManuallyEdited(true);
            }}
          />
        </label>
        <label style={{ display: "block", marginBottom: 8 }}>
          {t.fixtureController}:{" "}
          <select
            value={fixtureController}
            onChange={(event) => {
              setFixtureController(event.target.value as ControllerProfileKey);
              setFixtureControllerManuallySet(true);
            }}
          >
            <option value="haas-ngc">haas-ngc</option>
            <option value="haas-legacy">haas-legacy</option>
            <option value="fanuc">fanuc</option>
          </select>
        </label>
        {fixtureController !== detectedControllerProfile && (
          <p style={{ marginTop: 0, marginBottom: 8, color: "#ef6c00" }}>
            {`Controller mismatch: fixture=${fixtureController}, detected=${detectedControllerProfile}`}
          </p>
        )}
        <button onClick={handleUseDetectedController} disabled={fixtureOpsBusy}>
          {t.useDetectedController}
        </button>
        <button onClick={handleNormalizeFixtureId} style={{ marginLeft: 8 }} disabled={fixtureOpsBusy}>
          {t.normalizeFixtureId}
        </button>
        <label style={{ display: "block", marginBottom: 8 }}>
          {t.fixtureFilename}: <input value={fixtureFilename} onChange={(event) => setFixtureFilename(event.target.value)} />
        </label>
        <label style={{ display: "block", marginBottom: 8 }}>
          <input
            type="checkbox"
            checked={fixtureExpectMainM99}
            onChange={(event) => setFixtureExpectMainM99(event.target.checked)}
          />{" "}
          {t.fixtureExpectMainM99}
        </label>
        <label style={{ display: "block", marginBottom: 8 }}>
          <input
            type="checkbox"
            checked={fixtureExpectSimWarnings}
            onChange={(event) => setFixtureExpectSimWarnings(event.target.checked)}
          />{" "}
          {t.fixtureExpectSimWarnings}
        </label>
        <label style={{ display: "block", marginBottom: 8 }}>
          <input
            type="checkbox"
            checked={fixtureExpectSimFindings}
            onChange={(event) => setFixtureExpectSimFindings(event.target.checked)}
          />{" "}
          {t.fixtureExpectSimFindings}
        </label>
        <label style={{ display: "block", marginBottom: 8 }}>
          {t.fixtureExpectedFindingCodes}:{" "}
          <input
            value={fixtureExpectedFindingCodes}
            onChange={(event) => setFixtureExpectedFindingCodes(event.target.value)}
            style={{ width: "100%", fontFamily: "Consolas, monospace" }}
          />
        </label>
        <pre>{`${t.fixturePreviewPaths}: ${fixtureTargetPaths.fixturePath}\nmanifest: ${fixtureTargetPaths.manifestPath}`}</pre>
        <label style={{ display: "block", marginBottom: 8 }}>
          <input
            type="checkbox"
            checked={autoValidateAfterImport}
            onChange={(event) => setAutoValidateAfterImport(event.target.checked)}
          />{" "}
          {t.autoValidateAfterImport}
        </label>
        <label style={{ display: "block", marginBottom: 8 }}>
          <input
            type="checkbox"
            checked={autoRunTestsAfterImport}
            onChange={(event) => setAutoRunTestsAfterImport(event.target.checked)}
          />{" "}
          {t.autoRunTestsAfterImport}
        </label>
        <button
          onClick={() => void handleImportShopFixture()}
          disabled={nodeOnlyWithBusyDisabled}
          title={nodeOnlyDisabled ? nodeOnlyDisabledReason : undefined}
        >
          {fixtureOpsBusy ? t.fixtureOpsInProgress : t.fixtureImportNow}
        </button>
        <button
          data-testid="reset-fixture-prefs"
          onClick={handleResetFixturePrefsForController}
          style={{ marginLeft: 8 }}
          disabled={fixtureOpsBusy}
        >
          {t.resetFixturePrefs}
        </button>
        <button
          onClick={() => void handleValidateFixturesManifest()}
          style={{ marginLeft: 8 }}
          disabled={nodeOnlyWithBusyDisabled}
          title={nodeOnlyDisabled ? nodeOnlyDisabledReason : undefined}
        >
          {t.validateFixtures}
        </button>
        <label style={{ display: "block", marginTop: 8, marginBottom: 8 }}>
          {t.testsWorkspaceRoot}:{" "}
          <input value={testsWorkspaceRoot} onChange={(event) => setTestsWorkspaceRoot(event.target.value)} />
        </label>
        <button
          onClick={() => void handleRunFixtureTests()}
          disabled={nodeOnlyWithBusyDisabled}
          title={nodeOnlyDisabled ? nodeOnlyDisabledReason : undefined}
        >
          {t.runFixtureTests}
        </button>
        <button
          onClick={() => void handleRefreshFixtureHealth()}
          style={{ marginLeft: 8 }}
          disabled={nodeOnlyWithBusyDisabled}
          title={nodeOnlyDisabled ? nodeOnlyDisabledReason : undefined}
        >
          {t.refreshFixtureHealth}
        </button>
        <button
          onClick={() => void handleUpgradeFixtureToStrictMode()}
          style={{ marginLeft: 8 }}
          disabled={nodeOnlyWithBusyDisabled}
          title={nodeOnlyDisabled ? nodeOnlyDisabledReason : undefined}
        >
          {t.upgradeToStrict}
        </button>
        <label style={{ display: "block", marginTop: 8, marginBottom: 8 }}>
          <input
            type="checkbox"
            checked={includeControllerFixes}
            onChange={(event) => setIncludeControllerFixes(event.target.checked)}
          />{" "}
          {t.includeControllerFixes}
        </label>
        <label style={{ display: "block", marginBottom: 8 }}>
          <input
            type="checkbox"
            checked={includeStrictFixes}
            onChange={(event) => setIncludeStrictFixes(event.target.checked)}
          />{" "}
          {t.includeStrictFixes}
        </label>
        <label style={{ display: "block", marginBottom: 8 }}>
          {`${t.minControllerFixConfidence}: `}
          <select
            value={minimumControllerFixConfidence}
            onChange={(event) => setMinimumControllerFixConfidence(event.target.value as "high" | "medium" | "low")}
          >
            <option value="high">{t.confidenceHigh}</option>
            <option value="medium">{t.confidenceMedium}</option>
            <option value="low">{t.confidenceLow}</option>
          </select>
        </label>
        <label style={{ display: "block", marginBottom: 8 }}>
          <input
            type="checkbox"
            checked={autoRunTestsAfterApply}
            onChange={(event) => setAutoRunTestsAfterApply(event.target.checked)}
          />{" "}
          {t.autoRunTestsAfterApply}
        </label>
        <button
          onClick={() => void handlePreviewAutoFixes()}
          disabled={nodeOnlyWithBusyDisabled}
          title={nodeOnlyDisabled ? nodeOnlyDisabledReason : undefined}
        >
          {t.previewAutoFixes}
        </button>
        <button
          onClick={() => void handleApplyAutoFixes()}
          style={{ marginLeft: 8 }}
          disabled={nodeOnlyWithBusyDisabled || !autoFixPreviewMatchesCurrentSettings}
          title={nodeOnlyDisabled ? nodeOnlyDisabledReason : undefined}
        >
          {t.applyAutoFixes}
        </button>
        <button
          onClick={() => void handleRollbackAutoFixBackup()}
          style={{ marginLeft: 8 }}
          disabled={nodeOnlyWithBusyDisabled}
          title={nodeOnlyDisabled ? nodeOnlyDisabledReason : undefined}
        >
          {t.rollbackFromBackup}
        </button>
        {nodeOnlyDisabled && (
          <pre style={{ marginTop: 8 }}>
            Node-only QA/fixture operations are disabled in browser runtime. Use @cnc/core/node in a Node environment.
          </pre>
        )}
        {!autoFixPreviewMatchesCurrentSettings && <pre>{t.previewRequired}</pre>}
        {autoFixPreview && (
          <pre>
            {JSON.stringify(
              {
                manifestPath: autoFixPreview.manifestPath,
                changeCount: autoFixPreview.changes.length,
                fingerprint: autoFixPreview.fingerprint,
                changeTypeCounts: {
                  controller_mismatch: autoFixPreview.changes.filter((c) => c.kind === "controller_mismatch").length,
                  strict_codes_from_simulation: autoFixPreview.changes.filter(
                    (c) => c.kind === "strict_codes_from_simulation"
                  ).length
                },
                sampleChanges: autoFixPreview.changes.slice(0, 20)
              },
              null,
              2
            )}
          </pre>
        )}
        {autoFixPostReport && (
          <>
            <h4>{t.postApplyReport}</h4>
            <pre>
              {JSON.stringify(
                {
                  appliedChanges: autoFixPostReport.appliedChanges,
                  backupPath: autoFixPostReport.backupPath,
                  validationOk: autoFixPostReport.validationOk,
                  fixtureCount: autoFixPostReport.fixtureCount,
                  testsRun: autoFixPostReport.testsRun,
                  testsOk: autoFixPostReport.testsOk,
                  testsCommand: autoFixPostReport.testsCommand,
                  testsError: autoFixPostReport.testsError
                },
                null,
                2
              )}
            </pre>
            {autoFixPostReport.restoreCommand && (
              <pre>{`${t.restoreHint}: ${autoFixPostReport.restoreCommand}`}</pre>
            )}
          </>
        )}
        <h4>{t.fixtureHealth}</h4>
        <label style={{ display: "block", marginBottom: 8 }}>
          <input
            type="checkbox"
            checked={showOnlyIssueFixtures}
            onChange={(event) => setShowOnlyIssueFixtures(event.target.checked)}
          />{" "}
          {t.showOnlyIssueFixtures}
        </label>
        {fixtureHealth ? (
          <pre>
            {JSON.stringify(
              {
                fixtureCount: fixtureHealth.fixtureCount,
                byController: fixtureHealth.byController,
                strictFixtures: fixtureHealth.strictFixtures,
                nonStrictFixtures: fixtureHealth.nonStrictFixtures,
                expectedWarningsFixtures: fixtureHealth.expectedWarningsFixtures,
                expectedFindingsFixtures: fixtureHealth.expectedFindingsFixtures,
                topIssues: fixtureHealth.items
                  .filter((i) => (showOnlyIssueFixtures ? i.issues.length > 0 : true))
                  .slice(0, 12)
                  .map((i) => ({ id: i.id, score: i.score, issues: i.issues }))
              },
              null,
              2
            )}
          </pre>
        ) : (
          <pre>- none</pre>
        )}
        </details>
        <p style={{ marginTop: 8, marginBottom: 4 }}>
          <button onClick={() => void handleCopyJobCheckStatus()}>{t.copyJobCheckStatus}</button>
          <button onClick={() => void handleCopyJobCheckWithFindingsSummary()} style={{ marginLeft: 8 }}>
            {t.copyJobCheckWithFindings}
          </button>
          <button onClick={() => void handleCopyOperatorHandoffBundle()} style={{ marginLeft: 8 }}>
            {t.copyOperatorHandoffBundle}
          </button>
          <button onClick={() => void handleCopyMachineSafeStartupBrief()} style={{ marginLeft: 8 }}>
            {t.copyMachineSafeStartupBrief}
          </button>
          <button onClick={() => void handleCopyFirstCutRiskBrief()} style={{ marginLeft: 8 }}>
            {t.copyFirstCutRiskBrief}
          </button>
          <button onClick={() => void handleCopyFirstCutRiskBriefWithPolicyContext()} style={{ marginLeft: 8 }}>
            {t.copyFirstCutRiskBriefWithPolicy}
          </button>
          <button onClick={() => void handleCopyFirstCutRiskBriefWithJobCheckStatus()} style={{ marginLeft: 8 }}>
            {t.copyFirstCutRiskBriefWithJobCheck}
          </button>
        </p>
        <pre>{`${t.runJobCheckStatus}: ${jobCheckStatus}`}</pre>
        <pre>{`${t.jobCheckCopyStatus}: ${jobCheckCopyStatus}`}</pre>
        <pre>{`${t.lastCopiedJobCheckFindingsSummary}: ${jobCheckFindingsSummaryCopyStatus}`}</pre>
        <pre>{`${t.lastCopiedOperatorHandoffBundle}: ${operatorHandoffBundleCopyStatus}`}</pre>
        <pre>{`${t.lastCopiedMachineSafeStartupBrief}: ${machineSafeStartupBriefCopyStatus}`}</pre>
        <pre>{`${t.lastCopiedPolicyContext}: ${policyContextCopyStatus}`}</pre>
        <pre>{`${t.lastCopiedFullExportContext}: ${fullExportContextCopyStatus}`}</pre>
        <pre>{`${t.firstCutRiskBriefCopyStatusPlain}: ${firstCutRiskBriefCopyStatusPlain}`}</pre>
        <pre>{`${t.firstCutRiskBriefCopyStatusPolicy}: ${firstCutRiskBriefCopyStatusPolicy}`}</pre>
        <pre>{`${t.firstCutRiskBriefCopyStatusJobCheck}: ${firstCutRiskBriefCopyStatusJobCheck}`}</pre>
        <pre>{`${t.exportStatus}: ${exportStatus}`}</pre>
      </section>
    </main>
  );
}

function isTypingElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable;
}

function computeLineStarts(source: string): number[] {
  const starts = [0];
  for (let i = 0; i < source.length; i += 1) {
    if (source[i] === "\n") starts.push(i + 1);
  }
  return starts;
}

function readUiDefaultsFromTemplateJson(
  sourceJson: string,
  profile: ControllerProfileKey
):
  | {
      subprogramTargetPolicy?: SubprogramTargetPolicy;
      logSemantics?: LogSemantics;
      dOffsetCallStyle?: "haas_g43_d_with_h_only" | "fanuc_wear_on_g41_g42_with_g40_d00";
      showOnlyBlockers?: boolean;
      timelineFilters?: Partial<Record<TimelineFilterKey, boolean>>;
      fixturesRoot?: string;
      testsWorkspaceRoot?: string;
      autoValidateAfterImport?: boolean;
      autoRunTestsAfterImport?: boolean;
      operatorReviewMode?: boolean;
      advancedQaExpanded?: boolean;
      jobCheckPolicyPreset?: JobCheckPolicyPreset;
      policyUiEventsEnabled?: boolean;
      policyLockManualChanges?: boolean;
      parseDiagnosticsPolicy?: {
        enabled?: boolean;
        severity?: "warning" | "blocker";
        blockExport?: boolean;
        thresholdsText?: string;
      };
      lintDemoControllerOverride?: "auto" | ControllerProfileKey;
      auditTrailExportFormat?: AuditTrailExportFormat;
    }
  | undefined {
  try {
    const parsed = JSON.parse(sourceJson) as {
      settings?: {
        uiDefaults?: Record<
          string,
          {
            subprogramTargetPolicy?: SubprogramTargetPolicy;
            logSemantics?: LogSemantics;
            dOffsetCallStyle?: "haas_g43_d_with_h_only" | "fanuc_wear_on_g41_g42_with_g40_d00";
            showOnlyBlockers?: boolean;
            timelineFilters?: Partial<Record<TimelineFilterKey, boolean>>;
            fixturesRoot?: string;
            testsWorkspaceRoot?: string;
            autoValidateAfterImport?: boolean;
            autoRunTestsAfterImport?: boolean;
            operatorReviewMode?: boolean;
            advancedQaExpanded?: boolean;
            jobCheckPolicyPreset?: JobCheckPolicyPreset;
            policyUiEventsEnabled?: boolean;
            policyLockManualChanges?: boolean;
            parseDiagnosticsPolicy?: {
              enabled?: boolean;
              severity?: "warning" | "blocker";
              blockExport?: boolean;
              thresholdsText?: string;
            };
            lintDemoControllerOverride?: "auto" | ControllerProfileKey;
            auditTrailExportFormat?: AuditTrailExportFormat;
          }
        >;
      };
    };
    return parsed.settings?.uiDefaults?.[profile];
  } catch {
    return undefined;
  }
}

function emitPolicyPresetUiEvent(
  enabled: boolean,
  eventName: string,
  detail: { controller: ControllerProfileKey; preset: JobCheckPolicyPreset; source: "saved" | "bootstrap" | "manual" },
  timestampIso?: string,
  extras?: PolicyUiEventExtras
): PolicyUiEventPayload | null {
  if (!derivePolicyUiEventEmissionDecision(enabled).emit) return null;
  const payload = buildPolicyUiEventPayload({
    event: eventName,
    detail,
    timestampIso: timestampIso ?? new Date().toISOString(),
    extras
  });
  try {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("cnc:policy-preset-ui", { detail: payload }));
    }
    if (typeof console !== "undefined") {
      console.debug("[policy-preset-ui-event]", payload);
    }
    return payload;
  } catch {
    // Telemetry-ready hook should never block UI interactions.
    return null;
  }
}

function isAlarmEvent(kind: string): boolean {
  return kind === "alarm" || kind === "message_stop";
}

function isFlowEvent(kind: string): boolean {
  return kind === "subprogram_call" || kind === "subprogram_return" || kind === "subprogram_repeat";
}

function eventColor(kind: string): string {
  if (isAlarmEvent(kind)) return "#c62828";
  if (isFlowEvent(kind)) return "#1565c0";
  return "#ef6c00";
}

function findingSeverityColor(severity: "blocker" | "warning"): string {
  return severity === "blocker" ? "#a10000" : "#a17200";
}

function parseBlacklistedParameters(input: string): number[] {
  return input
    .split(",")
    .map((v) => v.trim().replace(/^#/, ""))
    .map((v) => Number(v))
    .filter((v) => Number.isInteger(v) && v >= 1);
}

function parseStringList(input: string): string[] {
  const items = input
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
  return [...new Set(items)];
}

function checksumText(input: string): string {
  let acc = 0;
  for (let i = 0; i < input.length; i += 1) {
    acc = (acc + input.charCodeAt(i) * (i + 1)) % 65535;
  }
  return acc.toString(16).padStart(4, "0");
}

function sanitizeFixtureName(value: string): string {
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return cleaned || "fixture";
}

function suggestFixtureIdFromCode(source: string): string {
  const lines = source.split(/\r?\n/).slice(0, 10);
  const joined = lines.join("\n");
  const oMatch = joined.match(/\bO(\d{3,6})\b/i);
  const commentMatch = joined.match(/\(([^)]+)\)/);
  const parts: string[] = [];
  if (oMatch) parts.push(`o${oMatch[1]}`);
  if (commentMatch?.[1]) parts.push(commentMatch[1]);
  if (parts.length === 0) return "my_shop_fixture";
  return sanitizeFixtureName(parts.join("_"));
}

function detectControllerProfile(code: string): ControllerProfileKey {
  const header = code.toUpperCase().split(/\r?\n/).slice(0, 40).join("\n");
  if (/\bFANUC\b/.test(header)) return "fanuc";
  if (/\bNGC\b/.test(header) || /\bG234\b/.test(header) || /\bDWO\b/.test(header)) return "haas-ngc";
  if (/\bHAAS\b/.test(header)) return "haas-legacy";
  return "haas-ngc";
}

function suggestedFixForFinding(code: string, language: UiLanguage): string {
  const FIXES: Record<UiLanguage, Record<string, string>> = {
    pl: {
      MISSING_G43_BEFORE_NEGATIVE_Z:
        "Dodaj G43 H.. przed pierwszym ruchem na ujemne Z i potwierdź poprawne przesunięcie długości narzędzia.",
      MISSING_PROGRAM_END: "Dodaj M30 (lub M2) na końcu programu i sprawdź, czy nie ma nieosiągalnych bloków.",
      CLAMP_ZONE_COLLISION_RISK: "Skoryguj ścieżkę/WCS lub strefy szczęk; wykonaj przejazd w powietrzu nad oprzyrządowaniem.",
      MIXED_UNITS: "Używaj tylko jednego systemu jednostek (G20 albo G21) w całym programie.",
      TOOL_H_MISMATCH: "Zweryfikuj mapowanie T/H; wyrównaj H z narzędziem lub opisz wyjątek.",
      SAFE_START_NOT_DETECTED: "Dodaj linię bezpiecznego startu na początku (np. G90 G17 G40 G49 G80).",
      CANNED_CYCLE_NO_R: "Dodaj wartość R w cyklu stałym dla przewidywalnego zachowania odjazdu.",
      SIM_MACRO_ALARM: "Usuń przyczynę alarmu makra (#3000/#3006) i ponownie zweryfikuj parametry wejściowe.",
      SIM_MAIN_M99: "Usuń M99 z programu głównego lub popraw ścieżkę powrotu z podprogramu.",
      SIM_CALL_DEPTH_LIMIT: "Ogranicz zagnieżdżenie wywołań M97/M98/G65 lub zwiększ limit tylko świadomie.",
      SIM_UNFINISHED_RETURN_PATH: "Dodaj brakujące M99 i popraw przepływ powrotu do programu głównego.",
      __default: "Zweryfikuj punkt i wykonaj dry run + single block przed produkcją."
    },
    en: {
      MISSING_G43_BEFORE_NEGATIVE_Z:
        "Insert G43 H.. before first negative Z move and verify correct tool length offset.",
      MISSING_PROGRAM_END: "Add M30 (or M2) at the end of the program and verify no unreachable tail blocks.",
      CLAMP_ZONE_COLLISION_RISK: "Adjust toolpath/WCS or update clamp zones; prove out in air above fixture.",
      MIXED_UNITS: "Use only one unit system (G20 or G21) for entire program.",
      TOOL_H_MISMATCH: "Confirm T/H mapping is intentional; align H with tool or document exception.",
      SAFE_START_NOT_DETECTED: "Add safe start line near top (e.g. G90 G17 G40 G49 G80).",
      CANNED_CYCLE_NO_R: "Add R plane value to canned cycle for predictable retract behavior.",
      SIM_MACRO_ALARM: "Resolve root cause of macro alarm (#3000/#3006) and re-validate input parameters.",
      SIM_MAIN_M99: "Remove M99 from main program or correct subprogram return flow.",
      SIM_CALL_DEPTH_LIMIT: "Reduce nested M97/M98/G65 calls or raise depth limit only intentionally.",
      SIM_UNFINISHED_RETURN_PATH: "Add missing M99 and fix return flow back to the main program.",
      __default: "Review this item and validate with dry run + single block before production."
    }
  };

  return FIXES[language][code] ?? FIXES[language].__default;
}
