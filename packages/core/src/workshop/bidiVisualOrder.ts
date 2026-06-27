/**
 * Minimal bidirectional text helpers for PDF display. PDF's `Tj` operator lays
 * glyphs left-to-right; RTL scripts (Arabic, Hebrew) need visual reordering so
 * readers display shop names correctly. This is not a full UAX#9 implementation
 * — it covers pure RTL lines and LTR+RTL mixed lines with Latin fallback.
 */

const RTL_STRONG =
  /[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
const LTR_STRONG = /[A-Za-z]/;
const DIGIT_RUN = /[0-9]/;

export type BidiTextMode = "auto" | "ltr" | "rtl";

export function containsRtlText(text: string): boolean {
  return RTL_STRONG.test(text);
}

function isRtlChar(char: string): boolean {
  return RTL_STRONG.test(char);
}

function isLtrChar(char: string): boolean {
  return LTR_STRONG.test(char);
}

function isDigitChar(char: string): boolean {
  return DIGIT_RUN.test(char);
}

type DirectionRun = { rtl: boolean; text: string };

function classifyChar(char: string, currentRtl: boolean | undefined): boolean | undefined {
  if (isRtlChar(char)) return true;
  if (isLtrChar(char)) return false;
  if (isDigitChar(char)) return currentRtl;
  return currentRtl;
}

function splitDirectionRuns(text: string): DirectionRun[] {
  const runs: DirectionRun[] = [];
  let current = "";
  let currentRtl: boolean | undefined;
  for (const char of text) {
    const classified = classifyChar(char, currentRtl);
    const rtl = classified ?? false;
    if (currentRtl !== undefined && rtl !== currentRtl) {
      runs.push({ rtl: currentRtl, text: current });
      current = "";
    }
    currentRtl = classified ?? currentRtl ?? false;
    current += char;
  }
  if (current.length > 0) runs.push({ rtl: currentRtl ?? false, text: current });
  return runs;
}

function reverseRunText(text: string): string {
  return [...text].reverse().join("");
}

/**
 * Reverse an RTL run for PDF visual placement while preserving embedded
 * Latin/digit islands (e.g. "אב Shop גד" keeps "Shop" readable).
 */
function reverseRtlRunPreservingEmbeddedLtr(text: string): string {
  type Segment = { preserve: boolean; text: string };
  const segments: Segment[] = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (isLtrChar(ch) || isDigitChar(ch)) {
      let j = i + 1;
      while (j < text.length && (isLtrChar(text[j]) || isDigitChar(text[j]))) j += 1;
      segments.push({ preserve: true, text: text.slice(i, j) });
      i = j;
    } else {
      let j = i + 1;
      while (j < text.length && !isLtrChar(text[j]) && !isDigitChar(text[j])) j += 1;
      segments.push({ preserve: false, text: text.slice(i, j) });
      i = j;
    }
  }
  return segments
    .reverse()
    .map((seg) => (seg.preserve ? seg.text : reverseRunText(seg.text)))
    .join("");
}

function dominantRtl(text: string): boolean {
  let rtl = 0;
  let ltr = 0;
  for (const char of text) {
    if (isRtlChar(char)) rtl += 1;
    else if (isLtrChar(char)) ltr += 1;
  }
  return rtl > ltr;
}

/**
 * UAX#9-lite: on LTR-dominant mixed lines, reverse RTL runs but keep Latin
 * digit runs with their preceding RTL segment (e.g. Arabic label + order no).
 */
export function applyBidiVisualOrder(text: string, mode: BidiTextMode = "auto"): string {
  if (text.length === 0) return text;
  const baseRtl =
    mode === "rtl" ? true : mode === "ltr" ? false : dominantRtl(text);
  if (!baseRtl && mode === "auto" && !containsRtlText(text)) return text;

  const runs = splitDirectionRuns(text).map((run) => ({
    rtl: run.rtl,
    text: run.rtl ? reverseRtlRunPreservingEmbeddedLtr(run.text) : run.text
  }));

  if (baseRtl) {
    return runs
      .slice()
      .reverse()
      .map((run) => run.text)
      .join("");
  }

  // LTR-dominant mixed line: mirror each RTL run in place; Latin stays put.
  return runs.map((run) => run.text).join("");
}

/**
 * Like {@link applyBidiVisualOrderMultiline} but treats blank-line-separated
 * blocks as paragraphs. RTL-dominant paragraphs reverse visual line order
 * after per-line bidi — incremental support for multi-line shop addresses.
 */
export function applyBidiVisualOrderParagraphs(
  text: string,
  mode: BidiTextMode = "auto"
): string {
  if (text.length === 0) return text;
  const paragraphs = text.split(/\n{2,}/);
  return paragraphs
    .map((paragraph) => {
      const lines = paragraph.split("\n");
      const ordered = lines.map((line) => applyBidiVisualOrder(line, mode));
      const flat = paragraph.replace(/\n/g, " ");
      const paraRtl =
        mode === "rtl" ? true : mode === "ltr" ? false : dominantRtl(flat);
      if (paraRtl && lines.length > 1) {
        return ordered.reverse().join("\n");
      }
      return ordered.join("\n");
    })
    .join("\n\n");
}

/**
 * Apply bidi visual ordering to every line in a multiline string, preserving
 * line breaks.
 */
export function applyBidiVisualOrderMultiline(
  text: string,
  mode: BidiTextMode = "auto",
  options?: { paragraphs?: boolean }
): string {
  if (options?.paragraphs) {
    return applyBidiVisualOrderParagraphs(text, mode);
  }
  return text
    .split("\n")
    .map((line) => applyBidiVisualOrder(line, mode))
    .join("\n");
}
