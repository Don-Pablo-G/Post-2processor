export type JobCheckPolicyPreset = "strict" | "balanced" | "permissive";
export type ControllerProfileKey = "haas-ngc" | "haas-legacy" | "fanuc";

export type PolicyPresetHintState = {
  persistedPreset?: JobCheckPolicyPreset;
  currentPreset: JobCheckPolicyPreset;
  isPersistedActive: boolean;
  hasUnsavedOverride: boolean;
  source: "saved" | "bootstrap" | "manual";
};

export type PolicyPresetActionState = {
  showSaveActions: boolean;
  canSaveAndRun: boolean;
  canRevertToControllerDefault: boolean;
};

export type PolicyPresetShortcutAction = "none" | "revert_to_default" | "save_and_run";
export type PolicyPresetVisualState = {
  showHelpTooltipIcon: boolean;
  highlightManualSource: boolean;
};
export type PolicyUiEventEmissionDecision = {
  emit: boolean;
};
export type SetupSheetPolicyContextBundle = {
  printable80mm: string;
  exportTxt: string;
  exportMarkdown: string;
};

export function resolvePolicyPresetHintState(input: {
  persistedPreset?: JobCheckPolicyPreset;
  currentPreset: JobCheckPolicyPreset;
  manuallySet?: boolean;
}): PolicyPresetHintState {
  const isPersistedActive = input.persistedPreset !== undefined && input.persistedPreset === input.currentPreset;
  const hasUnsavedOverride = input.persistedPreset !== undefined && input.persistedPreset !== input.currentPreset;
  const source: PolicyPresetHintState["source"] =
    input.manuallySet ? "manual" : input.persistedPreset !== undefined ? "saved" : "bootstrap";
  return {
    persistedPreset: input.persistedPreset,
    currentPreset: input.currentPreset,
    isPersistedActive,
    hasUnsavedOverride,
    source
  };
}

export function defaultPolicyPresetForController(profile: ControllerProfileKey): JobCheckPolicyPreset {
  // Fanuc defaults to strict on first use; Haas modes stay balanced.
  return profile === "fanuc" ? "strict" : "balanced";
}

export function derivePolicyPresetActionState(state: PolicyPresetHintState): PolicyPresetActionState {
  return {
    showSaveActions: state.hasUnsavedOverride,
    canSaveAndRun: state.hasUnsavedOverride,
    canRevertToControllerDefault: state.source !== "bootstrap"
  };
}

export function resolvePolicyPresetShortcutAction(input: {
  key: string;
  ctrlKey: boolean;
  shiftKey: boolean;
  isTypingContext: boolean;
}): PolicyPresetShortcutAction {
  if (!(input.ctrlKey && input.shiftKey) || input.isTypingContext) return "none";
  const key = input.key.toLowerCase();
  if (key === "r") return "revert_to_default";
  if (key === "j") return "save_and_run";
  return "none";
}

export function derivePolicyDriftWarning(input: {
  previousController?: ControllerProfileKey;
  nextController: ControllerProfileKey;
  manuallySet: boolean;
  warningPrefix: string;
}): string {
  if (!input.previousController || input.previousController === input.nextController || !input.manuallySet) return "";
  return `${input.warningPrefix}: ${input.previousController} -> ${input.nextController}`;
}

export function derivePolicyPresetVisualState(state: PolicyPresetHintState): PolicyPresetVisualState {
  return {
    showHelpTooltipIcon: true,
    highlightManualSource: state.source === "manual"
  };
}

export function derivePolicyUiEventEmissionDecision(enabled: boolean): PolicyUiEventEmissionDecision {
  return { emit: enabled };
}

export type PolicyUiEventExtras = {
  code?: string;
  blockIndex?: number;
  fixCount?: number;
  count?: number;
  severities?: string;
};

export type PolicyUiEventDetail = {
  controller: ControllerProfileKey;
  preset: JobCheckPolicyPreset;
  source: "saved" | "bootstrap" | "manual";
};

export type PolicyUiEventPayloadV1 = {
  schemaVersion: 1;
  event: string;
  controller: ControllerProfileKey;
  preset: JobCheckPolicyPreset;
  source: "saved" | "bootstrap" | "manual";
  timestampIso: string;
};

export type PolicyUiEventPayloadV2 = {
  schemaVersion: 2;
  event: string;
  controller: ControllerProfileKey;
  preset: JobCheckPolicyPreset;
  source: "saved" | "bootstrap" | "manual";
  timestampIso: string;
  extras: {
    code?: string;
    blockIndex?: number;
    fixCount?: number;
    count?: number;
    severities?: string;
  };
};

export type PolicyUiEventPayload = PolicyUiEventPayloadV1 | PolicyUiEventPayloadV2;

export type PolicyAuditTrailEntry = {
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
};

export function formatPolicyAuditTrailRow(entry: PolicyAuditTrailEntry): string {
  const base = `AUDIT | ${entry.timestampIso} | event=${entry.event} preset=${entry.preset} source=${entry.source} controller=${entry.controller}`;
  const extras: string[] = [];
  if (entry.code !== undefined) extras.push(`code=${entry.code}`);
  if (entry.blockIndex !== undefined) extras.push(`block=${entry.blockIndex}`);
  if (entry.fixCount !== undefined) extras.push(`fix=${entry.fixCount}`);
  if (entry.count !== undefined) extras.push(`count=${entry.count}`);
  if (entry.severities !== undefined) extras.push(`severities=${entry.severities}`);
  if (extras.length === 0) return base;
  return `${base} | ${extras.join(" | ")}`;
}

export function formatPolicyAuditTrailPayload(
  entries: PolicyAuditTrailEntry[],
  options: { limit?: number } = {}
): { payload: string; rowCount: number } {
  const limit = options.limit ?? 30;
  const slice = entries.slice(0, Math.max(0, limit));
  return {
    payload: slice.map(formatPolicyAuditTrailRow).join("\n"),
    rowCount: slice.length
  };
}

export function formatPolicyAuditTrailFilteredPayload(
  entries: PolicyAuditTrailEntry[],
  predicate: (entry: PolicyAuditTrailEntry) => boolean,
  options: { limit?: number } = {}
): { payload: string; rowCount: number } {
  const limit = options.limit ?? 30;
  const filtered = entries.filter(predicate);
  const slice = filtered.slice(0, Math.max(0, limit));
  return {
    payload: slice.map(formatPolicyAuditTrailRow).join("\n"),
    rowCount: slice.length
  };
}

export type AuditTrailExportFormat = "text" | "markdown" | "csv" | "ndjson";

export const AUDIT_TRAIL_EXPORT_FORMATS: ReadonlyArray<AuditTrailExportFormat> = [
  "text",
  "markdown",
  "csv",
  "ndjson"
];

export function isAuditTrailExportFormat(value: unknown): value is AuditTrailExportFormat {
  return (
    value === "text" || value === "markdown" || value === "csv" || value === "ndjson"
  );
}

const AUDIT_TRAIL_MARKDOWN_HEADER =
  "| Time | Event | Preset | Source | Controller | Extras |";
const AUDIT_TRAIL_MARKDOWN_SEPARATOR =
  "| --- | --- | --- | --- | --- | --- |";

const AUDIT_TRAIL_CSV_HEADER =
  "time,event,preset,source,controller,code,blockIndex,fixCount,count,severities";

function formatAuditTrailExtrasMarkdown(entry: PolicyAuditTrailEntry): string {
  const extras: string[] = [];
  if (entry.code !== undefined) extras.push(`code=${entry.code}`);
  if (entry.blockIndex !== undefined) extras.push(`block=${entry.blockIndex}`);
  if (entry.fixCount !== undefined) extras.push(`fix=${entry.fixCount}`);
  if (entry.count !== undefined) extras.push(`count=${entry.count}`);
  if (entry.severities !== undefined) extras.push(`severities=${entry.severities}`);
  if (extras.length === 0) return "";
  return extras.join(" \\| ");
}

function escapeCsvField(value: string | number | undefined): string {
  if (value === undefined) return "";
  const text = typeof value === "number" ? String(value) : value;
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function formatAuditTrailMarkdownRow(entry: PolicyAuditTrailEntry): string {
  return `| ${entry.timestampIso} | ${entry.event} | ${entry.preset} | ${entry.source} | ${entry.controller} | ${formatAuditTrailExtrasMarkdown(entry)} |`;
}

function formatAuditTrailCsvRow(entry: PolicyAuditTrailEntry): string {
  return [
    escapeCsvField(entry.timestampIso),
    escapeCsvField(entry.event),
    escapeCsvField(entry.preset),
    escapeCsvField(entry.source),
    escapeCsvField(entry.controller),
    escapeCsvField(entry.code),
    escapeCsvField(entry.blockIndex),
    escapeCsvField(entry.fixCount),
    escapeCsvField(entry.count),
    escapeCsvField(entry.severities)
  ].join(",");
}

function formatAuditTrailNdjsonLine(entry: PolicyAuditTrailEntry): string {
  return JSON.stringify({
    timestampIso: entry.timestampIso,
    event: entry.event,
    preset: entry.preset,
    source: entry.source,
    controller: entry.controller,
    ...(entry.code !== undefined ? { code: entry.code } : {}),
    ...(entry.blockIndex !== undefined ? { blockIndex: entry.blockIndex } : {}),
    ...(entry.fixCount !== undefined ? { fixCount: entry.fixCount } : {}),
    ...(entry.count !== undefined ? { count: entry.count } : {}),
    ...(entry.severities !== undefined ? { severities: entry.severities } : {})
  });
}

export function selectPolicyAuditTrailExportPayload(
  entries: ReadonlyArray<PolicyAuditTrailEntry>,
  options: {
    format?: AuditTrailExportFormat;
    limit?: number;
    categoryFilter?: PolicyAuditTrailCategory;
  } = {}
): { payload: string; rowCount: number } {
  const format = options.format ?? "text";
  const limit = options.limit ?? 30;
  const filtered =
    options.categoryFilter && options.categoryFilter !== "all"
      ? filterPolicyAuditTrailByCategory(entries, options.categoryFilter)
      : [...entries];
  const slice = filtered.slice(0, Math.max(0, limit));
  if (slice.length === 0) {
    if (format === "markdown") {
      return {
        payload: [AUDIT_TRAIL_MARKDOWN_HEADER, AUDIT_TRAIL_MARKDOWN_SEPARATOR].join("\n"),
        rowCount: 0
      };
    }
    if (format === "csv") {
      return { payload: AUDIT_TRAIL_CSV_HEADER, rowCount: 0 };
    }
    return { payload: "", rowCount: 0 };
  }
  if (format === "markdown") {
    return {
      payload: [
        AUDIT_TRAIL_MARKDOWN_HEADER,
        AUDIT_TRAIL_MARKDOWN_SEPARATOR,
        ...slice.map(formatAuditTrailMarkdownRow)
      ].join("\n"),
      rowCount: slice.length
    };
  }
  if (format === "csv") {
    return {
      payload: [AUDIT_TRAIL_CSV_HEADER, ...slice.map(formatAuditTrailCsvRow)].join("\n"),
      rowCount: slice.length
    };
  }
  if (format === "ndjson") {
    return {
      payload: slice.map(formatAuditTrailNdjsonLine).join("\n"),
      rowCount: slice.length
    };
  }
  return {
    payload: slice.map(formatPolicyAuditTrailRow).join("\n"),
    rowCount: slice.length
  };
}

export function isParseOrLintAuditEvent(entry: PolicyAuditTrailEntry): boolean {
  return entry.event.startsWith("parse_") || entry.event.startsWith("lint_");
}

export type PolicyAuditTrailEntryWithHydration = PolicyAuditTrailEntry & {
  hydratedFromTemplate?: boolean;
};

export type PolicyAuditTrailSummary = {
  total: number;
  hydrated: number;
  parseLint: number;
  resetEvents: number;
};

export function summarizePolicyAuditTrail(
  entries: ReadonlyArray<PolicyAuditTrailEntryWithHydration>
): PolicyAuditTrailSummary {
  let hydrated = 0;
  let parseLint = 0;
  let resetEvents = 0;
  for (const entry of entries) {
    if (entry.hydratedFromTemplate) hydrated += 1;
    if (isParseOrLintAuditEvent(entry)) parseLint += 1;
    if (entry.event.includes("reset")) resetEvents += 1;
  }
  return {
    total: entries.length,
    hydrated,
    parseLint,
    resetEvents
  };
}

export type PolicyAuditTrailCategory = "all" | "parse_lint" | "reset" | "policy";

export function classifyPolicyAuditTrailEntry(
  entry: PolicyAuditTrailEntry
): Exclude<PolicyAuditTrailCategory, "all"> {
  if (isParseOrLintAuditEvent(entry)) return "parse_lint";
  if (entry.event.includes("reset")) return "reset";
  return "policy";
}

export function filterPolicyAuditTrailByCategory<T extends PolicyAuditTrailEntry>(
  entries: ReadonlyArray<T>,
  category: PolicyAuditTrailCategory
): T[] {
  if (category === "all") return [...entries];
  return entries.filter((entry) => classifyPolicyAuditTrailEntry(entry) === category);
}

export type PersistedAuditEntry = PolicyAuditTrailEntry;

export const AUDIT_TRAIL_PERSIST_LIMIT = 10;

export function selectPersistableAuditEntries(
  entries: ReadonlyArray<PolicyAuditTrailEntry>,
  limit: number = AUDIT_TRAIL_PERSIST_LIMIT
): PersistedAuditEntry[] {
  if (limit <= 0) return [];
  return entries.slice(0, limit).map((entry) => ({
    timestampIso: entry.timestampIso,
    event: entry.event,
    preset: entry.preset,
    source: entry.source,
    controller: entry.controller,
    ...(entry.code !== undefined ? { code: entry.code } : {}),
    ...(entry.blockIndex !== undefined ? { blockIndex: entry.blockIndex } : {}),
    ...(entry.fixCount !== undefined ? { fixCount: entry.fixCount } : {}),
    ...(entry.count !== undefined ? { count: entry.count } : {}),
    ...(entry.severities !== undefined ? { severities: entry.severities } : {})
  }));
}

const VALID_AUDIT_PRESETS: ReadonlyArray<JobCheckPolicyPreset> = ["strict", "balanced", "permissive"];
const VALID_AUDIT_SOURCES: ReadonlyArray<PolicyAuditTrailEntry["source"]> = [
  "saved",
  "bootstrap",
  "manual"
];
const VALID_AUDIT_CONTROLLERS: ReadonlyArray<ControllerProfileKey> = [
  "haas-ngc",
  "haas-legacy",
  "fanuc"
];

function isValidAuditEntry(value: unknown): value is PersistedAuditEntry {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<PersistedAuditEntry>;
  if (typeof candidate.timestampIso !== "string") return false;
  if (typeof candidate.event !== "string") return false;
  if (!candidate.preset || !VALID_AUDIT_PRESETS.includes(candidate.preset)) return false;
  if (!candidate.source || !VALID_AUDIT_SOURCES.includes(candidate.source)) return false;
  if (!candidate.controller || !VALID_AUDIT_CONTROLLERS.includes(candidate.controller)) return false;
  if (candidate.code !== undefined && typeof candidate.code !== "string") return false;
  if (candidate.blockIndex !== undefined && typeof candidate.blockIndex !== "number") return false;
  if (candidate.fixCount !== undefined && typeof candidate.fixCount !== "number") return false;
  if (candidate.count !== undefined && typeof candidate.count !== "number") return false;
  if (candidate.severities !== undefined && typeof candidate.severities !== "string") return false;
  return true;
}

export function hydrateAuditEntriesFromTemplate(
  parsed: unknown,
  limit: number = AUDIT_TRAIL_PERSIST_LIMIT
): PersistedAuditEntry[] {
  if (!parsed || typeof parsed !== "object") return [];
  const settings = (parsed as { settings?: { auditTrailRecent?: unknown } }).settings;
  const list = settings?.auditTrailRecent;
  if (!Array.isArray(list)) return [];
  const valid = list.filter(isValidAuditEntry);
  return valid.slice(0, Math.max(0, limit));
}

export function buildPolicyUiEventPayload(input: {
  event: string;
  detail: PolicyUiEventDetail;
  timestampIso: string;
  extras?: PolicyUiEventExtras;
}): PolicyUiEventPayload {
  const hasExtras =
    !!input.extras &&
    (input.extras.code !== undefined ||
      input.extras.blockIndex !== undefined ||
      input.extras.fixCount !== undefined ||
      input.extras.count !== undefined ||
      input.extras.severities !== undefined);
  if (!hasExtras) {
    return {
      schemaVersion: 1,
      event: input.event,
      controller: input.detail.controller,
      preset: input.detail.preset,
      source: input.detail.source,
      timestampIso: input.timestampIso
    };
  }
  const extras: PolicyUiEventPayloadV2["extras"] = {};
  if (input.extras!.code !== undefined) extras.code = input.extras!.code;
  if (input.extras!.blockIndex !== undefined) extras.blockIndex = input.extras!.blockIndex;
  if (input.extras!.fixCount !== undefined) extras.fixCount = input.extras!.fixCount;
  if (input.extras!.count !== undefined) extras.count = input.extras!.count;
  if (input.extras!.severities !== undefined) extras.severities = input.extras!.severities;
  return {
    schemaVersion: 2,
    event: input.event,
    controller: input.detail.controller,
    preset: input.detail.preset,
    source: input.detail.source,
    timestampIso: input.timestampIso,
    extras
  };
}

export function addPolicyPresetContextToSetupSheetBundle(
  sheet: SetupSheetPolicyContextBundle,
  preset: JobCheckPolicyPreset,
  source: "saved" | "bootstrap" | "manual",
  controller: ControllerProfileKey
): SetupSheetPolicyContextBundle {
  const contextBlockTxt = [
    "",
    "=== POLICY CONTEXT ===",
    `policyPreset: ${preset}`,
    `policyPresetSource: ${source}`,
    `controller: ${controller}`
  ].join("\n");
  const contextBlockMd = [
    "",
    "### Policy Context",
    `- Policy preset: \`${preset}\``,
    `- Policy preset source: \`${source}\``,
    `- Controller: \`${controller}\``
  ].join("\n");
  return {
    printable80mm: `${sheet.printable80mm}${contextBlockTxt}`,
    exportTxt: `${sheet.exportTxt}${contextBlockTxt}`,
    exportMarkdown: `${sheet.exportMarkdown}${contextBlockMd}`
  };
}
