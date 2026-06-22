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
    id: "haas.g41-g42-without-d",
    severity: "warning",
    messageMatcher: /G41\/G42 without D and no prior D offset/,
    summary: "G41/G42 (cutter comp) requires a D offset (or a prior D in scope).",
    positiveSnippet: "O0001\nT1 M6\nS1200 M3\nG43 H1 Z25.\nG41 X10. Y10.\nM30\n",
    negativeSnippet: "O0001\nT1 M6\nS1200 M3\nG43 H1 Z25.\nG41 D1 X10. Y10.\nM30\n"
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
