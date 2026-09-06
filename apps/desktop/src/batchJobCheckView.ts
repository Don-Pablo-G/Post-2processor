import {
  BATCH_INPUT_EXTENSIONS,
  buildBatchEnvelope,
  buildBatchExportManifest,
  buildBatchFixTemplateCandidates,
  buildJobCheckEnvelope,
  buildSetupSheetPdf,
  classifyBatchRelativePath,
  CLI_SCHEMA_VERSION,
  createStoreZip,
  createZip,
  formatBatchAggregationsAsCsv,
  formatBatchExportManifest,
  formatBatchFixCandidatesAsSarifLite,
  type BatchExportManifest,
  type BatchFixCandidateRow,
  type CliBatchEnvelope,
  type CliBatchWalk,
  type CliBatchParseDiagnosticsPolicyBreachesAggregation,
  type CliBatchSafetyFindingsByCodeAggregation,
  type RunJobCheckResult
} from "@cnc/core/browser";
import {
  buildIdeBatchPatchedPrograms,
  buildIdeBatchQuickFixPreviews,
  type IdeBatchQuickFixPreview
} from "@cnc/ide-bridge";

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
  runResults: Array<{ input: string; source: string; result: RunJobCheckResult }>;
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
  const runResults: Array<{ input: string; source: string; result: RunJobCheckResult }> = [];
  for (const file of files) {
    const result = await runOne(file.source);
    const envelope = buildJobCheckEnvelope(result);
    entries.push({
      schemaVersion: CLI_SCHEMA_VERSION,
      input: file.input,
      envelope
    });
    runResults.push({ input: file.input, source: file.source, result });
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
  const exportPart =
    walk.export?.outDir || walk.export?.setupSheetPdfDir || walk.export?.batchExportZip
      ? ` export outDir=${walk.export.outDir ?? "-"} pdf=${walk.export.setupSheetPdfDir ?? "-"}${
          walk.export.batchExportZip ? " zip=yes" : ""
        }`
      : "";
  return `batch-walk: matched=${walk.matched} skipped=${walk.skipped}${
    walk.recursive ? " recursive" : ""
  }${exportPart}`;
}

export function formatDesktopBatchBlockReasonsChip(envelope: CliBatchEnvelope): string {
  const rows = envelope.summary.blockReasonsAggregated ?? [];
  if (rows.length === 0) return "batch-block-reasons: none";
  const top = rows
    .slice(0, 3)
    .map((r) => {
      const codes =
        r.matchedCodes && r.matchedCodes.length > 0 ? `[${r.matchedCodes.slice(0, 2).join(",")}]` : "";
      return `${r.reason}${codes}×${r.count}`;
    })
    .join(", ");
  const safetyCodes = envelope.summary.safetyBlockerCodesAggregated;
  const safetyPart =
    safetyCodes && safetyCodes.length > 0
      ? ` | safetyCodes=${safetyCodes.slice(0, 3).join(",")}`
      : "";
  return `batch-block-reasons: ${top}${safetyPart}`;
}

/**
 * Schema v20–v22: CSV export of safety + policy-breach + controller + parse-diag
 * aggregated dashboard rows. Delegates to shared `@cnc/core` formatter.
 */
export function formatDesktopBatchAggregationsAsCsv(envelope: CliBatchEnvelope): string {
  return formatBatchAggregationsAsCsv(envelope);
}

export type DesktopBatchQuickFixPreview = IdeBatchQuickFixPreview;

/**
 * Schema v20–v25: preview expanded safety + controller + parse-diag templates.
 * Delegates to `@cnc/ide-bridge` shared builder.
 */
export function buildDesktopBatchQuickFixPreviews(
  envelope: CliBatchEnvelope,
  sourcesByInput: ReadonlyMap<string, string> = new Map(),
  options?: { strict?: boolean }
): DesktopBatchQuickFixPreview[] {
  return buildIdeBatchQuickFixPreviews(envelope, sourcesByInput, options);
}

export function formatDesktopBatchQuickFixPreviewChip(
  previews: readonly DesktopBatchQuickFixPreview[]
): string {
  if (previews.length === 0) return "batch-fix-preview: none";
  const unbound = previews.filter((p) => p.unbound).length;
  const top = previews
    .slice(0, 2)
    .map((p) => p.code)
    .join(",");
  return `batch-fix-preview: fixes=${previews.length} unbound=${unbound} | top=${top || "n/a"}`;
}

/** Schema v23: chip summarizing unbound (still-templated) fix previews. */
export function formatDesktopBatchUnboundFixChip(
  previews: readonly DesktopBatchQuickFixPreview[]
): string {
  const unbound = previews.filter((p) => p.unbound);
  if (unbound.length === 0) return "batch-unbound-fixes: none";
  const top = unbound
    .slice(0, 3)
    .map((p) => p.code)
    .join(",");
  return `batch-unbound-fixes: ${unbound.length} | top=${top || "n/a"}`;
}

/**
 * Schema v24: clipboard payload concatenating patched NC bodies with separators.
 */
export function formatDesktopBatchPatchedProgramsForClipboard(
  items: readonly BatchDownloadItem[]
): string {
  if (items.length === 0) return "";
  return items
    .map((item) => `===== ${item.filename} =====\n${String(item.body)}`)
    .join("\n\n");
}

/**
 * Schema v24: SARIF-lite from true unbound previews when available; otherwise
 * catalogue template-placeholder candidates from the envelope.
 */
export function formatDesktopBatchUnboundFixesAsSarifLite(
  envelope: CliBatchEnvelope,
  previews: readonly DesktopBatchQuickFixPreview[] = []
): string {
  const unbound = previews.filter((p) => p.unbound);
  const rows: BatchFixCandidateRow[] =
    unbound.length > 0
      ? unbound.map((p) => ({
          input: p.input,
          code: p.code,
          kind: (p.kind ?? "safety") as BatchFixCandidateRow["kind"],
          title: p.title,
          reason: "unbound_after_expand" as const,
          ...(p.firstBlockIndex !== undefined ? { firstBlockIndex: p.firstBlockIndex } : {}),
          ...(p.expanded !== undefined ? { replacementTemplate: p.expanded } : {})
        }))
      : buildBatchFixTemplateCandidates(envelope);
  return formatBatchFixCandidatesAsSarifLite(rows, {
    schemaVersion: envelope.schemaVersion
  });
}

export function formatDesktopBatchQuickFixPreviewsForExport(
  previews: readonly DesktopBatchQuickFixPreview[]
): string {
  return JSON.stringify(previews, null, 2);
}

/**
 * Schema v21–v25: apply expanded fix templates into program sources.
 * Delegates to `@cnc/ide-bridge` shared builder.
 */
export function buildDesktopBatchPatchedPrograms(
  envelope: CliBatchEnvelope,
  sourcesByInput: ReadonlyMap<string, string>,
  options?: { strict?: boolean }
): BatchDownloadItem[] {
  return buildIdeBatchPatchedPrograms(envelope, sourcesByInput, options).map((item) => ({
    filename: item.filename,
    body: item.body,
    mimeType: "text/plain;charset=utf-8"
  }));
}

export function formatDesktopBatchPatchedProgramsChip(
  items: readonly BatchDownloadItem[]
): string {
  if (items.length === 0) return "batch-patched: none";
  return `batch-patched: files=${items.length}`;
}

/** Schema v25: chip summarizing SARIF template-candidate / unbound count. */
export function formatDesktopBatchSarifChip(envelope: CliBatchEnvelope): string {
  const candidates = buildBatchFixTemplateCandidates(envelope).length;
  const sarifPath = envelope.summary.batchWalk?.export?.batchUnboundSarif;
  if (candidates === 0 && !sarifPath) return "batch-sarif: none";
  return `batch-sarif: candidates=${candidates}${sarifPath ? " written" : ""}`;
}

/** Schema v25: chip summarizing zip / export artifact inventory. */
export function formatDesktopBatchExportInventoryChip(envelope: CliBatchEnvelope): string {
  const exp = envelope.summary.batchWalk?.export;
  if (!exp) return "batch-export: none";
  const parts: string[] = [];
  if (exp.outDir) parts.push("outDir");
  if (exp.setupSheetPdfDir) parts.push("pdf");
  if (exp.setupPdfCount !== undefined) parts.push(`setupPdf=${exp.setupPdfCount}`);
  if (exp.setupTxtCount !== undefined) parts.push(`setupTxt=${exp.setupTxtCount}`);
  if (exp.setupTxtDir) parts.push("setupTxtDir");
  if (exp.batchExportZip) parts.push("zip");
  if (exp.batchUnboundSarif) parts.push("sarif");
  if (exp.fixPreviewCount !== undefined) parts.push(`fixPreviews=${exp.fixPreviewCount}`);
  else if (exp.fixPreviewsPath) parts.push("fixPreviews");
  if (exp.patchedNcCount !== undefined) parts.push(`patched=${exp.patchedNcCount}`);
  if (exp.patchedNcDir) parts.push("patchedDir");
  if (exp.exportManifestPath) parts.push("manifest");
  if (exp.writtenFileCount !== undefined) parts.push(`written=${exp.writtenFileCount}`);
  if (exp.zipEntryCount !== undefined) parts.push(`zipEntries=${exp.zipEntryCount}`);
  if (exp.zipSha256) parts.push(`zipSha=${exp.zipSha256.slice(0, 8)}`);
  return parts.length === 0 ? "batch-export: none" : `batch-export: ${parts.join(",")}`;
}

/**
 * Schema v21–v22: pack PDF / TXT / envelope / patched items into one ZIP.
 * Defaults to STORE; pass `compression: "deflate"` for native DEFLATE when
 * available (falls back to STORE per entry).
 */
export async function buildDesktopBatchArchiveZip(
  items: ReadonlyArray<BatchDownloadItem | BatchPdfDownloadItem>,
  options?: { compression?: "store" | "deflate" }
): Promise<Uint8Array> {
  const entries = items.map((item) => ({
    path: item.filename,
    data: "bytes" in item ? item.bytes : item.body
  }));
  if (options?.compression === "deflate") {
    return createZip(entries, { method: "deflate" });
  }
  return createStoreZip(entries);
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

/**
 * Schema v30–v31: client-side export manifest for desktop zip parity with CLI.
 */
export function buildDesktopBatchExportManifest(
  paths: ReadonlyArray<string | { path: string; bytes?: number }>,
  options?: {
    outDir?: string;
    writtenFileCount?: number;
    zipEntryCount?: number;
    zipSha256?: string;
  }
): BatchExportManifest {
  return buildBatchExportManifest(paths, {
    schemaVersion: CLI_SCHEMA_VERSION,
    ...options
  });
}

export function formatDesktopBatchExportManifest(manifest: BatchExportManifest): string {
  return formatBatchExportManifest(manifest);
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
