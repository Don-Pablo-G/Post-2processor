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
  },
  {
    id: "fanuc.m6-without-t",
    severity: "warning",
    messageMatcher: /M6 without T on the same block/,
    summary: "M6 (tool change) must be paired with Tn on the same block.",
    positiveSnippet: "O1234\nM6\nM30\n",
    negativeSnippet: "O1234\nT1 M6\nM30\n"
  },
  {
    id: "fanuc.g43-without-h",
    severity: "warning",
    messageMatcher: /G43 without H on the same block/,
    summary: "G43 (tool length compensation) requires an H offset on the same block.",
    positiveSnippet: "O1234\nT1 M6\nS1200 M3\nG43 Z25.\nM30\n",
    negativeSnippet: "O1234\nT1 M6\nS1200 M3\nG43 H1 Z25.\nM30\n"
  },
  {
    id: "fanuc.feed-while-spindle-off",
    severity: "warning",
    messageMatcher: /G1\/G2\/G3 while spindle is off/,
    summary: "Start the spindle with M3/M4 before G1/G2/G3 feed motion.",
    positiveSnippet: "O1234\nT1 M6\nG54\nG1 X10. F100.\nM30\n",
    negativeSnippet: "O1234\nT1 M6\nG54\nS1200 M3\nG1 X10. F100.\nM5\nM30\n"
  },
  {
    id: "fanuc.tapping-while-spindle-off",
    severity: "warning",
    messageMatcher: /Tapping cycle \(G74\/G84\) while spindle is off/,
    summary: "Start the spindle before G74/G84 tapping cycles.",
    positiveSnippet: "O1234\nT1 M6\nG54\nG90\nG84 X10. Y10. Z-5. R2. F100.\nG80\nM30\n",
    negativeSnippet: "O1234\nT1 M6\nG54\nG90\nS500 M3\nG84 X10. Y10. Z-5. R2. F100.\nG80\nM5\nM30\n"
  },
  {
    id: "fanuc.m6-while-cutter-comp",
    severity: "warning",
    messageMatcher: /M6 while cutter compensation \(G41\/G42\) is still active/,
    summary: "Cancel cutter compensation with G40 before a tool change (M6).",
    positiveSnippet: "O1234\nT1 M6\nG54\nG90\nG41 D1\nT2 M6\nG40\nM30\n",
    negativeSnippet: "O1234\nT1 M6\nG54\nG90\nG41 D1\nG40\nT2 M6\nM30\n"
  },
  {
    id: "fanuc.m6-while-tool-length",
    severity: "warning",
    messageMatcher: /M6 while tool length compensation \(G43\) is still active/,
    summary: "Cancel tool length compensation with G49 before a tool change (M6).",
    positiveSnippet: "O1234\nT1 M6\nG54\nG90\nG43 H1 Z25.\nT2 M6\nG49\nM30\n",
    negativeSnippet: "O1234\nT1 M6\nG54\nG90\nG43 H1 Z25.\nG49\nT2 M6\nM30\n"
  },
  {
    id: "fanuc.m6-while-coolant-on",
    severity: "warning",
    messageMatcher: /M6 while coolant is still on/,
    summary: "Turn coolant off with M9 before a tool change (M6).",
    positiveSnippet: "O1234\nT1 M6\nG54\nS1200 M3\nM8\nT2 M6\nM9\nM5\nM30\n",
    negativeSnippet: "O1234\nT1 M6\nG54\nS1200 M3\nM8\nM9\nT2 M6\nM5\nM30\n"
  },
  {
    id: "fanuc.g40-and-cutter-comp-same-block",
    severity: "warning",
    messageMatcher: /G40 and G41\/G42 on the same block/,
    summary: "Do not cancel and apply cutter compensation on the same block.",
    positiveSnippet: "O1234\nT1 M6\nG54\nG40 G41 D1\nM30\n",
    negativeSnippet: "O1234\nT1 M6\nG54\nG41 D1\nG40\nM30\n"
  },
  {
    id: "fanuc.g80-and-canned-same-block",
    severity: "warning",
    messageMatcher: /G80 and a canned cycle on the same block/,
    summary: "Do not cancel and start a canned cycle on the same block.",
    positiveSnippet: "O1234\nT1 M6\nG54\nG90\nG81 Z-5. R2. F100. G80\nM30\n",
    negativeSnippet: "O1234\nT1 M6\nG54\nG90\nG81 Z-5. R2. F100.\nG80\nM30\n"
  },
  {
    id: "fanuc.g43-and-g49-same-block",
    severity: "warning",
    messageMatcher: /G43 and G49 on the same block/,
    summary: "Do not apply and cancel tool length compensation on the same block.",
    positiveSnippet: "O1234\nT1 M6\nG54\nG43 H1 G49 Z25.\nM30\n",
    negativeSnippet: "O1234\nT1 M6\nG54\nG43 H1 Z25.\nG49\nM30\n"
  },
  {
    id: "fanuc.cutter-comp-active-at-end",
    severity: "warning",
    messageMatcher: /Program ends with cutter compensation \(G41\/G42\) still active/,
    summary: "Cancel cutter compensation with G40 before M02/M30.",
    positiveSnippet: "O1234\nT1 M6\nS1200 M3\nG43 H1 Z25.\nG41 D1 X10. Y10.\nM30\n",
    negativeSnippet: "O1234\nT1 M6\nS1200 M3\nG43 H1 Z25.\nG41 D1 X10. Y10.\nG40\nM30\n"
  },
  {
    id: "fanuc.g43-active-at-end",
    severity: "warning",
    messageMatcher: /Program ends with tool length compensation \(G43\) still active/,
    summary: "Cancel tool length compensation with G49 before M02/M30.",
    positiveSnippet: "O1234\nT1 M6\nS1200 M3\nG43 H1 Z25.\nM5\nM30\n",
    negativeSnippet: "O1234\nT1 M6\nS1200 M3\nG43 H1 Z25.\nG49\nM5\nM30\n"
  },
  {
    id: "fanuc.spindle-on-at-end",
    severity: "warning",
    messageMatcher: /Program ends with spindle still on/,
    summary: "Stop the spindle with M5 before M02/M30.",
    positiveSnippet: "O1234\nT1 M6\nS1200 M3\nM30\n",
    negativeSnippet: "O1234\nT1 M6\nS1200 M3\nM5\nM30\n"
  },
  {
    id: "fanuc.coolant-on-at-end",
    severity: "warning",
    messageMatcher: /Program ends with coolant still on/,
    summary: "Turn coolant off with M9 before M02/M30.",
    positiveSnippet: "O1234\nT1 M6\nS1200 M3\nM8\nM5\nM30\n",
    negativeSnippet: "O1234\nT1 M6\nS1200 M3\nM8\nM5\nM9\nM30\n"
  },
  {
    id: "fanuc.g91-active-at-end",
    severity: "warning",
    messageMatcher: /Program ends in incremental mode \(G91\)/,
    summary: "Restore absolute mode with G90 before M02/M30.",
    positiveSnippet: "O1234\nT1 M6\nG54\nG91\nG0 X1.\nM30\n",
    negativeSnippet: "O1234\nT1 M6\nG54\nG91\nG0 X1.\nG90\nM30\n"
  },
  {
    id: "fanuc.canned-active-at-end",
    severity: "warning",
    messageMatcher: /Program ends with a canned cycle still active/,
    summary: "Cancel canned cycles with G80 before M02/M30.",
    positiveSnippet: "O1234\nT1 M6\nS1200 M3\nG81 X10. Y10. Z-5. R2. F100.\nM30\n",
    negativeSnippet: "O1234\nT1 M6\nS1200 M3\nG81 X10. Y10. Z-5. R2. F100.\nG80\nM30\n"
  },
  {
    id: "fanuc.g68-active-at-end",
    severity: "warning",
    messageMatcher: /Program ends with coordinate rotation \(G68\) still active/,
    summary: "Cancel coordinate rotation with G69 before M02/M30.",
    positiveSnippet: "O1234\nT1 M6\nG54\nG68\nM30\n",
    negativeSnippet: "O1234\nT1 M6\nG54\nG68\nG69\nM30\n"
  },
  {
    id: "fanuc.g51-active-at-end",
    severity: "warning",
    messageMatcher: /Program ends with scaling \(G51\) still active/,
    summary: "Cancel scaling with G50 before M02/M30.",
    positiveSnippet: "O1234\nT1 M6\nG54\nG51\nM30\n",
    negativeSnippet: "O1234\nT1 M6\nG54\nG51\nG50\nM30\n"
  },
  {
    id: "fanuc.m97-unsupported",
    severity: "warning",
    messageMatcher: /M97 local subprogram call is not standard Fanuc ISO/,
    summary: "M97 local subprogram calls are a Haas idiom; use standard Fanuc M98/G65.",
    positiveSnippet: "O1234\nM97 P100\nM30\nN100\nM99\n",
    negativeSnippet: "O1234\nM98 P1000\nM30\nO1000\nM99\n"
  },
  {
    id: "fanuc.g1-without-f",
    severity: "warning",
    messageMatcher: /G1\/G2\/G3 without F and no prior F in the program/,
    summary: "G1/G2/G3 feed motion needs an explicit F on the block or earlier in the program.",
    positiveSnippet: "O1234\nT1 M6\nS1200 M3\nG1 X10. Y10.\nM30\n",
    negativeSnippet: "O1234\nT1 M6\nS1200 M3\nG1 X10. Y10. F200.\nM30\n"
  },
  {
    id: "fanuc.m00-while-coolant-on",
    severity: "warning",
    messageMatcher: /M00 while coolant is still on/,
    summary: "Turn coolant off with M9 before an M00 program stop.",
    positiveSnippet: "O1234\nT1 M6\nS1200 M3\nM8\nM00\nM9\nM5\nM30\n",
    negativeSnippet: "O1234\nT1 M6\nS1200 M3\nM8\nM9\nM00\nM5\nM30\n"
  },
  {
    id: "fanuc.m00-while-cutter-comp",
    severity: "warning",
    messageMatcher: /M00 while cutter compensation \(G41\/G42\) is still active/,
    summary: "Cancel cutter compensation with G40 before an M00 program stop.",
    positiveSnippet: "O1234\nT1 M6\nS1200 M3\nG41 D1\nM00\nG40\nM5\nM30\n",
    negativeSnippet: "O1234\nT1 M6\nS1200 M3\nG41 D1\nG40\nM00\nM5\nM30\n"
  },
  {
    id: "fanuc.m00-while-canned",
    severity: "warning",
    messageMatcher: /M00 while a canned cycle is still active/,
    summary: "Cancel canned cycles with G80 before an M00 program stop.",
    positiveSnippet: "O1234\nT1 M6\nS1200 M3\nG81 X1. Y1. Z-1. R1. F50.\nM00\nG80\nM5\nM30\n",
    negativeSnippet: "O1234\nT1 M6\nS1200 M3\nG81 X1. Y1. Z-1. R1. F50.\nG80\nM00\nM5\nM30\n"
  },
  {
    id: "fanuc.m00-while-tool-length",
    severity: "warning",
    messageMatcher: /M00 while tool length compensation \(G43\) is still active/,
    summary: "Cancel tool length compensation with G49 before an M00 program stop.",
    positiveSnippet: "O1234\nT1 M6\nS1200 M3\nG43 H1 Z25.\nM00\nG49\nM5\nM30\n",
    negativeSnippet: "O1234\nT1 M6\nS1200 M3\nG43 H1 Z25.\nG49\nM00\nM5\nM30\n"
  },
  {
    id: "fanuc.m30-while-coolant-on",
    severity: "warning",
    messageMatcher: /M30 while coolant is still on/,
    summary: "Turn coolant off with M9 before an M30 program end.",
    positiveSnippet: "O1234\nT1 M6\nS1200 M3\nM8\nM5\nM30\n",
    negativeSnippet: "O1234\nT1 M6\nS1200 M3\nM8\nM9\nM5\nM30\n"
  },
  {
    id: "fanuc.m30-while-cutter-comp",
    severity: "warning",
    messageMatcher: /M30 while cutter compensation \(G41\/G42\) is still active/,
    summary: "Cancel cutter compensation with G40 before an M30 program end.",
    positiveSnippet: "O1234\nT1 M6\nS1200 M3\nG41 D1\nM5\nM30\n",
    negativeSnippet: "O1234\nT1 M6\nS1200 M3\nG41 D1\nG40\nM5\nM30\n"
  },
  {
    id: "fanuc.m30-while-canned",
    severity: "warning",
    messageMatcher: /M30 while a canned cycle is still active/,
    summary: "Cancel canned cycles with G80 before an M30 program end.",
    positiveSnippet: "O1234\nT1 M6\nS1200 M3\nG81 X1. Y1. Z-1. R1. F50.\nM30\n",
    negativeSnippet: "O1234\nT1 M6\nS1200 M3\nG81 X1. Y1. Z-1. R1. F50.\nG80\nM30\n"
  },
  {
    id: "fanuc.m30-while-tool-length",
    severity: "warning",
    messageMatcher: /M30 while tool length compensation \(G43\) is still active/,
    summary: "Cancel tool length compensation with G49 before an M30 program end.",
    positiveSnippet: "O1234\nT1 M6\nS1200 M3\nG43 H1 Z25.\nM5\nM30\n",
    negativeSnippet: "O1234\nT1 M6\nS1200 M3\nG43 H1 Z25.\nG49\nM5\nM30\n"
  },
  {
    id: "fanuc.m02-while-coolant-on",
    severity: "warning",
    messageMatcher: /M02 while coolant is still on/,
    summary: "Turn coolant off with M9 before an M02 program end.",
    positiveSnippet: "O1234\nT1 M6\nS1200 M3\nM8\nM5\nM02\n",
    negativeSnippet: "O1234\nT1 M6\nS1200 M3\nM8\nM9\nM5\nM02\n"
  },
  {
    id: "fanuc.m02-while-cutter-comp",
    severity: "warning",
    messageMatcher: /M02 while cutter compensation \(G41\/G42\) is still active/,
    summary: "Cancel cutter compensation with G40 before an M02 program end.",
    positiveSnippet: "O1234\nT1 M6\nS1200 M3\nG41 D1\nM5\nM02\n",
    negativeSnippet: "O1234\nT1 M6\nS1200 M3\nG41 D1\nG40\nM5\nM02\n"
  },
  {
    id: "fanuc.m02-while-canned",
    severity: "warning",
    messageMatcher: /M02 while a canned cycle is still active/,
    summary: "Cancel canned cycles with G80 before an M02 program end.",
    positiveSnippet: "O1234\nT1 M6\nS1200 M3\nG81 X1. Y1. Z-1. R1. F50.\nM02\n",
    negativeSnippet: "O1234\nT1 M6\nS1200 M3\nG81 X1. Y1. Z-1. R1. F50.\nG80\nM02\n"
  },
  {
    id: "fanuc.m02-while-tool-length",
    severity: "warning",
    messageMatcher: /M02 while tool length compensation \(G43\) is still active/,
    summary: "Cancel tool length compensation with G49 before an M02 program end.",
    positiveSnippet: "O1234\nT1 M6\nS1200 M3\nG43 H1 Z25.\nM5\nM02\n",
    negativeSnippet: "O1234\nT1 M6\nS1200 M3\nG43 H1 Z25.\nG49\nM5\nM02\n"
  },
  {
    id: "fanuc.m6-while-rotation",
    severity: "warning",
    messageMatcher: /M6 while coordinate rotation \(G68\) is still active/,
    summary: "Cancel coordinate rotation with G69 before a tool change (M6).",
    positiveSnippet: "O1234\nT1 M6\nS1200 M3\nG68 X0. Y0. R15.\nT2 M6\nG69\nM5\nM30\n",
    negativeSnippet: "O1234\nT1 M6\nS1200 M3\nG68 X0. Y0. R15.\nG69\nT2 M6\nM5\nM30\n"
  },
  {
    id: "fanuc.m6-while-scaling",
    severity: "warning",
    messageMatcher: /M6 while scaling \(G51\) is still active/,
    summary: "Cancel scaling with G50 before a tool change (M6).",
    positiveSnippet: "O1234\nT1 M6\nS1200 M3\nG51 X0. Y0. P2.\nT2 M6\nG50\nM5\nM30\n",
    negativeSnippet: "O1234\nT1 M6\nS1200 M3\nG51 X0. Y0. P2.\nG50\nT2 M6\nM5\nM30\n"
  },
  {
    id: "fanuc.g28-while-cutter-comp",
    severity: "warning",
    messageMatcher: /G28 while cutter compensation \(G41\/G42\) is still active/,
    summary: "Cancel cutter compensation with G40 before G28 reference return.",
    positiveSnippet: "O1234\nT1 M6\nS1200 M3\nG41 D1\nG28 Z0.\nG40\nM5\nM30\n",
    negativeSnippet: "O1234\nT1 M6\nS1200 M3\nG41 D1\nG40\nG28 Z0.\nM5\nM30\n"
  },
  {
    id: "fanuc.g28-while-canned",
    severity: "warning",
    messageMatcher: /G28 while a canned cycle is still active/,
    summary: "Cancel canned cycles with G80 before G28 reference return.",
    positiveSnippet: "O1234\nT1 M6\nS1200 M3\nG81 X1. Y1. Z-1. R1. F50.\nG28 Z0.\nG80\nM5\nM30\n",
    negativeSnippet: "O1234\nT1 M6\nS1200 M3\nG81 X1. Y1. Z-1. R1. F50.\nG80\nG28 Z0.\nM5\nM30\n"
  },
  {
    id: "fanuc.g53-while-cutter-comp",
    severity: "warning",
    messageMatcher: /G53 while cutter compensation \(G41\/G42\) is still active/,
    summary: "Cancel cutter compensation with G40 before G53 machine-coordinate moves.",
    positiveSnippet: "O1234\nT1 M6\nS1200 M3\nG41 D1\nG53 Z0.\nG40\nM5\nM30\n",
    negativeSnippet: "O1234\nT1 M6\nS1200 M3\nG41 D1\nG40\nG53 Z0.\nM5\nM30\n"
  },
  {
    id: "fanuc.g53-while-canned",
    severity: "warning",
    messageMatcher: /G53 while a canned cycle is still active/,
    summary: "Cancel canned cycles with G80 before G53 machine-coordinate moves.",
    positiveSnippet: "O1234\nT1 M6\nS1200 M3\nG81 X1. Y1. Z-1. R1. F50.\nG53 Z0.\nG80\nM5\nM30\n",
    negativeSnippet: "O1234\nT1 M6\nS1200 M3\nG81 X1. Y1. Z-1. R1. F50.\nG80\nG53 Z0.\nM5\nM30\n"
  },
  {
    id: "fanuc.m98-without-p",
    severity: "warning",
    messageMatcher: /M98 without P on the same block/,
    summary: "Fanuc M98 subprogram calls require a P program number on the same block.",
    positiveSnippet: "O1234\nM98\nM30\n",
    negativeSnippet: "O1234\nM98 P1000\nM30\nO1000\nM99\n"
  },
  {
    id: "fanuc.g68-and-g69-same-block",
    severity: "warning",
    messageMatcher: /G68 and G69 on the same block/,
    summary: "Do not apply and cancel coordinate rotation on the same block.",
    positiveSnippet: "O1234\nT1 M6\nS1200 M3\nG68 X0. Y0. R15. G69\nM5\nM30\n",
    negativeSnippet: "O1234\nT1 M6\nS1200 M3\nG68 X0. Y0. R15.\nG69\nM5\nM30\n"
  },
  {
    id: "fanuc.g50-and-g51-same-block",
    severity: "warning",
    messageMatcher: /G51 and G50 on the same block/,
    summary: "Do not apply and cancel scaling on the same block.",
    positiveSnippet: "O1234\nT1 M6\nS1200 M3\nG51 X0. Y0. P2. G50\nM5\nM30\n",
    negativeSnippet: "O1234\nT1 M6\nS1200 M3\nG51 X0. Y0. P2.\nG50\nM5\nM30\n"
  },
  {
    id: "fanuc.g41-and-g42-same-block",
    severity: "warning",
    messageMatcher: /G41 and G42 on the same block/,
    summary: "Do not select both cutter-compensation sides on the same block.",
    positiveSnippet: "O1234\nT1 M6\nS1200 M3\nG41 D1 G42\nM5\nM30\n",
    negativeSnippet: "O1234\nT1 M6\nS1200 M3\nG41 D1\nG40\nG42 D2\nG40\nM5\nM30\n"
  },
  {
    id: "fanuc.m01-while-coolant-on",
    severity: "warning",
    messageMatcher: /M01 while coolant is still on/,
    summary: "Turn coolant off with M9 before an M01 optional stop.",
    positiveSnippet: "O1234\nT1 M6\nS1200 M3\nM8\nM01\nM9\nM5\nM30\n",
    negativeSnippet: "O1234\nT1 M6\nS1200 M3\nM8\nM9\nM01\nM5\nM30\n"
  },
  {
    id: "fanuc.m01-while-cutter-comp",
    severity: "warning",
    messageMatcher: /M01 while cutter compensation \(G41\/G42\) is still active/,
    summary: "Cancel cutter compensation with G40 before an M01 optional stop.",
    positiveSnippet: "O1234\nT1 M6\nS1200 M3\nG41 D1\nM01\nG40\nM5\nM30\n",
    negativeSnippet: "O1234\nT1 M6\nS1200 M3\nG41 D1\nG40\nM01\nM5\nM30\n"
  },
  {
    id: "fanuc.m01-while-canned",
    severity: "warning",
    messageMatcher: /M01 while a canned cycle is still active/,
    summary: "Cancel canned cycles with G80 before an M01 optional stop.",
    positiveSnippet: "O1234\nT1 M6\nS1200 M3\nG81 X1. Y1. Z-1. R1. F50.\nM01\nG80\nM5\nM30\n",
    negativeSnippet: "O1234\nT1 M6\nS1200 M3\nG81 X1. Y1. Z-1. R1. F50.\nG80\nM01\nM5\nM30\n"
  },
  {
    id: "fanuc.m01-while-tool-length",
    severity: "warning",
    messageMatcher: /M01 while tool length compensation \(G43\) is still active/,
    summary: "Cancel tool length compensation with G49 before an M01 optional stop.",
    positiveSnippet: "O1234\nT1 M6\nS1200 M3\nG43 H1 Z25.\nM01\nG49\nM5\nM30\n",
    negativeSnippet: "O1234\nT1 M6\nS1200 M3\nG43 H1 Z25.\nG49\nM01\nM5\nM30\n"
  },
  {
    id: "fanuc.m01-while-rotation",
    severity: "warning",
    messageMatcher: /M01 while coordinate rotation \(G68\) is still active/,
    summary: "Cancel coordinate rotation with G69 before an M01 optional stop.",
    positiveSnippet: "O1234\nT1 M6\nS1200 M3\nG68 X0. Y0. R15.\nM01\nG69\nM5\nM30\n",
    negativeSnippet: "O1234\nT1 M6\nS1200 M3\nG68 X0. Y0. R15.\nG69\nM01\nM5\nM30\n"
  },
  {
    id: "fanuc.m00-while-rotation",
    severity: "warning",
    messageMatcher: /M00 while coordinate rotation \(G68\) is still active/,
    summary: "Cancel coordinate rotation with G69 before an M00 program stop.",
    positiveSnippet: "O1234\nT1 M6\nS1200 M3\nG68 X0. Y0. R15.\nM00\nG69\nM5\nM30\n",
    negativeSnippet: "O1234\nT1 M6\nS1200 M3\nG68 X0. Y0. R15.\nG69\nM00\nM5\nM30\n"
  },
  {
    id: "fanuc.m02-while-rotation",
    severity: "warning",
    messageMatcher: /M02 while coordinate rotation \(G68\) is still active/,
    summary: "Cancel coordinate rotation with G69 before an M02 program end.",
    positiveSnippet: "O1234\nT1 M6\nS1200 M3\nG68 X0. Y0. R15.\nM5\nM02\nG69\n",
    negativeSnippet: "O1234\nT1 M6\nS1200 M3\nG68 X0. Y0. R15.\nG69\nM5\nM02\n"
  },
  {
    id: "fanuc.m30-while-rotation",
    severity: "warning",
    messageMatcher: /M30 while coordinate rotation \(G68\) is still active/,
    summary: "Cancel coordinate rotation with G69 before an M30 program end.",
    positiveSnippet: "O1234\nT1 M6\nS1200 M3\nG68 X0. Y0. R15.\nM5\nM30\n",
    negativeSnippet: "O1234\nT1 M6\nS1200 M3\nG68 X0. Y0. R15.\nG69\nM5\nM30\n"
  },
  {
    id: "fanuc.g30-while-cutter-comp",
    severity: "warning",
    messageMatcher: /G30 while cutter compensation \(G41\/G42\) is still active/,
    summary: "Cancel cutter compensation with G40 before G30 secondary reference return.",
    positiveSnippet: "O1234\nT1 M6\nS1200 M3\nG41 D1\nG30 Z0.\nG40\nM5\nM30\n",
    negativeSnippet: "O1234\nT1 M6\nS1200 M3\nG41 D1\nG40\nG30 Z0.\nM5\nM30\n"
  },
  {
    id: "fanuc.g30-while-canned",
    severity: "warning",
    messageMatcher: /G30 while a canned cycle is still active/,
    summary: "Cancel canned cycles with G80 before G30 secondary reference return.",
    positiveSnippet: "O1234\nT1 M6\nS1200 M3\nG81 X1. Y1. Z-1. R1. F50.\nG30 Z0.\nG80\nM5\nM30\n",
    negativeSnippet: "O1234\nT1 M6\nS1200 M3\nG81 X1. Y1. Z-1. R1. F50.\nG80\nG30 Z0.\nM5\nM30\n"
  },
  {
    id: "fanuc.g28-while-tool-length",
    severity: "warning",
    messageMatcher: /G28 while tool length compensation \(G43\) is still active/,
    summary: "Cancel tool length compensation with G49 before G28 reference return.",
    positiveSnippet: "O1234\nT1 M6\nS1200 M3\nG43 H1 Z25.\nG28 Z0.\nG49\nM5\nM30\n",
    negativeSnippet: "O1234\nT1 M6\nS1200 M3\nG43 H1 Z25.\nG49\nG28 Z0.\nM5\nM30\n"
  },
  {
    id: "fanuc.g53-while-tool-length",
    severity: "warning",
    messageMatcher: /G53 while tool length compensation \(G43\) is still active/,
    summary: "Cancel tool length compensation with G49 before G53 machine-coordinate moves.",
    positiveSnippet: "O1234\nT1 M6\nS1200 M3\nG43 H1 Z25.\nG53 Z0.\nG49\nM5\nM30\n",
    negativeSnippet: "O1234\nT1 M6\nS1200 M3\nG43 H1 Z25.\nG49\nG53 Z0.\nM5\nM30\n"
  },
  {
    id: "fanuc.g28-while-rotation",
    severity: "warning",
    messageMatcher: /G28 while coordinate rotation \(G68\) is still active/,
    summary: "Cancel coordinate rotation with G69 before G28 reference return.",
    positiveSnippet: "O1234\nT1 M6\nS1200 M3\nG68 X0. Y0. R15.\nG28 Z0.\nG69\nM5\nM30\n",
    negativeSnippet: "O1234\nT1 M6\nS1200 M3\nG68 X0. Y0. R15.\nG69\nG28 Z0.\nM5\nM30\n"
  },
  {
    id: "fanuc.g53-while-rotation",
    severity: "warning",
    messageMatcher: /G53 while coordinate rotation \(G68\) is still active/,
    summary: "Cancel coordinate rotation with G69 before G53 machine-coordinate moves.",
    positiveSnippet: "O1234\nT1 M6\nS1200 M3\nG68 X0. Y0. R15.\nG53 Z0.\nG69\nM5\nM30\n",
    negativeSnippet: "O1234\nT1 M6\nS1200 M3\nG68 X0. Y0. R15.\nG69\nG53 Z0.\nM5\nM30\n"
  },
  {
    id: "fanuc.m5-while-coolant-on",
    severity: "warning",
    messageMatcher: /M5 while coolant is still on/,
    summary: "Turn coolant off with M9 when stopping the spindle with M5.",
    positiveSnippet: "O1234\nT1 M6\nS1200 M3\nM8\nM5\nM9\nM30\n",
    negativeSnippet: "O1234\nT1 M6\nS1200 M3\nM8\nM9\nM5\nM30\n"
  },
  {
    id: "fanuc.m5-while-cutter-comp",
    severity: "warning",
    messageMatcher: /M5 while cutter compensation \(G41\/G42\) is still active/,
    summary: "Cancel cutter compensation with G40 when stopping the spindle with M5.",
    positiveSnippet: "O1234\nT1 M6\nS1200 M3\nG41 D1\nM5\nG40\nM30\n",
    negativeSnippet: "O1234\nT1 M6\nS1200 M3\nG41 D1\nG40\nM5\nM30\n"
  },
  {
    id: "fanuc.g0-while-cutter-comp",
    severity: "warning",
    messageMatcher: /G0 rapid while cutter compensation \(G41\/G42\) is active/,
    summary: "Avoid rapid motion with cutter compensation active; cancel G40 or use feed motion.",
    positiveSnippet: "O1234\nT1 M6\nS1200 M3\nG41 D1\nG0 X1.\nG40\nM5\nM30\n",
    negativeSnippet: "O1234\nT1 M6\nS1200 M3\nG41 D1\nG1 X1. F50.\nG40\nM5\nM30\n"
  },
  {
    id: "fanuc.g0-while-canned",
    severity: "warning",
    messageMatcher: /G0 rapid while a canned cycle is still active/,
    summary: "Cancel canned cycles with G80 before G0 rapid moves.",
    positiveSnippet: "O1234\nT1 M6\nS1200 M3\nG81 X1. Y1. Z-1. R1. F50.\nG0 Z1.\nG80\nM5\nM30\n",
    negativeSnippet: "O1234\nT1 M6\nS1200 M3\nG81 X1. Y1. Z-1. R1. F50.\nG80\nG0 Z1.\nM5\nM30\n"
  },
  {
    id: "fanuc.coolant-on-while-spindle-off",
    severity: "warning",
    messageMatcher: /Coolant on \(M7\/M8\) while spindle is off/,
    summary: "After the spindle has been stopped, do not turn coolant on again without restarting the spindle.",
    positiveSnippet: "O1234\nT1 M6\nS1200 M3\nM5\nM8\nM9\nM30\n",
    negativeSnippet: "O1234\nT1 M6\nS1200 M3\nM5\nS1200 M3\nM8\nM9\nM5\nM30\n"
  },
  {
    id: "fanuc.g43-and-g41-same-block",
    severity: "warning",
    messageMatcher: /G43 and G41\/G42 on the same block/,
    summary: "Apply tool length and cutter compensation on separate blocks.",
    positiveSnippet: "O1234\nT1 M6\nS1200 M3\nG43 H1 G41 D1 Z25.\nG40\nG49\nM5\nM30\n",
    negativeSnippet: "O1234\nT1 M6\nS1200 M3\nG43 H1 Z25.\nG41 D1\nG40\nG49\nM5\nM30\n"
  },
  {
    id: "fanuc.g68-and-g51-same-block",
    severity: "warning",
    messageMatcher: /G68 and G51 on the same block/,
    summary: "Do not apply coordinate rotation and scaling on the same block.",
    positiveSnippet: "O1234\nT1 M6\nS1200 M3\nG68 X0. Y0. R15. G51 P2.\nG69\nG50\nM5\nM30\n",
    negativeSnippet: "O1234\nT1 M6\nS1200 M3\nG68 X0. Y0. R15.\nG51 P2.\nG69\nG50\nM5\nM30\n"
  },
  {
    id: "fanuc.g4-and-m6-same-block",
    severity: "warning",
    messageMatcher: /G4 dwell and M6 on the same block/,
    summary: "Separate dwell (G4) and tool change (M6).",
    positiveSnippet: "O1234\nT1\nG4 P1. M6\nM30\n",
    negativeSnippet: "O1234\nT1\nG4 P1.\nM6\nM30\n"
  }
];
