import {
  BATCH_INPUT_EXTENSIONS,
  buildBatchEnvelope,
  buildJobCheckEnvelope,
  buildSetupSheetPdf,
  classifyBatchRelativePath,
  CLI_SCHEMA_VERSION,
  createStoreZip,
  createZip,
  formatBatchAggregationsAsCsv,
  getControllerGrammarFix,
  getParseDiagnosticFix,
  getSafetyFindingFix,
  type CliBatchEnvelope,
  type CliBatchWalk,
  type CliBatchParseDiagnosticsPolicyBreachesAggregation,
  type CliBatchSafetyFindingsByCodeAggregation,
  type RunJobCheckResult
} from "@cnc/core/browser";
import {
  applyIdeQuickFixEdits,
  deriveControllerGrammarFixBindings,
  deriveParseDiagnosticFixBindings,
  deriveSafetyFindingFixBindings,
  expandIdeQuickFixTemplate,
  resolveQuickFixSpan
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

export type DesktopBatchQuickFixPreview = {
  input: string;
  code: string;
  title: string;
  /** Schema v22–v23: which catalogue produced this preview. */
  kind?: "safety" | "controller" | "parse-diag";
  expanded?: string;
  unbound?: boolean;
  firstBlockIndex?: number;
};

function expandPreviewTemplate(
  qf: { replacementTemplate?: string; code: string; title: string; rationale: string },
  bindings: Readonly<Record<string, string>>,
  options?: { strict?: boolean }
): { expanded?: string; unbound?: boolean } {
  if (qf.replacementTemplate === undefined) return {};
  let expanded: string | undefined;
  let unbound = false;
  try {
    expanded = expandIdeQuickFixTemplate(qf, bindings, { strict: options?.strict });
  } catch {
    unbound = true;
    expanded = expandIdeQuickFixTemplate(qf, bindings);
  }
  if (options?.strict !== true && expanded && /\{\{[A-Z0-9_]+\}\}/.test(expanded)) {
    unbound = true;
  }
  return {
    ...(expanded !== undefined ? { expanded } : {}),
    ...(unbound ? { unbound: true } : {})
  };
}

/**
 * Schema v20–v22: preview expanded safety + controller-grammar templates for
 * batch attribution rows, using program-source bindings when sources are supplied.
 */
export function buildDesktopBatchQuickFixPreviews(
  envelope: CliBatchEnvelope,
  sourcesByInput: ReadonlyMap<string, string> = new Map(),
  options?: { strict?: boolean }
): DesktopBatchQuickFixPreview[] {
  const out: DesktopBatchQuickFixPreview[] = [];
  const seen = new Set<string>();

  for (const row of envelope.summary.safetyFindingsByCodePerInputFile) {
    const key = `safety::${row.input}::${row.code}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const fix = getSafetyFindingFix(row.code);
    if (!fix) continue;
    const qf = {
      code: fix.code,
      title: fix.title,
      rationale: fix.rationale,
      ...(fix.replacementTemplate !== undefined
        ? { replacementTemplate: fix.replacementTemplate }
        : {})
    };
    const source = sourcesByInput.get(row.input);
    const bindings = deriveSafetyFindingFixBindings({
      code: row.code,
      source,
      blockIndex: row.firstBlockIndex
    });
    const expanded = expandPreviewTemplate(qf, bindings, options);
    out.push({
      input: row.input,
      code: row.code,
      title: fix.title,
      kind: "safety",
      ...(row.firstBlockIndex !== undefined ? { firstBlockIndex: row.firstBlockIndex } : {}),
      ...expanded
    });
  }

  for (const row of envelope.summary.lintIssuesByControllerCodePerInputFile) {
    const key = `controller::${row.input}::${row.code}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const fix = getControllerGrammarFix(row.code);
    if (!fix) continue;
    const qf = {
      code: row.code,
      title: fix.title,
      rationale: fix.rationale,
      ...(fix.replacementTemplate !== undefined
        ? { replacementTemplate: fix.replacementTemplate }
        : {})
    };
    const source = sourcesByInput.get(row.input);
    const bindings = deriveControllerGrammarFixBindings({
      code: row.code,
      source,
      blockIndex: row.firstBlockIndex
    });
    const expanded = expandPreviewTemplate(qf, bindings, options);
    out.push({
      input: row.input,
      code: row.code,
      title: fix.title,
      kind: "controller",
      ...(row.firstBlockIndex !== undefined ? { firstBlockIndex: row.firstBlockIndex } : {}),
      ...expanded
    });
  }

  for (const row of envelope.summary.parseDiagnosticsByCodePerInputFile) {
    const key = `parse-diag::${row.input}::${row.code}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const fix = getParseDiagnosticFix(row.code);
    if (!fix) continue;
    const source = sourcesByInput.get(row.input);
    const bindings = deriveParseDiagnosticFixBindings({
      code: row.code,
      source,
      blockIndex: row.firstBlockIndex
    });
    let expanded: { expanded?: string; unbound?: boolean } = {};
    // Append closers onto the block instead of replacing the block with ")" / "]".
    if (
      (row.code === "UNMATCHED_OPEN_PAREN" || row.code === "UNMATCHED_BRACKET") &&
      bindings.BLOCK
    ) {
      const closer =
        row.code === "UNMATCHED_OPEN_PAREN" ? ")" : (bindings.CLOSER ?? "]");
      expanded = { expanded: `${bindings.BLOCK}${closer}` };
    } else if (row.code === "ADDRESS_MISSING_VALUE" && bindings.LETTER && bindings.BLOCK) {
      const letter = bindings.LETTER;
      const patched = bindings.BLOCK.replace(
        new RegExp(`\\b${letter}\\b(?!\\s*-?\\d)`, "i"),
        `${letter}0`
      );
      expanded =
        patched !== bindings.BLOCK
          ? { expanded: patched }
          : expandPreviewTemplate(
              {
                code: fix.code,
                title: fix.title,
                rationale: fix.rationale,
                ...(fix.replacementTemplate !== undefined
                  ? { replacementTemplate: fix.replacementTemplate }
                  : {})
              },
              bindings,
              options
            );
    } else {
      const qf = {
        code: fix.code,
        title: fix.title,
        rationale: fix.rationale,
        ...(fix.replacementTemplate !== undefined
          ? { replacementTemplate: fix.replacementTemplate }
          : {})
      };
      expanded = expandPreviewTemplate(qf, bindings, options);
    }
    out.push({
      input: row.input,
      code: row.code,
      title: fix.title,
      kind: "parse-diag",
      ...(row.firstBlockIndex !== undefined ? { firstBlockIndex: row.firstBlockIndex } : {}),
      ...expanded
    });
  }

  out.sort((a, b) => {
    if (a.input !== b.input) return a.input.localeCompare(b.input);
    if (a.kind !== b.kind) return (a.kind ?? "").localeCompare(b.kind ?? "");
    return a.code.localeCompare(b.code);
  });
  return out;
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

export function formatDesktopBatchQuickFixPreviewsForExport(
  previews: readonly DesktopBatchQuickFixPreview[]
): string {
  return JSON.stringify(previews, null, 2);
}

/**
 * Schema v21–v22: apply expanded safety + controller-grammar fix templates
 * into program sources (descending offset order). Returns one patched
 * download item per input that received at least one edit.
 */
export function buildDesktopBatchPatchedPrograms(
  envelope: CliBatchEnvelope,
  sourcesByInput: ReadonlyMap<string, string>,
  options?: { strict?: boolean }
): BatchDownloadItem[] {
  const previews = buildDesktopBatchQuickFixPreviews(envelope, sourcesByInput, options);
  const byInput = new Map<string, typeof previews>();
  for (const preview of previews) {
    if (!preview.expanded || preview.unbound) continue;
    if (preview.firstBlockIndex === undefined) continue;
    const list = byInput.get(preview.input) ?? [];
    list.push(preview);
    byInput.set(preview.input, list);
  }
  const items: BatchDownloadItem[] = [];
  for (const [input, inputPreviews] of [...byInput.entries()].sort((a, b) =>
    a[0].localeCompare(b[0])
  )) {
    const source = sourcesByInput.get(input);
    if (source === undefined) continue;
    const edits = [];
    for (const preview of inputPreviews) {
      if (preview.expanded === undefined || preview.firstBlockIndex === undefined) continue;
      const span = resolveQuickFixSpan(source, preview.firstBlockIndex);
      if (!span) continue;
      edits.push({
        startOffset: span.startOffset,
        endOffset: span.endOffset,
        replacement: preview.expanded
      });
    }
    if (edits.length === 0) continue;
    const patched = applyIdeQuickFixEdits(source, edits);
    if (patched.applied === 0) continue;
    items.push({
      filename: `${stemFromInput(input)}.patched.nc`,
      body: patched.source,
      mimeType: "text/plain;charset=utf-8"
    });
  }
  return items;
}

export function formatDesktopBatchPatchedProgramsChip(
  items: readonly BatchDownloadItem[]
): string {
  if (items.length === 0) return "batch-patched: none";
  return `batch-patched: files=${items.length}`;
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
