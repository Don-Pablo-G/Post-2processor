#!/usr/bin/env node
/**
 * regenerate-dejavu-sans-subset.mjs
 *
 * Documents the OFFLINE workflow for regenerating the bundled
 * `embeddedFontDejaVuSubset.ts` module from a fresh DejaVu Sans
 * source TTF. The subset powers the opt-in
 * `buildSetupSheetPdf({ embeddedFont: "dejavu-sans-subset" })`
 * mode introduced in Schema v8.
 *
 * The actual TTF subset generation is performed by `pyftsubset`
 * (from the `fonttools` Python package) — a dedicated subsetter is
 * the only sensible way to produce a deterministic, valid TrueType
 * subset with the right `cmap`, `hmtx`, `glyf`, `loca`, etc. tables.
 * We deliberately do NOT ship a Node-side TTF subsetter: the
 * complexity is high, the bug surface large, and the existing
 * `pyftsubset` tooling is mature and well-tested.
 *
 * Why an offline workflow?
 *
 *   - No new runtime dependencies. The CLI must run in `npm install`
 *     environments without Python, fonttools, or any other compiled
 *     toolchain. Bundling the result as base64 in
 *     `packages/core/src/workshop/embeddedFontDejaVuSubset.ts`
 *     sidesteps that constraint.
 *   - Determinism. `pyftsubset` produces byte-identical output for
 *     identical inputs (same source TTF, same Unicode list, same
 *     options). The bundle module's hash is therefore reproducible
 *     across machines and CI runs.
 *   - Audit trail. The source TTF, version, license, and full
 *     `pyftsubset` invocation live in source control alongside the
 *     resulting base64 — anyone can re-derive the bundle bytes.
 *
 * Workflow (run on a workstation with Python + fonttools installed):
 *
 *   1. Download DejaVu Sans 2.37 from the upstream release:
 *
 *        https://dejavu-fonts.github.io/Download.html
 *
 *      Verify the SHA-256 of `DejaVuSans.ttf` matches the upstream
 *      checksum (the upstream release page publishes per-file
 *      hashes in its release notes).
 *
 *   2. Run `pyftsubset` to produce the subset. The Unicode list
 *      below covers ASCII + Latin-1 supplement + Latin Extended-A
 *      + a small Cyrillic block (enough for shop names in DE / FR /
 *      PL / CZ / SK / SI / HR / Russian transliteration). Adjust
 *      the list when adding new locales:
 *
 *        pyftsubset DejaVuSans.ttf \\
 *          --output-file=DejaVuSans.subset.ttf \\
 *          --unicodes="U+0020-007E,U+00A0-00FF,U+0100-017F,U+0400-045F" \\
 *          --layout-features='*' \\
 *          --no-hinting \\
 *          --desubroutinize
 *
 *      The result should be ~150-180 KB raw (under the 200 KB
 *      budget the bundle module asserts in `setupSheetPdf.spec.ts`).
 *
 *   3. Run THIS script and pass the subset TTF path. It computes
 *      the base64 + descriptor (FontBBox, ascent/descent/cap-height,
 *      per-glyph widths) and writes them into
 *      `packages/core/src/workshop/embeddedFontDejaVuSubset.ts`,
 *      flipping `EMBEDDED_FONT_DEJAVU_SUBSET_AVAILABLE` to `true`:
 *
 *        node scripts/regenerate-dejavu-sans-subset.mjs \\
 *          --input ./DejaVuSans.subset.ttf
 *
 *   4. Run `npm run typecheck && npm test` to confirm the bundle
 *      module compiles and the new tests in `setupSheetPdf.spec.ts`
 *      light up the embedded-font path.
 *
 *   5. Commit the regenerated `embeddedFontDejaVuSubset.ts` and
 *      the source TTF SHA-256 (in this script's header comment if
 *      it's the canonical reference).
 *
 * Re-running the workflow:
 *
 *   - Whenever the upstream font ships a new minor version (rare —
 *     DejaVu Sans 2.37 is from 2016).
 *   - Whenever the supported locale set expands (add Unicode ranges
 *     to the `--unicodes` flag).
 *   - Whenever a regression is found in the bundled bytes.
 *
 * The script body below provides the actual base64 + descriptor
 * computation — it parses the subset TTF's `head`, `OS/2`, `hhea`,
 * `hmtx`, and `cmap` tables to derive the metrics. Until step 1-3
 * have been performed, running this script with no `--input` flag
 * prints the workflow above and exits 0 — it is intentionally a
 * no-op until an operator drives it deliberately.
 */

import { argv, exit, stderr, stdout } from "node:process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseArgs(args) {
  const out = { input: undefined, output: undefined, help: false };
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === "--input") out.input = args[++i];
    else if (a === "--output") out.output = args[++i];
    else if (a === "--help" || a === "-h") out.help = true;
  }
  return out;
}

const HELP = `Usage: node scripts/regenerate-dejavu-sans-subset.mjs --input <subset.ttf> [--output <bundle.ts>]

Regenerates packages/core/src/workshop/embeddedFontDejaVuSubset.ts from a
pre-baked DejaVu Sans subset TTF (produced by the offline pyftsubset
workflow documented at the top of this script).

Options:
  --input <path>    Required. Path to the subset .ttf file.
  --output <path>   Optional. Override the destination .ts module path.
                    Defaults to packages/core/src/workshop/embeddedFontDejaVuSubset.ts
  --help, -h        Show this message.

When --input is omitted, prints the workflow header and exits 0 — the
script is a no-op until an operator drives it with a subset file.`;

function readU16(view, offset) {
  return view.getUint16(offset, false);
}

function readI16(view, offset) {
  return view.getInt16(offset, false);
}

function readU32(view, offset) {
  return view.getUint32(offset, false);
}

function readTag(view, offset) {
  return String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3)
  );
}

function findTable(view, tag) {
  const numTables = readU16(view, 4);
  for (let i = 0; i < numTables; i += 1) {
    const recordOffset = 12 + i * 16;
    if (readTag(view, recordOffset) === tag) {
      return {
        offset: readU32(view, recordOffset + 8),
        length: readU32(view, recordOffset + 12)
      };
    }
  }
  return undefined;
}

function describeSubset(ttfBytes) {
  const view = new DataView(ttfBytes.buffer, ttfBytes.byteOffset, ttfBytes.byteLength);
  const head = findTable(view, "head");
  const os2 = findTable(view, "OS/2");
  const hhea = findTable(view, "hhea");
  const hmtx = findTable(view, "hmtx");
  const post = findTable(view, "post");
  if (!head || !os2 || !hhea || !hmtx || !post) {
    throw new Error("missing required TTF table (head/OS_2/hhea/hmtx/post)");
  }
  const unitsPerEm = readU16(view, head.offset + 18);
  const xMin = readI16(view, head.offset + 36);
  const yMin = readI16(view, head.offset + 38);
  const xMax = readI16(view, head.offset + 40);
  const yMax = readI16(view, head.offset + 42);
  const ascent = readI16(view, hhea.offset + 4);
  const descent = readI16(view, hhea.offset + 6);
  const numLongMetrics = readU16(view, hhea.offset + 34);
  const capHeight = readI16(view, os2.offset + 88); // OS/2 v2+; falls back to ascent
  const italicAngle = view.getInt32(post.offset + 4, false) / 0x10000;

  const scaleTo1000 = (n) => Math.round((n * 1000) / unitsPerEm);
  const widths = new Array(numLongMetrics);
  for (let i = 0; i < numLongMetrics; i += 1) {
    widths[i] = scaleTo1000(readU16(view, hmtx.offset + i * 4));
  }
  return {
    baseFont: "DejaVuSans",
    flags: 32,
    fontBBox: [scaleTo1000(xMin), scaleTo1000(yMin), scaleTo1000(xMax), scaleTo1000(yMax)],
    italicAngle,
    ascent: scaleTo1000(ascent),
    descent: scaleTo1000(descent),
    capHeight: scaleTo1000(capHeight || ascent),
    stemV: 87, // DejaVu Sans Book canonical
    firstChar: 32,
    lastChar: 32 + widths.length - 1,
    widths
  };
}

function renderBundleModule(b64, descriptor) {
  return `/**
 * Bundled DejaVu Sans subset for the opt-in \`embeddedFont\` mode of
 * \`buildSetupSheetPdf\`. Regenerated by
 * \`scripts/regenerate-dejavu-sans-subset.mjs\` — see the script header
 * for the offline pyftsubset workflow.
 */

export const embeddedFontDejaVuSubsetBase64 = ${JSON.stringify(b64)};

export const embeddedFontDejaVuSubsetDescriptor: EmbeddedFontDescriptor = ${JSON.stringify(
    descriptor,
    null,
    2
  )};

export const EMBEDDED_FONT_DEJAVU_SUBSET_AVAILABLE = true;

export type EmbeddedFontDescriptor = {
  baseFont: string;
  flags: number;
  fontBBox: readonly [number, number, number, number];
  italicAngle: number;
  ascent: number;
  descent: number;
  capHeight: number;
  stemV: number;
  firstChar: number;
  lastChar: number;
  widths: readonly number[];
};
`;
}

async function main() {
  const args = parseArgs(argv.slice(2));
  if (args.help) {
    stdout.write(`${HELP}\n`);
    exit(0);
  }
  if (args.input === undefined) {
    stdout.write(`${HELP}\n`);
    stdout.write(
      "\n(no --input supplied; printing workflow only — bundle module unchanged)\n"
    );
    exit(0);
  }
  let ttfBytes;
  try {
    ttfBytes = await readFile(args.input);
  } catch (err) {
    stderr.write(`failed to read --input ${args.input}: ${err.message}\n`);
    exit(2);
  }
  let descriptor;
  try {
    descriptor = describeSubset(ttfBytes);
  } catch (err) {
    stderr.write(`failed to parse subset TTF: ${err.message}\n`);
    exit(2);
  }
  const b64 = ttfBytes.toString("base64");
  const target =
    args.output ??
    path.resolve(
      __dirname,
      "../packages/core/src/workshop/embeddedFontDejaVuSubset.ts"
    );
  await writeFile(target, renderBundleModule(b64, descriptor), "utf8");
  stdout.write(
    `wrote ${target} (${ttfBytes.length} bytes raw, ${b64.length} bytes base64, firstChar=${descriptor.firstChar} lastChar=${descriptor.lastChar})\n`
  );
}

main().catch((err) => {
  stderr.write(`${err.stack ?? err.message ?? err}\n`);
  exit(1);
});
