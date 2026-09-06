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
