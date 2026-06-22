/**
 * Bundled DejaVu Sans subset for the opt-in `embeddedFont` mode of
 * {@link buildSetupSheetPdf}. Designed to cover Latin-1 + Latin
 * Extended-A (Polish, Czech, Slovak, German diacritics) plus a small
 * Cyrillic block at < 200 KB raw / < 320 KB base64.
 *
 * The subset is generated OFFLINE via the documented `pyftsubset`
 * workflow in [`scripts/regenerate-dejavu-sans-subset.mjs`](../../../../scripts/regenerate-dejavu-sans-subset.mjs)
 * and pasted into this module. Until the regeneration runs, the
 * bundled bytes are EMPTY — `EMBEDDED_FONT_DEJAVU_SUBSET_AVAILABLE`
 * is `false` and any call to `buildSetupSheetPdf` with
 * `embeddedFont: "dejavu-sans-subset"` throws a canonical error
 * pointing at the regen script. The `onWarning` callback path
 * (helvetica default) still ships in this wave, so operators get
 * visibility into glyph-loss without the bundled font.
 *
 * Source font: DejaVu Sans Book 2.37
 * (https://dejavu-fonts.github.io/) — public-domain-equivalent
 * Bitstream Vera license. Re-bake the subset deterministically by
 * running the regeneration script and replacing the constants below.
 */

/**
 * Base64-encoded TrueType subset bytes. EMPTY string until the
 * regeneration workflow runs and pastes the real subset here.
 */
export const embeddedFontDejaVuSubsetBase64 = "";

/**
 * Pre-computed font descriptor for the bundled subset. EMPTY object
 * (`{}` typed as `Partial<EmbeddedFontDescriptor>`) until the regen
 * script computes the real values from the TTF source. Consumers MUST
 * NOT use this when {@link EMBEDDED_FONT_DEJAVU_SUBSET_AVAILABLE} is
 * `false` — the canonical error in
 * [`setupSheetPdf.ts`](./setupSheetPdf.ts) gates that path.
 */
export const embeddedFontDejaVuSubsetDescriptor: Partial<EmbeddedFontDescriptor> = {};

/**
 * `true` only when both the bytes and descriptor have been populated
 * by the regeneration workflow. Production code branches on this
 * boolean rather than checking length, so the regen script can flip
 * the bundle on/off atomically.
 */
export const EMBEDDED_FONT_DEJAVU_SUBSET_AVAILABLE = false;

/**
 * Subset of the PDF `/FontDescriptor` keys the setup-sheet emitter
 * needs. Computed offline by the regen script (`pyftsubset` reports
 * everything we need from the source TTF's `OS/2`, `head`, `hhea`,
 * `hmtx`, and `post` tables).
 */
export type EmbeddedFontDescriptor = {
  /** Mirrors the `/BaseFont` and `/FontDescriptor /FontName` entries (e.g. `DejaVuSans`). */
  baseFont: string;
  /**
   * `/Flags` integer per PDF 1.4 §5.7.1. For DejaVu Sans the right
   * value is `32` (Symbolic = 0, Nonsymbolic = 1, Serif = 0, Script = 0,
   * Italic = 0, AllCap = 0, SmallCap = 0, ForceBold = 0).
   */
  flags: number;
  /** `/FontBBox` [llx, lly, urx, ury] in glyph-space units (1000-unit em). */
  fontBBox: readonly [number, number, number, number];
  /** `/ItalicAngle` (0 for upright DejaVu Sans Book). */
  italicAngle: number;
  /** `/Ascent` in 1000-unit em. */
  ascent: number;
  /** `/Descent` in 1000-unit em (negative). */
  descent: number;
  /** `/CapHeight` in 1000-unit em. */
  capHeight: number;
  /** `/StemV` in 1000-unit em (rough — readers don't enforce this strictly). */
  stemV: number;
  /**
   * `/FirstChar` for the `/Widths` array. Together with `/Widths` and
   * `/Encoding /WinAnsiEncoding`, this lets PDF readers compute
   * per-glyph advance without parsing the embedded TTF.
   */
  firstChar: number;
  /** `/LastChar` for the `/Widths` array. */
  lastChar: number;
  /**
   * `/Widths` per-glyph advance in 1000-unit em, indexed
   * `firstChar..lastChar` inclusive.
   */
  widths: readonly number[];
};
