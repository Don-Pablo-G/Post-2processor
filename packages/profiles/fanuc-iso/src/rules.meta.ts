import type { ProfileRuleDoc } from "@cnc/core";

/**
 * Stable, append-only documentation registry for the Fanuc ISO profile pack.
 *
 * Every entry is contract-tested in `tests/rulesMeta.spec.ts` and consumed by
 * the root `scripts/generate-profile-pack-docs.mjs` to render `PROFILE_PACKS.md`.
 *
 * IMPORTANT: do NOT remove or rename ids — downstream tooling (and this
 * registry's contract test) treats the `id` as the stable identifier.
 */
export const fanucIsoRuleDocs: ProfileRuleDoc[] = [
  {
    id: "fanuc.missing-o-header",
    severity: "warning",
    messageMatcher: /Fanuc program lacks an explicit O####/,
    summary: "Fanuc programs must open with an O#### header before the first motion block.",
    positiveSnippet: "G0 X1.\nG1 X2.\nM30\n",
    negativeSnippet: "O1234\nG0 X1.\nG1 X2.\nM30\n"
  },
  {
    id: "fanuc.g65-missing-p",
    severity: "warning",
    messageMatcher: /Fanuc G65 macro call missing P/,
    summary: "G65 macro calls require an explicit P (program number) — controllers alarm without it.",
    positiveSnippet: "O1234\nG65 L1\nM30\n",
    negativeSnippet: "O1234\nG65 P9100 L1\nM30\n"
  },
  {
    id: "fanuc.g65-non-integer-l",
    severity: "warning",
    messageMatcher: /Fanuc G65 L \(loop count\) must be a non-negative integer/,
    summary: "G65 L (loop count) must be a non-negative integer; fractional/negative values alarm.",
    positiveSnippet: "O1234\nG65 P9100 L1.5\nM30\n",
    negativeSnippet: "O1234\nG65 P9100 L2\nM30\n"
  },
  {
    id: "fanuc.t0-before-real-tool",
    severity: "warning",
    messageMatcher: /T0 \(tool cancel\) issued before any real tool selection/,
    summary: "T0 (tool cancel) before any real Tn (n>0) trips the Fanuc tool-life manager.",
    positiveSnippet: "O1234\nT0 M6\nM30\n",
    negativeSnippet: "O1234\nT1 M6\nT0 M6\nM30\n",
    // Pilot for the soft-deprecation flow. Newer Fanuc machines surface their
    // own tool-life-manager warnings, so this rule is a candidate for shops
    // that want to lean on the controller-native check instead. Suppressed
    // when the CLI is invoked with `--no-deprecated-rules`.
    deprecatedSince: "2026-05",
    replacementSuggestion:
      "Rely on the Fanuc tool-life manager alarm instead of linting T0-before-Tn locally."
  }
];
