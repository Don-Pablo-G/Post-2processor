import {
  BATCH_INPUT_EXTENSIONS,
  buildBatchEnvelope,
  buildJobCheckEnvelope,
  buildSetupSheetPdf,
  classifyBatchRelativePath,
  CLI_SCHEMA_VERSION,
  type CliBatchEnvelope,
  type CliBatchWalk,
  type CliBatchParseDiagnosticsPolicyBreachesAggregation,
  type CliBatchSafetyFindingsByCodeAggregation,
  type RunJobCheckResult
} from "@cnc/core/browser";

export type DesktopBatchFilterOptions = {
  recursive?: boolean;
  include?: ReadonlyArray<string> | string;
  exclude?: ReadonlyArray<string> | string;
  /** Display label for `batchWalk.root` (selected folder name). */
  root?: string;
};

export type DesktopBatchFilterResult = {
  matched: Array<{ name: string; relativePath: string; lookupPath: string }>;
  skipped: number;
  batchWalk: CliBatchWalk;
};

export type DesktopBatchJobCheckResult = {
  envelope: CliBatchEnvelope;
  /** Parallel to envelope.results — full job-check payloads for PDF download. */
  runResults: Array<{ input: string; result: RunJobCheckResult }>;
};

function parseGlobList(value: ReadonlyArray<string> | string | undefined): string[] {
  if (value === undefined) return [];
  if (typeof value === "string") {
    return value
      .split(/[,;\n]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }
  return value.map((s) => s.trim()).filter((s) => s.length > 0);
}

/**
 * Strip a shared webkitdirectory root folder segment when every path shares it.
 */
function stripSharedWebkitRoot(relativePaths: string[]): string[] {
  if (relativePaths.length === 0) return relativePaths;
  const partsList = relativePaths.map((p) => p.split(/[/\\]/).filter(Boolean));
  if (!partsList.every((p) => p.length >= 2)) return relativePaths;
  const first = partsList[0]![0]!;
  if (!partsList.every((p) => p[0] === first)) return relativePaths;
  return partsList.map((p) => p.slice(1).join("/"));
}

export function isBatchJobCheckFilename(name: string): boolean {
  return BATCH_INPUT_EXTENSIONS.test(name);
}

export function filterBatchJobCheckFiles(
  files: ReadonlyArray<{ name: string; webkitRelativePath?: string }>,
  options: DesktopBatchFilterOptions = {}
): DesktopBatchFilterResult {
  const recursive = options.recursive ?? false;
  const include = parseGlobList(options.include);
  const exclude = parseGlobList(options.exclude);
  const lookupPaths = files.map((file) => {
    const relativePath =
      typeof file.webkitRelativePath === "string" && file.webkitRelativePath.length > 0
        ? file.webkitRelativePath
        : file.name;
    return relativePath.split(/\\/).join("/");
  });
  const stripped = stripSharedWebkitRoot(lookupPaths);
  const matched: Array<{ name: string; relativePath: string; lookupPath: string }> = [];
  let skipped = 0;
  for (let i = 0; i < files.length; i += 1) {
    const lookupPath = lookupPaths[i]!;
    const relativePath = stripped[i]!;
    const base = relativePath.split("/").pop() ?? files[i]!.name;
    const classification = classifyBatchRelativePath(relativePath, {
      recursive,
      include,
      exclude
    });
    if (classification === "matched") {
      matched.push({ name: base, relativePath, lookupPath });
    } else if (classification === "skipped") {
      skipped += 1;
    }
  }
  matched.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  const root =
    options.root ??
    (lookupPaths[0]?.includes("/") ? lookupPaths[0]!.split("/")[0]! : ".");
  return {
    matched,
    skipped,
    batchWalk: {
      recursive,
      include: [...include],
      exclude: [...exclude],
      matched: matched.length,
      skipped,
      root
    }
  };
}

export async function runDesktopBatchJobCheck(
  files: ReadonlyArray<{ input: string; source: string }>,
  runOne: (source: string) => Promise<RunJobCheckResult>,
  options?: { batchWalk?: CliBatchWalk }
): Promise<DesktopBatchJobCheckResult> {
  const entries = [];
  const runResults: Array<{ input: string; result: RunJobCheckResult }> = [];
  for (const file of files) {
    const result = await runOne(file.source);
    const envelope = buildJobCheckEnvelope(result);
    entries.push({
      schemaVersion: CLI_SCHEMA_VERSION,
      input: file.input,
      envelope
    });
    runResults.push({ input: file.input, result });
  }
  return {
    envelope: buildBatchEnvelope(entries, { batchWalk: options?.batchWalk }),
    runResults
  };
}

export function formatDesktopBatchSummaryChip(envelope: CliBatchEnvelope): string {
  const walk = envelope.summary.batchWalk;
  const safety = envelope.summary.safetyFindingsByCodeAggregated?.length ?? 0;
  const breaches = envelope.summary.parseDiagnosticsPolicyBreachesAggregated?.length ?? 0;
  const walkPart = walk
    ? `, walk matched=${walk.matched} skipped=${walk.skipped}${walk.recursive ? " recursive" : ""}`
    : "";
  return `batch: files=${envelope.summary.files}, blocked=${envelope.summary.blocked}, safetyCodes=${safety}, breachKeys=${breaches}${walkPart}`;
}

export function formatDesktopBatchSummaryForExport(envelope: CliBatchEnvelope): string {
  return JSON.stringify(envelope, null, 2);
}

export function formatDesktopBatchPolicyBreachChip(
  rows: readonly CliBatchParseDiagnosticsPolicyBreachesAggregation[] | undefined
): string {
  const list = [...(rows ?? [])].sort((a, b) => a.key.localeCompare(b.key));
  if (list.length === 0) return "batch-policy-breach: none";
  return `batch-policy-breach: ${list
    .map((b) => `${b.key} (files=${b.count}, obs=${b.totalObserved})`)
    .join(", ")}`;
}

export function formatDesktopBatchSafetyChip(
  rows: readonly CliBatchSafetyFindingsByCodeAggregation[] | undefined
): string {
  const list = rows ?? [];
  if (list.length === 0) return "batch-safety: none";
  const top = list
    .slice(0, 3)
    .map((r) => r.code)
    .join(",");
  return `batch-safety: codes=${list.length} | top=${top || "n/a"}`;
}

export function formatDesktopBatchWalkChip(envelope: CliBatchEnvelope): string {
  const walk = envelope.summary.batchWalk;
  if (!walk) return "batch-walk: none";
  return `batch-walk: matched=${walk.matched} skipped=${walk.skipped}${
    walk.recursive ? " recursive" : ""
  }`;
}

export type BatchDownloadItem = {
  filename: string;
  body: string | Uint8Array;
  mimeType: string;
};

export type BatchPdfDownloadItem = {
  filename: string;
  bytes: Uint8Array;
};

function stemFromInput(input: string): string {
  const base = input.split(/[/\\]/).pop() ?? input;
  return base.replace(/\.(nc|tap|gcode)$/i, "");
}

export function buildDesktopBatchSetupSheetPdfs(
  runResults: ReadonlyArray<{ input: string; result: RunJobCheckResult }>
): BatchPdfDownloadItem[] {
  const items: BatchPdfDownloadItem[] = [];
  for (const { input, result } of runResults) {
    const bytes = buildSetupSheetPdf(result.setupSheet, {
      lintIssuesSummary: result.lintIssuesSummary
    });
    items.push({ filename: `${stemFromInput(input)}.pdf`, bytes });
  }
  return items;
}

export function buildDesktopBatchSetupSheetTxts(
  runResults: ReadonlyArray<{ input: string; result: RunJobCheckResult }>
): BatchDownloadItem[] {
  return runResults.map(({ input, result }) => ({
    filename: `${stemFromInput(input)}.setup.txt`,
    body: result.setupSheet.exportTxt,
    mimeType: "text/plain;charset=utf-8"
  }));
}

export function buildDesktopBatchEnvelopeJsonFiles(
  envelope: CliBatchEnvelope
): BatchDownloadItem[] {
  return envelope.results.map((entry) => ({
    filename: `${stemFromInput(entry.input)}.job-check.json`,
    body: JSON.stringify(entry.envelope, null, 2),
    mimeType: "application/json;charset=utf-8"
  }));
}

export type BatchPdfDownloadEnvironment = {
  createObjectURL: (blob: Blob) => string;
  revokeObjectURL: (url: string) => void;
  createAnchor: () => HTMLAnchorElement;
  scheduleRevoke?: (fn: () => void) => void;
};

function defaultBatchPdfEnv(): BatchPdfDownloadEnvironment {
  return {
    createObjectURL: (blob) => URL.createObjectURL(blob),
    revokeObjectURL: (url) => URL.revokeObjectURL(url),
    createAnchor: () => document.createElement("a"),
    scheduleRevoke: (fn) => {
      queueMicrotask(fn);
    }
  };
}

/**
 * Fire one browser download per item (no zip dependency).
 */
export async function downloadDesktopBatchItems(
  items: ReadonlyArray<BatchDownloadItem | BatchPdfDownloadItem>,
  env: BatchPdfDownloadEnvironment = defaultBatchPdfEnv()
): Promise<{ downloaded: number }> {
  let downloaded = 0;
  for (const item of items) {
    const body = "bytes" in item ? item.bytes : item.body;
    const mimeType = "bytes" in item ? "application/pdf" : item.mimeType;
    const blob = new Blob([body as BlobPart], { type: mimeType });
    const url = env.createObjectURL(blob);
    const anchor = env.createAnchor();
    anchor.href = url;
    anchor.download = item.filename;
    anchor.click();
    if (env.scheduleRevoke) env.scheduleRevoke(() => env.revokeObjectURL(url));
    else env.revokeObjectURL(url);
    downloaded += 1;
  }
  return { downloaded };
}

/**
 * Fire one browser download per PDF (no zip dependency).
 */
export async function downloadDesktopBatchSetupSheetPdfs(
  items: ReadonlyArray<BatchPdfDownloadItem>,
  env: BatchPdfDownloadEnvironment = defaultBatchPdfEnv()
): Promise<{ downloaded: number }> {
  return downloadDesktopBatchItems(items, env);
}
