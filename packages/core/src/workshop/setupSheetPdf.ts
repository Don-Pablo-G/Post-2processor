import type { LintIssueProvenanceSource, LintIssuesSummary, SetupSheet } from "../types.js";
import { applyBidiVisualOrder, applyBidiVisualOrderMultiline, type BidiTextMode } from "./bidiVisualOrder.js";
import {
  EMBEDDED_FONT_DEJAVU_SUBSET_AVAILABLE,
  embeddedFontDejaVuSubsetBase64,
  embeddedFontDejaVuSubsetDescriptor,
  type EmbeddedFontDescriptor
} from "./embeddedFontDejaVuSubset.js";

export type BuildSetupSheetPdfOptions = {
  /**
   * When provided AND the summary has lint issues from at least two distinct
   * sources, the PDF appends a per-source severity histogram block (as filled
   * rectangles) below the text body, mirroring the txt histogram surfaced by
   * `formatLintIssuesSummaryBlock`.
   */
  lintIssuesSummary?: LintIssuesSummary;
  /**
   * Font selection for the emitted PDF. `"helvetica"` (default) uses the
   * built-in Helvetica Type 1 font (no embedding, byte-identical to the
   * pre-Schema-v8 contract for ASCII content; codepoints outside
   * WinAnsiEncoding silently render as `?` in PDF readers). `"dejavu-sans-subset"`
   * embeds the bundled DejaVu Sans subset for diacritics outside WinAnsi
   * (Polish `ł`, `ż`, etc.) — requires the regen workflow in
   * [`scripts/regenerate-dejavu-sans-subset.mjs`](../../../../scripts/regenerate-dejavu-sans-subset.mjs)
   * to have populated [`embeddedFontDejaVuSubset.ts`](./embeddedFontDejaVuSubset.ts);
   * throws a canonical error otherwise.
   */
  embeddedFont?: "helvetica" | "dejavu-sans-subset";
  /**
   * Optional callback invoked once per codepoint that falls outside the
   * active font's supported set. For `embeddedFont: "helvetica"` (default)
   * the supported set is the WinAnsi mapped table (Latin-1 minus a handful
   * of holes — Polish `ł` triggers a warning); for `"dejavu-sans-subset"`
   * the supported set is the bundled subset's `firstChar..lastChar` window
   * (codepoints outside Latin Extended-A trigger a warning).
   *
   * Each warning string is a canonical
   * `cnc-job-check setup-sheet-pdf: codepoint U+<HEX> not in <font>` line.
   * The same codepoint may produce multiple warnings if it appears in
   * multiple text runs — callers that want a deduped set should track
   * `<HEX>` themselves.
   */
  onWarning?: (warning: string) => void;
  /**
   * Bidirectional text handling for shop names in Arabic / Hebrew.
   * `"auto"` (default) reorders RTL-dominant lines for PDF left-to-right glyph
   * placement; `"ltr"` and `"rtl"` force the base direction.
   */
  bidi?: BidiTextMode;
};

const PAGE_WIDTH_PT = 612; // US Letter @ 72 DPI
const PAGE_HEIGHT_PT = 792;
const MARGIN_PT = 54; // 0.75 in
const TITLE_FONT_SIZE = 16;
const BODY_FONT_SIZE = 10;
const LINE_LEADING = 12;
const TITLE_GAP = 18;
const HISTOGRAM_TOP_GAP = 18;
const HISTOGRAM_LABEL_FONT_SIZE = 9;
const HISTOGRAM_BAR_HEIGHT = 10;
const HISTOGRAM_ROW_LEADING = 14;
const HISTOGRAM_MAX_BAR_WIDTH = PAGE_WIDTH_PT - MARGIN_PT * 2 - 200;

// Body region geometry: cursorY starts at PAGE_HEIGHT_PT - MARGIN_PT (738) and the
// title block consumes TITLE_FONT_SIZE + TITLE_GAP (34pt). On continuation pages
// (page 2+), no title is drawn so the body region starts at the margin. Bottom of
// body region is MARGIN_PT (54).
const BODY_REGION_TOP_FIRST_PAGE = PAGE_HEIGHT_PT - MARGIN_PT - TITLE_FONT_SIZE - TITLE_GAP;
const BODY_REGION_TOP_SUBSEQUENT = PAGE_HEIGHT_PT - MARGIN_PT;
const PAGE_FIRST_BODY_CAPACITY = computeBodyCapacity(BODY_REGION_TOP_FIRST_PAGE, MARGIN_PT);
const PAGE_SUBSEQUENT_BODY_CAPACITY = computeBodyCapacity(BODY_REGION_TOP_SUBSEQUENT, MARGIN_PT);

function computeBodyCapacity(topY: number, bottomY: number): number {
  // Baseline of nth body line (0-indexed) = topY - BODY_FONT_SIZE - n*LINE_LEADING.
  // Need that baseline >= bottomY, so 1-indexed count is floor(slack/leading) + 1.
  const slack = topY - BODY_FONT_SIZE - bottomY;
  if (slack < 0) return 0;
  return Math.floor(slack / LINE_LEADING) + 1;
}

const ENVELOPE_SOURCE_ORDER: ReadonlyArray<LintIssueProvenanceSource> = [
  "lexer",
  "expression_parser",
  "controller_grammar",
  "common_lint",
  "profile_lint"
];

/**
 * Build a PDF1.4 byte sequence for a setup sheet. Pure function: no I/O, no
 * Buffer dependency, no new runtime deps. Uses the built-in Helvetica font
 * (one of the 14 PDF standard fonts that every reader bundles — no font
 * embedding needed). When `options.lintIssuesSummary` carries lint issues
 * from at least two distinct sources, a per-source severity histogram is
 * appended as filled rectangles below the text.
 *
 * Output is single-page when the wrapped body + optional histogram fits
 * within US Letter; longer setup sheets paginate automatically (one Page
 * object per chunk, sharing the same Resources dict). Single-page output
 * is byte-identical to the pre-pagination contract — short content paths
 * never gain a `/Count > 1` Pages dict.
 */
export function buildSetupSheetPdf(
  setupSheet: SetupSheet,
  options: BuildSetupSheetPdfOptions = {}
): Uint8Array {
  const fontChoice = options.embeddedFont ?? "helvetica";
  const bidiMode = options.bidi ?? "auto";
  const embeddedFont =
    fontChoice === "dejavu-sans-subset" ? resolveBundledDejaVuSubset() : undefined;

  if (options.onWarning) {
    emitFontWarnings({
      texts: collectWarningTexts(setupSheet, options.lintIssuesSummary),
      fontChoice,
      embeddedFont,
      onWarning: options.onWarning
    });
  }

  const wrapWidthChars = approxCharsForWidth(PAGE_WIDTH_PT - MARGIN_PT * 2, BODY_FONT_SIZE);
  const displayTitle = applyBidiVisualOrder(setupSheet.title, bidiMode);
  const displayExportTxt = applyBidiVisualOrderMultiline(setupSheet.exportTxt, bidiMode);
  const bodyLines: string[] = [];
  for (const raw of displayExportTxt.split("\n")) {
    if (raw.length === 0) {
      bodyLines.push("");
      continue;
    }
    bodyLines.push(...wrapLine(raw, wrapWidthChars));
  }

  const histogramRows = buildHistogramRows(options.lintIssuesSummary);

  const pages = paginateBodyLines(bodyLines, histogramRows.length);
  const contentStreams = pages.map((page, idx) =>
    buildPageContentStream({
      title: idx === 0 ? displayTitle : undefined,
      bodyLines: page.bodyLines,
      histogramRows: page.includeHistogram ? histogramRows : []
    })
  );

  return assemblePdf(contentStreams, embeddedFont);
}

type ResolvedEmbeddedFont = {
  bytes: Uint8Array;
  descriptor: EmbeddedFontDescriptor;
};

/**
 * Look up the bundled DejaVu Sans subset, throwing a canonical error
 * when the regen workflow has not yet populated the bundle module.
 * Surfaces as `Error: cnc-job-check setup-sheet-pdf: ...` so callers
 * can discriminate this contract violation from a generic font error.
 */
function resolveBundledDejaVuSubset(): ResolvedEmbeddedFont {
  if (!EMBEDDED_FONT_DEJAVU_SUBSET_AVAILABLE) {
    throw new Error(
      "cnc-job-check setup-sheet-pdf: embeddedFont: \"dejavu-sans-subset\" requires the bundled subset; run scripts/regenerate-dejavu-sans-subset.mjs to populate packages/core/src/workshop/embeddedFontDejaVuSubset.ts"
    );
  }
  return {
    bytes: decodeBase64(embeddedFontDejaVuSubsetBase64),
    descriptor: embeddedFontDejaVuSubsetDescriptor as EmbeddedFontDescriptor
  };
}

function decodeBase64(b64: string): Uint8Array {
  // Base64 decode that works in both Node (Buffer) and browser (atob)
  // environments without pulling in a polyfill. The setup-sheet path is
  // Node-only today (the workshop facade only resolves to it server-side)
  // but we guard anyway so a future browser bridge stays reachable.
  if (typeof Buffer !== "undefined") {
    const buf = Buffer.from(b64, "base64");
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  }
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

function collectWarningTexts(
  setupSheet: SetupSheet,
  summary: LintIssuesSummary | undefined
): string[] {
  const texts: string[] = [setupSheet.title, setupSheet.exportTxt];
  if (summary?.bySource) {
    for (const source of Object.keys(summary.bySource)) texts.push(source);
  }
  return texts;
}

function emitFontWarnings(args: {
  texts: readonly string[];
  fontChoice: "helvetica" | "dejavu-sans-subset";
  embeddedFont: ResolvedEmbeddedFont | undefined;
  onWarning: (msg: string) => void;
}): void {
  const seen = new Set<number>();
  const supportsCodepoint =
    args.fontChoice === "dejavu-sans-subset" && args.embeddedFont
      ? buildDejaVuSubsetCodepointPredicate(args.embeddedFont.descriptor)
      : isWinAnsiCodepoint;
  const fontName = args.fontChoice === "dejavu-sans-subset" ? "dejavu-sans-subset" : "winansi";
  for (const text of args.texts) {
    for (const ch of text) {
      const cp = ch.codePointAt(0);
      if (cp === undefined) continue;
      if (seen.has(cp)) continue;
      seen.add(cp);
      if (supportsCodepoint(cp)) continue;
      const hex = cp.toString(16).toUpperCase().padStart(4, "0");
      args.onWarning(
        `cnc-job-check setup-sheet-pdf: codepoint U+${hex} not in ${fontName}`
      );
    }
  }
}

function buildDejaVuSubsetCodepointPredicate(
  descriptor: EmbeddedFontDescriptor
): (cp: number) => boolean {
  // The bundled subset covers the half-open range [firstChar, lastChar].
  // Anything outside that window is guaranteed missing; codepoints inside
  // are conservatively reported as present (the subset MAY have holes
  // even within the window — those readers will fall back to .notdef).
  const lo = descriptor.firstChar;
  const hi = descriptor.lastChar;
  return (cp: number) => cp >= lo && cp <= hi;
}

/**
 * Set of Unicode codepoints that PDF's WinAnsiEncoding maps to a glyph
 * (i.e. NOT silently substituted with `?`). Includes the entire
 * printable ASCII range U+0020..U+007E and the WinAnsi high-bit table
 * per PDF 1.4 Appendix D. Notable HOLES that DO trigger a warning:
 * Polish `ł` (U+0142), `Ł` (U+0141), Czech `č` (U+010D), `ř` (U+0159),
 * etc. — all part of Latin Extended-A but outside WinAnsi's mapped set.
 */
const WINANSI_HIGH_BIT_CODEPOINTS = new Set<number>([
  // 0x80-0x9F slots in WinAnsi
  0x20ac, // €
  0x201a, // ‚
  0x0192, // ƒ
  0x201e, // „
  0x2026, // …
  0x2020, // †
  0x2021, // ‡
  0x02c6, // ˆ
  0x2030, // ‰
  0x0160, // Š
  0x2039, // ‹
  0x0152, // Œ
  0x017d, // Ž
  0x2018, // ‘
  0x2019, // ’
  0x201c, // “
  0x201d, // ”
  0x2022, // •
  0x2013, // –
  0x2014, // —
  0x02dc, // ˜
  0x2122, // ™
  0x0161, // š
  0x203a, // ›
  0x0153, // œ
  0x017e, // ž
  0x0178 //  Ÿ
]);

function isWinAnsiCodepoint(cp: number): boolean {
  if (cp >= 0x0020 && cp <= 0x007e) return true;
  if (cp >= 0x00a0 && cp <= 0x00ff) return true;
  return WINANSI_HIGH_BIT_CODEPOINTS.has(cp);
}

type PageLayout = {
  bodyLines: string[];
  includeHistogram: boolean;
};

function paginateBodyLines(bodyLines: string[], histogramRowCount: number): PageLayout[] {
  const pages: PageLayout[] = [];
  let cursor = 0;
  while (cursor < bodyLines.length) {
    const cap = pages.length === 0 ? PAGE_FIRST_BODY_CAPACITY : PAGE_SUBSEQUENT_BODY_CAPACITY;
    pages.push({ bodyLines: bodyLines.slice(cursor, cursor + cap), includeHistogram: false });
    cursor += cap;
  }
  if (pages.length === 0) {
    pages.push({ bodyLines: [], includeHistogram: false });
  }

  if (histogramRowCount > 0) {
    const last = pages[pages.length - 1];
    const isLastFirstPage = pages.length === 1;
    const bodyTopY = isLastFirstPage ? BODY_REGION_TOP_FIRST_PAGE : BODY_REGION_TOP_SUBSEQUENT;
    const cursorAfterBody =
      bodyTopY - BODY_FONT_SIZE - last.bodyLines.length * LINE_LEADING - HISTOGRAM_TOP_GAP;
    const finalCursor =
      cursorAfterBody - HISTOGRAM_LABEL_FONT_SIZE - 6 - histogramRowCount * HISTOGRAM_ROW_LEADING;

    if (finalCursor >= MARGIN_PT) {
      last.includeHistogram = true;
    } else {
      pages.push({ bodyLines: [], includeHistogram: true });
    }
  }

  return pages;
}

type HistogramRow = {
  label: string;
  blockers: number;
  warnings: number;
  total: number;
};

function buildHistogramRows(summary?: LintIssuesSummary): HistogramRow[] {
  if (!summary) return [];
  const bySource = summary.bySource ?? {};
  const sources = ENVELOPE_SOURCE_ORDER.filter((s) => (bySource[s] ?? 0) > 0);
  if (sources.length < 2) return [];
  const bySev = summary.bySourceSeverity ?? {};
  return sources.map((source) => {
    const total = bySource[source] ?? 0;
    const sevEntry = bySev[source];
    const blockers = sevEntry?.blockers ?? 0;
    const warnings = sevEntry?.warnings ?? Math.max(0, total - blockers);
    return { label: source, blockers, warnings, total };
  });
}

function approxCharsForWidth(widthPt: number, fontSize: number): number {
  // Helvetica average glyph advance is ~0.5em.
  const averageGlyphWidth = fontSize * 0.5;
  return Math.max(20, Math.floor(widthPt / averageGlyphWidth));
}

function wrapLine(line: string, maxChars: number): string[] {
  if (line.length <= maxChars) return [line];
  const out: string[] = [];
  let remaining = line;
  while (remaining.length > maxChars) {
    let breakAt = remaining.lastIndexOf(" ", maxChars);
    if (breakAt <= 0) breakAt = maxChars;
    out.push(remaining.slice(0, breakAt));
    remaining = remaining.slice(breakAt).replace(/^ +/, "");
  }
  if (remaining.length > 0) out.push(remaining);
  return out;
}

function escapePdfString(value: string): string {
  // Escape the metacharacters PDF text strings reserve. Strip non-printable
  // bytes (including newlines) which are emitted as separate text-show ops
  // rather than embedded in the literal string.
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[\u0000-\u001f\u007f]/g, "");
}

function buildPageContentStream(args: {
  title?: string;
  bodyLines: string[];
  histogramRows: HistogramRow[];
}): string {
  const { title, bodyLines, histogramRows } = args;
  const out: string[] = [];

  let cursorY = PAGE_HEIGHT_PT - MARGIN_PT;

  if (title !== undefined) {
    out.push("BT");
    out.push(`/F1 ${TITLE_FONT_SIZE} Tf`);
    out.push(`${MARGIN_PT} ${cursorY - TITLE_FONT_SIZE} Td`);
    out.push(`(${escapePdfString(title)}) Tj`);
    out.push("ET");
    cursorY -= TITLE_FONT_SIZE + TITLE_GAP;
  }

  if (bodyLines.length > 0) {
    out.push("BT");
    out.push(`/F1 ${BODY_FONT_SIZE} Tf`);
    out.push(`${LINE_LEADING} TL`);
    out.push(`${MARGIN_PT} ${cursorY - BODY_FONT_SIZE} Td`);
    out.push(`(${escapePdfString(bodyLines[0] ?? "")}) Tj`);
    for (let i = 1; i < bodyLines.length; i += 1) {
      const text = escapePdfString(bodyLines[i]);
      out.push(`T*`);
      if (text.length > 0) {
        out.push(`(${text}) Tj`);
      }
    }
    out.push("ET");
    cursorY -= BODY_FONT_SIZE + bodyLines.length * LINE_LEADING + HISTOGRAM_TOP_GAP;
  }

  if (histogramRows.length > 0) {
    const maxTotal = histogramRows.reduce((m, r) => Math.max(m, r.total), 0) || 1;
    out.push("BT");
    out.push(`/F1 ${HISTOGRAM_LABEL_FONT_SIZE} Tf`);
    out.push(`${MARGIN_PT} ${cursorY - HISTOGRAM_LABEL_FONT_SIZE} Td`);
    out.push(`(Lint issues by source — blockers / warnings) Tj`);
    out.push("ET");
    cursorY -= HISTOGRAM_LABEL_FONT_SIZE + 6;

    for (const row of histogramRows) {
      const labelText = `${row.label}  (${row.blockers}b / ${row.warnings}w, total ${row.total})`;
      const barTotalWidth = (row.total / maxTotal) * HISTOGRAM_MAX_BAR_WIDTH;
      const blockerWidth = row.total > 0 ? (row.blockers / row.total) * barTotalWidth : 0;
      const warningWidth = barTotalWidth - blockerWidth;
      const barX = MARGIN_PT + 180;
      const barY = cursorY - HISTOGRAM_BAR_HEIGHT;

      out.push("BT");
      out.push(`/F1 ${HISTOGRAM_LABEL_FONT_SIZE} Tf`);
      out.push(`${MARGIN_PT} ${cursorY - HISTOGRAM_LABEL_FONT_SIZE + 1} Td`);
      out.push(`(${escapePdfString(labelText)}) Tj`);
      out.push("ET");

      if (blockerWidth > 0) {
        out.push("0.85 0.20 0.20 rg");
        out.push(`${barX} ${barY} ${blockerWidth.toFixed(2)} ${HISTOGRAM_BAR_HEIGHT} re`);
        out.push("f");
      }
      if (warningWidth > 0) {
        out.push("0.95 0.65 0.20 rg");
        out.push(
          `${(barX + blockerWidth).toFixed(2)} ${barY} ${warningWidth.toFixed(
            2
          )} ${HISTOGRAM_BAR_HEIGHT} re`
        );
        out.push("f");
      }
      out.push("0 0 0 rg");
      cursorY -= HISTOGRAM_ROW_LEADING;
      if (cursorY < MARGIN_PT) break;
    }
  }

  return out.join("\n");
}

function toBytes(str: string): Uint8Array {
  // Use TextEncoder for pure ASCII content; we never embed multi-byte glyphs
  // because Helvetica is the only registered font (StandardEncoding ≈ Latin-1).
  return new TextEncoder().encode(str);
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

function assemblePdf(
  contentStreams: string[],
  embeddedFont: ResolvedEmbeddedFont | undefined
): Uint8Array {
  // Default (helvetica) layout — preserves byte-identity with the
  // pre-pagination contract whenever pageCount === 1:
  //   1: Catalog
  //   2: Pages
  //   3: Page 1
  //   4: Resources (shared)
  //   5: Content stream for Page 1
  //   6: Page 2 / 7: Content for Page 2 / ...
  //
  // Embedded-font layout adds three objects after the Resources dict
  // (FontDescriptor, FontFile2 stream, Font dict) and bumps every
  // subsequent object id by 3. Page objects still reference Resources
  // 4, which now points at the new Font dict via /F1.
  const pageCount = Math.max(1, contentStreams.length);
  const fontExtraObjects = embeddedFont ? 3 : 0;
  const firstContentObjId = 5 + fontExtraObjects;
  const pageObjIds: number[] = [3];
  const contentObjIds: number[] = [firstContentObjId];
  for (let i = 1; i < pageCount; i += 1) {
    pageObjIds.push(firstContentObjId + 1 + 2 * (i - 1));
    contentObjIds.push(firstContentObjId + 2 + 2 * (i - 1));
  }

  const objects: string[] = [];
  objects.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  const kids = pageObjIds.map((id) => `${id} 0 R`).join(" ");
  objects.push(
    `2 0 obj\n<< /Type /Pages /Kids [${kids}] /Count ${pageCount} >>\nendobj\n`
  );
  objects.push(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH_PT} ${PAGE_HEIGHT_PT}] /Resources 4 0 R /Contents ${firstContentObjId} 0 R >>\nendobj\n`
  );

  // Object 4: Resources dict. The /F1 entry references either the
  // built-in Helvetica (default — keeps byte-identity) or the embedded
  // TrueType font dictionary at object 7 (5 + 2 = 7 when the three
  // font extras are present).
  if (embeddedFont) {
    const embeddedFontDictObjId = 7;
    objects.push(
      `4 0 obj\n<< /Font << /F1 ${embeddedFontDictObjId} 0 R >> >>\nendobj\n`
    );
  } else {
    objects.push(
      "4 0 obj\n<< /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >>\nendobj\n"
    );
  }

  const objectByteParts: Uint8Array[] = [];
  const offsets: number[] = [];

  if (embeddedFont) {
    // Object 5: FontDescriptor, Object 6: FontFile2, Object 7: Font dict.
    // Order chosen so the FontFile2 stream (the largest object) lives
    // between FontDescriptor and Font dict — minimises forward-reference
    // span the xref has to cover.
    const desc = embeddedFont.descriptor;
    const fontFile2ObjId = 6;
    const fontDictObjId = 7;
    objects.push(
      `5 0 obj\n<< /Type /FontDescriptor /FontName /${desc.baseFont} /Flags ${desc.flags} ` +
        `/FontBBox [${desc.fontBBox.join(" ")}] /ItalicAngle ${desc.italicAngle} ` +
        `/Ascent ${desc.ascent} /Descent ${desc.descent} /CapHeight ${desc.capHeight} ` +
        `/StemV ${desc.stemV} /FontFile2 ${fontFile2ObjId} 0 R >>\nendobj\n`
    );
    // FontFile2 stream object — header text + raw font bytes + endstream
    // trailer. We have to splice the binary bytes in between the text
    // halves of the stream object so they don't get mangled by toBytes()
    // (which is UTF-8 encoded and would corrupt high-byte glyphs).
    const streamHeader = `6 0 obj\n<< /Length ${embeddedFont.bytes.length} /Length1 ${embeddedFont.bytes.length} >>\nstream\n`;
    const streamFooter = `\nendstream\nendobj\n`;
    objects.push(`__FONTFILE2__${streamHeader}${streamFooter}`);
    objects.push(
      `${fontDictObjId} 0 obj\n<< /Type /Font /Subtype /TrueType /BaseFont /${desc.baseFont} ` +
        `/FirstChar ${desc.firstChar} /LastChar ${desc.lastChar} ` +
        `/Widths [${desc.widths.join(" ")}] /FontDescriptor 5 0 R /Encoding /WinAnsiEncoding >>\nendobj\n`
    );
  }

  const firstContent = contentStreams[0] ?? "";
  const firstContentBytes = toBytes(firstContent);
  objects.push(
    `${firstContentObjId} 0 obj\n<< /Length ${firstContentBytes.length} >>\nstream\n${firstContent}\nendstream\nendobj\n`
  );
  for (let i = 1; i < pageCount; i += 1) {
    const pid = pageObjIds[i];
    const cid = contentObjIds[i];
    objects.push(
      `${pid} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH_PT} ${PAGE_HEIGHT_PT}] /Resources 4 0 R /Contents ${cid} 0 R >>\nendobj\n`
    );
    const stream = contentStreams[i];
    const streamBytes = toBytes(stream);
    objects.push(
      `${cid} 0 obj\n<< /Length ${streamBytes.length} >>\nstream\n${stream}\nendstream\nendobj\n`
    );
  }

  const header = "%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n";
  const headerBytes = toBytes(header);

  let runningOffset = headerBytes.length;
  for (const obj of objects) {
    offsets.push(runningOffset);
    let bytes: Uint8Array;
    if (obj.startsWith("__FONTFILE2__") && embeddedFont) {
      // Splice raw binary font bytes into the stream object body.
      const headerFooter = obj.slice("__FONTFILE2__".length);
      const sep = "\nendstream\nendobj\n";
      const splitAt = headerFooter.lastIndexOf(sep);
      const objHeaderBytes = toBytes(headerFooter.slice(0, splitAt));
      const objFooterBytes = toBytes(sep);
      bytes = concatBytes([objHeaderBytes, embeddedFont.bytes, objFooterBytes]);
    } else {
      bytes = toBytes(obj);
    }
    objectByteParts.push(bytes);
    runningOffset += bytes.length;
  }

  const xrefOffset = runningOffset;
  const xrefLines: string[] = [];
  xrefLines.push("xref");
  xrefLines.push(`0 ${objects.length + 1}`);
  xrefLines.push("0000000000 65535 f ");
  for (const off of offsets) {
    xrefLines.push(`${off.toString().padStart(10, "0")} 00000 n `);
  }
  const xref = xrefLines.join("\n") + "\n";

  const trailer =
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n` +
    `startxref\n${xrefOffset}\n%%EOF`;

  return concatBytes([headerBytes, ...objectByteParts, toBytes(xref), toBytes(trailer)]);
}
