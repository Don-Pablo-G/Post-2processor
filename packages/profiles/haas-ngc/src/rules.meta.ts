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
    messageMatcher: /Machine positioning conflict on the same block/,
    summary: "Superseded by haas.machine-position-conflict-same-block — split G28/G30/G53 from other modes/calls/stops.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG90\nG53 G54 Z0\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG90\nG53 Z0\nM30\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.machine-position-conflict-same-block."
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
    id: "haas.g28-while-tool-length",
    severity: "warning",
    messageMatcher: /G28 while tool length compensation \(G43\) is still active/,
    summary: "Cancel tool length with G49 before G28 reference return.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nG91\nG28 Z0\nG90\nG49\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nG49\nG91\nG28 Z0\nG90\nM30\n"
  },
  {
    id: "haas.g30-while-tool-length",
    severity: "warning",
    messageMatcher: /G30 while tool length compensation \(G43\) is still active/,
    summary: "Cancel tool length with G49 before G30 secondary reference return.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nG91\nG30 Z0\nG90\nG49\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nG49\nG91\nG30 Z0\nG90\nM30\n"
  },
  {
    id: "haas.g53-while-tool-length",
    severity: "warning",
    messageMatcher: /G53 while tool length compensation \(G43\) is still active/,
    summary: "Cancel tool length with G49 before G53 machine move.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nG53 Z0\nG49\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nG49\nG53 Z0\nM30\n"
  },
  {
    id: "haas.canned-while-spindle-off",
    severity: "warning",
    messageMatcher: /Canned cycle \(G73\/G76\/G81-G83\/G85-G89\) while spindle is off/,
    summary: "Start the spindle before a non-tapping canned cycle.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG81 Z-1. R0.1 F10.\nG80\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nG80\nM5\nM30\n"
  },
  {
    id: "haas.feed-negative-z-without-g43",
    severity: "warning",
    messageMatcher: /G1\/G2\/G3 with negative Z while tool length compensation \(G43\) is inactive/,
    summary: "Apply G43 before feed plunging to a negative Z.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG1 Z-1. F10.\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nG1 Z-1. F10.\nM30\n"
  },
  {
    id: "haas.cutter-comp-without-tool-length",
    severity: "warning",
    messageMatcher: /G41\/G42 while tool length compensation \(G43\) is inactive/,
    summary: "Apply G43 tool length before G41/G42 cutter compensation.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG41 D1\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nG41 D1\nM30\n"
  },
  {
    id: "haas.m98-while-cutter-comp",
    severity: "warning",
    messageMatcher: /M98 while cutter compensation \(G41\/G42\) is still active/,
    summary: "Cancel cutter compensation with G40 before an M98 subprogram call.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nG41 D1\nM98 P1000\nG40\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nG41 D1\nG40\nM98 P1000\nM30\n"
  },
  {
    id: "haas.m98-while-canned",
    severity: "warning",
    messageMatcher: /M98 while a canned cycle is still active/,
    summary: "Cancel canned cycles with G80 before an M98 subprogram call.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nM98 P1000\nG80\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nG80\nM98 P1000\nM5\nM30\n"
  },
  {
    id: "haas.m97-while-cutter-comp",
    severity: "warning",
    messageMatcher: /M97 while cutter compensation \(G41\/G42\) is still active/,
    summary: "Cancel cutter compensation with G40 before an M97 local subprogram call.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nG41 D1\nM97 P10\nG40\nN10\nM99\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nG41 D1\nG40\nM97 P10\nN10\nM99\nM30\n"
  },
  {
    id: "haas.m97-while-canned",
    severity: "warning",
    messageMatcher: /M97 while a canned cycle is still active/,
    summary: "Cancel canned cycles with G80 before an M97 local subprogram call.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nM97 P10\nG80\nN10\nM99\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nG80\nM97 P10\nN10\nM99\nM5\nM30\n"
  },
  {
    id: "haas.m98-while-tool-length",
    severity: "warning",
    messageMatcher: /M98 while tool length compensation \(G43\) is still active/,
    summary: "Cancel tool length with G49 before an M98 subprogram call.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nM98 P1000\nG49\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nG49\nM98 P1000\nM30\n"
  },
  {
    id: "haas.m97-while-tool-length",
    severity: "warning",
    messageMatcher: /M97 while tool length compensation \(G43\) is still active/,
    summary: "Cancel tool length with G49 before an M97 local subprogram call.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nM97 P10\nG49\nN10\nM99\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nG49\nM97 P10\nN10\nM99\nM30\n"
  },
  {
    id: "haas.m98-while-rotation",
    severity: "warning",
    messageMatcher: /M98 while coordinate rotation \(G68\) is still active/,
    summary: "Cancel rotation with G69 before an M98 subprogram call.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG68 X0 Y0 R45.\nM98 P1000\nG69\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG68 X0 Y0 R45.\nG69\nM98 P1000\nM30\n"
  },
  {
    id: "haas.m97-while-rotation",
    severity: "warning",
    messageMatcher: /M97 while coordinate rotation \(G68\) is still active/,
    summary: "Cancel rotation with G69 before an M97 local subprogram call.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG68 X0 Y0 R45.\nM97 P10\nG69\nN10\nM99\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG68 X0 Y0 R45.\nG69\nM97 P10\nN10\nM99\nM30\n"
  },
  {
    id: "haas.m98-while-scaling",
    severity: "warning",
    messageMatcher: /M98 while scaling \(G51\) is still active/,
    summary: "Cancel scaling with G50 before an M98 subprogram call.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG51 P2.\nM98 P1000\nG50\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG51 P2.\nG50\nM98 P1000\nM30\n"
  },
  {
    id: "haas.m97-while-scaling",
    severity: "warning",
    messageMatcher: /M97 while scaling \(G51\) is still active/,
    summary: "Cancel scaling with G50 before an M97 local subprogram call.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG51 P2.\nM97 P10\nG50\nN10\nM99\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG51 P2.\nG50\nM97 P10\nN10\nM99\nM30\n"
  },
  {
    id: "haas.g65-while-cutter-comp",
    severity: "warning",
    messageMatcher: /G65 while cutter compensation \(G41\/G42\) is still active/,
    summary: "Cancel cutter compensation with G40 before a G65 macro call.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nG41 D1\nG65 P1000\nG40\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nG41 D1\nG40\nG65 P1000\nM30\n"
  },
  {
    id: "haas.g65-while-canned",
    severity: "warning",
    messageMatcher: /G65 while a canned cycle is still active/,
    summary: "Cancel canned cycles with G80 before a G65 macro call.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nG65 P1000\nG80\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nG80\nG65 P1000\nM5\nM30\n"
  },
  {
    id: "haas.g65-while-tool-length",
    severity: "warning",
    messageMatcher: /G65 while tool length compensation \(G43\) is still active/,
    summary: "Cancel tool length with G49 before a G65 macro call.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nG65 P1000\nG49\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nG49\nG65 P1000\nM30\n"
  },
  {
    id: "haas.g65-while-rotation",
    severity: "warning",
    messageMatcher: /G65 while coordinate rotation \(G68\) is still active/,
    summary: "Cancel rotation with G69 before a G65 macro call.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG68 X0 Y0 R45.\nG65 P1000\nG69\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG68 X0 Y0 R45.\nG69\nG65 P1000\nM30\n"
  },
  {
    id: "haas.g65-while-scaling",
    severity: "warning",
    messageMatcher: /G65 while scaling \(G51\) is still active/,
    summary: "Cancel scaling with G50 before a G65 macro call.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG51 P2.\nG65 P1000\nG50\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG51 P2.\nG50\nG65 P1000\nM30\n"
  },
  {
    id: "haas.m98-while-coolant-on",
    severity: "warning",
    messageMatcher: /M98 while coolant is still on/,
    summary: "Turn coolant off with M9 before an M98 subprogram call.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM8\nM98 P1000\nM9\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM8\nM9\nM98 P1000\nM5\nM30\n"
  },
  {
    id: "haas.m97-while-coolant-on",
    severity: "warning",
    messageMatcher: /M97 while coolant is still on/,
    summary: "Turn coolant off with M9 before an M97 local subprogram call.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM8\nM97 P10\nM9\nN10\nM99\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM8\nM9\nM97 P10\nN10\nM99\nM5\nM30\n"
  },
  {
    id: "haas.g65-while-coolant-on",
    severity: "warning",
    messageMatcher: /G65 while coolant is still on/,
    summary: "Turn coolant off with M9 before a G65 macro call.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM8\nG65 P1000\nM9\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM8\nM9\nG65 P1000\nM5\nM30\n"
  },
  {
    id: "haas.m98-while-incremental",
    severity: "warning",
    messageMatcher: /M98 while incremental mode \(G91\) is active/,
    summary: "Restore G90 before an M98 subprogram call.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG91\nM98 P1000\nG90\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG91\nG90\nM98 P1000\nM30\n"
  },
  {
    id: "haas.m97-while-incremental",
    severity: "warning",
    messageMatcher: /M97 while incremental mode \(G91\) is active/,
    summary: "Restore G90 before an M97 local subprogram call.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG91\nM97 P10\nG90\nN10\nM99\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG91\nG90\nM97 P10\nN10\nM99\nM30\n"
  },
  {
    id: "haas.g65-while-incremental",
    severity: "warning",
    messageMatcher: /G65 while incremental mode \(G91\) is active/,
    summary: "Restore G90 before a G65 macro call.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG91\nG65 P1000\nG90\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG91\nG90\nG65 P1000\nM30\n"
  },
  {
    id: "haas.m99-while-cutter-comp",
    severity: "warning",
    messageMatcher: /M99 while cutter compensation \(G41\/G42\) is still active/,
    summary: "Cancel cutter compensation with G40 before M99 subprogram return.",
    positiveSnippet: "O1000\nT1 M6\nG54\nG43 H1 Z25.\nG41 D1\nM99\n",
    negativeSnippet: "O1000\nT1 M6\nG54\nG43 H1 Z25.\nG41 D1\nG40\nM99\n"
  },
  {
    id: "haas.m99-while-canned",
    severity: "warning",
    messageMatcher: /M99 while a canned cycle is still active/,
    summary: "Cancel canned cycles with G80 before M99 subprogram return.",
    positiveSnippet: "O1000\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nM99\n",
    negativeSnippet: "O1000\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nG80\nM99\n"
  },
  {
    id: "haas.m99-while-tool-length",
    severity: "warning",
    messageMatcher: /M99 while tool length compensation \(G43\) is still active/,
    summary: "Cancel tool length with G49 before M99 subprogram return.",
    positiveSnippet: "O1000\nT1 M6\nG54\nG43 H1 Z25.\nM99\n",
    negativeSnippet: "O1000\nT1 M6\nG54\nG43 H1 Z25.\nG49\nM99\n"
  },
  {
    id: "haas.m99-while-rotation",
    severity: "warning",
    messageMatcher: /M99 while coordinate rotation \(G68\) is still active/,
    summary: "Cancel rotation with G69 before M99 subprogram return.",
    positiveSnippet: "O1000\nT1 M6\nG54\nG68 X0 Y0 R45.\nM99\n",
    negativeSnippet: "O1000\nT1 M6\nG54\nG68 X0 Y0 R45.\nG69\nM99\n"
  },
  {
    id: "haas.m99-while-scaling",
    severity: "warning",
    messageMatcher: /M99 while scaling \(G51\) is still active/,
    summary: "Cancel scaling with G50 before M99 subprogram return.",
    positiveSnippet: "O1000\nT1 M6\nG54\nG51 P2.\nM99\n",
    negativeSnippet: "O1000\nT1 M6\nG54\nG51 P2.\nG50\nM99\n"
  },
  {
    id: "haas.m99-while-coolant-on",
    severity: "warning",
    messageMatcher: /M99 while coolant is still on/,
    summary: "Turn coolant off with M9 before M99 subprogram return.",
    positiveSnippet: "O1000\nT1 M6\nG54\nS1200 M3\nM8\nM99\n",
    negativeSnippet: "O1000\nT1 M6\nG54\nS1200 M3\nM8\nM9\nM99\n"
  },
  {
    id: "haas.m99-while-incremental",
    severity: "warning",
    messageMatcher: /M99 while incremental mode \(G91\) is active/,
    summary: "Restore G90 before M99 subprogram return.",
    positiveSnippet: "O1000\nT1 M6\nG54\nG91\nM99\n",
    negativeSnippet: "O1000\nT1 M6\nG54\nG91\nG90\nM99\n"
  },
  {
    id: "haas.g28-while-coolant-on",
    severity: "warning",
    messageMatcher: /G28 while coolant is still on/,
    summary: "Turn coolant off with M9 before G28 reference return.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM8\nG91\nG28 Z0\nG90\nM9\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM8\nM9\nG91\nG28 Z0\nG90\nM5\nM30\n"
  },
  {
    id: "haas.g30-while-coolant-on",
    severity: "warning",
    messageMatcher: /G30 while coolant is still on/,
    summary: "Turn coolant off with M9 before G30 secondary reference return.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM8\nG91\nG30 Z0\nG90\nM9\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM8\nM9\nG91\nG30 Z0\nG90\nM5\nM30\n"
  },
  {
    id: "haas.g53-while-coolant-on",
    severity: "warning",
    messageMatcher: /G53 while coolant is still on/,
    summary: "Turn coolant off with M9 before a G53 machine move.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM8\nG90\nG53 Z0\nM9\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM8\nM9\nG90\nG53 Z0\nM5\nM30\n"
  },
  {
    id: "haas.m5-while-coolant-on",
    severity: "warning",
    messageMatcher: /M5 while coolant is still on/,
    summary: "Turn coolant off with M9 when stopping the spindle with M5.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM8\nM5\nM9\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM8\nM9\nM5\nM30\n"
  },
  {
    id: "haas.m5-while-cutter-comp",
    severity: "warning",
    messageMatcher: /M5 while cutter compensation \(G41\/G42\) is still active/,
    summary: "Cancel cutter compensation with G40 when stopping the spindle with M5.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nM5\nG40\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nG40\nM5\nM30\n"
  },
  {
    id: "haas.m5-while-canned",
    severity: "warning",
    messageMatcher: /M5 while a canned cycle is still active/,
    summary: "Cancel canned cycles with G80 when stopping the spindle with M5.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nM5\nG80\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nG80\nM5\nM30\n"
  },
  {
    id: "haas.m5-while-tool-length",
    severity: "warning",
    messageMatcher: /M5 while tool length compensation \(G43\) is still active/,
    summary: "Cancel tool length with G49 when stopping the spindle with M5.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nM5\nG49\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG49\nM5\nM30\n"
  },
  {
    id: "haas.m5-while-rotation",
    severity: "warning",
    messageMatcher: /M5 while coordinate rotation \(G68\) is still active/,
    summary: "Cancel rotation with G69 when stopping the spindle with M5.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG68 X0 Y0 R45.\nS1200 M3\nM5\nG69\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG68 X0 Y0 R45.\nS1200 M3\nG69\nM5\nM30\n"
  },
  {
    id: "haas.m5-while-scaling",
    severity: "warning",
    messageMatcher: /M5 while scaling \(G51\) is still active/,
    summary: "Cancel scaling with G50 when stopping the spindle with M5.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG51 P2.\nS1200 M3\nM5\nG50\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG51 P2.\nS1200 M3\nG50\nM5\nM30\n"
  },
  {
    id: "haas.m5-while-incremental",
    severity: "warning",
    messageMatcher: /M5 while incremental mode \(G91\) is active/,
    summary: "Restore G90 when stopping the spindle with M5.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG91\nS1200 M3\nM5\nG90\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG91\nS1200 M3\nG90\nM5\nM30\n"
  },
  {
    id: "haas.m00-while-coolant-on",
    severity: "warning",
    messageMatcher: /M00 while coolant is still on/,
    summary: "Turn coolant off with M9 before an M00 program stop.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM8\nM00\nM9\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM8\nM9\nM00\nM5\nM30\n"
  },
  {
    id: "haas.m00-while-cutter-comp",
    severity: "warning",
    messageMatcher: /M00 while cutter compensation \(G41\/G42\) is still active/,
    summary: "Cancel cutter compensation with G40 before an M00 program stop.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nM00\nG40\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nG40\nM00\nM5\nM30\n"
  },
  {
    id: "haas.m00-while-canned",
    severity: "warning",
    messageMatcher: /M00 while a canned cycle is still active/,
    summary: "Cancel canned cycles with G80 before an M00 program stop.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nM00\nG80\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nG80\nM00\nM5\nM30\n"
  },
  {
    id: "haas.m01-while-coolant-on",
    severity: "warning",
    messageMatcher: /M01 while coolant is still on/,
    summary: "Turn coolant off with M9 before an M01 optional stop.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM8\nM01\nM9\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM8\nM9\nM01\nM5\nM30\n"
  },
  {
    id: "haas.m01-while-cutter-comp",
    severity: "warning",
    messageMatcher: /M01 while cutter compensation \(G41\/G42\) is still active/,
    summary: "Cancel cutter compensation with G40 before an M01 optional stop.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nM01\nG40\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nG40\nM01\nM5\nM30\n"
  },
  {
    id: "haas.m01-while-canned",
    severity: "warning",
    messageMatcher: /M01 while a canned cycle is still active/,
    summary: "Cancel canned cycles with G80 before an M01 optional stop.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nM01\nG80\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nG80\nM01\nM5\nM30\n"
  },
  {
    id: "haas.m00-while-tool-length",
    severity: "warning",
    messageMatcher: /M00 while tool length compensation \(G43\) is still active/,
    summary: "Cancel tool length with G49 before an M00 program stop.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nM00\nG49\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG49\nM00\nM5\nM30\n"
  },
  {
    id: "haas.m00-while-rotation",
    severity: "warning",
    messageMatcher: /M00 while coordinate rotation \(G68\) is still active/,
    summary: "Cancel rotation with G69 before an M00 program stop.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG68 X0 Y0 R45.\nS1200 M3\nM00\nG69\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG68 X0 Y0 R45.\nS1200 M3\nG69\nM00\nM5\nM30\n"
  },
  {
    id: "haas.m00-while-scaling",
    severity: "warning",
    messageMatcher: /M00 while scaling \(G51\) is still active/,
    summary: "Cancel scaling with G50 before an M00 program stop.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG51 P2.\nS1200 M3\nM00\nG50\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG51 P2.\nS1200 M3\nG50\nM00\nM5\nM30\n"
  },
  {
    id: "haas.m00-while-incremental",
    severity: "warning",
    messageMatcher: /M00 while incremental mode \(G91\) is active/,
    summary: "Restore G90 before an M00 program stop.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG91\nS1200 M3\nM00\nG90\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG91\nS1200 M3\nG90\nM00\nM5\nM30\n"
  },
  {
    id: "haas.m01-while-tool-length",
    severity: "warning",
    messageMatcher: /M01 while tool length compensation \(G43\) is still active/,
    summary: "Cancel tool length with G49 before an M01 optional stop.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nM01\nG49\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG49\nM01\nM5\nM30\n"
  },
  {
    id: "haas.m01-while-rotation",
    severity: "warning",
    messageMatcher: /M01 while coordinate rotation \(G68\) is still active/,
    summary: "Cancel rotation with G69 before an M01 optional stop.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG68 X0 Y0 R45.\nS1200 M3\nM01\nG69\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG68 X0 Y0 R45.\nS1200 M3\nG69\nM01\nM5\nM30\n"
  },
  {
    id: "haas.m01-while-scaling",
    severity: "warning",
    messageMatcher: /M01 while scaling \(G51\) is still active/,
    summary: "Cancel scaling with G50 before an M01 optional stop.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG51 P2.\nS1200 M3\nM01\nG50\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG51 P2.\nS1200 M3\nG50\nM01\nM5\nM30\n"
  },
  {
    id: "haas.m01-while-incremental",
    severity: "warning",
    messageMatcher: /M01 while incremental mode \(G91\) is active/,
    summary: "Restore G90 before an M01 optional stop.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG91\nS1200 M3\nM01\nG90\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG91\nS1200 M3\nG90\nM01\nM5\nM30\n"
  },
  {
    id: "haas.g4-while-cutter-comp",
    severity: "warning",
    messageMatcher: /G4 while cutter compensation \(G41\/G42\) is still active/,
    summary: "Cancel cutter compensation with G40 before a G4 dwell.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nG4 P1.\nG40\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nG40\nG4 P1.\nM5\nM30\n"
  },
  {
    id: "haas.g4-while-canned",
    severity: "warning",
    messageMatcher: /G4 while a canned cycle is still active/,
    summary: "Cancel canned cycles with G80 before a G4 dwell.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nG4 P1.\nG80\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nG80\nG4 P1.\nM5\nM30\n"
  },
  {
    id: "haas.g4-while-tool-length",
    severity: "warning",
    messageMatcher: /G4 while tool length compensation \(G43\) is still active/,
    summary: "Cancel tool length with G49 before a G4 dwell.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG4 P1.\nG49\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG49\nG4 P1.\nM5\nM30\n"
  },
  {
    id: "haas.g4-while-rotation",
    severity: "warning",
    messageMatcher: /G4 while coordinate rotation \(G68\) is still active/,
    summary: "Cancel rotation with G69 before a G4 dwell.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG68 X0 Y0 R45.\nS1200 M3\nG4 P1.\nG69\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG68 X0 Y0 R45.\nS1200 M3\nG69\nG4 P1.\nM5\nM30\n"
  },
  {
    id: "haas.g4-while-scaling",
    severity: "warning",
    messageMatcher: /G4 while scaling \(G51\) is still active/,
    summary: "Cancel scaling with G50 before a G4 dwell.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG51 P2.\nS1200 M3\nG4 P1.\nG50\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG51 P2.\nS1200 M3\nG50\nG4 P1.\nM5\nM30\n"
  },
  {
    id: "haas.g4-while-coolant-on",
    severity: "warning",
    messageMatcher: /G4 while coolant is still on/,
    summary: "Turn coolant off with M9 before a G4 dwell.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM8\nG4 P1.\nM9\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM8\nM9\nG4 P1.\nM5\nM30\n"
  },
  {
    id: "haas.g4-while-incremental",
    severity: "warning",
    messageMatcher: /G4 while incremental mode \(G91\) is active/,
    summary: "Restore G90 before a G4 dwell.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG91\nS1200 M3\nG4 P1.\nG90\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG91\nS1200 M3\nG90\nG4 P1.\nM5\nM30\n"
  },
  {
    id: "haas.g0-while-canned",
    severity: "warning",
    messageMatcher: /G0 rapid while a canned cycle is still active/,
    summary: "Cancel canned cycles with G80 before a G0 rapid move.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nG0 Z25.\nG80\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nG80\nG0 Z25.\nM5\nM30\n"
  },
  {
    id: "haas.work-offset-while-cutter-comp",
    severity: "warning",
    messageMatcher: /Work offset \(G54-G59\/G154\) while cutter compensation \(G41\/G42\) is still active/,
    summary: "Cancel cutter compensation with G40 before selecting a work offset.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nG55\nG40\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nG40\nG55\nM5\nM30\n"
  },
  {
    id: "haas.work-offset-while-canned",
    severity: "warning",
    messageMatcher: /Work offset \(G54-G59\/G154\) while a canned cycle is still active/,
    summary: "Cancel canned cycles with G80 before selecting a work offset.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nG55\nG80\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nG80\nG55\nM5\nM30\n"
  },
  {
    id: "haas.work-offset-while-rotation",
    severity: "warning",
    messageMatcher: /Work offset \(G54-G59\/G154\) while coordinate rotation \(G68\) is still active/,
    summary: "Cancel rotation with G69 before selecting a work offset.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG68 X0 Y0 R45.\nS1200 M3\nG55\nG69\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG68 X0 Y0 R45.\nS1200 M3\nG69\nG55\nM5\nM30\n"
  },
  {
    id: "haas.work-offset-while-scaling",
    severity: "warning",
    messageMatcher: /Work offset \(G54-G59\/G154\) while scaling \(G51\) is still active/,
    summary: "Cancel scaling with G50 before selecting a work offset.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG51 P2.\nS1200 M3\nG55\nG50\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG51 P2.\nS1200 M3\nG50\nG55\nM5\nM30\n"
  },
  {
    id: "haas.work-offset-while-tool-length",
    severity: "warning",
    messageMatcher: /Work offset \(G54-G59\/G154\) while tool length compensation \(G43\) is still active/,
    summary: "Cancel tool length with G49 before selecting a work offset.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG55\nG49\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG49\nG55\nM5\nM30\n"
  },
  {
    id: "haas.work-offset-while-coolant-on",
    severity: "warning",
    messageMatcher: /Work offset \(G54-G59\/G154\) while coolant is still on/,
    summary: "Turn coolant off with M9 before selecting a work offset.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM8\nG55\nM9\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM8\nM9\nG55\nM5\nM30\n"
  },
  {
    id: "haas.work-offset-while-incremental",
    severity: "warning",
    messageMatcher: /Work offset \(G54-G59\/G154\) while incremental mode \(G91\) is active/,
    summary: "Restore G90 before selecting a work offset.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG91\nS1200 M3\nG55\nG90\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG91\nS1200 M3\nG90\nG55\nM5\nM30\n"
  },
  {
    id: "haas.g68-while-cutter-comp",
    severity: "warning",
    messageMatcher: /G68 while cutter compensation \(G41\/G42\) is still active/,
    summary: "Cancel cutter compensation with G40 before G68 coordinate rotation.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nG68 X0 Y0 R45.\nG40\nG69\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nG40\nG68 X0 Y0 R45.\nG69\nM5\nM30\n"
  },
  {
    id: "haas.g68-while-canned",
    severity: "warning",
    messageMatcher: /G68 while a canned cycle is still active/,
    summary: "Cancel canned cycles with G80 before G68 coordinate rotation.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nG68 X0 Y0 R45.\nG80\nG69\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nG80\nG68 X0 Y0 R45.\nG69\nM5\nM30\n"
  },
  {
    id: "haas.g51-while-cutter-comp",
    severity: "warning",
    messageMatcher: /G51 while cutter compensation \(G41\/G42\) is still active/,
    summary: "Cancel cutter compensation with G40 before G51 scaling.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nG51 P2.\nG40\nG50\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nG40\nG51 P2.\nG50\nM5\nM30\n"
  },
  {
    id: "haas.g51-while-canned",
    severity: "warning",
    messageMatcher: /G51 while a canned cycle is still active/,
    summary: "Cancel canned cycles with G80 before G51 scaling.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nG51 P2.\nG80\nG50\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nG80\nG51 P2.\nG50\nM5\nM30\n"
  },
  {
    id: "haas.g49-while-cutter-comp",
    severity: "warning",
    messageMatcher: /G49 while cutter compensation \(G41\/G42\) is still active/,
    summary: "Cancel cutter compensation with G40 before G49 tool-length cancel.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nG49\nG40\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nG40\nG49\nM5\nM30\n"
  },
  {
    id: "haas.g49-while-canned",
    severity: "warning",
    messageMatcher: /G49 while a canned cycle is still active/,
    summary: "Cancel canned cycles with G80 before G49 tool-length cancel.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG81 Z-1. R0.1 F10.\nG49\nG80\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG81 Z-1. R0.1 F10.\nG80\nG49\nM5\nM30\n"
  },
  {
    id: "haas.g80-while-cutter-comp",
    severity: "warning",
    messageMatcher: /G80 while cutter compensation \(G41\/G42\) is still active/,
    summary: "Cancel cutter compensation with G40 before G80 canned-cycle cancel.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nG81 Z-1. R0.1 F10.\nG80\nG40\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nG81 Z-1. R0.1 F10.\nG40\nG80\nM5\nM30\n"
  },
  {
    id: "haas.g68-while-tool-length",
    severity: "warning",
    messageMatcher: /G68 while tool length compensation \(G43\) is still active/,
    summary: "Cancel tool length with G49 before G68 coordinate rotation.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG68 X0 Y0 R45.\nG49\nG69\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG49\nG68 X0 Y0 R45.\nG69\nM5\nM30\n"
  },
  {
    id: "haas.g68-while-scaling",
    severity: "warning",
    messageMatcher: /G68 while scaling \(G51\) is still active/,
    summary: "Cancel scaling with G50 before G68 coordinate rotation.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG51 P2.\nS1200 M3\nG68 X0 Y0 R45.\nG50\nG69\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG51 P2.\nS1200 M3\nG50\nG68 X0 Y0 R45.\nG69\nM5\nM30\n"
  },
  {
    id: "haas.g51-while-tool-length",
    severity: "warning",
    messageMatcher: /G51 while tool length compensation \(G43\) is still active/,
    summary: "Cancel tool length with G49 before G51 scaling.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG51 P2.\nG49\nG50\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG49\nG51 P2.\nG50\nM5\nM30\n"
  },
  {
    id: "haas.g51-while-rotation",
    severity: "warning",
    messageMatcher: /G51 while coordinate rotation \(G68\) is still active/,
    summary: "Cancel rotation with G69 before G51 scaling.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG68 X0 Y0 R45.\nS1200 M3\nG51 P2.\nG69\nG50\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG68 X0 Y0 R45.\nS1200 M3\nG69\nG51 P2.\nG50\nM5\nM30\n"
  },
  {
    id: "haas.g40-while-canned",
    severity: "warning",
    messageMatcher: /G40 while a canned cycle is still active/,
    summary: "Cancel canned cycles with G80 before G40 cutter-comp cancel.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nG81 Z-1. R0.1 F10.\nG40\nG80\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nG81 Z-1. R0.1 F10.\nG80\nG40\nM5\nM30\n"
  },
  {
    id: "haas.g40-while-rotation",
    severity: "warning",
    messageMatcher: /G40 while coordinate rotation \(G68\) is still active/,
    summary: "Cancel rotation with G69 before G40 cutter-comp cancel.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nG68 X0 Y0 R45.\nG40\nG69\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nG68 X0 Y0 R45.\nG69\nG40\nM5\nM30\n"
  },
  {
    id: "haas.g40-while-scaling",
    severity: "warning",
    messageMatcher: /G40 while scaling \(G51\) is still active/,
    summary: "Cancel scaling with G50 before G40 cutter-comp cancel.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nG51 P2.\nG40\nG50\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nG51 P2.\nG50\nG40\nM5\nM30\n"
  },
  {
    id: "haas.g69-while-cutter-comp",
    severity: "warning",
    messageMatcher: /G69 while cutter compensation \(G41\/G42\) is still active/,
    summary: "Cancel cutter compensation with G40 before G69 rotation cancel.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nG68 X0 Y0 R45.\nG69\nG40\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nG68 X0 Y0 R45.\nG40\nG69\nM5\nM30\n"
  },
  {
    id: "haas.g69-while-canned",
    severity: "warning",
    messageMatcher: /G69 while a canned cycle is still active/,
    summary: "Cancel canned cycles with G80 before G69 rotation cancel.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nG68 X0 Y0 R45.\nG69\nG80\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nG68 X0 Y0 R45.\nG80\nG69\nM5\nM30\n"
  },
  {
    id: "haas.g50-while-cutter-comp",
    severity: "warning",
    messageMatcher: /G50 while cutter compensation \(G41\/G42\) is still active/,
    summary: "Cancel cutter compensation with G40 before G50 scaling cancel.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nG51 P2.\nG50\nG40\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nG51 P2.\nG40\nG50\nM5\nM30\n"
  },
  {
    id: "haas.g49-while-rotation",
    severity: "warning",
    messageMatcher: /G49 while coordinate rotation \(G68\) is still active/,
    summary: "Cancel rotation with G69 before G49 tool-length cancel.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG68 X0 Y0 R45.\nG49\nG69\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG68 X0 Y0 R45.\nG69\nG49\nM5\nM30\n"
  },
  {
    id: "haas.g49-while-scaling",
    severity: "warning",
    messageMatcher: /G49 while scaling \(G51\) is still active/,
    summary: "Cancel scaling with G50 before G49 tool-length cancel.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG51 P2.\nG49\nG50\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG51 P2.\nG50\nG49\nM5\nM30\n"
  },
  {
    id: "haas.g50-while-canned",
    severity: "warning",
    messageMatcher: /G50 while a canned cycle is still active/,
    summary: "Cancel canned cycles with G80 before G50 scaling cancel.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nG51 P2.\nG50\nG80\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nG51 P2.\nG80\nG50\nM5\nM30\n"
  },
  {
    id: "haas.g50-while-rotation",
    severity: "warning",
    messageMatcher: /G50 while coordinate rotation \(G68\) is still active/,
    summary: "Cancel rotation with G69 before G50 scaling cancel.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG68 X0 Y0 R45.\nS1200 M3\nG51 P2.\nG50\nG69\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG68 X0 Y0 R45.\nS1200 M3\nG51 P2.\nG69\nG50\nM5\nM30\n"
  },
  {
    id: "haas.g50-while-tool-length",
    severity: "warning",
    messageMatcher: /G50 while tool length compensation \(G43\) is still active/,
    summary: "Cancel tool length with G49 before G50 scaling cancel.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG51 P2.\nG50\nG49\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG51 P2.\nG49\nG50\nM5\nM30\n"
  },
  {
    id: "haas.g69-while-tool-length",
    severity: "warning",
    messageMatcher: /G69 while tool length compensation \(G43\) is still active/,
    summary: "Cancel tool length with G49 before G69 rotation cancel.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG68 X0 Y0 R45.\nG69\nG49\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG68 X0 Y0 R45.\nG49\nG69\nM5\nM30\n"
  },
  {
    id: "haas.g69-while-scaling",
    severity: "warning",
    messageMatcher: /G69 while scaling \(G51\) is still active/,
    summary: "Cancel scaling with G50 before G69 rotation cancel.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG51 P2.\nS1200 M3\nG68 X0 Y0 R45.\nG69\nG50\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG51 P2.\nS1200 M3\nG68 X0 Y0 R45.\nG50\nG69\nM5\nM30\n"
  },
  {
    id: "haas.g80-while-rotation",
    severity: "warning",
    messageMatcher: /G80 while coordinate rotation \(G68\) is still active/,
    summary: "Cancel rotation with G69 before G80 canned-cycle cancel.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG68 X0 Y0 R45.\nG81 Z-1. R0.1 F10.\nG80\nG69\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG68 X0 Y0 R45.\nG81 Z-1. R0.1 F10.\nG69\nG80\nM5\nM30\n"
  },
  {
    id: "haas.g80-while-scaling",
    severity: "warning",
    messageMatcher: /G80 while scaling \(G51\) is still active/,
    summary: "Cancel scaling with G50 before G80 canned-cycle cancel.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG51 P2.\nG81 Z-1. R0.1 F10.\nG80\nG50\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG51 P2.\nG81 Z-1. R0.1 F10.\nG50\nG80\nM5\nM30\n"
  },
  {
    id: "haas.g68-while-coolant-on",
    severity: "warning",
    messageMatcher: /G68 while coolant is still on/,
    summary: "Turn coolant off with M9 before G68 coordinate rotation.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM8\nG68 X0 Y0 R45.\nM9\nG69\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM8\nM9\nG68 X0 Y0 R45.\nG69\nM5\nM30\n"
  },
  {
    id: "haas.g68-while-incremental",
    severity: "warning",
    messageMatcher: /G68 while incremental mode \(G91\) is active/,
    summary: "Restore G90 before G68 coordinate rotation.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG91\nS1200 M3\nG68 X0 Y0 R45.\nG90\nG69\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG91\nS1200 M3\nG90\nG68 X0 Y0 R45.\nG69\nM5\nM30\n"
  },
  {
    id: "haas.g51-while-coolant-on",
    severity: "warning",
    messageMatcher: /G51 while coolant is still on/,
    summary: "Turn coolant off with M9 before G51 scaling.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM8\nG51 P2.\nM9\nG50\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM8\nM9\nG51 P2.\nG50\nM5\nM30\n"
  },
  {
    id: "haas.g51-while-incremental",
    severity: "warning",
    messageMatcher: /G51 while incremental mode \(G91\) is active/,
    summary: "Restore G90 before G51 scaling.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG91\nS1200 M3\nG51 P2.\nG90\nG50\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG91\nS1200 M3\nG90\nG51 P2.\nG50\nM5\nM30\n"
  },
  {
    id: "haas.g49-while-coolant-on",
    severity: "warning",
    messageMatcher: /G49 while coolant is still on/,
    summary: "Turn coolant off with M9 before G49 tool-length cancel.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nM8\nG49\nM9\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nM8\nM9\nG49\nM5\nM30\n"
  },
  {
    id: "haas.g49-while-incremental",
    severity: "warning",
    messageMatcher: /G49 while incremental mode \(G91\) is active/,
    summary: "Restore G90 before G49 tool-length cancel.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nG91\nS1200 M3\nG49\nG90\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nG91\nS1200 M3\nG90\nG49\nM5\nM30\n"
  },
  {
    id: "haas.g69-while-coolant-on",
    severity: "warning",
    messageMatcher: /G69 while coolant is still on/,
    summary: "Turn coolant off with M9 before G69 rotation cancel.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM8\nG68 X0 Y0 R45.\nG69\nM9\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM8\nG68 X0 Y0 R45.\nM9\nG69\nM5\nM30\n"
  },
  {
    id: "haas.g69-while-incremental",
    severity: "warning",
    messageMatcher: /G69 while incremental mode \(G91\) is active/,
    summary: "Restore G90 before G69 rotation cancel.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG91\nS1200 M3\nG68 X0 Y0 R45.\nG69\nG90\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG91\nS1200 M3\nG68 X0 Y0 R45.\nG90\nG69\nM5\nM30\n"
  },
  {
    id: "haas.g50-while-coolant-on",
    severity: "warning",
    messageMatcher: /G50 while coolant is still on/,
    summary: "Turn coolant off with M9 before G50 scaling cancel.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM8\nG51 P2.\nG50\nM9\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM8\nG51 P2.\nM9\nG50\nM5\nM30\n"
  },
  {
    id: "haas.g50-while-incremental",
    severity: "warning",
    messageMatcher: /G50 while incremental mode \(G91\) is active/,
    summary: "Restore G90 before G50 scaling cancel.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG91\nS1200 M3\nG51 P2.\nG50\nG90\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG91\nS1200 M3\nG51 P2.\nG90\nG50\nM5\nM30\n"
  },
  {
    id: "haas.g80-while-incremental",
    severity: "warning",
    messageMatcher: /G80 while incremental mode \(G91\) is active/,
    summary: "Restore G90 before G80 canned-cycle cancel.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG91\nS1200 M3\nG81 Z-1. R0.1 F10.\nG80\nG90\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG91\nS1200 M3\nG81 Z-1. R0.1 F10.\nG90\nG80\nM5\nM30\n"
  },
  {
    id: "haas.g40-while-coolant-on",
    severity: "warning",
    messageMatcher: /G40 while coolant is still on/,
    summary: "Turn coolant off with M9 before G40 cutter-comp cancel.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nM8\nG41 D1\nG40\nM9\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nM8\nG41 D1\nM9\nG40\nM5\nM30\n"
  },
  {
    id: "haas.g40-while-incremental",
    severity: "warning",
    messageMatcher: /G40 while incremental mode \(G91\) is active/,
    summary: "Restore G90 before G40 cutter-comp cancel.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nG91\nS1200 M3\nG41 D1\nG40\nG90\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nG91\nS1200 M3\nG41 D1\nG90\nG40\nM5\nM30\n"
  },
  {
    id: "haas.g41-g42-while-canned",
    severity: "warning",
    messageMatcher: /G41\/G42 while a canned cycle is still active/,
    summary: "Cancel canned cycles with G80 before G41/G42 cutter compensation.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG81 Z-1. R0.1 F10.\nG41 D1\nG80\nG40\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG81 Z-1. R0.1 F10.\nG80\nG41 D1\nG40\nM5\nM30\n"
  },
  {
    id: "haas.g41-g42-while-rotation",
    severity: "warning",
    messageMatcher: /G41\/G42 while coordinate rotation \(G68\) is still active/,
    summary: "Cancel rotation with G69 before G41/G42 cutter compensation.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG68 X0 Y0 R45.\nG41 D1\nG69\nG40\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG68 X0 Y0 R45.\nG69\nG41 D1\nG40\nM5\nM30\n"
  },
  {
    id: "haas.g41-g42-while-scaling",
    severity: "warning",
    messageMatcher: /G41\/G42 while scaling \(G51\) is still active/,
    summary: "Cancel scaling with G50 before G41/G42 cutter compensation.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG51 P2.\nG41 D1\nG50\nG40\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG51 P2.\nG50\nG41 D1\nG40\nM5\nM30\n"
  },
  {
    id: "haas.g41-g42-while-incremental",
    severity: "warning",
    messageMatcher: /G41\/G42 while incremental mode \(G91\) is active/,
    summary: "Restore G90 before G41/G42 cutter compensation.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nG91\nS1200 M3\nG41 D1\nG90\nG40\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nG91\nS1200 M3\nG90\nG41 D1\nG40\nM5\nM30\n"
  },
  {
    id: "haas.g43-while-cutter-comp",
    severity: "warning",
    messageMatcher: /G43 while cutter compensation \(G41\/G42\) is still active/,
    summary: "Cancel cutter compensation with G40 before applying G43 tool length.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nG43 H1 Z25.\nG40\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nG40\nG43 H1 Z25.\nM5\nM30\n"
  },
  {
    id: "haas.g43-while-canned",
    severity: "warning",
    messageMatcher: /G43 while a canned cycle is still active/,
    summary: "Cancel canned cycles with G80 before applying G43 tool length.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG81 Z-1. R0.1 F10.\nG43 H1 Z25.\nG80\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG81 Z-1. R0.1 F10.\nG80\nG43 H1 Z25.\nM5\nM30\n"
  },
  {
    id: "haas.canned-while-cutter-comp",
    severity: "warning",
    messageMatcher: /Canned cycle while cutter compensation \(G41\/G42\) is still active/,
    summary: "Cancel cutter compensation with G40 before a canned cycle.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nG81 Z-1. R0.1 F10.\nG40\nG80\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nG40\nG81 Z-1. R0.1 F10.\nG80\nM5\nM30\n"
  },
  {
    id: "haas.canned-while-rotation",
    severity: "warning",
    messageMatcher: /Canned cycle while coordinate rotation \(G68\) is still active/,
    summary: "Cancel rotation with G69 before a canned cycle.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG68 X0 Y0 R45.\nG81 Z-1. R0.1 F10.\nG69\nG80\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG68 X0 Y0 R45.\nG69\nG81 Z-1. R0.1 F10.\nG80\nM5\nM30\n"
  },
  {
    id: "haas.g43-while-rotation",
    severity: "warning",
    messageMatcher: /G43 while coordinate rotation \(G68\) is still active/,
    summary: "Cancel rotation with G69 before applying G43 tool length.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG68 X0 Y0 R45.\nS1200 M3\nG43 H1 Z25.\nG69\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG68 X0 Y0 R45.\nS1200 M3\nG69\nG43 H1 Z25.\nM5\nM30\n"
  },
  {
    id: "haas.g43-while-scaling",
    severity: "warning",
    messageMatcher: /G43 while scaling \(G51\) is still active/,
    summary: "Cancel scaling with G50 before applying G43 tool length.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG51 P2.\nS1200 M3\nG43 H1 Z25.\nG50\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG51 P2.\nS1200 M3\nG50\nG43 H1 Z25.\nM5\nM30\n"
  },
  {
    id: "haas.g43-while-coolant-on",
    severity: "warning",
    messageMatcher: /G43 while coolant is still on/,
    summary: "Turn coolant off with M9 before applying G43 tool length.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM8\nG43 H1 Z25.\nM9\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM8\nM9\nG43 H1 Z25.\nM5\nM30\n"
  },
  {
    id: "haas.g43-while-incremental",
    severity: "warning",
    messageMatcher: /G43 while incremental mode \(G91\) is active/,
    summary: "Restore G90 before applying G43 tool length.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG91\nS1200 M3\nG43 H1 Z25.\nG90\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG91\nS1200 M3\nG90\nG43 H1 Z25.\nM5\nM30\n"
  },
  {
    id: "haas.canned-while-scaling",
    severity: "warning",
    messageMatcher: /Canned cycle while scaling \(G51\) is still active/,
    summary: "Cancel scaling with G50 before a canned cycle.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG51 P2.\nG81 Z-1. R0.1 F10.\nG50\nG80\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG51 P2.\nG50\nG81 Z-1. R0.1 F10.\nG80\nM5\nM30\n"
  },
  {
    id: "haas.canned-while-incremental",
    severity: "warning",
    messageMatcher: /Canned cycle while incremental mode \(G91\) is active/,
    summary: "Restore G90 before a canned cycle.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG91\nS1200 M3\nG81 Z-1. R0.1 F10.\nG90\nG80\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG91\nS1200 M3\nG90\nG81 Z-1. R0.1 F10.\nG80\nM5\nM30\n"
  },
  {
    id: "haas.plane-while-cutter-comp",
    severity: "warning",
    messageMatcher: /Plane select \(G17\/G18\/G19\) while cutter compensation \(G41\/G42\) is still active/,
    summary: "Cancel cutter compensation with G40 before changing plane.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nG18\nG40\nG17\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nG40\nG18\nG17\nM5\nM30\n"
  },
  {
    id: "haas.plane-while-canned",
    severity: "warning",
    messageMatcher: /Plane select \(G17\/G18\/G19\) while a canned cycle is still active/,
    summary: "Cancel canned cycles with G80 before changing plane.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nG18\nG80\nG17\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nG80\nG18\nG17\nM5\nM30\n"
  },
  {
    id: "haas.plane-while-rotation",
    severity: "warning",
    messageMatcher: /Plane select \(G17\/G18\/G19\) while coordinate rotation \(G68\) is still active/,
    summary: "Cancel rotation with G69 before changing plane.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG68 X0 Y0 R45.\nG18\nG69\nG17\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG68 X0 Y0 R45.\nG69\nG18\nG17\nM5\nM30\n"
  },
  {
    id: "haas.plane-while-scaling",
    severity: "warning",
    messageMatcher: /Plane select \(G17\/G18\/G19\) while scaling \(G51\) is still active/,
    summary: "Cancel scaling with G50 before changing plane.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG51 P2.\nG18\nG50\nG17\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG51 P2.\nG50\nG18\nG17\nM5\nM30\n"
  },
  {
    id: "haas.plane-while-coolant-on",
    severity: "warning",
    messageMatcher: /Plane select \(G17\/G18\/G19\) while coolant is still on/,
    summary: "Turn coolant off with M9 before changing plane.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM8\nG18\nM9\nG17\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM8\nM9\nG18\nG17\nM5\nM30\n"
  },
  {
    id: "haas.plane-while-incremental",
    severity: "warning",
    messageMatcher: /Plane select \(G17\/G18\/G19\) while incremental mode \(G91\) is active/,
    summary: "Restore G90 before changing plane.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG91\nS1200 M3\nG18\nG90\nG17\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG91\nS1200 M3\nG90\nG18\nG17\nM5\nM30\n"
  },
  {
    id: "haas.unit-while-cutter-comp",
    severity: "warning",
    messageMatcher: /Unit select \(G20\/G21\) while cutter compensation \(G41\/G42\) is still active/,
    summary: "Cancel cutter compensation with G40 before changing units.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nG21\nG40\nG20\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nG40\nG21\nG20\nM5\nM30\n"
  },
  {
    id: "haas.unit-while-canned",
    severity: "warning",
    messageMatcher: /Unit select \(G20\/G21\) while a canned cycle is still active/,
    summary: "Cancel canned cycles with G80 before changing units.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nG21\nG80\nG20\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nG80\nG21\nG20\nM5\nM30\n"
  },
  {
    id: "haas.unit-while-rotation",
    severity: "warning",
    messageMatcher: /Unit select \(G20\/G21\) while coordinate rotation \(G68\) is still active/,
    summary: "Cancel rotation with G69 before changing units.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG68 X0 Y0 R45.\nG21\nG69\nG20\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG68 X0 Y0 R45.\nG69\nG21\nG20\nM5\nM30\n"
  },
  {
    id: "haas.unit-while-scaling",
    severity: "warning",
    messageMatcher: /Unit select \(G20\/G21\) while scaling \(G51\) is still active/,
    summary: "Cancel scaling with G50 before changing units.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG51 P2.\nG21\nG50\nG20\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG51 P2.\nG50\nG21\nG20\nM5\nM30\n"
  },
  {
    id: "haas.feed-mode-while-cutter-comp",
    severity: "warning",
    messageMatcher: /Feed mode select \(G94\/G95\) while cutter compensation \(G41\/G42\) is still active/,
    summary: "Cancel cutter compensation with G40 before changing feed mode.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nG95\nG40\nG94\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nG40\nG95\nG94\nM5\nM30\n"
  },
  {
    id: "haas.feed-mode-while-canned",
    severity: "warning",
    messageMatcher: /Feed mode select \(G94\/G95\) while a canned cycle is still active/,
    summary: "Cancel canned cycles with G80 before changing feed mode.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nG95\nG80\nG94\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nG80\nG95\nG94\nM5\nM30\n"
  },
  {
    id: "haas.path-mode-while-cutter-comp",
    severity: "warning",
    messageMatcher: /Path mode select \(G61\/G64\) while cutter compensation \(G41\/G42\) is still active/,
    summary: "Cancel cutter compensation with G40 before changing path mode.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nG61\nG40\nG64\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nG40\nG61\nG64\nM5\nM30\n"
  },
  {
    id: "haas.path-mode-while-canned",
    severity: "warning",
    messageMatcher: /Path mode select \(G61\/G64\) while a canned cycle is still active/,
    summary: "Cancel canned cycles with G80 before changing path mode.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nG61\nG80\nG64\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nG80\nG61\nG64\nM5\nM30\n"
  },
  {
    id: "haas.unit-while-coolant-on",
    severity: "warning",
    messageMatcher: /Unit select \(G20\/G21\) while coolant is still on/,
    summary: "Turn coolant off with M9 before changing units.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM8\nG21\nM9\nG20\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM8\nM9\nG21\nG20\nM5\nM30\n"
  },
  {
    id: "haas.unit-while-incremental",
    severity: "warning",
    messageMatcher: /Unit select \(G20\/G21\) while incremental mode \(G91\) is active/,
    summary: "Restore G90 before changing units.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG91\nS1200 M3\nG21\nG90\nG20\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG91\nS1200 M3\nG90\nG21\nG20\nM5\nM30\n"
  },
  {
    id: "haas.feed-mode-while-rotation",
    severity: "warning",
    messageMatcher: /Feed mode select \(G94\/G95\) while coordinate rotation \(G68\) is still active/,
    summary: "Cancel rotation with G69 before changing feed mode.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG68 X0 Y0 R45.\nG95\nG69\nG94\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG68 X0 Y0 R45.\nG69\nG95\nG94\nM5\nM30\n"
  },
  {
    id: "haas.feed-mode-while-scaling",
    severity: "warning",
    messageMatcher: /Feed mode select \(G94\/G95\) while scaling \(G51\) is still active/,
    summary: "Cancel scaling with G50 before changing feed mode.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG51 P2.\nG95\nG50\nG94\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG51 P2.\nG50\nG95\nG94\nM5\nM30\n"
  },
  {
    id: "haas.feed-mode-while-coolant-on",
    severity: "warning",
    messageMatcher: /Feed mode select \(G94\/G95\) while coolant is still on/,
    summary: "Turn coolant off with M9 before changing feed mode.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM8\nG95\nM9\nG94\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM8\nM9\nG95\nG94\nM5\nM30\n"
  },
  {
    id: "haas.feed-mode-while-incremental",
    severity: "warning",
    messageMatcher: /Feed mode select \(G94\/G95\) while incremental mode \(G91\) is active/,
    summary: "Restore G90 before changing feed mode.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG91\nS1200 M3\nG95\nG90\nG94\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG91\nS1200 M3\nG90\nG95\nG94\nM5\nM30\n"
  },
  {
    id: "haas.path-mode-while-rotation",
    severity: "warning",
    messageMatcher: /Path mode select \(G61\/G64\) while coordinate rotation \(G68\) is still active/,
    summary: "Cancel rotation with G69 before changing path mode.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG68 X0 Y0 R45.\nG61\nG69\nG64\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG68 X0 Y0 R45.\nG69\nG61\nG64\nM5\nM30\n"
  },
  {
    id: "haas.path-mode-while-scaling",
    severity: "warning",
    messageMatcher: /Path mode select \(G61\/G64\) while scaling \(G51\) is still active/,
    summary: "Cancel scaling with G50 before changing path mode.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG51 P2.\nG61\nG50\nG64\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG51 P2.\nG50\nG61\nG64\nM5\nM30\n"
  },
  {
    id: "haas.path-mode-while-coolant-on",
    severity: "warning",
    messageMatcher: /Path mode select \(G61\/G64\) while coolant is still on/,
    summary: "Turn coolant off with M9 before changing path mode.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM8\nG61\nM9\nG64\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM8\nM9\nG61\nG64\nM5\nM30\n"
  },
  {
    id: "haas.path-mode-while-incremental",
    severity: "warning",
    messageMatcher: /Path mode select \(G61\/G64\) while incremental mode \(G91\) is active/,
    summary: "Restore G90 before changing path mode.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG91\nS1200 M3\nG61\nG90\nG64\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG91\nS1200 M3\nG90\nG61\nG64\nM5\nM30\n"
  },
  {
    id: "haas.distance-mode-while-cutter-comp",
    severity: "warning",
    messageMatcher: /Distance mode select \(G90\/G91\) while cutter compensation \(G41\/G42\) is still active/,
    summary: "Cancel cutter compensation with G40 before changing distance mode.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nG91\nG40\nG90\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nG40\nG91\nG90\nM5\nM30\n"
  },
  {
    id: "haas.distance-mode-while-canned",
    severity: "warning",
    messageMatcher: /Distance mode select \(G90\/G91\) while a canned cycle is still active/,
    summary: "Cancel canned cycles with G80 before changing distance mode.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nG91\nG80\nG90\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nG80\nG91\nG90\nM5\nM30\n"
  },
  {
    id: "haas.distance-mode-while-rotation",
    severity: "warning",
    messageMatcher: /Distance mode select \(G90\/G91\) while coordinate rotation \(G68\) is still active/,
    summary: "Cancel rotation with G69 before changing distance mode.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG68 X0 Y0 R45.\nG91\nG69\nG90\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG68 X0 Y0 R45.\nG69\nG91\nG90\nM5\nM30\n"
  },
  {
    id: "haas.distance-mode-while-scaling",
    severity: "warning",
    messageMatcher: /Distance mode select \(G90\/G91\) while scaling \(G51\) is still active/,
    summary: "Cancel scaling with G50 before changing distance mode.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG51 P2.\nG91\nG50\nG90\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG51 P2.\nG50\nG91\nG90\nM5\nM30\n"
  },
  {
    id: "haas.distance-mode-while-coolant-on",
    severity: "warning",
    messageMatcher: /Distance mode select \(G90\/G91\) while coolant is still on/,
    summary: "Turn coolant off with M9 before changing distance mode.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM8\nG91\nM9\nG90\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM8\nM9\nG91\nG90\nM5\nM30\n"
  },
  {
    id: "haas.plane-while-tool-length",
    severity: "warning",
    messageMatcher: /Plane select \(G17\/G18\/G19\) while tool length compensation \(G43\) is still active/,
    summary: "Cancel tool length with G49 before changing plane.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG18\nG49\nG17\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG49\nG18\nG17\nM5\nM30\n"
  },
  {
    id: "haas.unit-while-tool-length",
    severity: "warning",
    messageMatcher: /Unit select \(G20\/G21\) while tool length compensation \(G43\) is still active/,
    summary: "Cancel tool length with G49 before changing units.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG21\nG49\nG20\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG49\nG21\nG20\nM5\nM30\n"
  },
  {
    id: "haas.feed-mode-while-tool-length",
    severity: "warning",
    messageMatcher: /Feed mode select \(G94\/G95\) while tool length compensation \(G43\) is still active/,
    summary: "Cancel tool length with G49 before changing feed mode.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG95\nG49\nG94\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG49\nG95\nG94\nM5\nM30\n"
  },
  {
    id: "haas.path-mode-while-tool-length",
    severity: "warning",
    messageMatcher: /Path mode select \(G61\/G64\) while tool length compensation \(G43\) is still active/,
    summary: "Cancel tool length with G49 before changing path mode.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG61\nG49\nG64\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG49\nG61\nG64\nM5\nM30\n"
  },
  {
    id: "haas.g41-g42-while-coolant-on",
    severity: "warning",
    messageMatcher: /G41\/G42 while coolant is still on/,
    summary: "Turn coolant off with M9 before cutter compensation.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nM8\nG41 D1\nM9\nG40\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nM8\nM9\nG41 D1\nG40\nM5\nM30\n"
  },
  {
    id: "haas.g0-while-rotation",
    severity: "warning",
    messageMatcher: /G0 rapid while coordinate rotation \(G68\) is still active/,
    summary: "Cancel rotation with G69 before G0 rapid moves.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG68 X0 Y0 R45.\nG0 X10.\nG69\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG68 X0 Y0 R45.\nG69\nG0 X10.\nM5\nM30\n"
  },
  {
    id: "haas.g0-while-scaling",
    severity: "warning",
    messageMatcher: /G0 rapid while scaling \(G51\) is still active/,
    summary: "Cancel scaling with G50 before G0 rapid moves.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG51 P2.\nG0 X10.\nG50\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG51 P2.\nG50\nG0 X10.\nM5\nM30\n"
  },
  {
    id: "haas.g80-while-coolant-on",
    severity: "warning",
    messageMatcher: /G80 while coolant is still on/,
    summary: "Turn coolant off with M9 before canceling canned cycles with G80.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM8\nG81 Z-1. R0.1 F10.\nG80\nM9\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM8\nG81 Z-1. R0.1 F10.\nM9\nG80\nM5\nM30\n"
  },
  {
    id: "haas.m9-while-cutter-comp",
    severity: "warning",
    messageMatcher: /M9 while cutter compensation \(G41\/G42\) is still active/,
    summary: "Cancel cutter compensation with G40 when turning coolant off.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nM8\nG41 D1\nM9\nG40\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nM8\nG41 D1\nG40\nM9\nM5\nM30\n"
  },
  {
    id: "haas.m9-while-canned",
    severity: "warning",
    messageMatcher: /M9 while a canned cycle is still active/,
    summary: "Cancel canned cycles with G80 when turning coolant off.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM8\nG81 Z-1. R0.1 F10.\nM9\nG80\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM8\nG81 Z-1. R0.1 F10.\nG80\nM9\nM5\nM30\n"
  },
  {
    id: "haas.m9-while-tool-length",
    severity: "warning",
    messageMatcher: /M9 while tool length compensation \(G43\) is still active/,
    summary: "Cancel tool length with G49 when turning coolant off.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nM8\nM9\nG49\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nM8\nG49\nM9\nM5\nM30\n"
  },
  {
    id: "haas.m9-while-rotation",
    severity: "warning",
    messageMatcher: /M9 while coordinate rotation \(G68\) is still active/,
    summary: "Cancel rotation with G69 when turning coolant off.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM8\nG68 X0 Y0 R45.\nM9\nG69\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM8\nG68 X0 Y0 R45.\nG69\nM9\nM5\nM30\n"
  },
  {
    id: "haas.m9-while-scaling",
    severity: "warning",
    messageMatcher: /M9 while scaling \(G51\) is still active/,
    summary: "Cancel scaling with G50 when turning coolant off.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM8\nG51 P2.\nM9\nG50\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM8\nG51 P2.\nG50\nM9\nM5\nM30\n"
  },
  {
    id: "haas.m9-while-incremental",
    severity: "warning",
    messageMatcher: /M9 while incremental mode \(G91\) is active/,
    summary: "Restore G90 when turning coolant off.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG91\nS1200 M3\nM8\nM9\nG90\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG91\nS1200 M3\nM8\nG90\nM9\nM5\nM30\n"
  },
  {
    id: "haas.spindle-on-while-canned",
    severity: "warning",
    messageMatcher: /Spindle start \(M3\/M4\) while a canned cycle is still active/,
    summary: "Cancel canned cycles with G80 before starting the spindle.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nM5\nM3\nG80\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nG80\nM5\nM3\nM5\nM30\n"
  },
  {
    id: "haas.spindle-on-while-cutter-comp",
    severity: "warning",
    messageMatcher: /Spindle start \(M3\/M4\) while cutter compensation \(G41\/G42\) is still active/,
    summary: "Cancel cutter compensation with G40 before starting the spindle.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nM5\nM3\nG40\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nG40\nM5\nM3\nM5\nM30\n"
  },
  {
    id: "haas.spindle-on-while-rotation",
    severity: "warning",
    messageMatcher: /Spindle start \(M3\/M4\) while coordinate rotation \(G68\) is still active/,
    summary: "Cancel rotation with G69 before starting the spindle.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG68 X0 Y0 R45.\nM5\nM3\nG69\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG68 X0 Y0 R45.\nG69\nM5\nM3\nM5\nM30\n"
  },
  {
    id: "haas.spindle-on-while-scaling",
    severity: "warning",
    messageMatcher: /Spindle start \(M3\/M4\) while scaling \(G51\) is still active/,
    summary: "Cancel scaling with G50 before starting the spindle.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG51 P2.\nM5\nM3\nG50\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG51 P2.\nG50\nM5\nM3\nM5\nM30\n"
  },
  {
    id: "haas.spindle-on-while-incremental",
    severity: "warning",
    messageMatcher: /Spindle start \(M3\/M4\) while incremental mode \(G91\) is active/,
    summary: "Restore G90 before starting the spindle.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG90\nS1200 M3\nG91\nM5\nM3\nG90\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG90\nS1200 M3\nG91\nG90\nM5\nM3\nM5\nM30\n"
  },
  {
    id: "haas.spindle-on-while-coolant-on",
    severity: "warning",
    messageMatcher: /Spindle start \(M3\/M4\) while coolant is still on/,
    summary: "Turn coolant off with M9 before starting the spindle.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM8\nM5\nM3\nM9\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM8\nM9\nM5\nM3\nM5\nM30\n"
  },
  {
    id: "haas.coolant-on-while-rotation",
    severity: "warning",
    messageMatcher: /Coolant on \(M7\/M8\) while coordinate rotation \(G68\) is still active/,
    summary: "Cancel rotation with G69 before coolant.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG68 X0 Y0 R45.\nM8\nG69\nM9\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG68 X0 Y0 R45.\nG69\nM8\nM9\nM5\nM30\n"
  },
  {
    id: "haas.coolant-on-while-scaling",
    severity: "warning",
    messageMatcher: /Coolant on \(M7\/M8\) while scaling \(G51\) is still active/,
    summary: "Cancel scaling with G50 before coolant.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG51 P2.\nM8\nG50\nM9\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG51 P2.\nG50\nM8\nM9\nM5\nM30\n"
  },
  {
    id: "haas.coolant-on-while-incremental",
    severity: "warning",
    messageMatcher: /Coolant on \(M7\/M8\) while incremental mode \(G91\) is active/,
    summary: "Restore G90 before coolant.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG91\nS1200 M3\nM8\nG90\nM9\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG91\nS1200 M3\nG90\nM8\nM9\nM5\nM30\n"
  },
  {
    id: "haas.coolant-on-while-cutter-comp",
    severity: "warning",
    messageMatcher: /Coolant on \(M7\/M8\) while cutter compensation \(G41\/G42\) is still active/,
    summary: "Cancel cutter compensation with G40 before coolant.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nM8\nG40\nM9\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nG40\nM8\nM9\nM5\nM30\n"
  },
  {
    id: "haas.feed-while-canned",
    severity: "warning",
    messageMatcher: /G1\/G2\/G3 while a canned cycle is still active/,
    summary: "Cancel canned cycles with G80 before feed motion.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nG1 X1. F10.\nG80\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nG80\nG1 X1. F10.\nM5\nM30\n"
  },
  {
    id: "haas.g92-while-cutter-comp",
    severity: "warning",
    messageMatcher: /G92 while cutter compensation \(G41\/G42\) is still active/,
    summary: "Cancel cutter compensation with G40 before G92.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nG92 X0\nG40\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nG40\nG92 X0\nM5\nM30\n"
  },
  {
    id: "haas.g92-while-canned",
    severity: "warning",
    messageMatcher: /G92 while a canned cycle is still active/,
    summary: "Cancel canned cycles with G80 before G92.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nG92 X0\nG80\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nG80\nG92 X0\nM5\nM30\n"
  },
  {
    id: "haas.g92-while-rotation",
    severity: "warning",
    messageMatcher: /G92 while coordinate rotation \(G68\) is still active/,
    summary: "Cancel rotation with G69 before G92.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG68 X0 Y0 R45.\nG92 X0\nG69\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG68 X0 Y0 R45.\nG69\nG92 X0\nM5\nM30\n"
  },
  {
    id: "haas.g92-while-scaling",
    severity: "warning",
    messageMatcher: /G92 while scaling \(G51\) is still active/,
    summary: "Cancel scaling with G50 before G92.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG51 P2.\nG92 X0\nG50\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG51 P2.\nG50\nG92 X0\nM5\nM30\n"
  },
  {
    id: "haas.g92-while-tool-length",
    severity: "warning",
    messageMatcher: /G92 while tool length compensation \(G43\) is still active/,
    summary: "Cancel tool length with G49 before G92.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG92 X0\nG49\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG49\nG92 X0\nM5\nM30\n"
  },
  {
    id: "haas.g52-while-cutter-comp",
    severity: "warning",
    messageMatcher: /G52 while cutter compensation \(G41\/G42\) is still active/,
    summary: "Cancel cutter compensation with G40 before G52.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nG52 X10.\nG40\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nG40\nG52 X10.\nM5\nM30\n"
  },
  {
    id: "haas.g52-while-canned",
    severity: "warning",
    messageMatcher: /G52 while a canned cycle is still active/,
    summary: "Cancel canned cycles with G80 before G52.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nG52 X10.\nG80\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nG80\nG52 X10.\nM5\nM30\n"
  },
  {
    id: "haas.g52-while-rotation",
    severity: "warning",
    messageMatcher: /G52 while coordinate rotation \(G68\) is still active/,
    summary: "Cancel rotation with G69 before G52.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG68 X0 Y0 R45.\nG52 X10.\nG69\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG68 X0 Y0 R45.\nG69\nG52 X10.\nM5\nM30\n"
  },
  {
    id: "haas.g52-while-scaling",
    severity: "warning",
    messageMatcher: /G52 while scaling \(G51\) is still active/,
    summary: "Cancel scaling with G50 before G52.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG51 P2.\nG52 X10.\nG50\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG51 P2.\nG50\nG52 X10.\nM5\nM30\n"
  },
  {
    id: "haas.g52-while-tool-length",
    severity: "warning",
    messageMatcher: /G52 while tool length compensation \(G43\) is still active/,
    summary: "Cancel tool length with G49 before G52.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG52 X10.\nG49\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG49\nG52 X10.\nM5\nM30\n"
  },
  {
    id: "haas.g92-while-coolant-on",
    severity: "warning",
    messageMatcher: /G92 while coolant is still on/,
    summary: "Turn coolant off with M9 before G92.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM8\nG92 X0\nM9\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM8\nM9\nG92 X0\nM5\nM30\n"
  },
  {
    id: "haas.g92-while-incremental",
    severity: "warning",
    messageMatcher: /G92 while incremental mode \(G91\) is active/,
    summary: "Restore G90 before G92.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG91\nS1200 M3\nG92 X0\nG90\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG91\nS1200 M3\nG90\nG92 X0\nM5\nM30\n"
  },
  {
    id: "haas.g52-while-coolant-on",
    severity: "warning",
    messageMatcher: /G52 while coolant is still on/,
    summary: "Turn coolant off with M9 before G52.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM8\nG52 X10.\nM9\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM8\nM9\nG52 X10.\nM5\nM30\n"
  },
  {
    id: "haas.g52-while-incremental",
    severity: "warning",
    messageMatcher: /G52 while incremental mode \(G91\) is active/,
    summary: "Restore G90 before G52.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG91\nS1200 M3\nG52 X10.\nG90\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG91\nS1200 M3\nG90\nG52 X10.\nM5\nM30\n"
  },
  {
    id: "haas.coolant-on-while-canned",
    severity: "warning",
    messageMatcher: /Coolant on \(M7\/M8\) while a canned cycle is still active/,
    summary: "Cancel canned cycles with G80 before coolant.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nM8\nG80\nM9\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nG80\nM8\nM9\nM5\nM30\n"
  },
  {
    id: "haas.feed-while-coolant-off",
    severity: "warning",
    messageMatcher: /G1\/G2\/G3 while coolant is off after coolant was used earlier/,
    summary: "Turn coolant back on before feed motion after coolant was used earlier.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nM8\nG1 X1. F10.\nM9\nG1 X2. F10.\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nM8\nG1 X1. F10.\nM9\nM8\nG1 X2. F10.\nM5\nM30\n"
  },
  {
    id: "haas.t-while-cutter-comp",
    severity: "warning",
    messageMatcher: /Tool select \(T\) while cutter compensation \(G41\/G42\) is still active/,
    summary: "Cancel cutter compensation with G40 before staging the next tool.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nT2\nG40\nM6\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nG40\nT2\nM6\nM5\nM30\n"
  },
  {
    id: "haas.t-while-canned",
    severity: "warning",
    messageMatcher: /Tool select \(T\) while a canned cycle is still active/,
    summary: "Cancel canned cycles with G80 before staging the next tool.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nT2\nG80\nM6\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nG80\nT2\nM6\nM5\nM30\n"
  },
  {
    id: "haas.t-while-tool-length",
    severity: "warning",
    messageMatcher: /Tool select \(T\) while tool length compensation \(G43\) is still active/,
    summary: "Cancel tool length with G49 before staging the next tool.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nT2\nG49\nM6\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG49\nT2\nM6\nM5\nM30\n"
  },
  {
    id: "haas.t-while-rotation",
    severity: "warning",
    messageMatcher: /Tool select \(T\) while coordinate rotation \(G68\) is still active/,
    summary: "Cancel rotation with G69 before staging the next tool.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG68 X0 Y0 R45.\nT2\nG69\nM6\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG68 X0 Y0 R45.\nG69\nT2\nM6\nM5\nM30\n"
  },
  {
    id: "haas.t-while-scaling",
    severity: "warning",
    messageMatcher: /Tool select \(T\) while scaling \(G51\) is still active/,
    summary: "Cancel scaling with G50 before staging the next tool.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG51 P2.\nT2\nG50\nM6\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG51 P2.\nG50\nT2\nM6\nM5\nM30\n"
  },
  {
    id: "haas.t-while-coolant-on",
    severity: "warning",
    messageMatcher: /Tool select \(T\) while coolant is still on/,
    summary: "Turn coolant off with M9 before staging the next tool.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM8\nT2\nM9\nM6\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM8\nM9\nT2\nM6\nM5\nM30\n"
  },
  {
    id: "haas.t-while-incremental",
    severity: "warning",
    messageMatcher: /Tool select \(T\) while incremental mode \(G91\) is active/,
    summary: "Restore G90 before staging the next tool.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG91\nS1200 M3\nT2\nG90\nM6\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG91\nS1200 M3\nG90\nT2\nM6\nM5\nM30\n"
  },
  {
    id: "haas.s-while-canned",
    severity: "warning",
    messageMatcher: /Spindle speed \(S\) while a canned cycle is still active/,
    summary: "Cancel canned cycles with G80 before changing spindle speed.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nS800\nG80\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nG80\nS800\nM5\nM30\n"
  },
  {
    id: "haas.s-while-cutter-comp",
    severity: "warning",
    messageMatcher: /Spindle speed \(S\) while cutter compensation \(G41\/G42\) is still active/,
    summary: "Cancel cutter compensation with G40 before changing spindle speed.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nS800\nG40\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nG40\nS800\nM5\nM30\n"
  },
  {
    id: "haas.s-while-rotation",
    severity: "warning",
    messageMatcher: /Spindle speed \(S\) while coordinate rotation \(G68\) is still active/,
    summary: "Cancel rotation with G69 before changing spindle speed.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG68 X0 Y0 R45.\nS800\nG69\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG68 X0 Y0 R45.\nG69\nS800\nM5\nM30\n"
  },
  {
    id: "haas.s-while-scaling",
    severity: "warning",
    messageMatcher: /Spindle speed \(S\) while scaling \(G51\) is still active/,
    summary: "Cancel scaling with G50 before changing spindle speed.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG51 P2.\nS800\nG50\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG51 P2.\nG50\nS800\nM5\nM30\n"
  },
  {
    id: "haas.s-while-incremental",
    severity: "warning",
    messageMatcher: /Spindle speed \(S\) while incremental mode \(G91\) is active/,
    summary: "Restore G90 before changing spindle speed.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG90\nS1200 M3\nG91\nS800\nG90\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG90\nS1200 M3\nG91\nG90\nS800\nM5\nM30\n"
  },
  {
    id: "haas.feed-mode-active-at-end",
    severity: "warning",
    messageMatcher: /Program ends in feed per revolution \(G95\)/,
    summary: "Restore G94 before M02/M30.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG95\nG1 X1. F0.1\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG95\nG1 X1. F0.1\nG94\nM5\nM30\n"
  },
  {
    id: "haas.path-mode-active-at-end",
    severity: "warning",
    messageMatcher: /Program ends in exact stop mode \(G61\)/,
    summary: "Restore G64 before M02/M30.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG61\nG1 X1. F10.\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG61\nG1 X1. F10.\nG64\nM5\nM30\n"
  },
  {
    id: "haas.s-while-coolant-on",
    severity: "warning",
    messageMatcher: /Spindle speed \(S\) while coolant is still on/,
    summary: "Turn coolant off with M9 before changing spindle speed.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM8\nS800\nM9\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM8\nM9\nS800\nM5\nM30\n"
  },
  {
    id: "haas.g52-active-at-end",
    severity: "warning",
    messageMatcher: /Program ends with G52 local offset still applied/,
    summary: "Cancel G52 local offset before M02/M30.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG52 X10.\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG52 X10.\nG52 X0 Y0 Z0\nM5\nM30\n"
  },
  {
    id: "haas.h-while-canned",
    severity: "warning",
    messageMatcher: /H offset word while a canned cycle is still active/,
    summary: "Cancel canned cycles with G80 before changing H offsets.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nH2\nG80\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nG80\nH2\nM5\nM30\n"
  },
  {
    id: "haas.h-while-cutter-comp",
    severity: "warning",
    messageMatcher: /H offset word while cutter compensation \(G41\/G42\) is still active/,
    summary: "Cancel cutter compensation with G40 before changing H offsets.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nH2\nG40\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nG40\nH2\nM5\nM30\n"
  },
  {
    id: "haas.h-while-rotation",
    severity: "warning",
    messageMatcher: /H offset word while coordinate rotation \(G68\) is still active/,
    summary: "Cancel rotation with G69 before changing H offsets.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG68 X0 Y0 R45.\nH2\nG69\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG68 X0 Y0 R45.\nG69\nH2\nM5\nM30\n"
  },
  {
    id: "haas.h-while-scaling",
    severity: "warning",
    messageMatcher: /H offset word while scaling \(G51\) is still active/,
    summary: "Cancel scaling with G50 before changing H offsets.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG51 P2.\nH2\nG50\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG51 P2.\nG50\nH2\nM5\nM30\n"
  },
  {
    id: "haas.d-while-canned",
    severity: "warning",
    messageMatcher: /D offset word while a canned cycle is still active/,
    summary: "Cancel canned cycles with G80 before changing D offsets.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nD2\nG80\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nG80\nD2\nM5\nM30\n"
  },
  {
    id: "haas.d-while-rotation",
    severity: "warning",
    messageMatcher: /D offset word while coordinate rotation \(G68\) is still active/,
    summary: "Cancel rotation with G69 before changing D offsets.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG68 X0 Y0 R45.\nD2\nG69\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG68 X0 Y0 R45.\nG69\nD2\nM5\nM30\n"
  },
  {
    id: "haas.d-while-scaling",
    severity: "warning",
    messageMatcher: /D offset word while scaling \(G51\) is still active/,
    summary: "Cancel scaling with G50 before changing D offsets.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG51 P2.\nD2\nG50\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG51 P2.\nG50\nD2\nM5\nM30\n"
  },
  {
    id: "haas.d-while-incremental",
    severity: "warning",
    messageMatcher: /D offset word while incremental mode \(G91\) is active/,
    summary: "Restore G90 before changing D offsets.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG91\nS1200 M3\nD2\nG90\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG91\nS1200 M3\nG90\nD2\nM5\nM30\n"
  },
  {
    id: "haas.h-while-incremental",
    severity: "warning",
    messageMatcher: /H offset word while incremental mode \(G91\) is active/,
    summary: "Restore G90 before changing H offsets.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG91\nS1200 M3\nH2\nG90\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG91\nS1200 M3\nG90\nH2\nM5\nM30\n"
  },
  {
    id: "haas.h-while-coolant-on",
    severity: "warning",
    messageMatcher: /H offset word while coolant is still on/,
    summary: "Turn coolant off with M9 before changing H offsets.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM8\nH2\nM9\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM8\nM9\nH2\nM5\nM30\n"
  },
  {
    id: "haas.d-while-cutter-comp",
    severity: "warning",
    messageMatcher: /D offset word while cutter compensation \(G41\/G42\) is still active/,
    summary: "Cancel cutter compensation with G40 before changing D offsets.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nD2\nG40\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nG40\nD2\nM5\nM30\n"
  },
  {
    id: "haas.d-while-coolant-on",
    severity: "warning",
    messageMatcher: /D offset word while coolant is still on/,
    summary: "Turn coolant off with M9 before changing D offsets.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM8\nD2\nM9\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM8\nM9\nD2\nM5\nM30\n"
  },
  {
    id: "haas.q-while-cutter-comp",
    severity: "warning",
    messageMatcher: /Q word while cutter compensation \(G41\/G42\) is still active/,
    summary: "Cancel cutter compensation with G40 before using Q outside a peck cycle.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nQ0.1\nG40\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nG40\nQ0.1\nM5\nM30\n"
  },
  {
    id: "haas.q-while-canned",
    severity: "warning",
    messageMatcher: /Q word while a canned cycle is still active/,
    summary: "Cancel canned cycles with G80 before using Q outside a peck cycle.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nQ0.1\nG80\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nG80\nQ0.1\nM5\nM30\n"
  },
  {
    id: "haas.q-while-rotation",
    severity: "warning",
    messageMatcher: /Q word while coordinate rotation \(G68\) is still active/,
    summary: "Cancel rotation with G69 before using Q outside a peck cycle.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG68 X0 Y0 R45.\nQ0.1\nG69\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG68 X0 Y0 R45.\nG69\nQ0.1\nM5\nM30\n"
  },
  {
    id: "haas.q-while-scaling",
    severity: "warning",
    messageMatcher: /Q word while scaling \(G51\) is still active/,
    summary: "Cancel scaling with G50 before using Q outside a peck cycle.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG51 P2.\nQ0.1\nG50\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG51 P2.\nG50\nQ0.1\nM5\nM30\n"
  },
  {
    id: "haas.q-while-incremental",
    severity: "warning",
    messageMatcher: /Q word while incremental mode \(G91\) is active/,
    summary: "Restore G90 before using Q outside a peck cycle.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG91\nS1200 M3\nQ0.1\nG90\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG91\nS1200 M3\nG90\nQ0.1\nM5\nM30\n"
  },
  {
    id: "haas.q-while-coolant-on",
    severity: "warning",
    messageMatcher: /Q word while coolant is still on/,
    summary: "Turn coolant off with M9 before using Q outside a peck cycle.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM8\nQ0.1\nM9\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM8\nM9\nQ0.1\nM5\nM30\n"
  },
  {
    id: "haas.r-while-cutter-comp",
    severity: "warning",
    messageMatcher: /R word while cutter compensation \(G41\/G42\) is still active/,
    summary: "Cancel cutter compensation with G40 before using R outside canned/arc/rotation context.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nR0.1\nG40\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nG40\nR0.1\nM5\nM30\n"
  },
  {
    id: "haas.r-while-rotation",
    severity: "warning",
    messageMatcher: /R word while coordinate rotation \(G68\) is still active/,
    summary: "Cancel rotation with G69 before using R outside canned/arc/rotation context.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG68 X0 Y0 R45.\nR0.1\nG69\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG68 X0 Y0 R45.\nG69\nR0.1\nM5\nM30\n"
  },
  {
    id: "haas.r-while-scaling",
    severity: "warning",
    messageMatcher: /R word while scaling \(G51\) is still active/,
    summary: "Cancel scaling with G50 before using R outside canned/arc/rotation context.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG51 P2.\nR0.1\nG50\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG51 P2.\nG50\nR0.1\nM5\nM30\n"
  },
  {
    id: "haas.r-while-incremental",
    severity: "warning",
    messageMatcher: /R word while incremental mode \(G91\) is active/,
    summary: "Restore G90 before using R outside canned/arc/rotation context.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG91\nS1200 M3\nR0.1\nG90\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG91\nS1200 M3\nG90\nR0.1\nM5\nM30\n"
  },
  {
    id: "haas.r-while-coolant-on",
    severity: "warning",
    messageMatcher: /R word while coolant is still on/,
    summary: "Turn coolant off with M9 before using R outside canned/arc/rotation context.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM8\nR0.1\nM9\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM8\nM9\nR0.1\nM5\nM30\n"
  },
  {
    id: "haas.r-while-tool-length",
    severity: "warning",
    messageMatcher: /R word while tool length compensation \(G43\) is still active/,
    summary: "Cancel tool length with G49 before using R outside canned/arc/rotation context.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nR0.1\nG49\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG49\nR0.1\nM5\nM30\n"
  },
  {
    id: "haas.p-while-cutter-comp",
    severity: "warning",
    messageMatcher: /P word while cutter compensation \(G41\/G42\) is still active/,
    summary: "Cancel cutter compensation with G40 before using P outside call/dwell/scaling/canned context.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nP100\nG40\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nG40\nP100\nM5\nM30\n"
  },
  {
    id: "haas.p-while-rotation",
    severity: "warning",
    messageMatcher: /P word while coordinate rotation \(G68\) is still active/,
    summary: "Cancel rotation with G69 before using P outside call/dwell/scaling/canned context.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG68 X0 Y0 R45.\nP100\nG69\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG68 X0 Y0 R45.\nG69\nP100\nM5\nM30\n"
  },
  {
    id: "haas.p-while-scaling",
    severity: "warning",
    messageMatcher: /P word while scaling \(G51\) is still active/,
    summary: "Cancel scaling with G50 before using P outside call/dwell/scaling/canned context.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG51 P2.\nP100\nG50\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG51 P2.\nG50\nP100\nM5\nM30\n"
  },
  {
    id: "haas.p-while-tool-length",
    severity: "warning",
    messageMatcher: /P word while tool length compensation \(G43\) is still active/,
    summary: "Cancel tool length with G49 before using P outside call/dwell/scaling/canned context.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nP100\nG49\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG49\nP100\nM5\nM30\n"
  },
  {
    id: "haas.p-while-incremental",
    severity: "warning",
    messageMatcher: /P word while incremental mode \(G91\) is active/,
    summary: "Restore G90 before using P outside call/dwell/scaling/canned context.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG91\nS1200 M3\nP100\nG90\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG91\nS1200 M3\nG90\nP100\nM5\nM30\n"
  },
  {
    id: "haas.p-while-coolant-on",
    severity: "warning",
    messageMatcher: /P word while coolant is still on/,
    summary: "Turn coolant off with M9 before using P outside call/dwell/scaling/canned context.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM8\nP100\nM9\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM8\nM9\nP100\nM5\nM30\n"
  },
  {
    id: "haas.ijk-while-cutter-comp",
    severity: "warning",
    messageMatcher: /I\/J\/K word while cutter compensation \(G41\/G42\) is still active/,
    summary: "Cancel cutter compensation with G40 before using I/J/K outside arc context.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nI1.\nG40\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nG40\nI1.\nM5\nM30\n"
  },
  {
    id: "haas.ijk-while-rotation",
    severity: "warning",
    messageMatcher: /I\/J\/K word while coordinate rotation \(G68\) is still active/,
    summary: "Cancel rotation with G69 before using I/J/K outside arc context.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG68 X0 Y0 R45.\nI1.\nG69\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG68 X0 Y0 R45.\nG69\nI1.\nM5\nM30\n"
  },
  {
    id: "haas.ijk-while-scaling",
    severity: "warning",
    messageMatcher: /I\/J\/K word while scaling \(G51\) is still active/,
    summary: "Cancel scaling with G50 before using I/J/K outside arc context.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG51 P2.\nI1.\nG50\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG51 P2.\nG50\nI1.\nM5\nM30\n"
  },
  {
    id: "haas.ijk-while-incremental",
    severity: "warning",
    messageMatcher: /I\/J\/K word while incremental mode \(G91\) is active/,
    summary: "Restore G90 before using I/J/K outside arc context.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG91\nS1200 M3\nI1.\nG90\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG91\nS1200 M3\nG90\nI1.\nM5\nM30\n"
  },
  {
    id: "haas.ijk-while-coolant-on",
    severity: "warning",
    messageMatcher: /I\/J\/K word while coolant is still on/,
    summary: "Turn coolant off with M9 before using I/J/K outside arc context.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM8\nI1.\nM9\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM8\nM9\nI1.\nM5\nM30\n"
  },
  {
    id: "haas.ijk-while-tool-length",
    severity: "warning",
    messageMatcher: /I\/J\/K word while tool length compensation \(G43\) is still active/,
    summary: "Cancel tool length with G49 before using I/J/K outside arc context.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nI1.\nG49\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG49\nI1.\nM5\nM30\n"
  },
  {
    id: "haas.ijk-while-canned",
    severity: "warning",
    messageMatcher: /I\/J\/K word while a canned cycle is still active/,
    summary: "Cancel canned cycles with G80 before using I/J/K outside arc context.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nI1.\nG80\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nG80\nI1.\nM5\nM30\n"
  },
  {
    id: "haas.g92-used-at-end",
    severity: "warning",
    messageMatcher: /Program ends after G92 was used/,
    summary: "Verify the coordinate system is restored before M02/M30 after G92.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG92 X0\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM5\nM30\n"
  },
  {
    id: "haas.g28-and-g92-same-block",
    severity: "warning",
    messageMatcher: /Machine positioning conflict on the same block/,
    summary: "Superseded by haas.machine-position-conflict-same-block — split G28/G30/G53 from other modes/calls/stops.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG91\nG28 Z0 G92 X0\nG90\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG91\nG28 Z0\nG90\nM30\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.machine-position-conflict-same-block."
  },
  {
    id: "haas.g53-and-g92-same-block",
    severity: "warning",
    messageMatcher: /Machine positioning conflict on the same block/,
    summary: "Superseded by haas.machine-position-conflict-same-block — split G28/G30/G53 from other modes/calls/stops.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG90\nG53 Z0 G92 X0\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG90\nG53 Z0\nM30\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.machine-position-conflict-same-block."
  },
  {
    id: "haas.g30-and-g92-same-block",
    severity: "warning",
    messageMatcher: /Machine positioning conflict on the same block/,
    summary: "Superseded by haas.machine-position-conflict-same-block — split G28/G30/G53 from other modes/calls/stops.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG91\nG30 Z0 G92 X0\nG90\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG91\nG30 Z0\nG90\nM30\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.machine-position-conflict-same-block."
  },
  {
    id: "haas.g28-and-g52-same-block",
    severity: "warning",
    messageMatcher: /Machine positioning conflict on the same block/,
    summary: "Superseded by haas.machine-position-conflict-same-block — split G28/G30/G53 from other modes/calls/stops.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG91\nG28 Z0 G52 X10.\nG90\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG91\nG28 Z0\nG90\nM30\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.machine-position-conflict-same-block."
  },
  {
    id: "haas.g53-and-g52-same-block",
    severity: "warning",
    messageMatcher: /Machine positioning conflict on the same block/,
    summary: "Superseded by haas.machine-position-conflict-same-block — split G28/G30/G53 from other modes/calls/stops.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG90\nG53 Z0 G52 X10.\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG90\nG53 Z0\nM30\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.machine-position-conflict-same-block."
  },
  {
    id: "haas.g30-and-g52-same-block",
    severity: "warning",
    messageMatcher: /Machine positioning conflict on the same block/,
    summary: "Superseded by haas.machine-position-conflict-same-block — split G28/G30/G53 from other modes/calls/stops.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG91\nG30 Z0 G52 X10.\nG90\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG91\nG30 Z0\nG90\nM30\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.machine-position-conflict-same-block."
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
    messageMatcher: /Machine positioning conflict on the same block/,
    summary: "Superseded by haas.machine-position-conflict-same-block — split G28/G30/G53 from other modes/calls/stops.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG91\nT2 M6 G28 Z0\nG90\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG91\nG28 Z0\nG90\nT2 M6\nM30\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.machine-position-conflict-same-block."
  },
  {
    id: "haas.m6-and-g30-same-block",
    severity: "warning",
    messageMatcher: /Machine positioning conflict on the same block/,
    summary: "Superseded by haas.machine-position-conflict-same-block — split G28/G30/G53 from other modes/calls/stops.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG91\nT2 M6 G30 Z0\nG90\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG91\nG30 Z0\nG90\nT2 M6\nM30\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.machine-position-conflict-same-block."
  },
  {
    id: "haas.m6-and-g53-same-block",
    severity: "warning",
    messageMatcher: /Machine positioning conflict on the same block/,
    summary: "Superseded by haas.machine-position-conflict-same-block — split G28/G30/G53 from other modes/calls/stops.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG90\nT2 M6 G53 Z0\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG90\nG53 Z0\nT2 M6\nM30\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.machine-position-conflict-same-block."
  },
  {
    id: "haas.g4-and-g28-same-block",
    severity: "warning",
    messageMatcher: /Machine positioning conflict on the same block/,
    summary: "Superseded by haas.machine-position-conflict-same-block — split G28/G30/G53 from other modes/calls/stops.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG91\nG28 Z0 G4 P1.\nG90\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG91\nG28 Z0\nG4 P1.\nG90\nM30\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.machine-position-conflict-same-block."
  },
  {
    id: "haas.g4-and-g30-same-block",
    severity: "warning",
    messageMatcher: /Machine positioning conflict on the same block/,
    summary: "Superseded by haas.machine-position-conflict-same-block — split G28/G30/G53 from other modes/calls/stops.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG91\nG30 Z0 G4 P1.\nG90\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG91\nG30 Z0\nG4 P1.\nG90\nM30\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.machine-position-conflict-same-block."
  },
  {
    id: "haas.g4-and-g53-same-block",
    severity: "warning",
    messageMatcher: /Machine positioning conflict on the same block/,
    summary: "Superseded by haas.machine-position-conflict-same-block — split G28/G30/G53 from other modes/calls/stops.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG90\nG53 Z0 G4 P1.\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG90\nG53 Z0\nG4 P1.\nM30\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.machine-position-conflict-same-block."
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
    messageMatcher: /Machine positioning conflict on the same block/,
    summary: "Superseded by haas.machine-position-conflict-same-block — split G28/G30/G53 from other modes/calls/stops.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG91\nM98 P2 G28 Z0\nG90\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG91\nG28 Z0\nG90\nM98 P2\nM30\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.machine-position-conflict-same-block."
  },
  {
    id: "haas.m97-and-g28-same-block",
    severity: "warning",
    messageMatcher: /Machine positioning conflict on the same block/,
    summary: "Superseded by haas.machine-position-conflict-same-block — split G28/G30/G53 from other modes/calls/stops.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG91\nM97 P10 G28 Z0\nG90\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG91\nG28 Z0\nG90\nM97 P10\nM30\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.machine-position-conflict-same-block."
  },
  {
    id: "haas.g65-and-g28-same-block",
    severity: "warning",
    messageMatcher: /Machine positioning conflict on the same block/,
    summary: "Superseded by haas.machine-position-conflict-same-block — split G28/G30/G53 from other modes/calls/stops.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG91\nG65 P9010 G28 Z0\nG90\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG91\nG28 Z0\nG90\nG65 P9010\nM30\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.machine-position-conflict-same-block."
  },
  {
    id: "haas.m98-and-g53-same-block",
    severity: "warning",
    messageMatcher: /Machine positioning conflict on the same block/,
    summary: "Superseded by haas.machine-position-conflict-same-block — split G28/G30/G53 from other modes/calls/stops.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG90\nM98 P2 G53 Z0\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG90\nG53 Z0\nM98 P2\nM30\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.machine-position-conflict-same-block."
  },
  {
    id: "haas.m97-and-g53-same-block",
    severity: "warning",
    messageMatcher: /Machine positioning conflict on the same block/,
    summary: "Superseded by haas.machine-position-conflict-same-block — split G28/G30/G53 from other modes/calls/stops.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG90\nM97 P10 G53 Z0\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG90\nG53 Z0\nM97 P10\nM30\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.machine-position-conflict-same-block."
  },
  {
    id: "haas.g65-and-g53-same-block",
    severity: "warning",
    messageMatcher: /Machine positioning conflict on the same block/,
    summary: "Superseded by haas.machine-position-conflict-same-block — split G28/G30/G53 from other modes/calls/stops.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG90\nG65 P9010 G53 Z0\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG90\nG53 Z0\nG65 P9010\nM30\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.machine-position-conflict-same-block."
  },
  {
    id: "haas.m98-and-g30-same-block",
    severity: "warning",
    messageMatcher: /Machine positioning conflict on the same block/,
    summary: "Superseded by haas.machine-position-conflict-same-block — split G28/G30/G53 from other modes/calls/stops.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG91\nM98 P2 G30 Z0\nG90\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG91\nG30 Z0\nG90\nM98 P2\nM30\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.machine-position-conflict-same-block."
  },
  {
    id: "haas.m97-and-g30-same-block",
    severity: "warning",
    messageMatcher: /Machine positioning conflict on the same block/,
    summary: "Superseded by haas.machine-position-conflict-same-block — split G28/G30/G53 from other modes/calls/stops.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG91\nM97 P10 G30 Z0\nG90\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG91\nG30 Z0\nG90\nM97 P10\nM30\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.machine-position-conflict-same-block."
  },
  {
    id: "haas.g65-and-g30-same-block",
    severity: "warning",
    messageMatcher: /Machine positioning conflict on the same block/,
    summary: "Superseded by haas.machine-position-conflict-same-block — split G28/G30/G53 from other modes/calls/stops.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG91\nG65 P9010 G30 Z0\nG90\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG91\nG30 Z0\nG90\nG65 P9010\nM30\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.machine-position-conflict-same-block."
  },
  {
    id: "haas.m00-and-g28-same-block",
    severity: "warning",
    messageMatcher: /Machine positioning conflict on the same block/,
    summary: "Superseded by haas.machine-position-conflict-same-block — split G28/G30/G53 from other modes/calls/stops.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG91\nM00 G28 Z0\nG90\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG91\nG28 Z0\nG90\nM00\nM30\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.machine-position-conflict-same-block."
  },
  {
    id: "haas.m01-and-g28-same-block",
    severity: "warning",
    messageMatcher: /Machine positioning conflict on the same block/,
    summary: "Superseded by haas.machine-position-conflict-same-block — split G28/G30/G53 from other modes/calls/stops.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG91\nM01 G28 Z0\nG90\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG91\nG28 Z0\nG90\nM01\nM30\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.machine-position-conflict-same-block."
  },
  {
    id: "haas.m00-and-g53-same-block",
    severity: "warning",
    messageMatcher: /Machine positioning conflict on the same block/,
    summary: "Superseded by haas.machine-position-conflict-same-block — split G28/G30/G53 from other modes/calls/stops.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG90\nM00 G53 Z0\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG90\nG53 Z0\nM00\nM30\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.machine-position-conflict-same-block."
  },
  {
    id: "haas.m01-and-g53-same-block",
    severity: "warning",
    messageMatcher: /Machine positioning conflict on the same block/,
    summary: "Superseded by haas.machine-position-conflict-same-block — split G28/G30/G53 from other modes/calls/stops.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG90\nM01 G53 Z0\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG90\nG53 Z0\nM01\nM30\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.machine-position-conflict-same-block."
  },
  {
    id: "haas.m00-and-g30-same-block",
    severity: "warning",
    messageMatcher: /Machine positioning conflict on the same block/,
    summary: "Superseded by haas.machine-position-conflict-same-block — split G28/G30/G53 from other modes/calls/stops.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG91\nM00 G30 Z0\nG90\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG91\nG30 Z0\nG90\nM00\nM30\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.machine-position-conflict-same-block."
  },
  {
    id: "haas.m01-and-g30-same-block",
    severity: "warning",
    messageMatcher: /Machine positioning conflict on the same block/,
    summary: "Superseded by haas.machine-position-conflict-same-block — split G28/G30/G53 from other modes/calls/stops.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG91\nM01 G30 Z0\nG90\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG91\nG30 Z0\nG90\nM01\nM30\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.machine-position-conflict-same-block."
  },
  {
    id: "haas.m99-and-g28-same-block",
    severity: "warning",
    messageMatcher: /Machine positioning conflict on the same block/,
    summary: "Superseded by haas.machine-position-conflict-same-block — split G28/G30/G53 from other modes/calls/stops.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG91\nM99 G28 Z0\nG90\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG91\nG28 Z0\nG90\nM99\nM30\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.machine-position-conflict-same-block."
  },
  {
    id: "haas.m99-and-g30-same-block",
    severity: "warning",
    messageMatcher: /Machine positioning conflict on the same block/,
    summary: "Superseded by haas.machine-position-conflict-same-block — split G28/G30/G53 from other modes/calls/stops.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG91\nM99 G30 Z0\nG90\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG91\nG30 Z0\nG90\nM99\nM30\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.machine-position-conflict-same-block."
  },
  {
    id: "haas.m99-and-g53-same-block",
    severity: "warning",
    messageMatcher: /Machine positioning conflict on the same block/,
    summary: "Superseded by haas.machine-position-conflict-same-block — split G28/G30/G53 from other modes/calls/stops.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG90\nM99 G53 Z0\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG90\nG53 Z0\nM99\nM30\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.machine-position-conflict-same-block."
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
    id: "haas.m30-and-g28-same-block",
    severity: "warning",
    messageMatcher: /Machine positioning conflict on the same block/,
    summary: "Superseded by haas.machine-position-conflict-same-block — split G28/G30/G53 from other modes/calls/stops.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG91\nM30 G28 Z0\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG91\nG28 Z0\nG90\nM30\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.machine-position-conflict-same-block."
  },
  {
    id: "haas.m30-and-g30-same-block",
    severity: "warning",
    messageMatcher: /Machine positioning conflict on the same block/,
    summary: "Superseded by haas.machine-position-conflict-same-block — split G28/G30/G53 from other modes/calls/stops.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG91\nM30 G30 Z0\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG91\nG30 Z0\nG90\nM30\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.machine-position-conflict-same-block."
  },
  {
    id: "haas.m30-and-g53-same-block",
    severity: "warning",
    messageMatcher: /Machine positioning conflict on the same block/,
    summary: "Superseded by haas.machine-position-conflict-same-block — split G28/G30/G53 from other modes/calls/stops.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG90\nM30 G53 Z0\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG90\nG53 Z0\nM30\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.machine-position-conflict-same-block."
  },
  {
    id: "haas.m02-and-g28-same-block",
    severity: "warning",
    messageMatcher: /Machine positioning conflict on the same block/,
    summary: "Superseded by haas.machine-position-conflict-same-block — split G28/G30/G53 from other modes/calls/stops.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG91\nM02 G28 Z0\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG91\nG28 Z0\nG90\nM02\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.machine-position-conflict-same-block."
  },
  {
    id: "haas.m02-and-g30-same-block",
    severity: "warning",
    messageMatcher: /Machine positioning conflict on the same block/,
    summary: "Superseded by haas.machine-position-conflict-same-block — split G28/G30/G53 from other modes/calls/stops.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG91\nM02 G30 Z0\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG91\nG30 Z0\nG90\nM02\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.machine-position-conflict-same-block."
  },
  {
    id: "haas.m02-and-g53-same-block",
    severity: "warning",
    messageMatcher: /Machine positioning conflict on the same block/,
    summary: "Superseded by haas.machine-position-conflict-same-block — split G28/G30/G53 from other modes/calls/stops.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG90\nM02 G53 Z0\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG90\nG53 Z0\nM02\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.machine-position-conflict-same-block."
  },
  {
    id: "haas.g4-and-g92-same-block",
    severity: "warning",
    messageMatcher: /Coordinate shift conflict on the same block/,
    summary: "Superseded by haas.coord-shift-conflict-same-block — split G92/G52 from other modes.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG4 P1. G92 X0\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG4 P1.\nM30\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.coord-shift-conflict-same-block."
  },
  {
    id: "haas.g4-and-g52-same-block",
    severity: "warning",
    messageMatcher: /Coordinate shift conflict on the same block/,
    summary: "Superseded by haas.coord-shift-conflict-same-block — split G92/G52 from other modes.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG4 P1. G52 X10.\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG4 P1.\nM30\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.coord-shift-conflict-same-block."
  },
  {
    id: "haas.m6-and-g92-same-block",
    severity: "warning",
    messageMatcher: /Coordinate shift conflict on the same block/,
    summary: "Superseded by haas.coord-shift-conflict-same-block — split G92/G52 from other modes.",
    positiveSnippet: "O0001\nT1 M6\nG54\nT2 M6 G92 X0\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nT2 M6\nM30\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.coord-shift-conflict-same-block."
  },
  {
    id: "haas.m6-and-g52-same-block",
    severity: "warning",
    messageMatcher: /Coordinate shift conflict on the same block/,
    summary: "Superseded by haas.coord-shift-conflict-same-block — split G92/G52 from other modes.",
    positiveSnippet: "O0001\nT1 M6\nG54\nT2 M6 G52 X10.\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nT2 M6\nM30\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.coord-shift-conflict-same-block."
  },
  {
    id: "haas.work-offset-and-g28-same-block",
    severity: "warning",
    messageMatcher: /Machine positioning conflict on the same block/,
    summary: "Superseded by haas.machine-position-conflict-same-block — split G28/G30/G53 from other modes/calls/stops.",
    positiveSnippet: "O0001\nT1 M6\nG54 G28 Z0\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG28 Z0\nM30\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.machine-position-conflict-same-block."
  },
  {
    id: "haas.work-offset-and-g30-same-block",
    severity: "warning",
    messageMatcher: /Machine positioning conflict on the same block/,
    summary: "Superseded by haas.machine-position-conflict-same-block — split G28/G30/G53 from other modes/calls/stops.",
    positiveSnippet: "O0001\nT1 M6\nG54 G30 Z0\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG30 Z0\nM30\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.machine-position-conflict-same-block."
  },
  {
    id: "haas.g43-and-g92-same-block",
    severity: "warning",
    messageMatcher: /Coordinate shift conflict on the same block/,
    summary: "Superseded by haas.coord-shift-conflict-same-block — split G92/G52 from other modes.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25. G92 X0\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nM30\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.coord-shift-conflict-same-block."
  },
  {
    id: "haas.g43-and-g52-same-block",
    severity: "warning",
    messageMatcher: /Coordinate shift conflict on the same block/,
    summary: "Superseded by haas.coord-shift-conflict-same-block — split G92/G52 from other modes.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25. G52 X10.\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nM30\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.coord-shift-conflict-same-block."
  },
  {
    id: "haas.g49-and-g92-same-block",
    severity: "warning",
    messageMatcher: /Coordinate shift conflict on the same block/,
    summary: "Superseded by haas.coord-shift-conflict-same-block — split G92/G52 from other modes.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nG49 G92 X0\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nG49\nM30\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.coord-shift-conflict-same-block."
  },
  {
    id: "haas.g49-and-g52-same-block",
    severity: "warning",
    messageMatcher: /Coordinate shift conflict on the same block/,
    summary: "Superseded by haas.coord-shift-conflict-same-block — split G92/G52 from other modes.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nG49 G52 X10.\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nG49\nM30\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.coord-shift-conflict-same-block."
  },
  {
    id: "haas.g40-and-g92-same-block",
    severity: "warning",
    messageMatcher: /Coordinate shift conflict on the same block/,
    summary: "Superseded by haas.coord-shift-conflict-same-block — split G92/G52 from other modes.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG41 D1\nG40 G92 X0\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG41 D1\nG40\nM30\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.coord-shift-conflict-same-block."
  },
  {
    id: "haas.g40-and-g52-same-block",
    severity: "warning",
    messageMatcher: /Coordinate shift conflict on the same block/,
    summary: "Superseded by haas.coord-shift-conflict-same-block — split G92/G52 from other modes.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG41 D1\nG40 G52 X10.\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG41 D1\nG40\nM30\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.coord-shift-conflict-same-block."
  },
  {
    id: "haas.g80-and-g92-same-block",
    severity: "warning",
    messageMatcher: /Coordinate shift conflict on the same block/,
    summary: "Superseded by haas.coord-shift-conflict-same-block — split G92/G52 from other modes.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG81 Z-1. R0.1 F10.\nG80 G92 X0\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG81 Z-1. R0.1 F10.\nG80\nM30\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.coord-shift-conflict-same-block."
  },
  {
    id: "haas.g80-and-g52-same-block",
    severity: "warning",
    messageMatcher: /Coordinate shift conflict on the same block/,
    summary: "Superseded by haas.coord-shift-conflict-same-block — split G92/G52 from other modes.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG81 Z-1. R0.1 F10.\nG80 G52 X10.\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG81 Z-1. R0.1 F10.\nG80\nM30\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.coord-shift-conflict-same-block."
  },
  {
    id: "haas.work-offset-and-g92-same-block",
    severity: "warning",
    messageMatcher: /Coordinate shift conflict on the same block/,
    summary: "Superseded by haas.coord-shift-conflict-same-block — split G92/G52 from other modes.",
    positiveSnippet: "O0001\nT1 M6\nG54 G92 X0\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG92 X0\nM30\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.coord-shift-conflict-same-block."
  },
  {
    id: "haas.work-offset-and-g52-same-block",
    severity: "warning",
    messageMatcher: /Coordinate shift conflict on the same block/,
    summary: "Superseded by haas.coord-shift-conflict-same-block — split G92/G52 from other modes.",
    positiveSnippet: "O0001\nT1 M6\nG54 G52 X10.\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG52 X10.\nM30\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.coord-shift-conflict-same-block."
  },
  {
    id: "haas.cutter-comp-and-g92-same-block",
    severity: "warning",
    messageMatcher: /Coordinate shift conflict on the same block/,
    summary: "Superseded by haas.coord-shift-conflict-same-block — split G92/G52 from other modes.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG41 D1 G92 X0\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG41 D1\nM30\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.coord-shift-conflict-same-block."
  },
  {
    id: "haas.cutter-comp-and-g52-same-block",
    severity: "warning",
    messageMatcher: /Coordinate shift conflict on the same block/,
    summary: "Superseded by haas.coord-shift-conflict-same-block — split G92/G52 from other modes.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG41 D1 G52 X10.\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG41 D1\nM30\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.coord-shift-conflict-same-block."
  },
  {
    id: "haas.g68-and-g92-same-block",
    severity: "warning",
    messageMatcher: /Coordinate shift conflict on the same block/,
    summary: "Superseded by haas.coord-shift-conflict-same-block — split G92/G52 from other modes.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG68 X0 Y0 R45. G92 X0\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG68 X0 Y0 R45.\nM30\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.coord-shift-conflict-same-block."
  },
  {
    id: "haas.g68-and-g52-same-block",
    severity: "warning",
    messageMatcher: /Coordinate shift conflict on the same block/,
    summary: "Superseded by haas.coord-shift-conflict-same-block — split G92/G52 from other modes.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG68 X0 Y0 R45. G52 X10.\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG68 X0 Y0 R45.\nM30\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.coord-shift-conflict-same-block."
  },
  {
    id: "haas.g69-and-g92-same-block",
    severity: "warning",
    messageMatcher: /Coordinate shift conflict on the same block/,
    summary: "Superseded by haas.coord-shift-conflict-same-block — split G92/G52 from other modes.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG68 X0 Y0 R45.\nG69 G92 X0\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG68 X0 Y0 R45.\nG69\nM30\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.coord-shift-conflict-same-block."
  },
  {
    id: "haas.g69-and-g52-same-block",
    severity: "warning",
    messageMatcher: /Coordinate shift conflict on the same block/,
    summary: "Superseded by haas.coord-shift-conflict-same-block — split G92/G52 from other modes.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG68 X0 Y0 R45.\nG69 G52 X10.\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG68 X0 Y0 R45.\nG69\nM30\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.coord-shift-conflict-same-block."
  },
  {
    id: "haas.g51-and-g92-same-block",
    severity: "warning",
    messageMatcher: /Coordinate shift conflict on the same block/,
    summary: "Superseded by haas.coord-shift-conflict-same-block — split G92/G52 from other modes.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG51 P2. G92 X0\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG51 P2.\nM30\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.coord-shift-conflict-same-block."
  },
  {
    id: "haas.g51-and-g52-same-block",
    severity: "warning",
    messageMatcher: /Coordinate shift conflict on the same block/,
    summary: "Superseded by haas.coord-shift-conflict-same-block — split G92/G52 from other modes.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG51 P2. G52 X10.\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG51 P2.\nM30\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.coord-shift-conflict-same-block."
  },
  {
    id: "haas.g50-and-g92-same-block",
    severity: "warning",
    messageMatcher: /Coordinate shift conflict on the same block/,
    summary: "Superseded by haas.coord-shift-conflict-same-block — split G92/G52 from other modes.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG51 P2.\nG50 G92 X0\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG51 P2.\nG50\nM30\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.coord-shift-conflict-same-block."
  },
  {
    id: "haas.g50-and-g52-same-block",
    severity: "warning",
    messageMatcher: /Coordinate shift conflict on the same block/,
    summary: "Superseded by haas.coord-shift-conflict-same-block — split G92/G52 from other modes.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG51 P2.\nG50 G52 X10.\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG51 P2.\nG50\nM30\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.coord-shift-conflict-same-block."
  },
  {
    id: "haas.g43-and-g28-same-block",
    severity: "warning",
    messageMatcher: /Machine positioning conflict on the same block/,
    summary: "Superseded by haas.machine-position-conflict-same-block — split G28/G30/G53 from other modes/calls/stops.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25. G28 Z0\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nG28 Z0\nM30\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.machine-position-conflict-same-block."
  },
  {
    id: "haas.g43-and-g30-same-block",
    severity: "warning",
    messageMatcher: /Machine positioning conflict on the same block/,
    summary: "Superseded by haas.machine-position-conflict-same-block — split G28/G30/G53 from other modes/calls/stops.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25. G30 Z0\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nG30 Z0\nM30\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.machine-position-conflict-same-block."
  },
  {
    id: "haas.g49-and-g28-same-block",
    severity: "warning",
    messageMatcher: /Machine positioning conflict on the same block/,
    summary: "Superseded by haas.machine-position-conflict-same-block — split G28/G30/G53 from other modes/calls/stops.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nG49 G28 Z0\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nG49\nG28 Z0\nM30\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.machine-position-conflict-same-block."
  },
  {
    id: "haas.g49-and-g30-same-block",
    severity: "warning",
    messageMatcher: /Machine positioning conflict on the same block/,
    summary: "Superseded by haas.machine-position-conflict-same-block — split G28/G30/G53 from other modes/calls/stops.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nG49 G30 Z0\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nG49\nG30 Z0\nM30\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.machine-position-conflict-same-block."
  },
  {
    id: "haas.g40-and-g28-same-block",
    severity: "warning",
    messageMatcher: /Machine positioning conflict on the same block/,
    summary: "Superseded by haas.machine-position-conflict-same-block — split G28/G30/G53 from other modes/calls/stops.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG41 D1\nG40 G28 Z0\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG41 D1\nG40\nG28 Z0\nM30\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.machine-position-conflict-same-block."
  },
  {
    id: "haas.g40-and-g30-same-block",
    severity: "warning",
    messageMatcher: /Machine positioning conflict on the same block/,
    summary: "Superseded by haas.machine-position-conflict-same-block — split G28/G30/G53 from other modes/calls/stops.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG41 D1\nG40 G30 Z0\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG41 D1\nG40\nG30 Z0\nM30\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.machine-position-conflict-same-block."
  },
  {
    id: "haas.g80-and-g28-same-block",
    severity: "warning",
    messageMatcher: /Machine positioning conflict on the same block/,
    summary: "Superseded by haas.machine-position-conflict-same-block — split G28/G30/G53 from other modes/calls/stops.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG81 Z-1. R0.1 F10.\nG80 G28 Z0\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG81 Z-1. R0.1 F10.\nG80\nG28 Z0\nM30\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.machine-position-conflict-same-block."
  },
  {
    id: "haas.g80-and-g30-same-block",
    severity: "warning",
    messageMatcher: /Machine positioning conflict on the same block/,
    summary: "Superseded by haas.machine-position-conflict-same-block — split G28/G30/G53 from other modes/calls/stops.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG81 Z-1. R0.1 F10.\nG80 G30 Z0\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG81 Z-1. R0.1 F10.\nG80\nG30 Z0\nM30\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.machine-position-conflict-same-block."
  },
  {
    id: "haas.g43-and-g53-same-block",
    severity: "warning",
    messageMatcher: /Machine positioning conflict on the same block/,
    summary: "Superseded by haas.machine-position-conflict-same-block — split G28/G30/G53 from other modes/calls/stops.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25. G53 Z0\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nG53 Z0\nM30\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.machine-position-conflict-same-block."
  },
  {
    id: "haas.g49-and-g53-same-block",
    severity: "warning",
    messageMatcher: /Machine positioning conflict on the same block/,
    summary: "Superseded by haas.machine-position-conflict-same-block — split G28/G30/G53 from other modes/calls/stops.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nG49 G53 Z0\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nG49\nG53 Z0\nM30\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.machine-position-conflict-same-block."
  },
  {
    id: "haas.g40-and-g53-same-block",
    severity: "warning",
    messageMatcher: /Machine positioning conflict on the same block/,
    summary: "Superseded by haas.machine-position-conflict-same-block — split G28/G30/G53 from other modes/calls/stops.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG41 D1\nG40 G53 Z0\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG41 D1\nG40\nG53 Z0\nM30\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.machine-position-conflict-same-block."
  },
  {
    id: "haas.g80-and-g53-same-block",
    severity: "warning",
    messageMatcher: /Machine positioning conflict on the same block/,
    summary: "Superseded by haas.machine-position-conflict-same-block — split G28/G30/G53 from other modes/calls/stops.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG81 Z-1. R0.1 F10.\nG80 G53 Z0\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG81 Z-1. R0.1 F10.\nG80\nG53 Z0\nM30\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.machine-position-conflict-same-block."
  },
  {
    id: "haas.cutter-comp-and-g28-same-block",
    severity: "warning",
    messageMatcher: /Machine positioning conflict on the same block/,
    summary: "Superseded by haas.machine-position-conflict-same-block — split G28/G30/G53 from other modes/calls/stops.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG41 D1 G28 Z0\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG41 D1\nG28 Z0\nM30\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.machine-position-conflict-same-block."
  },
  {
    id: "haas.cutter-comp-and-g30-same-block",
    severity: "warning",
    messageMatcher: /Machine positioning conflict on the same block/,
    summary: "Superseded by haas.machine-position-conflict-same-block — split G28/G30/G53 from other modes/calls/stops.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG41 D1 G30 Z0\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG41 D1\nG30 Z0\nM30\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.machine-position-conflict-same-block."
  },
  {
    id: "haas.g68-and-g28-same-block",
    severity: "warning",
    messageMatcher: /Machine positioning conflict on the same block/,
    summary: "Superseded by haas.machine-position-conflict-same-block — split G28/G30/G53 from other modes/calls/stops.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG68 X0 Y0 R45. G28 Z0\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG68 X0 Y0 R45.\nG28 Z0\nM30\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.machine-position-conflict-same-block."
  },
  {
    id: "haas.g68-and-g30-same-block",
    severity: "warning",
    messageMatcher: /Machine positioning conflict on the same block/,
    summary: "Superseded by haas.machine-position-conflict-same-block — split G28/G30/G53 from other modes/calls/stops.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG68 X0 Y0 R45. G30 Z0\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG68 X0 Y0 R45.\nG30 Z0\nM30\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.machine-position-conflict-same-block."
  },
  {
    id: "haas.g69-and-g28-same-block",
    severity: "warning",
    messageMatcher: /Machine positioning conflict on the same block/,
    summary: "Superseded by haas.machine-position-conflict-same-block — split G28/G30/G53 from other modes/calls/stops.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG68 X0 Y0 R45.\nG69 G28 Z0\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG68 X0 Y0 R45.\nG69\nG28 Z0\nM30\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.machine-position-conflict-same-block."
  },
  {
    id: "haas.g69-and-g30-same-block",
    severity: "warning",
    messageMatcher: /Machine positioning conflict on the same block/,
    summary: "Superseded by haas.machine-position-conflict-same-block — split G28/G30/G53 from other modes/calls/stops.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG68 X0 Y0 R45.\nG69 G30 Z0\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG68 X0 Y0 R45.\nG69\nG30 Z0\nM30\n",
    deprecatedSince: "2026-09",
    replacementSuggestion: "Use haas.machine-position-conflict-same-block."
  },
  {
    id: "haas.machine-position-conflict-same-block",
    severity: "warning",
    messageMatcher: /Machine positioning conflict on the same block/,
    summary: "Do not combine G28/G30/G53 with other modes, calls, or stops on one block.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25. G28 Z0\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nG28 Z0\nM30\n"
  },
  {
    id: "haas.coord-shift-conflict-same-block",
    severity: "warning",
    messageMatcher: /Coordinate shift conflict on the same block/,
    summary: "Do not combine G92/G52 with other setup modes on one block.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25. G92 X0\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nM30\n"
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
  },
  {
    id: "haas.l-while-cutter-comp",
    severity: "warning",
    messageMatcher: /L word while cutter compensation \(G41\/G42\) is still active/,
    summary: "Cancel cutter compensation before an orphan L word (outside M98/G65/G10).",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG41 D1 X10.\nL2\nG40\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG41 D1 X10.\nG40\nL2\nM30\n"
  },
  {
    id: "haas.l-while-canned",
    severity: "warning",
    messageMatcher: /L word while a canned cycle is still active/,
    summary: "Cancel the canned cycle before an orphan L word.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nL2\nG80\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nG80\nL2\nM30\n"
  },
  {
    id: "haas.l-while-rotation",
    severity: "warning",
    messageMatcher: /L word while coordinate rotation \(G68\) is still active/,
    summary: "Cancel G68 before an orphan L word.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG68 X0 Y0 R45.\nL2\nG69\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG68 X0 Y0 R45.\nG69\nL2\nM30\n"
  },
  {
    id: "haas.l-while-scaling",
    severity: "warning",
    messageMatcher: /L word while scaling \(G51\) is still active/,
    summary: "Cancel G51 before an orphan L word.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG51 P2.\nL2\nG50\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG51 P2.\nG50\nL2\nM30\n"
  },
  {
    id: "haas.l-while-incremental",
    severity: "warning",
    messageMatcher: /L word while incremental mode \(G91\) is active/,
    summary: "Restore G90 before an orphan L word.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG91\nL2\nG90\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG91\nG90\nL2\nM30\n"
  },
  {
    id: "haas.l-while-coolant-on",
    severity: "warning",
    messageMatcher: /L word while coolant is still on/,
    summary: "Turn coolant off before an orphan L word.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM8\nL2\nM9\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM8\nM9\nL2\nM30\n"
  },
  {
    id: "haas.l-while-tool-length",
    severity: "warning",
    messageMatcher: /L word while tool length compensation \(G43\) is still active/,
    summary: "Cancel G43 before an orphan L word.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG43 H1 Z25.\nL2\nG49\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG43 H1 Z25.\nG49\nL2\nM30\n"
  },
  {
    id: "haas.q-while-tool-length",
    severity: "warning",
    messageMatcher: /Q word while tool length compensation \(G43\) is still active/,
    summary: "Cancel G43 before an orphan Q word outside a peck cycle.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG43 H1 Z25.\nQ0.1\nG49\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG43 H1 Z25.\nG49\nQ0.1\nM30\n"
  },
  {
    id: "haas.missing-unit-mode",
    severity: "warning",
    messageMatcher: /Axis motion before any unit mode \(G20\/G21\)/,
    summary: "Select G20 or G21 before axis motion (parallel to missing distance mode).",
    positiveSnippet: "O0001\nT1 M6\nG54\nG90\nG0 X0\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG90\nG21\nG0 X0\nM30\n"
  },
  {
    id: "haas.g10-used-at-end",
    severity: "warning",
    messageMatcher: /Program ends after G10 data setting/,
    summary: "Ending after G10 offset/data writes is easy to leave latched — verify intentional.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG10 L2 P1 X0 Y0 Z0\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nM30\n"
  },
  {
    id: "haas.g93-active-at-end",
    severity: "warning",
    messageMatcher: /Program ends in inverse-time feed mode \(G93\)/,
    summary: "Restore G94 before program end after inverse-time feed.",
    positiveSnippet: "O0001\nG93\nM30\n",
    negativeSnippet: "O0001\nG93\nG94\nM30\n"
  },
  {
    id: "haas.m19-orient-at-end",
    severity: "warning",
    messageMatcher: /Program ends with spindle orientation \(M19\) still latched/,
    summary: "Clear a latched M19 spindle orientation before program end.",
    positiveSnippet: "O0001\nM19\nM30\n",
    negativeSnippet: "O0001\nM19\nM5\nM30\n"
  },
  {
    id: "haas.m88-active-at-end",
    severity: "warning",
    messageMatcher: /Program ends with through-spindle coolant \(M88\) still active/,
    summary: "Turn through-spindle coolant off with M89 before program end.",
    positiveSnippet: "O0001\nM88\nM30\n",
    negativeSnippet: "O0001\nM88\nM89\nM30\n"
  },
  {
    id: "haas.a-while-cutter-comp",
    severity: "warning",
    messageMatcher: /A rotary word while cutter compensation \(G41\/G42\) is still active/,
    summary: "Cancel cutter compensation before an orphan A rotary word.",
    positiveSnippet: "O0001\nG41 D1 X1.\nA10.\nG40\nM30\n",
    negativeSnippet: "O0001\nG41 D1 X1.\nG1 A10.\nG40\nM30\n"
  },
  {
    id: "haas.a-while-canned",
    severity: "warning",
    messageMatcher: /A rotary word while a canned cycle is still active/,
    summary: "Cancel canned cycles before an orphan A rotary word.",
    positiveSnippet: "O0001\nG81 Z-1. R.1 F10.\nA10.\nG80\nM30\n",
    negativeSnippet: "O0001\nG81 Z-1. R.1 F10.\nG0 A10.\nG80\nM30\n"
  },
  {
    id: "haas.a-while-rotation",
    severity: "warning",
    messageMatcher: /A rotary word while coordinate rotation \(G68\) is still active/,
    summary: "Cancel coordinate rotation before an orphan A rotary word.",
    positiveSnippet: "O0001\nG68 X0 Y0 R45.\nA10.\nG69\nM30\n",
    negativeSnippet: "O0001\nG68 X0 Y0 R45.\nG1 A10.\nG69\nM30\n"
  },
  {
    id: "haas.b-while-cutter-comp",
    severity: "warning",
    messageMatcher: /B rotary word while cutter compensation \(G41\/G42\) is still active/,
    summary: "Cancel cutter compensation before an orphan B rotary word.",
    positiveSnippet: "O0001\nG41 D1 X1.\nB10.\nG40\nM30\n",
    negativeSnippet: "O0001\nG41 D1 X1.\nG1 B10.\nG40\nM30\n"
  },
  {
    id: "haas.b-while-canned",
    severity: "warning",
    messageMatcher: /B rotary word while a canned cycle is still active/,
    summary: "Cancel canned cycles before an orphan B rotary word.",
    positiveSnippet: "O0001\nG81 Z-1. R.1 F10.\nB10.\nG80\nM30\n",
    negativeSnippet: "O0001\nG81 Z-1. R.1 F10.\nG0 B10.\nG80\nM30\n"
  },
  {
    id: "haas.c-while-cutter-comp",
    severity: "warning",
    messageMatcher: /C rotary word while cutter compensation \(G41\/G42\) is still active/,
    summary: "Cancel cutter compensation before an orphan C rotary word.",
    positiveSnippet: "O0001\nG41 D1 X1.\nC10.\nG40\nM30\n",
    negativeSnippet: "O0001\nG41 D1 X1.\nG1 C10.\nG40\nM30\n"
  },
  {
    id: "haas.c-while-canned",
    severity: "warning",
    messageMatcher: /C rotary word while a canned cycle is still active/,
    summary: "Cancel canned cycles before an orphan C rotary word.",
    positiveSnippet: "O0001\nG81 Z-1. R.1 F10.\nC10.\nG80\nM30\n",
    negativeSnippet: "O0001\nG81 Z-1. R.1 F10.\nG0 C10.\nG80\nM30\n"
  },
  {
    id: "haas.cancel-conflict-same-block",
    severity: "warning",
    messageMatcher: /Cancel family conflict on the same block/,
    summary: "Split multiple modal cancel commands across separate blocks.",
    positiveSnippet: "O0001\nG40 G49 G80\nM30\n",
    negativeSnippet: "O0001\nG40\nG49\nG80\nM30\n"
  },
  {
    id: "haas.g40-while-tool-length",
    severity: "warning",
    messageMatcher: /G40 while tool length compensation \(G43\) is still active/,
    summary: "Cancel tool length compensation before G40.",
    positiveSnippet: "O0001\nG43 H1 Z1.\nG41 D1 X1.\nG40\nG49\nM30\n",
    negativeSnippet: "O0001\nG43 H1 Z1.\nG41 D1 X1.\nG49\nG40\nM30\n"
  },
  {
    id: "haas.g80-while-tool-length",
    severity: "warning",
    messageMatcher: /G80 while tool length compensation \(G43\) is still active/,
    summary: "Cancel tool length compensation before G80.",
    positiveSnippet: "O0001\nG43 H1 Z1.\nG81 Z-1. R.1 F10.\nG80\nG49\nM30\n",
    negativeSnippet: "O0001\nG43 H1 Z1.\nG81 Z-1. R.1 F10.\nG49\nG80\nM30\n"
  },
  {
    id: "haas.g0-while-tool-length",
    severity: "warning",
    messageMatcher: /G0 rapid while tool length compensation \(G43\) is still active/,
    summary: "Cancel tool length compensation before G0 rapid moves.",
    positiveSnippet: "O0001\nG43 H1 Z1.\nG0 X1.\nG49\nM30\n",
    negativeSnippet: "O0001\nG43 H1 Z1.\nG49\nG0 X1.\nM30\n"
  },
  {
    id: "haas.g0-while-coolant-on",
    severity: "warning",
    messageMatcher: /G0 rapid while coolant is still on/,
    summary: "Turn coolant off before G0 rapid moves.",
    positiveSnippet: "O0001\nM8\nG0 X1.\nM9\nM30\n",
    negativeSnippet: "O0001\nM8\nM9\nG0 X1.\nM30\n"
  },
  {
    id: "haas.spindle-on-while-tool-length",
    severity: "warning",
    messageMatcher: /Spindle start \(M3\/M4\) while tool length compensation \(G43\) is still active/,
    summary: "Cancel tool length compensation before starting the spindle.",
    positiveSnippet: "O0001\nG43 H1 Z1.\nS1000 M3\nG49\nM5\nM30\n",
    negativeSnippet: "O0001\nG43 H1 Z1.\nG49\nS1000 M3\nM5\nM30\n"
  },
  {
    id: "haas.coolant-on-while-tool-length",
    severity: "warning",
    messageMatcher: /Coolant on \(M7\/M8\) while tool length compensation \(G43\) is still active/,
    summary: "Cancel tool length compensation before turning coolant on.",
    positiveSnippet: "O0001\nG43 H1 Z1.\nM8\nG49\nM9\nM30\n",
    negativeSnippet: "O0001\nG43 H1 Z1.\nG49\nM8\nM9\nM30\n"
  },
  {
    id: "haas.a-while-scaling",
    severity: "warning",
    messageMatcher: /A rotary word while scaling \(G51\) is still active/,
    summary: "Cancel scaling before an orphan A rotary word.",
    positiveSnippet: "O0001\nG51 P2.\nA10.\nG50\nM30\n",
    negativeSnippet: "O0001\nG51 P2.\nG1 A10.\nG50\nM30\n"
  },
  {
    id: "haas.a-while-incremental",
    severity: "warning",
    messageMatcher: /A rotary word while incremental mode \(G91\) is active/,
    summary: "Restore G90 before an orphan A rotary word.",
    positiveSnippet: "O0001\nG91\nA10.\nG90\nM30\n",
    negativeSnippet: "O0001\nG91\nG1 A10.\nG90\nM30\n"
  },
  {
    id: "haas.a-while-coolant-on",
    severity: "warning",
    messageMatcher: /A rotary word while coolant is still on/,
    summary: "Turn coolant off before an orphan A rotary word.",
    positiveSnippet: "O0001\nM8\nA10.\nM9\nM30\n",
    negativeSnippet: "O0001\nM8\nG1 A10.\nM9\nM30\n"
  },
  {
    id: "haas.b-while-rotation",
    severity: "warning",
    messageMatcher: /B rotary word while coordinate rotation \(G68\) is still active/,
    summary: "Cancel coordinate rotation before an orphan B rotary word.",
    positiveSnippet: "O0001\nG68 X0 Y0 R45.\nB10.\nG69\nM30\n",
    negativeSnippet: "O0001\nG68 X0 Y0 R45.\nG1 B10.\nG69\nM30\n"
  },
  {
    id: "haas.b-while-scaling",
    severity: "warning",
    messageMatcher: /B rotary word while scaling \(G51\) is still active/,
    summary: "Cancel scaling before an orphan B rotary word.",
    positiveSnippet: "O0001\nG51 P2.\nB10.\nG50\nM30\n",
    negativeSnippet: "O0001\nG51 P2.\nG1 B10.\nG50\nM30\n"
  },
  {
    id: "haas.b-while-incremental",
    severity: "warning",
    messageMatcher: /B rotary word while incremental mode \(G91\) is active/,
    summary: "Restore G90 before an orphan B rotary word.",
    positiveSnippet: "O0001\nG91\nB10.\nG90\nM30\n",
    negativeSnippet: "O0001\nG91\nG1 B10.\nG90\nM30\n"
  },
  {
    id: "haas.b-while-coolant-on",
    severity: "warning",
    messageMatcher: /B rotary word while coolant is still on/,
    summary: "Turn coolant off before an orphan B rotary word.",
    positiveSnippet: "O0001\nM8\nB10.\nM9\nM30\n",
    negativeSnippet: "O0001\nM8\nG1 B10.\nM9\nM30\n"
  },
  {
    id: "haas.b-while-tool-length",
    severity: "warning",
    messageMatcher: /B rotary word while tool length compensation \(G43\) is still active/,
    summary: "Cancel tool length compensation before an orphan B rotary word.",
    positiveSnippet: "O0001\nG43 H1 Z1.\nB10.\nG49\nM30\n",
    negativeSnippet: "O0001\nG43 H1 Z1.\nG1 B10.\nG49\nM30\n"
  },
  {
    id: "haas.c-while-rotation",
    severity: "warning",
    messageMatcher: /C rotary word while coordinate rotation \(G68\) is still active/,
    summary: "Cancel coordinate rotation before an orphan C rotary word.",
    positiveSnippet: "O0001\nG68 X0 Y0 R45.\nC10.\nG69\nM30\n",
    negativeSnippet: "O0001\nG68 X0 Y0 R45.\nG1 C10.\nG69\nM30\n"
  },
  {
    id: "haas.c-while-scaling",
    severity: "warning",
    messageMatcher: /C rotary word while scaling \(G51\) is still active/,
    summary: "Cancel scaling before an orphan C rotary word.",
    positiveSnippet: "O0001\nG51 P2.\nC10.\nG50\nM30\n",
    negativeSnippet: "O0001\nG51 P2.\nG1 C10.\nG50\nM30\n"
  },
  {
    id: "haas.c-while-incremental",
    severity: "warning",
    messageMatcher: /C rotary word while incremental mode \(G91\) is active/,
    summary: "Restore G90 before an orphan C rotary word.",
    positiveSnippet: "O0001\nG91\nC10.\nG90\nM30\n",
    negativeSnippet: "O0001\nG91\nG1 C10.\nG90\nM30\n"
  },
  {
    id: "haas.c-while-coolant-on",
    severity: "warning",
    messageMatcher: /C rotary word while coolant is still on/,
    summary: "Turn coolant off before an orphan C rotary word.",
    positiveSnippet: "O0001\nM8\nC10.\nM9\nM30\n",
    negativeSnippet: "O0001\nM8\nG1 C10.\nM9\nM30\n"
  },
  {
    id: "haas.c-while-tool-length",
    severity: "warning",
    messageMatcher: /C rotary word while tool length compensation \(G43\) is still active/,
    summary: "Cancel tool length compensation before an orphan C rotary word.",
    positiveSnippet: "O0001\nG43 H1 Z1.\nC10.\nG49\nM30\n",
    negativeSnippet: "O0001\nG43 H1 Z1.\nG1 C10.\nG49\nM30\n"
  },
  {
    id: "haas.f-while-cutter-comp",
    severity: "warning",
    messageMatcher: /F word while cutter compensation \(G41\/G42\) is still active/,
    summary: "Cancel cutter compensation with G40 before a bare F word outside feed motion.",
    positiveSnippet: "O0001\nG41 D1 X1.\nF10.\nG40\nM30\n",
    negativeSnippet: "O0001\nG41 D1 X1.\nG1 X2. F10.\nG40\nM30\n"
  },
  {
    id: "haas.f-while-canned",
    severity: "warning",
    messageMatcher: /F word while a canned cycle is still active/,
    summary: "Cancel canned cycles with G80 before a bare F word outside feed motion.",
    positiveSnippet: "O0001\nG81 Z-1. R.1 F10.\nF5.\nG80\nM30\n",
    negativeSnippet: "O0001\nG81 Z-1. R.1 F10.\nG80\nF5.\nM30\n"
  },
  {
    id: "haas.f-while-rotation",
    severity: "warning",
    messageMatcher: /F word while coordinate rotation \(G68\) is still active/,
    summary: "Cancel rotation with G69 before a bare F word outside feed motion.",
    positiveSnippet: "O0001\nG68 X0 Y0 R45.\nF10.\nG69\nM30\n",
    negativeSnippet: "O0001\nG68 X0 Y0 R45.\nG69\nF10.\nM30\n"
  },
  {
    id: "haas.f-while-scaling",
    severity: "warning",
    messageMatcher: /F word while scaling \(G51\) is still active/,
    summary: "Cancel scaling with G50 before a bare F word outside feed motion.",
    positiveSnippet: "O0001\nG51 P2.\nF10.\nG50\nM30\n",
    negativeSnippet: "O0001\nG51 P2.\nG50\nF10.\nM30\n"
  },
  {
    id: "haas.f-while-incremental",
    severity: "warning",
    messageMatcher: /F word while incremental mode \(G91\) is active/,
    summary: "Restore G90 before a bare F word outside feed motion.",
    positiveSnippet: "O0001\nG91\nF10.\nG90\nM30\n",
    negativeSnippet: "O0001\nG91\nG90\nF10.\nM30\n"
  },
  {
    id: "haas.f-while-coolant-on",
    severity: "warning",
    messageMatcher: /F word while coolant is still on/,
    summary: "Turn coolant off with M9 before a bare F word outside feed motion.",
    positiveSnippet: "O0001\nM8\nF10.\nM9\nM30\n",
    negativeSnippet: "O0001\nM8\nM9\nF10.\nM30\n"
  },
  {
    id: "haas.f-while-tool-length",
    severity: "warning",
    messageMatcher: /F word while tool length compensation \(G43\) is still active/,
    summary: "Cancel tool length compensation with G49 before a bare F word outside feed motion.",
    positiveSnippet: "O0001\nG43 H1 Z1.\nF10.\nG49\nM30\n",
    negativeSnippet: "O0001\nG43 H1 Z1.\nG49\nF10.\nM30\n"
  },
  {
    id: "haas.a-while-tool-length",
    severity: "warning",
    messageMatcher: /A rotary word while tool length compensation \(G43\) is still active/,
    summary: "Cancel tool length compensation before an orphan A rotary word.",
    positiveSnippet: "O0001\nG43 H1 Z1.\nA10.\nG49\nM30\n",
    negativeSnippet: "O0001\nG43 H1 Z1.\nG1 A10.\nG49\nM30\n"
  },
  {
    id: "haas.h-while-tool-length",
    severity: "warning",
    messageMatcher: /H offset word while tool length compensation \(G43\) is still active/,
    summary: "Cancel tool length compensation with G49 before changing H offsets.",
    positiveSnippet: "O0001\nG43 H1 Z1.\nH2\nG49\nM30\n",
    negativeSnippet: "O0001\nG43 H1 Z1.\nG49\nH2\nM30\n"
  },
  {
    id: "haas.d-while-tool-length",
    severity: "warning",
    messageMatcher: /D offset word while tool length compensation \(G43\) is still active/,
    summary: "Cancel tool length compensation with G49 before changing D offsets.",
    positiveSnippet: "O0001\nG43 H1 Z1.\nD2\nG49\nM30\n",
    negativeSnippet: "O0001\nG43 H1 Z1.\nG49\nD2\nM30\n"
  },
  {
    id: "haas.s-while-tool-length",
    severity: "warning",
    messageMatcher: /Spindle speed \(S\) while tool length compensation \(G43\) is still active/,
    summary: "Cancel tool length compensation with G49 before changing spindle speed.",
    positiveSnippet: "O0001\nG43 H1 Z1.\nS1200\nG49\nM30\n",
    negativeSnippet: "O0001\nG43 H1 Z1.\nG49\nS1200\nM30\n"
  },
  {
    id: "haas.g0-while-incremental",
    severity: "warning",
    messageMatcher: /G0 rapid while incremental mode \(G91\) is active/,
    summary: "Restore G90 before G0 rapid moves.",
    positiveSnippet: "O0001\nG91\nG0 X1.\nG90\nM30\n",
    negativeSnippet: "O0001\nG90\nG0 X1.\nM30\n"
  },
  {
    id: "haas.distance-mode-while-tool-length",
    severity: "warning",
    messageMatcher: /Distance mode select \(G90\/G91\) while tool length compensation \(G43\) is still active/,
    summary: "Cancel tool length compensation with G49 before changing distance mode.",
    positiveSnippet: "O0001\nG43 H1 Z1.\nG90\nG49\nM30\n",
    negativeSnippet: "O0001\nG43 H1 Z1.\nG49\nG90\nM30\n"
  },
  {
    id: "haas.canned-while-tool-length",
    severity: "warning",
    messageMatcher: /Canned cycle while tool length compensation \(G43\) is still active/,
    summary: "Cancel tool length compensation with G49 before a canned cycle.",
    positiveSnippet: "O0001\nG43 H1 Z1.\nG81 X1. Y1. Z-1. R.1 F10.\nG80\nG49\nM30\n",
    negativeSnippet: "O0001\nG43 H1 Z1.\nG49\nG81 X1. Y1. Z-1. R.1 F10.\nG80\nM30\n"
  },
  {
    id: "haas.canned-while-coolant-on",
    severity: "warning",
    messageMatcher: /Canned cycle while coolant is still on/,
    summary: "Turn coolant off with M9 before a canned cycle.",
    positiveSnippet: "O0001\nM8\nG81 X1. Y1. Z-1. R.1 F10.\nG80\nM9\nM30\n",
    negativeSnippet: "O0001\nM8\nM9\nG81 X1. Y1. Z-1. R.1 F10.\nG80\nM30\n"
  },
  {
    id: "haas.missing-feed-mode",
    severity: "warning",
    messageMatcher: /Axis motion before any feed mode \(G93\/G94\/G95\)/,
    summary: "Select G93/G94/G95 feed mode before axis motion (parallel to missing unit mode).",
    positiveSnippet: "O0001\nT1 M6\nG54\nG90\nG20\nG17\nG0 X0\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG90\nG20\nG17\nG94\nG0 X0\nM30\n"
  },
  {
    id: "haas.g93-and-g94-same-block",
    severity: "warning",
    messageMatcher: /G93 and G94 on the same block/,
    summary: "Do not select inverse-time (G93) and per-minute (G94) feed on one block.",
    positiveSnippet: "O0001\nG93 G94\nM30\n",
    negativeSnippet: "O0001\nG93\nG94\nM30\n"
  },
  {
    id: "haas.g93-and-g95-same-block",
    severity: "warning",
    messageMatcher: /G93 and G95 on the same block/,
    summary: "Do not select inverse-time (G93) and per-rev (G95) feed on one block.",
    positiveSnippet: "O0001\nG93 G95\nM30\n",
    negativeSnippet: "O0001\nG93\nG95\nM30\n"
  },
  {
    id: "haas.g93-and-g94-mixed",
    severity: "warning",
    messageMatcher: /Program contains both G93 and G94/,
    summary: "Mixing G93 and G94 feed modes in one program is ambiguous — pick one.",
    positiveSnippet: "O0001\nG93\nG94\nM30\n",
    negativeSnippet: "O0001\nG93\nM30\n"
  },
  {
    id: "haas.missing-plane-mode",
    severity: "warning",
    messageMatcher: /Axis motion before any plane mode \(G17\/G18\/G19\)/,
    summary: "Select G17/G18/G19 plane before axis motion (parallel to missing unit mode).",
    positiveSnippet: "O0001\nT1 M6\nG54\nG90\nG20\nG94\nG0 X0\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG90\nG20\nG94\nG17\nG0 X0\nM30\n"
  },
  {
    id: "haas.m02-while-coolant-on",
    severity: "warning",
    messageMatcher: /M02 while coolant is still on/,
    summary: "Turn coolant off with M9 before an M02 program end.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM8\nM02\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM8\nM9\nM02\n"
  },
  {
    id: "haas.m02-while-cutter-comp",
    severity: "warning",
    messageMatcher: /M02 while cutter compensation \(G41\/G42\) is still active/,
    summary: "Cancel cutter compensation with G40 before an M02 program end.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nM02\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nG40\nM02\n"
  },
  {
    id: "haas.m02-while-canned",
    severity: "warning",
    messageMatcher: /M02 while a canned cycle is still active/,
    summary: "Cancel canned cycles with G80 before an M02 program end.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nM02\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nG80\nM02\n"
  },
  {
    id: "haas.m02-while-tool-length",
    severity: "warning",
    messageMatcher: /M02 while tool length compensation \(G43\) is still active/,
    summary: "Cancel tool length with G49 before an M02 program end.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nM02\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG49\nM02\n"
  },
  {
    id: "haas.m02-while-rotation",
    severity: "warning",
    messageMatcher: /M02 while coordinate rotation \(G68\) is still active/,
    summary: "Cancel rotation with G69 before an M02 program end.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG68 X0 Y0 R45.\nS1200 M3\nM02\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG68 X0 Y0 R45.\nS1200 M3\nG69\nM02\n"
  },
  {
    id: "haas.m02-while-scaling",
    severity: "warning",
    messageMatcher: /M02 while scaling \(G51\) is still active/,
    summary: "Cancel scaling with G50 before an M02 program end.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG51 P2.\nS1200 M3\nM02\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG51 P2.\nS1200 M3\nG50\nM02\n"
  },
  {
    id: "haas.m02-while-incremental",
    severity: "warning",
    messageMatcher: /M02 while incremental mode \(G91\) is active/,
    summary: "Restore G90 before an M02 program end.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG91\nS1200 M3\nM02\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG91\nS1200 M3\nG90\nM02\n"
  },
  {
    id: "haas.p-while-canned",
    severity: "warning",
    messageMatcher: /P word while a canned cycle is still active/,
    summary: "Cancel canned cycles with G80 before using P outside call/dwell/scaling/canned context.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nP100\nG80\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nG80\nP100\nM5\nM30\n"
  },
  {
    id: "haas.r-while-canned",
    severity: "warning",
    messageMatcher: /R word while a canned cycle is still active/,
    summary: "Cancel canned cycles with G80 before using R outside canned/arc/rotation context.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nR0.1\nG80\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nG80\nR0.1\nM5\nM30\n"
  },
  {
    id: "haas.stop-restart-unsafe-z",
    severity: "warning",
    messageMatcher: /is followed by a move below Z0 before spindle restart/,
    summary: "After M00/M01, avoid moving below Z0 before restarting the spindle (M3/M4).",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG43 H1 Z25.\nM5\nM00\nG0 Z-1.\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG43 H1 Z25.\nM5\nM00\nS1200 M3\nG0 Z-1.\nM30\n"
  },
  {
    id: "haas.g90-and-g91-same-block",
    severity: "warning",
    messageMatcher: /G90 and G91 on the same block/,
    summary: "G90 and G91 are mutually exclusive distance modes — do not combine on one block.",
    positiveSnippet: "O0001\nG90 G91\nT1 M6\nM30\n",
    negativeSnippet: "O0001\nG90\nG91\nT1 M6\nM30\n"
  },
  {
    id: "haas.g17-and-g18-same-block",
    severity: "warning",
    messageMatcher: /G17 and G18 on the same block/,
    summary: "G17 and G18 are mutually exclusive planes — do not combine on one block.",
    positiveSnippet: "O0001\nG17 G18\nT1 M6\nM30\n",
    negativeSnippet: "O0001\nG17\nG18\nT1 M6\nM30\n"
  },
  {
    id: "haas.g17-and-g19-same-block",
    severity: "warning",
    messageMatcher: /G17 and G19 on the same block/,
    summary: "G17 and G19 are mutually exclusive planes — do not combine on one block.",
    positiveSnippet: "O0001\nG17 G19\nT1 M6\nM30\n",
    negativeSnippet: "O0001\nG17\nG19\nT1 M6\nM30\n"
  },
  {
    id: "haas.g18-and-g19-same-block",
    severity: "warning",
    messageMatcher: /G18 and G19 on the same block/,
    summary: "G18 and G19 are mutually exclusive planes — do not combine on one block.",
    positiveSnippet: "O0001\nG18 G19\nT1 M6\nM30\n",
    negativeSnippet: "O0001\nG18\nG19\nT1 M6\nM30\n"
  },
  {
    id: "haas.g20-and-g21-same-block",
    severity: "warning",
    messageMatcher: /G20 and G21 on the same block/,
    summary: "G20 and G21 are mutually exclusive unit modes — do not combine on one block.",
    positiveSnippet: "O0001\nG20 G21\nT1 M6\nM30\n",
    negativeSnippet: "O0001\nG20\nG21\nT1 M6\nM30\n"
  },
  {
    id: "haas.g94-and-g95-same-block",
    severity: "warning",
    messageMatcher: /G94 and G95 on the same block/,
    summary: "G94 and G95 are mutually exclusive feed modes — do not combine on one block.",
    positiveSnippet: "O0001\nG94 G95\nT1 M6\nM30\n",
    negativeSnippet: "O0001\nG94\nG95\nT1 M6\nM30\n"
  },
  {
    id: "haas.g61-and-g64-same-block",
    severity: "warning",
    messageMatcher: /G61 and G64 on the same block/,
    summary: "G61 and G64 are mutually exclusive path modes — do not combine on one block.",
    positiveSnippet: "O0001\nG61 G64\nT1 M6\nM30\n",
    negativeSnippet: "O0001\nG61\nG64\nT1 M6\nM30\n"
  },
  {
    id: "haas.g93-and-g95-mixed",
    severity: "warning",
    messageMatcher: /Program contains both G93 and G95/,
    summary: "Mixing G93 and G95 feed modes in one program is ambiguous — pick one.",
    positiveSnippet: "O0001\nG93\nG95\nT1 M6\nM30\n",
    negativeSnippet: "O0001\nG95\nT1 M6\nM30\n"
  },
  {
    id: "haas.g10-while-cutter-comp",
    severity: "warning",
    messageMatcher: /G10 while cutter compensation \(G41\/G42\) is still active/,
    summary: "Cancel cutter compensation with G40 before a G10 data setting block.",
    positiveSnippet:
      "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1 X0 Y0\nG10 L2 P1 X0\nG40\nM30\n",
    negativeSnippet:
      "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1 X0 Y0\nG40\nG10 L2 P1 X0\nM30\n"
  },
  {
    id: "haas.g10-while-canned",
    severity: "warning",
    messageMatcher: /G10 while a canned cycle is still active/,
    summary: "Cancel canned cycles with G80 before a G10 data setting block.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nG10 L2 P1 X0\nG80\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nG80\nG10 L2 P1 X0\nM30\n"
  },
  {
    id: "haas.g10-while-rotation",
    severity: "warning",
    messageMatcher: /G10 while coordinate rotation \(G68\) is still active/,
    summary: "Cancel coordinate rotation with G69 before a G10 data setting block.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG68\nG10 L2 P1 X0\nG69\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG68\nG69\nG10 L2 P1 X0\nM30\n"
  },
  {
    id: "haas.g10-while-scaling",
    severity: "warning",
    messageMatcher: /G10 while scaling \(G51\) is still active/,
    summary: "Cancel scaling with G50 before a G10 data setting block.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG51\nG10 L2 P1 X0\nG50\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG51\nG50\nG10 L2 P1 X0\nM30\n"
  },
  {
    id: "haas.g10-while-incremental",
    severity: "warning",
    messageMatcher: /G10 while incremental mode \(G91\) is active/,
    summary: "Restore G90 absolute mode before a G10 data setting block.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG91\nG10 L2 P1 X0\nG90\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG91\nG90\nG10 L2 P1 X0\nM30\n"
  },
  {
    id: "haas.g10-while-coolant-on",
    severity: "warning",
    messageMatcher: /G10 while coolant is still on/,
    summary: "Turn coolant off with M9 before a G10 data setting block.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM8\nG10 L2 P1 X0\nM9\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM8\nM9\nG10 L2 P1 X0\nM5\nM30\n"
  },
  {
    id: "haas.g10-while-tool-length",
    severity: "warning",
    messageMatcher: /G10 while tool length compensation \(G43\) is still active/,
    summary: "Cancel tool length with G49 before a G10 data setting block.",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nG10 L2 P1 X0\nG49\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nG49\nG10 L2 P1 X0\nM30\n"
  },
  {
    id: "haas.g93-while-cutter-comp",
    severity: "warning",
    messageMatcher: /G93 while cutter compensation \(G41\/G42\) is still active/,
    summary: "Cancel cutter compensation with G40 before selecting inverse-time feed (G93).",
    positiveSnippet:
      "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1 X0 Y0\nG93\nG40\nM30\n",
    negativeSnippet:
      "O0001\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1 X0 Y0\nG40\nG93\nM30\n"
  },
  {
    id: "haas.g93-while-canned",
    severity: "warning",
    messageMatcher: /G93 while a canned cycle is still active/,
    summary: "Cancel canned cycles with G80 before selecting inverse-time feed (G93).",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nG93\nG80\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nG80\nG93\nM30\n"
  },
  {
    id: "haas.g93-while-rotation",
    severity: "warning",
    messageMatcher: /G93 while coordinate rotation \(G68\) is still active/,
    summary: "Cancel coordinate rotation with G69 before selecting inverse-time feed (G93).",
    positiveSnippet: "O0001\nT1 M6\nG54\nG68\nG93\nG69\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG68\nG69\nG93\nM30\n"
  },
  {
    id: "haas.g93-while-scaling",
    severity: "warning",
    messageMatcher: /G93 while scaling \(G51\) is still active/,
    summary: "Cancel scaling with G50 before selecting inverse-time feed (G93).",
    positiveSnippet: "O0001\nT1 M6\nG54\nG51\nG93\nG50\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG51\nG50\nG93\nM30\n"
  },
  {
    id: "haas.g93-while-tool-length",
    severity: "warning",
    messageMatcher: /G93 while tool length compensation \(G43\) is still active/,
    summary: "Cancel tool length with G49 before selecting inverse-time feed (G93).",
    positiveSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nG93\nG49\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG43 H1 Z25.\nG49\nG93\nM30\n"
  },
  {
    id: "haas.g93-while-coolant-on",
    severity: "warning",
    messageMatcher: /G93 while coolant is still on/,
    summary: "Turn coolant off with M9 before selecting inverse-time feed (G93).",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM8\nG93\nM9\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM8\nM9\nG93\nM30\n"
  },
  {
    id: "haas.g93-while-incremental",
    severity: "warning",
    messageMatcher: /G93 while incremental mode \(G91\) is active/,
    summary: "Restore G90 absolute mode before selecting inverse-time feed (G93).",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG91\nG93\nG90\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG91\nG90\nG93\nM30\n"
  },
  {
    id: "haas.g10-while-spindle-on",
    severity: "warning",
    messageMatcher: /G10 while spindle is still on/,
    summary: "Stop the spindle with M5 before a G10 data setting block.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG10 L2 P1 X0\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM5\nG10 L2 P1 X0\nM30\n"
  },
  {
    id: "haas.g92-while-spindle-on",
    severity: "warning",
    messageMatcher: /G92 while spindle is still on/,
    summary: "Stop the spindle with M5 before shifting coordinates with G92.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG92 X0 Y0\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM5\nG92 X0 Y0\nM30\n"
  },
  {
    id: "haas.g52-while-spindle-on",
    severity: "warning",
    messageMatcher: /G52 while spindle is still on/,
    summary: "Stop the spindle with M5 before a G52 local offset.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG52 X10.\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM5\nG52 X10.\nM30\n"
  },
  {
    id: "haas.g28-while-spindle-on",
    severity: "warning",
    messageMatcher: /G28 while spindle is still on/,
    summary: "Stop the spindle with M5 before a G28 reference return.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG91 G28 Z0\nG90\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM5\nG91 G28 Z0\nG90\nM30\n"
  },
  {
    id: "haas.g30-while-spindle-on",
    severity: "warning",
    messageMatcher: /G30 while spindle is still on/,
    summary: "Stop the spindle with M5 before a G30 secondary reference return.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG91 G30 Z0\nG90\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM5\nG91 G30 Z0\nG90\nM30\n"
  },
  {
    id: "haas.g53-while-spindle-on",
    severity: "warning",
    messageMatcher: /G53 while spindle is still on/,
    summary: "Stop the spindle with M5 before a G53 machine-coordinate move.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG90 G53 Z0\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM5\nG90 G53 Z0\nM30\n"
  },
  {
    id: "haas.g68-while-spindle-on",
    severity: "warning",
    messageMatcher: /G68 while spindle is still on/,
    summary: "Stop the spindle with M5 before enabling G68 coordinate rotation.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG68 R45.\nG69\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM5\nG68 R45.\nG69\nM30\n"
  },
  {
    id: "haas.g51-while-spindle-on",
    severity: "warning",
    messageMatcher: /G51 while spindle is still on/,
    summary: "Stop the spindle with M5 before enabling G51 scaling.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG51\nG50\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM5\nG51\nG50\nM30\n"
  },
  {
    id: "haas.m19-while-cutter-comp",
    severity: "warning",
    messageMatcher: /M19 while cutter compensation \(G41\/G42\) is still active/,
    summary: "Cancel cutter compensation with G40 before spindle orientation (M19).",
    positiveSnippet: "O0001\nT1 M6\nG54\nG90\nG41 D1\nM19\nG40\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG90\nG41 D1\nG40\nM19\nM30\n"
  },
  {
    id: "haas.m19-while-canned",
    severity: "warning",
    messageMatcher: /M19 while a canned cycle is still active/,
    summary: "Cancel canned cycles with G80 before spindle orientation (M19).",
    positiveSnippet: "O0001\nT1 M6\nS1200 M3\nG81 X10. Y10. Z-5. R2. F100.\nM19\nG80\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nS1200 M3\nG81 X10. Y10. Z-5. R2. F100.\nG80\nM19\nM30\n"
  },
  {
    id: "haas.m19-while-rotation",
    severity: "warning",
    messageMatcher: /M19 while coordinate rotation \(G68\) is still active/,
    summary: "Cancel coordinate rotation with G69 before spindle orientation (M19).",
    positiveSnippet: "O0001\nT1 M6\nG54\nG68\nM19\nG69\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG68\nG69\nM19\nM30\n"
  },
  {
    id: "haas.m19-while-scaling",
    severity: "warning",
    messageMatcher: /M19 while scaling \(G51\) is still active/,
    summary: "Cancel scaling with G50 before spindle orientation (M19).",
    positiveSnippet: "O0001\nT1 M6\nG54\nG51\nM19\nG50\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG51\nG50\nM19\nM30\n"
  },
  {
    id: "haas.m19-while-incremental",
    severity: "warning",
    messageMatcher: /M19 while incremental mode \(G91\) is active/,
    summary: "Restore absolute mode with G90 before spindle orientation (M19).",
    positiveSnippet: "O0001\nT1 M6\nG54\nG91\nM19\nG90\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG91\nG90\nM19\nM30\n"
  },
  {
    id: "haas.m19-while-coolant-on",
    severity: "warning",
    messageMatcher: /M19 while coolant is still on/,
    summary: "Turn coolant off with M9 before spindle orientation (M19).",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM8\nM19\nM9\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM8\nM9\nM19\nM5\nM30\n"
  },
  {
    id: "haas.m19-while-tool-length",
    severity: "warning",
    messageMatcher: /M19 while tool length compensation \(G43\) is still active/,
    summary: "Cancel tool length with G49 before spindle orientation (M19).",
    positiveSnippet: "O0001\nT1 M6\nG54\nG90\nG43 H1 Z25.\nM19\nG49\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG90\nG43 H1 Z25.\nG49\nM19\nM30\n"
  },
  {
    id: "haas.g50-while-spindle-on",
    severity: "warning",
    messageMatcher: /G50 while spindle is still on/,
    summary: "Stop the spindle with M5 before canceling scaling with G50.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG50\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM5\nG50\nM30\n"
  },
  {
    id: "haas.g69-while-spindle-on",
    severity: "warning",
    messageMatcher: /G69 while spindle is still on/,
    summary: "Stop the spindle with M5 before canceling coordinate rotation with G69.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG69\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM5\nG69\nM30\n"
  },
  {
    id: "haas.g80-while-spindle-on",
    severity: "warning",
    messageMatcher: /G80 while spindle is still on/,
    summary: "Stop the spindle with M5 before canceling the canned cycle with G80.",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG80\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM5\nG80\nM30\n"
  },
  {
    id: "haas.m88-while-cutter-comp",
    severity: "warning",
    messageMatcher: /M88 while cutter compensation \(G41\/G42\) is still active/,
    summary: "Cancel cutter compensation with G40 before through-spindle coolant (M88).",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG90\nG41 D1\nM88\nG40\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG90\nG41 D1\nG40\nM88\nM30\n"
  },
  {
    id: "haas.m88-while-canned",
    severity: "warning",
    messageMatcher: /M88 while a canned cycle is still active/,
    summary: "Cancel canned cycles with G80 before through-spindle coolant (M88).",
    positiveSnippet: "O0001\nT1 M6\nS1200 M3\nG81 X10. Y10. Z-5. R2. F100.\nM88\nG80\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nS1200 M3\nG81 X10. Y10. Z-5. R2. F100.\nG80\nM88\nM30\n"
  },
  {
    id: "haas.m88-while-rotation",
    severity: "warning",
    messageMatcher: /M88 while coordinate rotation \(G68\) is still active/,
    summary: "Cancel coordinate rotation with G69 before through-spindle coolant (M88).",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG68\nM88\nG69\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG68\nG69\nM88\nM30\n"
  },
  {
    id: "haas.m88-while-scaling",
    severity: "warning",
    messageMatcher: /M88 while scaling \(G51\) is still active/,
    summary: "Cancel scaling with G50 before through-spindle coolant (M88).",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG51\nM88\nG50\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG51\nG50\nM88\nM30\n"
  },
  {
    id: "haas.m88-while-incremental",
    severity: "warning",
    messageMatcher: /M88 while incremental mode \(G91\) is active/,
    summary: "Restore absolute mode with G90 before through-spindle coolant (M88).",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG91\nM88\nG90\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG91\nG90\nM88\nM30\n"
  },
  {
    id: "haas.m88-while-coolant-on",
    severity: "warning",
    messageMatcher: /M88 while flood\/mist coolant is still on/,
    summary: "Turn flood/mist coolant off with M9 before through-spindle coolant (M88).",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM8\nM88\nM9\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM8\nM9\nM88\nM30\n"
  },
  {
    id: "haas.m88-while-tool-length",
    severity: "warning",
    messageMatcher: /M88 while tool length compensation \(G43\) is still active/,
    summary: "Cancel tool length with G49 before through-spindle coolant (M88).",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG90\nG43 H1 Z25.\nM88\nG49\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG90\nG43 H1 Z25.\nG49\nM88\nM30\n"
  },
  {
    id: "haas.m88-while-spindle-off",
    severity: "warning",
    messageMatcher: /M88 while spindle is off/,
    summary: "Start the spindle (M3/M4) before turning through-spindle coolant on (M88).",
    positiveSnippet: "O0001\nT1 M6\nG54\nM88\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM88\nM30\n"
  },
  {
    id: "haas.m89-while-cutter-comp",
    severity: "warning",
    messageMatcher: /M89 while cutter compensation \(G41\/G42\) is still active/,
    summary: "Cancel cutter compensation with G40 before turning through-spindle coolant off (M89).",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG90\nG41 D1\nM89\nG40\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG90\nG41 D1\nG40\nM89\nM30\n"
  },
  {
    id: "haas.m89-while-canned",
    severity: "warning",
    messageMatcher: /M89 while a canned cycle is still active/,
    summary: "Cancel canned cycles with G80 before turning through-spindle coolant off (M89).",
    positiveSnippet: "O0001\nT1 M6\nS1200 M3\nG81 X10. Y10. Z-5. R2. F100.\nM89\nG80\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nS1200 M3\nG81 X10. Y10. Z-5. R2. F100.\nG80\nM89\nM30\n"
  },
  {
    id: "haas.m89-while-rotation",
    severity: "warning",
    messageMatcher: /M89 while coordinate rotation \(G68\) is still active/,
    summary: "Cancel coordinate rotation with G69 before turning through-spindle coolant off (M89).",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG68\nM89\nG69\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG68\nG69\nM89\nM30\n"
  },
  {
    id: "haas.m89-while-scaling",
    severity: "warning",
    messageMatcher: /M89 while scaling \(G51\) is still active/,
    summary: "Cancel scaling with G50 before turning through-spindle coolant off (M89).",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG51\nM89\nG50\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG51\nG50\nM89\nM30\n"
  },
  {
    id: "haas.m89-while-incremental",
    severity: "warning",
    messageMatcher: /M89 while incremental mode \(G91\) is active/,
    summary: "Restore absolute mode with G90 before turning through-spindle coolant off (M89).",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG91\nM89\nG90\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG91\nG90\nM89\nM30\n"
  },
  {
    id: "haas.m89-while-coolant-on",
    severity: "warning",
    messageMatcher: /M89 while flood\/mist coolant is still on/,
    summary: "Turn flood/mist coolant off with M9 before turning through-spindle coolant off (M89).",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM8\nM89\nM9\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM8\nM9\nM89\nM30\n"
  },
  {
    id: "haas.m89-while-tool-length",
    severity: "warning",
    messageMatcher: /M89 while tool length compensation \(G43\) is still active/,
    summary: "Cancel tool length with G49 before turning through-spindle coolant off (M89).",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG90\nG43 H1 Z25.\nM89\nG49\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG90\nG43 H1 Z25.\nG49\nM89\nM30\n"
  },
  {
    id: "haas.m89-while-spindle-off",
    severity: "warning",
    messageMatcher: /M89 while spindle is off/,
    summary: "Start the spindle (M3/M4) before turning through-spindle coolant off (M89).",
    positiveSnippet: "O0001\nT1 M6\nG54\nM89\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM89\nM30\n"
  },
  {
    id: "haas.m98-while-spindle-on",
    severity: "warning",
    messageMatcher: /M98 while spindle is still on/,
    summary: "Stop the spindle with M5 before the subprogram call (M98).",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM98 P1000\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM5\nM98 P1000\nM30\n"
  },
  {
    id: "haas.m97-while-spindle-on",
    severity: "warning",
    messageMatcher: /M97 while spindle is still on/,
    summary: "Stop the spindle with M5 before the local subprogram call (M97).",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM97 P100\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM5\nM97 P100\nM30\n"
  },
  {
    id: "haas.g65-while-spindle-on",
    severity: "warning",
    messageMatcher: /G65 while spindle is still on/,
    summary: "Stop the spindle with M5 before the macro call (G65).",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG65 P9000\nM5\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM5\nG65 P9000\nM30\n"
  },
  {
    id: "haas.m99-while-spindle-on",
    severity: "warning",
    messageMatcher: /M99 while spindle is still on/,
    summary: "Stop the spindle with M5 before subprogram return (M99).",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM99\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nM5\nM99\nM30\n"
  },
  {
    id: "haas.g41-g42-while-spindle-off",
    severity: "warning",
    messageMatcher: /G41\/G42 while spindle is off/,
    summary: "Start the spindle (M3/M4) before cutter compensation (G41/G42).",
    positiveSnippet: "O0001\nT1 M6\nG54\nG41 D1\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG41 D1\nM30\n"
  },
  {
    id: "haas.g93-while-spindle-off",
    severity: "warning",
    messageMatcher: /G93 while spindle is off/,
    summary: "Start the spindle (M3/M4) before inverse-time feed mode (G93).",
    positiveSnippet: "O0001\nT1 M6\nG54\nG93\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG93\nM30\n"
  },
  {
    id: "haas.g95-while-spindle-off",
    severity: "warning",
    messageMatcher: /G95 while spindle is off/,
    summary: "Start the spindle (M3/M4) before feed-per-revolution mode (G95).",
    positiveSnippet: "O0001\nT1 M6\nG54\nG95\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG95\nM30\n"
  },
  {
    id: "haas.g68-while-spindle-off",
    severity: "warning",
    messageMatcher: /G68 while spindle is off/,
    summary: "Start the spindle (M3/M4) before coordinate rotation (G68).",
    positiveSnippet: "O0001\nT1 M6\nG54\nG68\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG68\nM30\n"
  },
  {
    id: "haas.g51-while-spindle-off",
    severity: "warning",
    messageMatcher: /G51 while spindle is off/,
    summary: "Start the spindle (M3/M4) before scaling (G51).",
    positiveSnippet: "O0001\nT1 M6\nG54\nG51\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG51\nM30\n"
  },
  {
    id: "haas.work-offset-while-spindle-on",
    severity: "warning",
    messageMatcher: /Work offset \(G54-G59\/G154\) while spindle is still on/,
    summary: "Stop the spindle with M5 before selecting a work offset (G54-G59/G154).",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG55\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG55\nS1200 M3\nM30\n"
  },
  {
    id: "haas.g94-while-spindle-off",
    severity: "warning",
    messageMatcher: /G94 while spindle is off/,
    summary: "Start the spindle (M3/M4) before feed-per-minute mode (G94).",
    positiveSnippet: "O0001\nT1 M6\nG54\nG94\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG94\nM30\n"
  },
  {
    id: "haas.path-mode-while-spindle-on",
    severity: "warning",
    messageMatcher: /Path mode select \(G61\/G64\) while spindle is still on/,
    summary: "Stop the spindle with M5 before changing path mode (G61/G64).",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG61\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG61\nS1200 M3\nM30\n"
  },
  {
    id: "haas.feed-mode-while-spindle-on",
    severity: "warning",
    messageMatcher: /Feed mode select \(G93\/G94\/G95\) while spindle is still on/,
    summary: "Stop the spindle with M5 before changing feed mode (G93/G94/G95).",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG94\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG54\nG94\nS1200 M3\nM30\n"
  },
  {
    id: "haas.unit-while-spindle-on",
    severity: "warning",
    messageMatcher: /Unit select \(G20\/G21\) while spindle is still on/,
    summary: "Stop the spindle with M5 before changing units (G20/G21).",
    positiveSnippet: "O0001\nT1 M6\nG54\nS1200 M3\nG21\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nG21\nG54\nS1200 M3\nM30\n"
  }
];
