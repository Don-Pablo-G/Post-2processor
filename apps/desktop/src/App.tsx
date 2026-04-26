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
  lint,
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
  defaultPolicyPresetForController,
  derivePolicyDriftWarning,
  derivePolicyUiEventEmissionDecision,
  derivePolicyPresetVisualState,
  resolvePolicyPresetHintState,
  resolvePolicyPresetShortcutAction
} from "./policyPresetHint";

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
    policyUiEventsEnabled: string;
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
    jobCheckCard: string;
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
    policyUiEventsEnabled: "Włącz lokalne eventy UI polityki",
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
    jobCheckCard: "Wynik Job Check",
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
    english: "English"
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
    policyUiEventsEnabled: "Enable local policy UI events",
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
    jobCheckCard: "Job Check result",
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
    english: "English"
  }
};

export function App() {
  const nodeCapable = isNodeCapable();
  const nodeOnlyDisabled = !nodeCapable;
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
  const [jobCheckResult, setJobCheckResult] = useState<RunJobCheckResult | null>(null);
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
    }>
  >([]);
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

  const ast = useMemo(() => parse(code, haasNgcProfile), [code]);
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
  const lintIssues = useMemo(() => lint(ast, haasNgcProfile), [ast]);
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
      }))
    });
  }, [
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
    detail: { controller: ControllerProfileKey; preset: JobCheckPolicyPreset; source: "saved" | "bootstrap" | "manual" }
  ): void => {
    const timestampIso = new Date().toISOString();
    setPolicyAuditTrail((prev) => [{ event: eventName, timestampIso, ...detail }, ...prev].slice(0, 30));
    emitPolicyPresetUiEvent(policyUiEventsEnabled, eventName, detail);
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
    if (uiDefaults.jobCheckPolicyPreset) {
      setJobCheckPolicyPreset(uiDefaults.jobCheckPolicyPreset);
      setPolicyPresetManuallySet(false);
      recordPolicyPresetTransition("saved_default_loaded", {
        controller: detectedControllerProfile,
        preset: uiDefaults.jobCheckPolicyPreset,
        source: "saved"
      });
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
      const action = resolvePolicyPresetShortcutAction({
        key: event.key,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        isTypingContext: isTypingElement(event.target),
        hasUnsavedOverride: policyPresetHintState.hasUnsavedOverride
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
  }, [detectedControllerProfile, policyPresetHintState.hasUnsavedOverride, policyUiEventsEnabled]);

  async function handleExport(): Promise<void> {
    try {
      const exported = await exportWorkshopFiles({
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
        }
      });
      setJobCheckStatus(
        `score=${result.readyToRunScore}, blockers=${result.blockerCount}, warnings=${result.warningCount}, blocked=${result.blocked}`
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
            }
          >;
        };
      };

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
              policyUiEventsEnabled
            }
          }
        }
      };

      setTemplateJson(JSON.stringify(next, null, 2));
      recordPolicyPresetTransition("saved_to_template", {
        controller: detectedControllerProfile,
        preset: jobCheckPolicyPreset,
        source: policyPresetHintState.source
      });
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
      setExportStatus(`Copied policy context: ${line}`);
    } catch {
      setExportStatus(`Copy policy context manually: ${line}`);
    }
  }

  async function handleCopyFullExportContext(): Promise<void> {
    const exportDir = jobCheckResult?.exportResult?.exportDirectory ?? "n/a";
    const artifactCount = jobCheckResult?.exportResult?.artifacts.length ?? 0;
    const line = `EXPORT CONTEXT | dir=${exportDir} artifacts=${artifactCount} | preset=${policyPresetHintState.currentPreset} source=${policyPresetHintState.source} controller=${detectedControllerProfile}`;
    try {
      await navigator.clipboard.writeText(line);
      setExportStatus(`Copied full export context: ${line}`);
    } catch {
      setExportStatus(`Copy full export context manually: ${line}`);
    }
  }

  function handleResetUiPrefsForController(): void {
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
      setShowOnlyBlockers(false);
      setTimelineFilters({ alarms: true, flow: true, control: true });
      setExportStatus("UI defaults reset for current controller profile.");
    } catch {
      setExportStatus("Cannot reset UI defaults: invalid template JSON.");
    }
  }

  function handleResetFixturePrefsForController(): void {
    setFixtureControllerManuallySet(false);
    setFixtureController(detectedControllerProfile);
    setFixturesRoot("./packages/test-fixtures");
    setTestsWorkspaceRoot(".");
    setAutoValidateAfterImport(true);
    setAutoRunTestsAfterImport(false);
    setExportStatus("Fixture import defaults reset for current controller profile.");
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
          <h2>{t.lintIssues}</h2>
          <pre>{JSON.stringify(lintIssues, null, 2)}</pre>
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
              value={templateJson}
              onChange={(event) => setTemplateJson(event.target.value)}
              rows={10}
              style={{ width: "100%", fontFamily: "Consolas, monospace" }}
            />
            <button onClick={handleSaveParameterPrefsToTemplateJson}>{t.saveParamPrefs}</button>
            <button onClick={handleResetUiPrefsForController} style={{ marginLeft: 8 }}>
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
          <summary style={{ cursor: "pointer", fontWeight: 600 }}>{t.policyAuditTrail}</summary>
          {policyAuditTrail.length === 0 ? (
            <p style={{ marginTop: 6, opacity: 0.8 }}>{t.policyAuditTrailEmpty}</p>
          ) : (
            <ul style={{ marginTop: 6 }}>
              {policyAuditTrail.map((entry, idx) => (
                <li key={`${entry.timestampIso}-${idx}`}>
                  {`${entry.timestampIso} | ${entry.event} | ${entry.preset}/${entry.source} | ${entry.controller}`}
                </li>
              ))}
            </ul>
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
        <button onClick={() => void handleRunJobCheck()}>{t.runJobCheck}</button>
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
        <button onClick={handleResetFixturePrefsForController} style={{ marginLeft: 8 }} disabled={fixtureOpsBusy}>
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
        <pre>{`${t.runJobCheckStatus}: ${jobCheckStatus}`}</pre>
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
  detail: { controller: ControllerProfileKey; preset: JobCheckPolicyPreset; source: "saved" | "bootstrap" | "manual" }
): { event: string; controller: ControllerProfileKey; preset: JobCheckPolicyPreset; source: "saved" | "bootstrap" | "manual"; timestampIso: string } | null {
  if (!derivePolicyUiEventEmissionDecision(enabled).emit) return null;
  const payload = {
    schemaVersion: 1,
    event: eventName,
    ...detail,
    timestampIso: new Date().toISOString()
  };
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
