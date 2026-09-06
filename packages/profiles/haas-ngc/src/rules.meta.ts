import type { ProfileRuleDoc } from "@cnc/core";

/**
 * Stable, append-only documentation registry for the Haas NGC profile pack.
 *
 * Every entry is contract-tested in `tests/rulesMeta.spec.ts` and consumed by
 * the root `scripts/generate-profile-pack-docs.mjs` to render `PROFILE_PACKS.md`.
 *
 * IMPORTANT: do NOT remove or rename ids — downstream tooling (and this
 * registry's contract test) treats the `id` as the stable identifier.
 */
export const haasNgcRuleDocs: ProfileRuleDoc[] = [
  {
    id: "haas.m6-without-t",
    severity: "warning",
    messageMatcher: /M6 without T on the same block/,
    summary: "M6 (tool change) must be paired with T# on the same block.",
    positiveSnippet: "O0001\nM6\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nM30\n"
  },
  {
    id: "haas.spindle-on-without-s",
    severity: "warning",
    messageMatcher: /Spindle start \(M3\/M4\/M13\/M14\) without S/,
    summary: "Spindle on (M3/M4/M13/M14) must specify an explicit S RPM.",
    positiveSnippet: "O0001\nT1 M6\nM3\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nS1200 M3\nM30\n"
  },
  {
    id: "haas.spindle-on-with-s0",
    severity: "warning",
    messageMatcher: /Spindle start with S0/,
    summary: "Spindle start with S0 — verify intentional stop or missing speed.",
    positiveSnippet: "O0001\nT1 M6\nS0 M3\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nS1200 M3\nM30\n"
  },
  {
    id: "haas.g43-without-h",
    severity: "warning",
    messageMatcher: /G43 without H on the same block/,
    summary: "G43 (tool length comp) requires an H offset on the same block.",
    positiveSnippet: "O0001\nT1 M6\nS1200 M3\nG43 Z25.\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nS1200 M3\nG43 H1 Z25.\nM30\n"
  },
  {
    id: "haas.g43-with-h0",
    severity: "warning",
    messageMatcher: /G43 with H0/,
    summary: "G43 with H0 — tool length offset zero is usually invalid for a real tool.",
    positiveSnippet: "O0001\nT1 M6\nS1200 M3\nG43 H0 Z25.\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nS1200 M3\nG43 H1 Z25.\nM30\n"
  },
  {
    id: "haas.first-g43-without-z",
    severity: "warning",
    messageMatcher: /First G43 activation has no meaningful Z move/,
    summary: "First G43 should include a meaningful clearance/retract Z on the same block.",
    positiveSnippet: "O0001\nT1 M6\nS1200 M3\nG43 H1\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nS1200 M3\nG43 H1 Z25.\nM30\n"
  },
  {
    id: "haas.g41-g42-without-d",
    severity: "warning",
    messageMatcher: /G41\/G42 without D and no prior D offset/,
    summary: "G41/G42 (cutter comp) requires a D offset (or a prior D in scope).",
    positiveSnippet: "O0001\nT1 M6\nS1200 M3\nG43 H1 Z25.\nG41 X10. Y10.\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nS1200 M3\nG43 H1 Z25.\nG41 D1 X10. Y10.\nM30\n"
  },
  {
    id: "haas.g41-g42-with-d0",
    severity: "warning",
    messageMatcher: /G41\/G42 with D0/,
    summary: "G41/G42 with D0 — cutter comp offset zero is usually invalid.",
    positiveSnippet: "O0001\nT1 M6\nS1200 M3\nG43 H1 Z25.\nG41 D0 X10. Y10.\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nS1200 M3\nG43 H1 Z25.\nG41 D1 X10. Y10.\nM30\n"
  },
  {
    id: "haas.cutter-comp-active-at-end",
    severity: "warning",
    messageMatcher: /Program ends with cutter compensation \(G41\/G42\) still active/,
    summary: "Cancel cutter compensation with G40 before M02/M30.",
    positiveSnippet: "O0001\nT1 M6\nS1200 M3\nG43 H1 Z25.\nG41 D1 X10. Y10.\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nS1200 M3\nG43 H1 Z25.\nG41 D1 X10. Y10.\nG40\nM30\n"
  },
  {
    id: "haas.feed-motion-without-f",
    severity: "warning",
    messageMatcher: /G1\/G2\/G3 without F and no prior F/,
    summary: "G1/G2/G3 feed motion needs an explicit F (on the block or earlier in the program).",
    positiveSnippet: "O0001\nT1 M6\nS1200 M3\nG1 X10. Y10.\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nS1200 M3\nG1 X10. Y10. F200.\nM30\n"
  },
  {
    id: "haas.feed-f0",
    severity: "warning",
    messageMatcher: /F0 feed rate/,
    summary: "F0 feed rate — verify intentional zero feed or missing feed value.",
    positiveSnippet: "O0001\nT1 M6\nS1200 M3\nG1 X10. F0\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nS1200 M3\nG1 X10. F200.\nM30\n"
  },
  {
    id: "haas.arc-without-center-or-radius",
    severity: "warning",
    messageMatcher: /G2\/G3 arc without R or I\/J\/K/,
    summary: "G2/G3 arcs require R or I/J/K center offsets.",
    positiveSnippet: "O0001\nT1 M6\nS1200 M3\nG2 X10. Y10. F100.\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nS1200 M3\nG2 X10. Y10. R5. F100.\nM30\n"
  },
  {
    id: "haas.coolant-without-spindle",
    severity: "warning",
    messageMatcher: /Coolant on \(M7\/M8\) before any spindle start/,
    summary: "Coolant (M7/M8) before any spindle start — verify intentional order.",
    positiveSnippet: "O0001\nT1 M6\nM8\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nS1200 M3\nM8\nM30\n"
  },
  {
    id: "haas.canned-without-z",
    severity: "warning",
    messageMatcher: /Canned cycle \(G73\/G74\/G76\/G81-G89\) without Z depth/,
    summary: "Canned cycle activation needs a Z depth on the block or earlier in the active cycle.",
    positiveSnippet: "O0001\nT1 M6\nS1200 M3\nG81 X10. Y10. R2. F100.\nG80\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nS1200 M3\nG81 X10. Y10. Z-5. R2. F100.\nG80\nM30\n"
  },
  {
    id: "haas.canned-without-r",
    severity: "warning",
    messageMatcher: /Canned cycle \(G73\/G74\/G76\/G81-G89\) without R plane/,
    summary: "Canned cycle activation needs an R plane on the block or earlier in the active cycle.",
    positiveSnippet: "O0001\nT1 M6\nS1200 M3\nG81 X10. Y10. Z-5. F100.\nG80\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nS1200 M3\nG81 X10. Y10. Z-5. R2. F100.\nG80\nM30\n"
  },
  {
    id: "haas.canned-active-at-end",
    severity: "warning",
    messageMatcher: /Program ends with a canned cycle still active/,
    summary: "Cancel canned cycles with G80 before M02/M30.",
    positiveSnippet: "O0001\nT1 M6\nS1200 M3\nG81 X10. Y10. Z-5. R2. F100.\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nS1200 M3\nG81 X10. Y10. Z-5. R2. F100.\nG80\nM30\n"
  },
  {
    id: "haas.m6-while-canned-active",
    severity: "warning",
    messageMatcher: /M6 while a canned cycle is still active/,
    summary: "Cancel canned cycles with G80 before a tool change (M6).",
    positiveSnippet: "O0001\nT1 M6\nS1200 M3\nG81 X10. Y10. Z-5. R2. F100.\nT2 M6\nG80\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nS1200 M3\nG81 X10. Y10. Z-5. R2. F100.\nG80\nT2 M6\nM30\n"
  },
  {
    id: "haas.g20-and-g21-mixed",
    severity: "warning",
    messageMatcher: /Program contains both G20 and G21/,
    summary: "Mixing G20 and G21 in one program is ambiguous — pick inch or metric.",
    positiveSnippet: "O0001\nG20\nG21\nT1 M6\nM30\n",
    negativeSnippet: "O0001\nG21\nT1 M6\nM30\n"
  },
  {
    id: "haas.spindle-on-at-end",
    severity: "warning",
    messageMatcher: /Program ends with spindle still on/,
    summary: "Stop the spindle with M5 before M02/M30.",
    positiveSnippet: "O0001\nT1 M6\nS1200 M3\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nS1200 M3\nM5\nM30\n"
  },
  {
    id: "haas.coolant-on-at-end",
    severity: "warning",
    messageMatcher: /Program ends with coolant still on/,
    summary: "Turn coolant off with M9 before M02/M30.",
    positiveSnippet: "O0001\nT1 M6\nS1200 M3\nM8\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nS1200 M3\nM8\nM5\nM9\nM30\n"
  },
  {
    id: "haas.g43-active-at-end",
    severity: "warning",
    messageMatcher: /Program ends with tool length compensation \(G43\) still active/,
    summary: "Cancel tool length compensation with G49 before M02/M30.",
    positiveSnippet: "O0001\nT1 M6\nS1200 M3\nG43 H1 Z25.\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nS1200 M3\nG43 H1 Z25.\nG49\nM5\nM30\n"
  },
  {
    id: "haas.g91-active-at-end",
    severity: "warning",
    messageMatcher: /Program ends in incremental mode \(G91\)/,
    summary: "Restore absolute mode with G90 before M02/M30.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG91\nG0 X1.\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG91\nG0 X1.\nG90\nM30\n"
  },
  {
    id: "haas.m6-while-spindle-on",
    severity: "warning",
    messageMatcher: /M6 while spindle is still on/,
    summary: "Stop the spindle with M5 before a tool change (M6).",
    positiveSnippet: "O0001\nT1 M6\nS1200 M3\nT2 M6\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nS1200 M3\nM5\nT2 M6\nM30\n"
  },
  {
    id: "haas.motion-without-work-offset",
    severity: "warning",
    messageMatcher: /Axis motion before any work offset \(G54-G59\/G154\)/,
    summary: "Select G54-G59 or G154 before axis motion (unless using G53).",
    positiveSnippet: "O0001\nT1 M6\nG0 X0 Y0\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG0 X0 Y0\nM30\n"
  },
  {
    id: "haas.g53-in-incremental",
    severity: "warning",
    messageMatcher: /G53 with incremental mode \(G91\) active/,
    summary: "G53 machine coordinates should be used with G90, not G91.",
    positiveSnippet: "O0001\nT1 M6\nG91\nG53 Z0\nG90\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG90\nG53 Z0\nM30\n"
  },
  {
    id: "haas.non-xy-plane-at-end",
    severity: "warning",
    messageMatcher: /Program ends in G1[89] plane/,
    summary: "Restore G17 (XY) before end when a mill program used G18/G19.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG18\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG18\nG17\nM30\n"
  },
  {
    id: "haas.feed-while-spindle-off",
    severity: "warning",
    messageMatcher: /G1\/G2\/G3 while spindle is off/,
    summary: "Start the spindle before G1/G2/G3 feed motion.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG1 X10. F100.\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG1 X10. F100.\nM5\nM30\n"
  },
  {
    id: "haas.rapid-negative-z-without-g43",
    severity: "warning",
    messageMatcher: /G0 with negative Z while tool length compensation \(G43\) is inactive/,
    summary: "Avoid G0 plunges to negative Z without G43 tool length active.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG0 Z-1.\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nG0 Z-1.\nG49\nM30\n"
  },
  {
    id: "haas.cutter-comp-during-rapid",
    severity: "warning",
    messageMatcher: /G0 rapid while cutter compensation \(G41\/G42\) is active/,
    summary: "Do not rapid (G0) with G41/G42 active — cancel with G40 first.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG41 D1\nG0 X10.\nG40\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG41 D1\nG1 X10. F100.\nG40\nM5\nM30\n"
  },
  {
    id: "haas.m98-without-p",
    severity: "warning",
    messageMatcher: /M98 without P/,
    summary: "M98 subprogram calls require an explicit P program number.",
    positiveSnippet: "O0001\nM98\nM30\n",
    negativeSnippet: "O0001\nM98 P1000\nM30\nO1000\nM99\n"
  },
  {
    id: "haas.m97-without-p",
    severity: "warning",
    messageMatcher: /M97 without P/,
    summary: "M97 local subprogram calls require an explicit P (N-target).",
    positiveSnippet: "O0001\nM97\nM30\n",
    negativeSnippet: "O0001\nM97 P100\nM30\nN100\nM99\n"
  },
  {
    id: "haas.g65-without-p",
    severity: "warning",
    messageMatcher: /G65 without P/,
    summary: "G65 macro calls require an explicit P program number.",
    positiveSnippet: "O0001\nG65\nM30\n",
    negativeSnippet: "O0001\nG65 P9010\nM30\n"
  },
  {
    id: "haas.dwell-without-time",
    severity: "warning",
    messageMatcher: /G4 dwell without P or X/,
    summary: "G4 dwell needs an explicit P or X time value.",
    positiveSnippet: "O0001\nG4\nM30\n",
    negativeSnippet: "O0001\nG4 P1000\nM30\n"
  },
  {
    id: "haas.g43-h-mismatched-t",
    severity: "warning",
    messageMatcher: /G43 H\d+ does not match last tool T\d+/,
    summary: "G43 H offset should usually match the active tool number T.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG43 H2 Z25.\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG43 H1 Z25.\nM5\nM30\n"
  },
  {
    id: "haas.work-offset-change-after-motion",
    severity: "warning",
    messageMatcher: /Work offset changed after axis motion/,
    summary: "Changing G54-G59/G154 after motion may be unintentional — verify the switch.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG0 X0\nG55\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG0 X0\nM30\n"
  },
  {
    id: "haas.g28-multi-axis",
    severity: "warning",
    messageMatcher: /G28 with multiple axes on one block/,
    summary: "Prefer single-axis G28 moves instead of combined XYZ home returns.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG28 X0 Y0\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG28 Z0\nM30\n"
  },
  {
    id: "haas.g30-multi-axis",
    severity: "warning",
    messageMatcher: /G30 with multiple axes on one block/,
    summary: "Prefer single-axis G30 moves instead of combined XYZ secondary home returns.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG30 X0 Y0\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG30 Z0\nM30\n"
  },
  {
    id: "haas.arc-r-and-ijk",
    severity: "warning",
    messageMatcher: /G2\/G3 arc specifies both R and I\/J\/K/,
    summary: "Arcs should use either R or I/J/K, not both on the same block.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG2 X10. Y10. R5. I1. F100.\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG2 X10. Y10. R5. F100.\nM5\nM30\n"
  },
  {
    id: "haas.g94-and-g95-mixed",
    severity: "warning",
    messageMatcher: /Program contains both G94 and G95/,
    summary: "Mixing G94 and G95 feed modes in one program is ambiguous — pick one.",
    positiveSnippet: "O0001\nG94\nG95\nT1 M6\nM30\n",
    negativeSnippet: "O0001\nG94\nT1 M6\nM30\n"
  },
  {
    id: "haas.missing-o-header",
    severity: "warning",
    messageMatcher: /Program has no O header/,
    summary: "Haas NGC programs usually begin with an O#### program number.",
    positiveSnippet: "T1 M6\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nM30\n"
  },
  {
    id: "haas.spindle-direction-conflict",
    severity: "warning",
    messageMatcher: /Multiple M codes on the same block/,
    summary: "Superseded by haas.multiple-m-codes-same-block — Haas allows only one M function per block.",
    positiveSnippet: "O0001\nT1 M6\nS1200 M3 M4\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nS1200 M3\nM30\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.multiple-m-codes-same-block (Haas allows only one M function per block)."
  },
  {
    id: "haas.canned-without-f",
    severity: "warning",
    messageMatcher: /Canned cycle \(G73\/G74\/G76\/G81-G89\) without F and no prior F/,
    summary: "Canned cycle activation needs a feed F on the block or earlier in the program.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG81 X10. Y10. Z-5. R2.\nG80\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG81 X10. Y10. Z-5. R2. F100.\nG80\nM5\nM30\n"
  },
  {
    id: "haas.peck-without-q",
    severity: "warning",
    messageMatcher: /Peck canned cycle \(G73\/G83\) without Q/,
    summary: "G73/G83 peck cycles need an explicit Q peck depth.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG83 X10. Y10. Z-5. R2. F100.\nG80\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG83 X10. Y10. Z-5. R2. Q2. F100.\nG80\nM5\nM30\n"
  },
  {
    id: "haas.g68-active-at-end",
    severity: "warning",
    messageMatcher: /Program ends with coordinate rotation \(G68\) still active/,
    summary: "Cancel coordinate rotation with G69 before M02/M30.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG68\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG68\nG69\nM30\n"
  },
  {
    id: "haas.cutter-side-flip-without-g40",
    severity: "warning",
    messageMatcher: /Cutter compensation flipped G4[12] to G4[12] without G40/,
    summary: "Cancel with G40 before switching between G41 and G42.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG41 D1\nG42 D1\nG40\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG41 D1\nG40\nG42 D1\nG40\nM30\n"
  },
  {
    id: "haas.g43-without-prior-tool",
    severity: "warning",
    messageMatcher: /G43 before any tool selection \(T\)/,
    summary: "Select a tool (Tn) before applying G43 tool length compensation.",
    positiveSnippet: "O0001\nG54\nG43 H1 Z25.\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nM30\n"
  },
  {
    id: "haas.g43-and-g49-same-block",
    severity: "warning",
    messageMatcher: /G43 and G49 on the same block/,
    summary: "Do not apply and cancel tool length compensation on the same block.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 G49 Z25.\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nG49\nM30\n"
  },
  {
    id: "haas.missing-distance-mode",
    severity: "warning",
    messageMatcher: /Axis motion before G90\/G91/,
    summary: "Set G90 or G91 before the first axis move.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG0 X0\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG90\nG0 X0\nM30\n"
  },
  {
    id: "haas.unit-change-after-motion",
    severity: "warning",
    messageMatcher: /Unit mode changed after axis motion/,
    summary: "Changing G20/G21 after motion may be unintentional — verify the switch.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG20\nG90\nG0 X0\nG21\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG21\nG90\nG0 X0\nM30\n"
  },
  {
    id: "haas.tapping-without-spindle",
    severity: "warning",
    messageMatcher: /Tapping cycle \(G74\/G84\) while spindle is off/,
    summary: "Start the spindle before G74/G84 tapping cycles.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG90\nG84 X10. Y10. Z-5. R2. F100.\nG80\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG90\nS500 M3\nG84 X10. Y10. Z-5. R2. F100.\nG80\nM5\nM30\n"
  },
  {
    id: "haas.g51-active-at-end",
    severity: "warning",
    messageMatcher: /Program ends with scaling \(G51\) still active/,
    summary: "Cancel scaling with G50 before M02/M30.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG51\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG51\nG50\nM30\n"
  },
  {
    id: "haas.plane-change-after-motion",
    severity: "warning",
    messageMatcher: /Plane mode changed after axis motion/,
    summary: "Changing G17/G18/G19 after motion may be unintentional — verify the switch.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG90\nG17\nG0 X0\nG18\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG90\nG17\nG0 X0\nM30\n"
  },
  {
    id: "haas.feed-mode-change-after-motion",
    severity: "warning",
    messageMatcher: /Feed mode changed after cutting motion/,
    summary: "Changing G94/G95 after feed/canned motion may be unintentional — verify the switch.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG90\nG94\nS1200 M3\nG1 X10. F100.\nG95\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG90\nG94\nS1200 M3\nG1 X10. F100.\nM5\nM30\n"
  },
  {
    id: "haas.g61-and-g64-mixed",
    severity: "warning",
    messageMatcher: /Program contains both G61 and G64/,
    summary: "Mixing G61 and G64 path modes in one program is ambiguous — pick one.",
    positiveSnippet: "O0001\nG61\nG64\nT1 M6\nM30\n",
    negativeSnippet: "O0001\nG64\nT1 M6\nM30\n"
  },
  {
    id: "haas.spindle-on-and-off-same-block",
    severity: "warning",
    messageMatcher: /Multiple M codes on the same block/,
    summary: "Superseded by haas.multiple-m-codes-same-block — Haas allows only one M function per block.",
    positiveSnippet: "O0001\nT1 M6\nS1200 M3 M5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nS1200 M3\nM5\nM30\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.multiple-m-codes-same-block (Haas allows only one M function per block)."
  },
  {
    id: "haas.coolant-on-and-off-same-block",
    severity: "warning",
    messageMatcher: /Multiple M codes on the same block/,
    summary: "Superseded by haas.multiple-m-codes-same-block — Haas allows only one M function per block.",
    positiveSnippet: "O0001\nT1 M6\nS1200 M3\nM8 M9\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nS1200 M3\nM8\nM9\nM5\nM30\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.multiple-m-codes-same-block (Haas allows only one M function per block)."
  },
  {
    id: "haas.distance-mode-change-after-motion",
    severity: "warning",
    messageMatcher: /Distance mode changed after axis motion/,
    summary: "Changing G90/G91 after motion may be unintentional — verify the switch.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG90\nG0 X0\nG91\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG90\nG0 X0\nM30\n"
  },
  {
    id: "haas.g40-and-cutter-comp-same-block",
    severity: "warning",
    messageMatcher: /G40 and G41\/G42 on the same block/,
    summary: "Do not cancel and apply cutter compensation on the same block.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG40 G41 D1\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG41 D1\nG40\nM30\n"
  },
  {
    id: "haas.g80-and-canned-same-block",
    severity: "warning",
    messageMatcher: /G80 and a canned cycle on the same block/,
    summary: "Do not cancel and start a canned cycle on the same block.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG90\nG81 Z-5. R2. F100. G80\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG90\nG81 Z-5. R2. F100.\nG80\nM30\n"
  },
  {
    id: "haas.m6-while-cutter-comp",
    severity: "warning",
    messageMatcher: /M6 while cutter compensation \(G41\/G42\) is still active/,
    summary: "Cancel cutter compensation with G40 before a tool change (M6).",
    positiveSnippet: "O0001\nT1 M6\nG54\nG90\nG41 D1\nT2 M6\nG40\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG90\nG41 D1\nG40\nT2 M6\nM30\n"
  },
  {
    id: "haas.m6-while-tool-length",
    severity: "warning",
    messageMatcher: /M6 while tool length compensation \(G43\) is still active/,
    summary: "Cancel tool length with G49 before a tool change (M6).",
    positiveSnippet: "O0001\nT1 M6\nG54\nG90\nG43 H1 Z25.\nT2 M6\nG49\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG90\nG43 H1 Z25.\nG49\nT2 M6\nM30\n"
  },
  {
    id: "haas.path-mode-change-after-motion",
    severity: "warning",
    messageMatcher: /Path mode changed after axis motion/,
    summary: "Changing G61/G64 after motion may be unintentional — verify the switch.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG90\nG61\nG0 X0\nG64\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG90\nG61\nG0 X0\nM30\n"
  },
  {
    id: "haas.g41-and-g42-same-block",
    severity: "warning",
    messageMatcher: /G41 and G42 on the same block/,
    summary: "Do not combine G41 and G42 on one block — pick one cutter side.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG41 G42 D1\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG41 D1\nG40\nM30\n"
  },
  {
    id: "haas.m6-while-coolant-on",
    severity: "warning",
    messageMatcher: /M6 while coolant is still on/,
    summary: "Turn coolant off with M9 before a tool change (M6).",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM8\nT2 M6\nM9\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM8\nM9\nT2 M6\nM5\nM30\n"
  },
  {
    id: "haas.g53-with-work-offset",
    severity: "warning",
    messageMatcher: /G53 and a work offset \(G54-G59\/G154\) on the same block/,
    summary: "Do not combine G53 machine coordinates with a work offset on one block.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG90\nG53 G54 Z0\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG90\nG53 Z0\nM30\n"
  },
  {
    id: "haas.coolant-m7-and-m8-same-block",
    severity: "warning",
    messageMatcher: /Multiple M codes on the same block/,
    summary: "Superseded by haas.multiple-m-codes-same-block — Haas allows only one M function per block.",
    positiveSnippet: "O0001\nT1 M6\nS1200 M3\nM7 M8\nM9\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nS1200 M3\nM8\nM9\nM5\nM30\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.multiple-m-codes-same-block (Haas allows only one M function per block)."
  },
  {
    id: "haas.g68-and-g69-same-block",
    severity: "warning",
    messageMatcher: /G68 and G69 on the same block/,
    summary: "Do not apply and cancel coordinate rotation on the same block.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG68 G69\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG68\nG69\nM30\n"
  },
  {
    id: "haas.g50-and-g51-same-block",
    severity: "warning",
    messageMatcher: /G51 and G50 on the same block/,
    summary: "Do not apply and cancel scaling on the same block.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG51 G50\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG51\nG50\nM30\n"
  },
  {
    id: "haas.g28-and-g30-same-block",
    severity: "warning",
    messageMatcher: /G28 and G30 on the same block/,
    summary: "Do not combine G28 and G30 reference-return on one block.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG90\nG28 G30 Z0\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG90\nG28 Z0\nM30\n"
  },
  {
    id: "haas.spindle-reverse-without-stop",
    severity: "warning",
    messageMatcher: /Spindle direction reversed without M5 stop/,
    summary: "Stop the spindle with M5 before reversing M3/M4 (or M13/M14).",
    positiveSnippet: "O0001\nT1 M6\nS1200 M3\nS1200 M4\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nS1200 M3\nM5\nS1200 M4\nM5\nM30\n"
  },
  {
    id: "haas.coolant-while-spindle-off",
    severity: "warning",
    messageMatcher: /Coolant on \(M7\/M8\) while spindle is off/,
    summary: "Do not turn coolant on after the spindle has been stopped — restart spindle first.",
    positiveSnippet: "O0001\nT1 M6\nS1200 M3\nM5\nM8\nM9\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nS1200 M3\nM8\nM9\nM5\nM30\n"
  },
  {
    id: "haas.m98-and-m97-same-block",
    severity: "warning",
    messageMatcher: /Multiple M codes on the same block/,
    summary: "Superseded by haas.multiple-m-codes-same-block — Haas allows only one M function per block.",
    positiveSnippet: "O0001\nT1 M6\nM98 P2 M97 P10\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nM98 P2\nM30\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.multiple-m-codes-same-block (Haas allows only one M function per block)."
  },
  {
    id: "haas.g65-and-m98-same-block",
    severity: "warning",
    messageMatcher: /G65 and M98 on the same block/,
    summary: "Do not combine G65 macro call and M98 subprogram call on one block.",
    positiveSnippet: "O0001\nT1 M6\nG65 P9010 M98 P2\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG65 P9010\nM30\n"
  },
  {
    id: "haas.m00-and-m01-same-block",
    severity: "warning",
    messageMatcher: /Multiple M codes on the same block/,
    summary: "Superseded by haas.multiple-m-codes-same-block — Haas allows only one M function per block.",
    positiveSnippet: "O0001\nT1 M6\nM00 M01\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nM00\nM30\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.multiple-m-codes-same-block (Haas allows only one M function per block)."
  },
  {
    id: "haas.g28-while-absolute",
    severity: "warning",
    messageMatcher: /G28 while absolute mode \(G90\) is active/,
    summary: "Use G91 with G28 intermediate points, then restore G90.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG90\nG28 Z0\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG91\nG28 Z0\nG90\nM30\n"
  },
  {
    id: "haas.g30-while-absolute",
    severity: "warning",
    messageMatcher: /G30 while absolute mode \(G90\) is active/,
    summary: "Use G91 with G30 intermediate points, then restore G90.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG90\nG30 Z0\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG91\nG30 Z0\nG90\nM30\n"
  },
  {
    id: "haas.g65-and-m97-same-block",
    severity: "warning",
    messageMatcher: /G65 and M97 on the same block/,
    summary: "Do not combine G65 macro call and M97 local subprogram call on one block.",
    positiveSnippet: "O0001\nT1 M6\nG65 P9010 M97 P10\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG65 P9010\nM30\n"
  },
  {
    id: "haas.m99-and-m30-same-block",
    severity: "warning",
    messageMatcher: /Multiple M codes on the same block/,
    summary: "Superseded by haas.multiple-m-codes-same-block — Haas allows only one M function per block.",
    positiveSnippet: "O0001\nT1 M6\nM99 M30\n",
    negativeSnippet: "O0001\nT1 M6\nM30\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.multiple-m-codes-same-block (Haas allows only one M function per block)."
  },
  {
    id: "haas.m6-while-rotation",
    severity: "warning",
    messageMatcher: /M6 while coordinate rotation \(G68\) is still active/,
    summary: "Cancel coordinate rotation with G69 before a tool change (M6).",
    positiveSnippet: "O0001\nT1 M6\nG54\nG68\nT2 M6\nG69\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG68\nG69\nT2 M6\nM30\n"
  },
  {
    id: "haas.m6-while-scaling",
    severity: "warning",
    messageMatcher: /M6 while scaling \(G51\) is still active/,
    summary: "Cancel scaling with G50 before a tool change (M6).",
    positiveSnippet: "O0001\nT1 M6\nG54\nG51\nT2 M6\nG50\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG51\nG50\nT2 M6\nM30\n"
  },
  {
    id: "haas.g92-coordinate-set",
    severity: "warning",
    messageMatcher: /G92 coordinate system shift is uncommon and risky/,
    summary: "Avoid G92 on mill programs — prefer work offsets (G54-G59).",
    positiveSnippet: "O0001\nT1 M6\nG54\nG92 X0 Y0\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG0 X0 Y0\nM30\n"
  },
  {
    id: "haas.m98-and-m99-same-block",
    severity: "warning",
    messageMatcher: /Multiple M codes on the same block/,
    summary: "Superseded by haas.multiple-m-codes-same-block — Haas allows only one M function per block.",
    positiveSnippet: "O0001\nT1 M6\nM98 P2 M99\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nM98 P2\nM30\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.multiple-m-codes-same-block (Haas allows only one M function per block)."
  },
  {
    id: "haas.g28-without-axis",
    severity: "warning",
    messageMatcher: /G28 without an axis word/,
    summary: "G28 should include an intermediate axis point (e.g. G91 G28 Z0).",
    positiveSnippet: "O0001\nT1 M6\nG54\nG91\nG28\nG90\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG91\nG28 Z0\nG90\nM30\n"
  },
  {
    id: "haas.g30-without-axis",
    severity: "warning",
    messageMatcher: /G30 without an axis word/,
    summary: "G30 should include an intermediate axis point (e.g. G91 G30 Z0).",
    positiveSnippet: "O0001\nT1 M6\nG54\nG91\nG30\nG90\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG91\nG30 Z0\nG90\nM30\n"
  },
  {
    id: "haas.g28-and-g53-same-block",
    severity: "warning",
    messageMatcher: /G28 and G53 on the same block/,
    summary: "Do not combine G28 reference return and G53 machine move on one block.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG91\nG28 G53 Z0\nG90\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG91\nG28 Z0\nG90\nM30\n"
  },
  {
    id: "haas.g4-zero-dwell",
    severity: "warning",
    messageMatcher: /G4 dwell with zero time/,
    summary: "G4 with P0/X0 is a zero-time dwell — verify intentional.",
    positiveSnippet: "O0001\nT1 M6\nG4 P0\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG4 P1.\nM30\n"
  },
  {
    id: "haas.g30-and-g53-same-block",
    severity: "warning",
    messageMatcher: /G30 and G53 on the same block/,
    summary: "Do not combine G30 reference return and G53 machine move on one block.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG91\nG30 G53 Z0\nG90\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG91\nG30 Z0\nG90\nM30\n"
  },
  {
    id: "haas.g53-without-axis",
    severity: "warning",
    messageMatcher: /G53 without an axis word/,
    summary: "G53 should include a machine-coordinate axis move (e.g. G53 Z0).",
    positiveSnippet: "O0001\nT1 M6\nG54\nG90\nG53\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG90\nG53 Z0\nM30\n"
  },
  {
    id: "haas.g53-multi-axis",
    severity: "warning",
    messageMatcher: /G53 with multiple axes on one block/,
    summary: "Prefer single-axis G53 moves for safer machine positioning.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG90\nG53 X0 Z0\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG90\nG53 Z0\nM30\n"
  },
  {
    id: "haas.m97-and-m99-same-block",
    severity: "warning",
    messageMatcher: /Multiple M codes on the same block/,
    summary: "Superseded by haas.multiple-m-codes-same-block — Haas allows only one M function per block.",
    positiveSnippet: "O0001\nT1 M6\nM97 P10 M99\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nM97 P10\nM30\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.multiple-m-codes-same-block (Haas allows only one M function per block)."
  },
  {
    id: "haas.g4-and-motion-same-block",
    severity: "warning",
    messageMatcher: /G4 dwell and axis motion on the same block/,
    summary: "Do not combine G4 dwell with G0/G1/G2/G3 on one block.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG90\nG4 P1. G0 X10.\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG90\nG4 P1.\nG0 X10.\nM30\n"
  },
  {
    id: "haas.g65-and-m99-same-block",
    severity: "warning",
    messageMatcher: /G65 and M99 on the same block/,
    summary: "Do not combine G65 macro call and M99 return on one block.",
    positiveSnippet: "O0001\nT1 M6\nG65 P9010 M99\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG65 P9010\nM30\n"
  },
  {
    id: "haas.m6-while-incremental",
    severity: "warning",
    messageMatcher: /M6 while incremental mode \(G91\) is active/,
    summary: "Restore absolute mode with G90 before a tool change (M6).",
    positiveSnippet: "O0001\nT1 M6\nG54\nG91\nT2 M6\nG90\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG91\nG90\nT2 M6\nM30\n"
  },
  {
    id: "haas.g4-and-m6-same-block",
    severity: "warning",
    messageMatcher: /G4 dwell and M6 on the same block/,
    summary: "Do not combine G4 dwell with a tool change (M6) on one block.",
    positiveSnippet: "O0001\nT1 M6\nG4 P1. T2 M6\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG4 P1.\nT2 M6\nM30\n"
  },
  {
    id: "haas.negative-feed-rate",
    severity: "warning",
    messageMatcher: /Negative feed rate \(F\)/,
    summary: "Feed rate F must not be negative.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG90\nS1200 M3\nG1 X10. F-100.\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG90\nS1200 M3\nG1 X10. F100.\nM5\nM30\n"
  },
  {
    id: "haas.negative-spindle-speed",
    severity: "warning",
    messageMatcher: /Negative spindle speed \(S\)/,
    summary: "Spindle speed S must not be negative.",
    positiveSnippet: "O0001\nT1 M6\nS-1200 M3\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nS1200 M3\nM5\nM30\n"
  },
  {
    id: "haas.g28-while-cutter-comp",
    severity: "warning",
    messageMatcher: /G28 while cutter compensation \(G41\/G42\) is still active/,
    summary: "Cancel cutter compensation with G40 before G28 reference return.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG90\nG41 D1\nG91\nG28 Z0\nG90\nG40\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG90\nG41 D1\nG40\nG91\nG28 Z0\nG90\nM30\n"
  },
  {
    id: "haas.g28-while-canned",
    severity: "warning",
    messageMatcher: /G28 while a canned cycle is still active/,
    summary: "Cancel the canned cycle with G80 before G28 reference return.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG90\nG81 Z-5. R2. F100.\nG91\nG28 Z0\nG90\nG80\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG90\nG81 Z-5. R2. F100.\nG80\nG91\nG28 Z0\nG90\nM30\n"
  },
  {
    id: "haas.g53-while-cutter-comp",
    severity: "warning",
    messageMatcher: /G53 while cutter compensation \(G41\/G42\) is still active/,
    summary: "Cancel cutter compensation with G40 before a G53 machine move.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG90\nG41 D1\nG53 Z0\nG40\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG90\nG41 D1\nG40\nG53 Z0\nM30\n"
  },
  {
    id: "haas.g53-while-canned",
    severity: "warning",
    messageMatcher: /G53 while a canned cycle is still active/,
    summary: "Cancel the canned cycle with G80 before a G53 machine move.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG90\nG81 Z-5. R2. F100.\nG53 Z0\nG80\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG90\nG81 Z-5. R2. F100.\nG80\nG53 Z0\nM30\n"
  },
  {
    id: "haas.g52-local-offset",
    severity: "warning",
    messageMatcher: /G52 local coordinate offset/,
    summary: "G52 local offsets should be intentional — prefer work offsets (G54-G59) when possible.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG52 X10.\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG0 X10.\nM30\n"
  },
  {
    id: "haas.g30-while-cutter-comp",
    severity: "warning",
    messageMatcher: /G30 while cutter compensation \(G41\/G42\) is still active/,
    summary: "Cancel cutter compensation with G40 before G30 secondary reference return.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG90\nG41 D1\nG91\nG30 Z0\nG90\nG40\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG90\nG41 D1\nG40\nG91\nG30 Z0\nG90\nM30\n"
  },
  {
    id: "haas.g30-while-canned",
    severity: "warning",
    messageMatcher: /G30 while a canned cycle is still active/,
    summary: "Cancel the canned cycle with G80 before G30 secondary reference return.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG90\nG81 Z-5. R2. F100.\nG91\nG30 Z0\nG90\nG80\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG90\nG81 Z-5. R2. F100.\nG80\nG91\nG30 Z0\nG90\nM30\n"
  },
  {
    id: "haas.g28-while-rotation",
    severity: "warning",
    messageMatcher: /G28 while coordinate rotation \(G68\) is still active/,
    summary: "Cancel coordinate rotation with G69 before G28 reference return.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG68\nG91\nG28 Z0\nG90\nG69\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG68\nG69\nG91\nG28 Z0\nG90\nM30\n"
  },
  {
    id: "haas.g53-while-rotation",
    severity: "warning",
    messageMatcher: /G53 while coordinate rotation \(G68\) is still active/,
    summary: "Cancel coordinate rotation with G69 before a G53 machine move.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG90\nG68\nG53 Z0\nG69\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG90\nG68\nG69\nG53 Z0\nM30\n"
  },
  {
    id: "haas.g28-while-scaling",
    severity: "warning",
    messageMatcher: /G28 while scaling \(G51\) is still active/,
    summary: "Cancel scaling with G50 before G28 reference return.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG51\nG91\nG28 Z0\nG90\nG50\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG51\nG50\nG91\nG28 Z0\nG90\nM30\n"
  },
  {
    id: "haas.g53-while-scaling",
    severity: "warning",
    messageMatcher: /G53 while scaling \(G51\) is still active/,
    summary: "Cancel scaling with G50 before a G53 machine move.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG90\nG51\nG53 Z0\nG50\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG90\nG51\nG50\nG53 Z0\nM30\n"
  },
  {
    id: "haas.g30-while-rotation",
    severity: "warning",
    messageMatcher: /G30 while coordinate rotation \(G68\) is still active/,
    summary: "Cancel coordinate rotation with G69 before G30 secondary reference return.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG68\nG91\nG30 Z0\nG90\nG69\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG68\nG69\nG91\nG30 Z0\nG90\nM30\n"
  },
  {
    id: "haas.g30-while-scaling",
    severity: "warning",
    messageMatcher: /G30 while scaling \(G51\) is still active/,
    summary: "Cancel scaling with G50 before G30 secondary reference return.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG51\nG91\nG30 Z0\nG90\nG50\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG51\nG50\nG91\nG30 Z0\nG90\nM30\n"
  },
  {
    id: "haas.g28-and-g92-same-block",
    severity: "warning",
    messageMatcher: /G28 and G92 on the same block/,
    summary: "Do not combine G28 reference return with G92 on one block.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG91\nG28 Z0 G92 X0\nG90\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG91\nG28 Z0\nG90\nM30\n"
  },
  {
    id: "haas.g53-and-g92-same-block",
    severity: "warning",
    messageMatcher: /G53 and G92 on the same block/,
    summary: "Do not combine G53 machine move with G92 on one block.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG90\nG53 Z0 G92 X0\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG90\nG53 Z0\nM30\n"
  },
  {
    id: "haas.g30-and-g92-same-block",
    severity: "warning",
    messageMatcher: /G30 and G92 on the same block/,
    summary: "Do not combine G30 secondary reference return with G92 on one block.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG91\nG30 Z0 G92 X0\nG90\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG91\nG30 Z0\nG90\nM30\n"
  },
  {
    id: "haas.g28-and-g52-same-block",
    severity: "warning",
    messageMatcher: /G28 and G52 on the same block/,
    summary: "Do not combine G28 reference return with G52 on one block.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG91\nG28 Z0 G52 X10.\nG90\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG91\nG28 Z0\nG90\nM30\n"
  },
  {
    id: "haas.g53-and-g52-same-block",
    severity: "warning",
    messageMatcher: /G53 and G52 on the same block/,
    summary: "Do not combine G53 machine move with G52 on one block.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG90\nG53 Z0 G52 X10.\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG90\nG53 Z0\nM30\n"
  },
  {
    id: "haas.g30-and-g52-same-block",
    severity: "warning",
    messageMatcher: /G30 and G52 on the same block/,
    summary: "Do not combine G30 secondary reference return with G52 on one block.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG91\nG30 Z0 G52 X10.\nG90\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG91\nG30 Z0\nG90\nM30\n"
  },
  {
    id: "haas.g92-and-g52-same-block",
    severity: "warning",
    messageMatcher: /G92 and G52 on the same block/,
    summary: "Do not combine G92 and G52 coordinate shifts on one block.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG92 X0 G52 X10.\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG52 X10.\nM30\n"
  },
  {
    id: "haas.m6-and-g28-same-block",
    severity: "warning",
    messageMatcher: /M6 and G28 on the same block/,
    summary: "Do not combine a tool change (M6) with G28 on one block.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG91\nT2 M6 G28 Z0\nG90\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG91\nG28 Z0\nG90\nT2 M6\nM30\n"
  },
  {
    id: "haas.m6-and-g30-same-block",
    severity: "warning",
    messageMatcher: /M6 and G30 on the same block/,
    summary: "Do not combine a tool change (M6) with G30 on one block.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG91\nT2 M6 G30 Z0\nG90\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG91\nG30 Z0\nG90\nT2 M6\nM30\n"
  },
  {
    id: "haas.m6-and-g53-same-block",
    severity: "warning",
    messageMatcher: /M6 and G53 on the same block/,
    summary: "Do not combine a tool change (M6) with G53 on one block.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG90\nT2 M6 G53 Z0\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG90\nG53 Z0\nT2 M6\nM30\n"
  },
  {
    id: "haas.g4-and-g28-same-block",
    severity: "warning",
    messageMatcher: /G4 dwell and G28 on the same block/,
    summary: "Do not combine G4 dwell with G28 on one block.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG91\nG28 Z0 G4 P1.\nG90\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG91\nG28 Z0\nG4 P1.\nG90\nM30\n"
  },
  {
    id: "haas.g4-and-g30-same-block",
    severity: "warning",
    messageMatcher: /G4 dwell and G30 on the same block/,
    summary: "Do not combine G4 dwell with G30 on one block.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG91\nG30 Z0 G4 P1.\nG90\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG91\nG30 Z0\nG4 P1.\nG90\nM30\n"
  },
  {
    id: "haas.g4-and-g53-same-block",
    severity: "warning",
    messageMatcher: /G4 dwell and G53 on the same block/,
    summary: "Do not combine G4 dwell with G53 on one block.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG90\nG53 Z0 G4 P1.\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG90\nG53 Z0\nG4 P1.\nM30\n"
  },
  {
    id: "haas.m6-and-m98-same-block",
    severity: "warning",
    messageMatcher: /Multiple M codes on the same block/,
    summary: "Superseded by haas.multiple-m-codes-same-block — Haas allows only one M function per block.",
    positiveSnippet: "O0001\nT1 M6\nG54\nT2 M6 M98 P2\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nT2 M6\nM98 P2\nM30\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.multiple-m-codes-same-block (Haas allows only one M function per block)."
  },
  {
    id: "haas.m6-and-m97-same-block",
    severity: "warning",
    messageMatcher: /Multiple M codes on the same block/,
    summary: "Superseded by haas.multiple-m-codes-same-block — Haas allows only one M function per block.",
    positiveSnippet: "O0001\nT1 M6\nG54\nT2 M6 M97 P10\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nT2 M6\nM97 P10\nM30\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.multiple-m-codes-same-block (Haas allows only one M function per block)."
  },
  {
    id: "haas.m6-and-g65-same-block",
    severity: "warning",
    messageMatcher: /M6 and G65 on the same block/,
    summary: "Do not combine a tool change (M6) with G65 on one block.",
    positiveSnippet: "O0001\nT1 M6\nG54\nT2 M6 G65 P9010\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nT2 M6\nG65 P9010\nM30\n"
  },
  {
    id: "haas.m6-and-m00-same-block",
    severity: "warning",
    messageMatcher: /Multiple M codes on the same block/,
    summary: "Superseded by haas.multiple-m-codes-same-block — Haas allows only one M function per block.",
    positiveSnippet: "O0001\nT1 M6\nG54\nT2 M6 M00\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nT2 M6\nM00\nM30\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.multiple-m-codes-same-block (Haas allows only one M function per block)."
  },
  {
    id: "haas.m6-and-m01-same-block",
    severity: "warning",
    messageMatcher: /Multiple M codes on the same block/,
    summary: "Superseded by haas.multiple-m-codes-same-block — Haas allows only one M function per block.",
    positiveSnippet: "O0001\nT1 M6\nG54\nT2 M6 M01\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nT2 M6\nM01\nM30\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.multiple-m-codes-same-block (Haas allows only one M function per block)."
  },
  {
    id: "haas.m98-and-g28-same-block",
    severity: "warning",
    messageMatcher: /M98 and G28 on the same block/,
    summary: "Do not combine M98 with G28 on one block.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG91\nM98 P2 G28 Z0\nG90\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG91\nG28 Z0\nG90\nM98 P2\nM30\n"
  },
  {
    id: "haas.m97-and-g28-same-block",
    severity: "warning",
    messageMatcher: /M97 and G28 on the same block/,
    summary: "Do not combine M97 with G28 on one block.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG91\nM97 P10 G28 Z0\nG90\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG91\nG28 Z0\nG90\nM97 P10\nM30\n"
  },
  {
    id: "haas.g65-and-g28-same-block",
    severity: "warning",
    messageMatcher: /G65 and G28 on the same block/,
    summary: "Do not combine G65 with G28 on one block.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG91\nG65 P9010 G28 Z0\nG90\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG91\nG28 Z0\nG90\nG65 P9010\nM30\n"
  },
  {
    id: "haas.m98-and-g53-same-block",
    severity: "warning",
    messageMatcher: /M98 and G53 on the same block/,
    summary: "Do not combine M98 with G53 on one block.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG90\nM98 P2 G53 Z0\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG90\nG53 Z0\nM98 P2\nM30\n"
  },
  {
    id: "haas.m97-and-g53-same-block",
    severity: "warning",
    messageMatcher: /M97 and G53 on the same block/,
    summary: "Do not combine M97 with G53 on one block.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG90\nM97 P10 G53 Z0\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG90\nG53 Z0\nM97 P10\nM30\n"
  },
  {
    id: "haas.g65-and-g53-same-block",
    severity: "warning",
    messageMatcher: /G65 and G53 on the same block/,
    summary: "Do not combine G65 with G53 on one block.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG90\nG65 P9010 G53 Z0\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG90\nG53 Z0\nG65 P9010\nM30\n"
  },
  {
    id: "haas.m98-and-g30-same-block",
    severity: "warning",
    messageMatcher: /M98 and G30 on the same block/,
    summary: "Do not combine M98 with G30 on one block.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG91\nM98 P2 G30 Z0\nG90\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG91\nG30 Z0\nG90\nM98 P2\nM30\n"
  },
  {
    id: "haas.m97-and-g30-same-block",
    severity: "warning",
    messageMatcher: /M97 and G30 on the same block/,
    summary: "Do not combine M97 with G30 on one block.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG91\nM97 P10 G30 Z0\nG90\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG91\nG30 Z0\nG90\nM97 P10\nM30\n"
  },
  {
    id: "haas.g65-and-g30-same-block",
    severity: "warning",
    messageMatcher: /G65 and G30 on the same block/,
    summary: "Do not combine G65 with G30 on one block.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG91\nG65 P9010 G30 Z0\nG90\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG91\nG30 Z0\nG90\nG65 P9010\nM30\n"
  },
  {
    id: "haas.m00-and-g28-same-block",
    severity: "warning",
    messageMatcher: /M00 and G28 on the same block/,
    summary: "Do not combine program stop (M00) with G28 on one block.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG91\nM00 G28 Z0\nG90\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG91\nG28 Z0\nG90\nM00\nM30\n"
  },
  {
    id: "haas.m01-and-g28-same-block",
    severity: "warning",
    messageMatcher: /M01 and G28 on the same block/,
    summary: "Do not combine optional stop (M01) with G28 on one block.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG91\nM01 G28 Z0\nG90\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG91\nG28 Z0\nG90\nM01\nM30\n"
  },
  {
    id: "haas.m00-and-g53-same-block",
    severity: "warning",
    messageMatcher: /M00 and G53 on the same block/,
    summary: "Do not combine program stop (M00) with G53 on one block.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG90\nM00 G53 Z0\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG90\nG53 Z0\nM00\nM30\n"
  },
  {
    id: "haas.m01-and-g53-same-block",
    severity: "warning",
    messageMatcher: /M01 and G53 on the same block/,
    summary: "Do not combine optional stop (M01) with G53 on one block.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG90\nM01 G53 Z0\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG90\nG53 Z0\nM01\nM30\n"
  },
  {
    id: "haas.m00-and-g30-same-block",
    severity: "warning",
    messageMatcher: /M00 and G30 on the same block/,
    summary: "Do not combine program stop (M00) with G30 on one block.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG91\nM00 G30 Z0\nG90\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG91\nG30 Z0\nG90\nM00\nM30\n"
  },
  {
    id: "haas.m01-and-g30-same-block",
    severity: "warning",
    messageMatcher: /M01 and G30 on the same block/,
    summary: "Do not combine optional stop (M01) with G30 on one block.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG91\nM01 G30 Z0\nG90\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG91\nG30 Z0\nG90\nM01\nM30\n"
  },
  {
    id: "haas.m99-and-g28-same-block",
    severity: "warning",
    messageMatcher: /M99 and G28 on the same block/,
    summary: "Do not combine M99 with G28 on one block.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG91\nM99 G28 Z0\nG90\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG91\nG28 Z0\nG90\nM99\nM30\n"
  },
  {
    id: "haas.m99-and-g30-same-block",
    severity: "warning",
    messageMatcher: /M99 and G30 on the same block/,
    summary: "Do not combine M99 with G30 on one block.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG91\nM99 G30 Z0\nG90\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG91\nG30 Z0\nG90\nM99\nM30\n"
  },
  {
    id: "haas.m99-and-g53-same-block",
    severity: "warning",
    messageMatcher: /M99 and G53 on the same block/,
    summary: "Do not combine M99 with G53 on one block.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG90\nM99 G53 Z0\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG90\nG53 Z0\nM99\nM30\n"
  },
  {
    id: "haas.g4-and-g65-same-block",
    severity: "warning",
    messageMatcher: /G4 dwell and G65 on the same block/,
    summary: "Do not combine G4 dwell with G65 on one block.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG4 P1. G65 P9010\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG4 P1.\nG65 P9010\nM30\n"
  },
  {
    id: "haas.g4-and-m98-same-block",
    severity: "warning",
    messageMatcher: /G4 dwell and M98 on the same block/,
    summary: "Do not combine G4 dwell with M98 on one block.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG4 P1. M98 P2\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG4 P1.\nM98 P2\nM30\n"
  },
  {
    id: "haas.g4-and-m97-same-block",
    severity: "warning",
    messageMatcher: /G4 dwell and M97 on the same block/,
    summary: "Do not combine G4 dwell with M97 on one block.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG4 P1. M97 P10\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG4 P1.\nM97 P10\nM30\n"
  },
  {
    id: "haas.g4-and-m00-same-block",
    severity: "warning",
    messageMatcher: /G4 dwell and M00 on the same block/,
    summary: "Do not combine G4 dwell with program stop (M00) on one block.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG4 P1. M00\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG4 P1.\nM00\nM30\n"
  },
  {
    id: "haas.g4-and-m01-same-block",
    severity: "warning",
    messageMatcher: /G4 dwell and M01 on the same block/,
    summary: "Do not combine G4 dwell with optional stop (M01) on one block.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG4 P1. M01\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG4 P1.\nM01\nM30\n"
  },
  {
    id: "haas.g4-and-m99-same-block",
    severity: "warning",
    messageMatcher: /G4 dwell and M99 on the same block/,
    summary: "Do not combine G4 dwell with M99 on one block.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG4 P1. M99\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG4 P1.\nM99\nM30\n"
  },
  {
    id: "haas.multiple-m-codes-same-block",
    severity: "warning",
    messageMatcher: /Multiple M codes on the same block/,
    summary: "Haas allows only one M function per block — split M codes onto separate blocks.",
    positiveSnippet: "O0001\nT1 M6\nS1200 M3 M8\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nS1200 M3\nM8\nM5\nM30\n"
  },
  {
    id: "haas.t0-selected",
    severity: "warning",
    messageMatcher: /T0 selects tool zero/,
    summary: "T0 selects tool zero — usually invalid for a real tool change.",
    positiveSnippet: "O0001\nT0 M6\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nM30\n"
  },
  {
    id: "haas.m30-before-last-block",
    severity: "warning",
    messageMatcher: /M30 appears before the last block/,
    summary: "M30 before the final block usually means trailing unreachable code.",
    positiveSnippet: "O0001\nT1 M6\nM30\nG0 X0\n",
    negativeSnippet: "O0001\nT1 M6\nM30\n"
  },
  {
    id: "haas.duplicate-m30",
    severity: "error",
    messageMatcher: /Duplicate M30/,
    summary: "A program should end exactly once with M30; duplicates indicate a copy/paste mistake.",
    positiveSnippet: "O0001\nT1 M6\nM30\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nM30\n"
  },
  {
    id: "haas.m02-and-m30-mixed",
    severity: "warning",
    messageMatcher: /Program contains both M02 and M30/,
    summary: "Mixing M02 and M30 program-end commands is ambiguous — pick one.",
    positiveSnippet: "O0001\nT1 M6\nM02\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nM30\n"
  },
  {
    id: "haas.duplicate-sequence-n",
    severity: "warning",
    messageMatcher: /Duplicate sequence number N/,
    summary: "Duplicate N numbers make GOTO/M97 targets ambiguous.",
    positiveSnippet: "O0001\nN10 G0 X0\nN10 G0 Y0\nM30\n",
    negativeSnippet: "O0001\nN10 G0 X0\nN20 G0 Y0\nM30\n"
  },
  {
    id: "haas.duplicate-program-label-o",
    severity: "warning",
    messageMatcher: /Duplicate program label O/,
    summary: "Two O#### headers with the same number — subprogram targets become ambiguous.",
    positiveSnippet: "O0001\nT1 M6\nO0001\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nO0002\nM30\n"
  },
  {
    id: "haas.missing-program-end",
    severity: "warning",
    messageMatcher: /Last block has no M02, M30, or M99/,
    summary: "The last block must contain M02, M30, or M99 to close the program cleanly.",
    positiveSnippet: "O0001\nT1 M6\nG0 X0\n",
    negativeSnippet: "O0001\nT1 M6\nM30\n"
  }
];
