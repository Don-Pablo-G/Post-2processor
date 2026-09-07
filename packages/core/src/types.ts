export type Word = {
  letter: string;
  value: string;
  span?: SourceSpan;
  expressionAst?: ParseExpressionNode;
};

export type SourceSpan = {
  start: number;
  end: number;
};

export type ParseDiagnostic = {
  code:
    | "UNMATCHED_OPEN_PAREN"
    | "UNMATCHED_CLOSE_PAREN"
    | "ADDRESS_MISSING_VALUE"
    | "UNMATCHED_BRACKET"
    | "BRACKET_EXPRESSION_INVALID"
    | "UNKNOWN_TOKEN"
    | "INVALID_CHARACTER";
  severity: "warning" | "error";
  message: string;
  blockIndex: number;
  span?: SourceSpan;
  suggestedFixes?: ParseDiagnosticFixSuggestion[];
};

export type ParseDiagnosticFixSuggestion = {
  title: string;
  replacement?: string;
};

export type ParseBlockSummary = {
  blockIndex: number;
  errorCount: number;
  warningCount: number;
  hasRecovery: boolean;
};

export type ParseSummary = {
  errorCount: number;
  warningCount: number;
  hasRecovery: boolean;
  blocks: ParseBlockSummary[];
};

export type ParseExpressionNode =
  | { kind: "number"; value: number; raw: string }
  | { kind: "variable"; name: string; indexExpression?: ParseExpressionNode }
  | { kind: "unary"; operator: "+" | "-"; operand: ParseExpressionNode }
  | {
      kind: "binary";
      operator: "+" | "-" | "*" | "/" | "MOD" | "AND" | "OR" | "XOR" | "EQ" | "NE" | "GT" | "GE" | "LT" | "LE";
      left: ParseExpressionNode;
      right: ParseExpressionNode;
    }
  | { kind: "function"; name: string; args: ParseExpressionNode[] };

export type Block = {
  raw: string;
  words: Word[];
  comment?: string;
};

export type ProgramAst = {
  profileId: string;
  blocks: Block[];
  parseComplianceMode?: ParseComplianceMode;
  /**
   * Optional grammar pack table ids stamped from a controller pack manifest
   * (e.g. `haas-strict`, `fanuc-strict`). When set, controller-grammar lint
   * uses these instead of profileId / compliance heuristics.
   */
  grammarPackIds?: string[];
  parseDiagnostics?: ParseDiagnostic[];
  parseSummary?: ParseSummary;
};

export type ParseComplianceMode = "strict" | "lenient" | "strict_haas" | "strict_fanuc";

export type ParseOptions = {
  complianceMode?: ParseComplianceMode;
  /** Optional grammar pack ids to stamp onto the returned AST. */
  grammarPackIds?: string[];
  semicolonEob?: boolean;
  includeTokenSpans?: boolean;
  includeExpressionAst?: boolean;
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
  suggestedFixes?: ParseDiagnosticFixSuggestion[];
  /**
   * Stable rule code (e.g. `CG_N_AND_O_MIXED`, `haas.m6-without-t`).
   * Controller-grammar lints use the `CG_` prefix; profile packs use their
   * `ProfileRuleDoc.id`. Preferred for policy toggles and envelope aggregation.
   */
  code?: string;
};

export type LintIssueProvenance = {
  source: "lexer" | "expression_parser" | "controller_grammar" | "common_lint" | "profile_lint";
  relatedDiagnostics: Array<{
    code: ParseDiagnostic["code"];
    span?: SourceSpan;
    suggestedFixes?: ParseDiagnosticFixSuggestion[];
  }>;
};

export type LintIssueWithProvenance = LintIssue & {
  provenance: LintIssueProvenance;
};

/**
 * Structured documentation entry for a profile-pack lint rule. Used to drive
 * the auto-generated PROFILE_PACKS.md reference and to provide a contract
 * test surface (every rule MUST trigger on its `positiveSnippet` and MUST NOT
 * trigger on its `negativeSnippet`). Append-only — new optional fields may be
 * added to this type, but existing fields remain stable.
 */
export type ProfileRuleDoc = {
  /** Stable, dotted, lowercase id (e.g. "fanuc.g65-missing-p"). */
  id: string;
  /** Mirrors LintIssue.severity. */
  severity: LintIssue["severity"];
  /** Substring/regex that matches `LintIssue.message` for this rule. */
  messageMatcher: RegExp;
  /** Minimal G-code snippet that MUST trigger this rule when linted. */
  positiveSnippet: string;
  /** Minimal G-code snippet that MUST NOT trigger this rule when linted. */
  negativeSnippet: string;
  /** One-liner human-readable summary suitable for a docs row. */
  summary: string;
  /**
   * When set, this rule is "soft-deprecated": it still emits issues by default
   * but can be suppressed via the CLI `--no-deprecated-rules` flag. Format is
   * an ISO year-month string (e.g. `"2026-05"`); shops use this to plan
   * migration off the rule. Append-only field — never set then unset, only set
   * once and bumped forward in time if the deprecation is re-confirmed.
   */
  deprecatedSince?: string;
  /**
   * When set alongside `deprecatedSince`, a one-line migration hint surfaced
   * in `audit-deprecated-rules` output and `PROFILE_PACKS.md` so operators
   * know what to switch to. Append-only optional field.
   */
  replacementSuggestion?: string;
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
  invalidAssignment: SimulationFindingRulePolicy;
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

/**
 * Per-rule enable/disable (+ optional severity override) keyed by stable
 * `LintIssue.code` / `ProfileRuleDoc.id`. Missing ids keep default (enabled).
 */
export type RulePolicyEntry = {
  enabled: boolean;
  severity?: LintIssue["severity"];
};

export type RulePolicy = {
  rules: Record<string, RulePolicyEntry>;
};

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
  parseDiagnosticsSummary?: ParseDiagnosticsSummary;
};

export type TimelineFindingsExportBundle = {
  timelineTxt: string;
  timelineMarkdown: string;
  findingsTxt: string;
  findingsMarkdown: string;
};

export type ParseDiagnosticsThresholdPolicy = {
  severity: "warning" | "blocker";
  blockExport?: boolean;
  thresholds: Partial<Record<ParseDiagnostic["code"] | "TOTAL", number>>;
};

export type RunJobCheckInput = {
  ast: ProgramAst;
  initialState?: Record<string, number>;
  advisorOptions?: ProgramAdvisorOptions;
  simulationLimits?: Partial<SimulatorLimits>;
  policyPreset?: JobCheckPolicyPreset;
  simulationFindingPolicy?: SimulationFindingPolicyOverride;
  exportBlockingPolicy?: ExportBlockingPolicyOverride;
  parseDiagnosticsPolicy?: ParseDiagnosticsThresholdPolicy;
  /**
   * Per-rule enable/disable for lint issues that carry a stable `code`
   * (controller-grammar `CG_*`, profile `haas.*` / `fanuc.*`, declarative).
   */
  rulePolicy?: RulePolicy;
  /**
   * Optional profile rule docs used to attach missing `code`s to profile-lint
   * issues before `rulePolicy` is applied.
   */
  profileRuleDocs?: ProfileRuleDoc[];
  exportOptions?: {
    enabled: boolean;
    allowExportWithBlockers?: boolean;
    baseDirectory: string;
    baseName?: string;
  };
  profileLintIssues?: LintIssue[];
};

export type ParseDiagnosticsSummary = {
  total: number;
  byCode: Record<string, number>;
  /**
   * Severity sub-counts per code. Append-only field added with the schema-v3
   * envelope wave; older consumers can ignore it. When defined,
   * `bySeverity[c].warnings + .errors === byCode[c]` for every code `c`.
   */
  bySeverity?: Record<string, { warnings: number; errors: number }>;
  topCodes: string[];
};

export type ParseDiagnosticsPolicyBreach = {
  key: string;
  observed: number;
  threshold: number;
  severity: "warning" | "blocker";
  firstBlockIndex?: number;
};

export type LintIssueProvenanceSource = LintIssueProvenance["source"];

export type LintIssuesSummary = {
  total: number;
  blockers: number;
  warnings: number;
  bySource: Partial<Record<LintIssueProvenanceSource, number>>;
  /**
   * Severity sub-counts per source. Append-only field added with the
   * setup-sheet histogram wave; older consumers can ignore it. When defined,
   * `bySourceSeverity[s].blockers + .warnings === bySource[s]` for every
   * source `s` in `bySource`.
   */
  bySourceSeverity?: Partial<
    Record<LintIssueProvenanceSource, { blockers: number; warnings: number }>
  >;
  topSources: LintIssueProvenanceSource[];
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
  parseDiagnosticsSummary: ParseDiagnosticsSummary;
  parseDiagnosticsPolicyBreaches: ParseDiagnosticsPolicyBreach[];
  lintIssues: LintIssueWithProvenance[];
  lintIssuesSummary: LintIssuesSummary;
  /**
   * Min `blockIndex` per parse-diagnostic `code` from the parsed AST.
   * Empty when the program has no parse diagnostics.
   */
  parseDiagnosticsFirstBlockIndexByCode: Record<string, number>;
};
