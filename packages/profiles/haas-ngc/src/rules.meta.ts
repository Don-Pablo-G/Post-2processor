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
