export type Word = {
  letter: string;
  value: string;
};

export type Block = {
  raw: string;
  words: Word[];
  comment?: string;
};

export type ProgramAst = {
  profileId: string;
  blocks: Block[];
};

export type FormatStyle = {
  upperCaseWords: boolean;
  normalizeSpacing: boolean;
  removeStandaloneOptionalStops: boolean;
};

export type ParameterSuggestion = {
  literal: string;
  replacement: string;
  count: number;
};

export type ParameterizeResult = {
  ast: ProgramAst;
  suggestions: ParameterSuggestion[];
};

export type ParameterizeOptions = {
  startAt?: number;
  blacklistedParameters?: number[];
};

export type ParameterReserveProfile = {
  id: string;
  label: string;
  controller: "haas_ngc" | "haas_legacy" | "fanuc";
  startAt: number;
  blacklistedParameters: number[];
  notes?: string;
};

export type SimulatorLimits = {
  maxSteps: number;
  maxLoopIterations: number;
  rapidRateMmPerMin?: number;
  defaultFeedMmPerMin?: number;
  toolChangeSeconds?: number;
  controllerMode?: "haas-ngc" | "haas-legacy" | "fanuc";
  maxCallDepth?: number;
  subprogramTargetPolicy?: "shop_friendly" | "strict_controller";
  logSemantics?: "controller_default" | "natural" | "base10";
};

export type SimulationState = {
  variables: Record<string, number>;
  currentBlock: number;
  steps: number;
  halted: boolean;
};

export type SimulationTraceEntry = {
  blockIndex: number;
  raw: string;
  variableSnapshot: Record<string, number>;
  blockTimeSeconds: number;
  elapsedSeconds: number;
  event?: {
    kind:
      | "alarm"
      | "message_stop"
      | "subprogram_call"
      | "subprogram_return"
      | "subprogram_repeat"
      | "call_depth_limit"
      | "main_m99";
    message: string;
    parameter?: 3000 | 3006;
    code?: number;
    program?: number;
    via?: "M97" | "M98" | "G65";
    returnBlock?: number;
    remainingRepeats?: number;
    maxCallDepth?: number;
  };
};

export type SimulationResult = {
  trace: SimulationTraceEntry[];
  state: SimulationState;
  warnings: string[];
  estimatedCycleTimeSeconds: number;
  alarms: Array<{
    blockIndex: number;
    parameter: 3000 | 3006;
    code: number;
    message: string;
  }>;
};

export type LintIssue = {
  severity: "warning" | "error";
  message: string;
  blockIndex: number;
};

export type ToolingReportOptions = {
  rapidRateMmPerMin?: number;
  includeSetupInstructions?: boolean;
  dOffsetCallStyle?: "haas_g43_d_with_h_only" | "fanuc_wear_on_g41_g42_with_g40_d00";
  toolCommentSelections?: Record<number, string>;
  autoSelectToolComments?: boolean;
  fiveAxis?: {
    enabled: boolean;
    machine: "3axis" | "umc";
    holderGaugeLengthMm?: number;
    safetyClearanceMm?: number;
  };
};

export type ToolUsage = {
  toolNumber: number;
  firstSeenBlock: number;
  hOffset?: number;
  hOffsetParameter?: string;
  dOffset?: number;
  dOffsetParameter?: string;
  toolCommentCandidates: string[];
  selectedToolComment?: string;
  workOffsetsUsed: string[];
  lowestZ: number;
  estimatedStickoutMm?: number;
  orientationAtLowestZ?: {
    a: number;
    b: number;
    c: number;
  };
};

export type ToolingReport = {
  tools: ToolUsage[];
  programLowestZ: number;
  workOffsetsSeen: string[];
  setupInstructions: string[];
  warnings: string[];
  printable80mm: string;
};

export type SafetyFinding = {
  severity: "blocker" | "warning";
  code: string;
  message: string;
  blockIndex?: number;
};

export type SimulationFindingRulePolicy = {
  enabled: boolean;
  severity: "blocker" | "warning";
};

export type SimulationFindingPolicy = {
  macroAlarm: SimulationFindingRulePolicy;
  mainM99: SimulationFindingRulePolicy;
  callDepthLimit: SimulationFindingRulePolicy;
  unfinishedReturnPath: SimulationFindingRulePolicy;
  ifThenRhsInvalid: SimulationFindingRulePolicy;
  controlFlowMissingEnd: SimulationFindingRulePolicy;
  controlFlowLoopLimit: SimulationFindingRulePolicy;
  functionDomainError: SimulationFindingRulePolicy;
  controlFlowOrphanEnd: SimulationFindingRulePolicy;
  cycleParameterIssue: SimulationFindingRulePolicy;
  unsupportedM97: SimulationFindingRulePolicy;
  unsupportedFunction: SimulationFindingRulePolicy;
  subprogramTargetMiss: SimulationFindingRulePolicy;
  rapidZPlunge: SimulationFindingRulePolicy;
  gotoTargetMiss: SimulationFindingRulePolicy;
  maxStepsLimit: SimulationFindingRulePolicy;
};

export type SimulationFindingPolicyOverride = Partial<{
  [K in keyof SimulationFindingPolicy]: Partial<SimulationFindingPolicy[K]>;
}>;

export type ExportBlockingPolicy = {
  includeAllBlockers: boolean;
  blockedFindingCodes: string[];
};

export type ExportBlockingPolicyOverride = Partial<{
  includeAllBlockers: boolean;
  blockedFindingCodes: string[];
}>;

export type JobCheckPolicyPreset = "strict" | "balanced" | "permissive";

export type CriticalEvent = {
  kind:
    | "first_motion"
    | "first_cut"
    | "first_tool_change"
    | "deepest_z"
    | "first_wcs_change"
    | "program_end";
  blockIndex: number;
  description: string;
};

export type SetupOptimization = {
  kind: "group_by_tool";
  message: string;
  estimatedToolChangesSaved: number;
};

export type OptionalStopSuggestion = {
  blockIndex: number;
  reason: string;
  suggestedLine: string;
};

export type ProgramAdvisorOptions = {
  stock?: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    topZ: number;
    bottomZ: number;
  };
  clampZones?: Array<{
    name: string;
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    minZ?: number;
    maxZ?: number;
  }>;
};

export type ProgramAdvisorReport = {
  readyToRunScore: number;
  safetyFindings: SafetyFinding[];
  checklist: string[];
  criticalEvents: CriticalEvent[];
  setupOptimizations: SetupOptimization[];
  optionalStopSuggestions: OptionalStopSuggestion[];
  parameterFrontMatter: string;
  operatorViewProgram: string;
};

export type ProgramTemplate = {
  id: string;
  name: string;
  description: string;
  code: string;
};

export type TemplateLibrary = {
  templates: ProgramTemplate[];
  settings?: {
    parameterDefaults?: Record<
      string,
      {
        presetId?: string;
        startAt?: number;
        blacklistedParameters?: number[];
      }
    >;
  };
  sourceJson: string;
};

export type SetupSheet = {
  title: string;
  lines: string[];
  printable80mm: string;
  exportTxt: string;
  exportMarkdown: string;
};

export type ProveoutResult = {
  code: string;
  insertedCheckpoints: number;
  notes: string[];
};

export type ProveoutPatchResult = {
  code: string;
  markersAdded: number;
  markersRemoved: number;
};

export type ExportArtifactsInput = {
  baseDirectory: string;
  baseName?: string;
  setupSheetTxt: string;
  setupSheetMarkdown: string;
  proveoutCode: string;
  fixtureSummaryTxt?: string;
  fixtureSummaryMarkdown?: string;
  timelineTxt?: string;
  timelineMarkdown?: string;
  findingsTxt?: string;
  findingsMarkdown?: string;
};

export type ExportedArtifact = {
  kind:
    | "setup_txt"
    | "setup_md"
    | "proveout_nc"
    | "fixture_summary_txt"
    | "fixture_summary_md"
    | "timeline_txt"
    | "timeline_md"
    | "findings_txt"
    | "findings_md";
  path: string;
};

export type ExportArtifactsResult = {
  exportDirectory: string;
  artifacts: ExportedArtifact[];
};

export type ImportShopFixtureInput = {
  fixturesRootDirectory: string;
  id: string;
  controller: "haas-ngc" | "haas-legacy" | "fanuc";
  code: string;
  expectations: {
    expectsMainM99: boolean;
    expectsSimulationWarnings: boolean;
    expectsSimulationFindings: boolean;
    expectedFindingCodes?: string[];
  };
  filename?: string;
  overwriteExistingFile?: boolean;
};

export type ImportShopFixtureResult = {
  fixturePath: string;
  manifestPath: string;
  fixtureId: string;
};

export type ValidateShopFixturesInput = {
  fixturesRootDirectory: string;
};

export type ValidateShopFixturesResult = {
  fixtureCount: number;
  manifestPath: string;
};

export type RunShopRegressionTestsInput = {
  workspaceRootDirectory: string;
};

export type RunShopRegressionTestsResult = {
  ok: boolean;
  command: string;
  output: string;
};

export type AnalyzeShopFixturesInput = {
  fixturesRootDirectory: string;
};

export type FixtureHealthItem = {
  id: string;
  controller: "haas-ngc" | "haas-legacy" | "fanuc";
  path: string;
  strictMode: boolean;
  score: number;
  issues: string[];
};

export type AnalyzeShopFixturesResult = {
  manifestPath: string;
  fixtureCount: number;
  byController: Record<"haas-ngc" | "haas-legacy" | "fanuc", number>;
  strictFixtures: number;
  nonStrictFixtures: number;
  expectedWarningsFixtures: number;
  expectedFindingsFixtures: number;
  items: FixtureHealthItem[];
  summaryTxt: string;
  summaryMarkdown: string;
};

export type PreviewShopFixtureAutoFixesInput = {
  fixturesRootDirectory: string;
  includeControllerMismatchFixes?: boolean;
  includeStrictFromSimulationFixes?: boolean;
};

export type ShopFixtureAutoFixChange = {
  fixtureId: string;
  kind: "controller_mismatch" | "strict_codes_from_simulation";
  confidence?: "high" | "medium" | "low";
  field: string;
  from: string;
  to: string;
};

export type PreviewShopFixtureAutoFixesResult = {
  manifestPath: string;
  changes: ShopFixtureAutoFixChange[];
  updatedManifestJson: string;
  fingerprint: string;
};

export type ApplyShopFixtureAutoFixesInput = PreviewShopFixtureAutoFixesInput & {
  createBackup?: boolean;
  minimumControllerFixConfidence?: "high" | "medium" | "low";
  expectedPreviewFingerprint?: string;
};

export type ApplyShopFixtureAutoFixesResult = {
  manifestPath: string;
  backupPath?: string;
  appliedChanges: number;
  appliedFingerprint: string;
};

export type RestoreShopFixtureManifestBackupInput = {
  manifestPath: string;
  backupPath: string;
};

export type RestoreShopFixtureManifestBackupResult = {
  manifestPath: string;
  restoredFrom: string;
};

export type TimelineFindingsExportBundleInput = {
  timestampIso: string;
  controller: "haas-ngc" | "haas-legacy" | "fanuc";
  policyPreset?: JobCheckPolicyPreset;
  policyPresetSource?: "saved" | "bootstrap" | "manual" | "unknown";
  subprogramTargetPolicy?: "shop_friendly" | "strict_controller";
  logSemantics?: "controller_default" | "natural" | "base10";
  score?: number;
  timelineEntries: Array<{
    blockIndex: number;
    kind: string;
    message: string;
  }>;
  findings: SafetyFinding[];
};

export type TimelineFindingsExportBundle = {
  timelineTxt: string;
  timelineMarkdown: string;
  findingsTxt: string;
  findingsMarkdown: string;
};

export type RunJobCheckInput = {
  ast: ProgramAst;
  initialState?: Record<string, number>;
  advisorOptions?: ProgramAdvisorOptions;
  simulationLimits?: Partial<SimulatorLimits>;
  policyPreset?: JobCheckPolicyPreset;
  simulationFindingPolicy?: SimulationFindingPolicyOverride;
  exportBlockingPolicy?: ExportBlockingPolicyOverride;
  exportOptions?: {
    enabled: boolean;
    allowExportWithBlockers?: boolean;
    baseDirectory: string;
    baseName?: string;
  };
};

export type RunJobCheckResult = {
  readyToRunScore: number;
  blockerCount: number;
  warningCount: number;
  blocked: boolean;
  simulation: SimulationResult;
  simulationFindings: SafetyFinding[];
  advisor: ProgramAdvisorReport;
  setupSheet: SetupSheet;
  proveout: ProveoutResult;
  exportResult?: ExportArtifactsResult;
  messages: string[];
};
