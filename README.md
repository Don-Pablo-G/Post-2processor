# CNC Workbench (Scaffold)

Haas NGC-first starter project for:

- G-code parsing and formatting
- program parameterization suggestions
- safe macro simulation sandbox

## Workspace Layout

- `apps/desktop` - React + Vite desktop UI scaffold
- `packages/core` - parser/formatter/parameterizer/simulator/lint contracts
- `packages/profiles/haas-ngc` - Haas NGC profile (`haasNgcProfile`) with mill-oriented `lint()` rules (e.g. `G43`/`H`, `M6`/`T`, program end)
- `packages/test-fixtures` - fixture inputs for regression tests

## Quick Start

```bash
npm install
npm run verify
npm run dev
```

## Core Runtime Entry Points

`@cnc/core` now exposes explicit runtime-targeted entry points:

- `@cnc/core/browser` - browser-safe API surface for UI/runtime bundles
- `@cnc/core/node` - full Node-capable API surface (filesystem/process workflows)
- `@cnc/core` - currently aligned with node entry for backward compatibility

Use `isNodeCapable()` when wiring UI actions that may require Node-only workflows.

### Recommended Imports

- Browser UI (React/Vite): import from `@cnc/core/browser`
- CLI/tools/scripts/tests with filesystem access: import from `@cnc/core/node`

Node-only workflows (fixture import/validation, regression runs, file export) are intentionally blocked in the browser entry with clear runtime errors.

## Development Checkpoints

This repository is configured for local checkpoint snapshots and automatic checkpoint commits during development:

- Hook config: `.cursor/hooks.json`
- Hook script: `.cursor/hooks/auto-checkpoint.mjs`
- Snapshot folder: `.checkpoints/` (gitignored)

Successful verification commands (`npm run test`, `npm run typecheck`, `npm run build`, `npm run verify`) trigger checkpoint behavior.

## Import Boundary Guard

Browser app code is guarded against accidental `@cnc/core` default imports.

- Command: `npm run guard:imports`
- Script: `scripts/verify-import-boundaries.mjs`
- Current rules:
  - files in `apps/desktop/src` must use `@cnc/core/browser` (not `@cnc/core`)
  - files in `packages/core/tests` must use `../src/index.node.js` (not `../src/index.js`)
  - fail if `packages/core/src/simulator/simpleSimulator.js` exists beside the TypeScript source, to prevent stale simulator behavior from shadowing `simpleSimulator.ts` in test/runtime resolution
  - enforce an intentionally empty shadow allowlist (`allowedShadowedJsRelPaths`) so any new `src/*.js` sibling is a hard CI failure by default

## Recent Updates

- Expanded Haas NGC mill lint coverage with warnings for spindle start without same-block `S`, `S0` spindle starts, plain `G41/G42` without same-block `D`, `T0`, and duplicate `N`/`O` labels.
- Added Haas NGC simulator behavior for single-line `IF [cond] THEN #n = expr` execution and tested true/false paths.
- Added Haas NGC rapid safety warning for significant `G0` Z-down moves to catch potential clearance/retract issues during simulation review.
- Added regression tests in `packages/core/tests/core.spec.ts` for the new NGC lint and simulation behaviors.
- Policy preset UX now includes named presets (`strict|balanced|permissive`), persisted per-controller defaults, source visibility (`saved|bootstrap|manual`), and one-click actions to save/revert/run checks.
- Exported timeline/findings artifacts now include `policyPreset` and `policyPresetSource` metadata headers for audit traceability.

## Current Status

This is a foundation scaffold. Core logic is intentionally simple and ready for incremental replacement with full Haas NGC semantics.

Current backend includes:

- macro flow simulation (`IF/GOTO`, `WHILE/DO/END`)
- canned cycle timing handlers (`G73`, `G81` to `G89`)
- feed/rapid based cycle-time estimate
- tooling report generation with lowest-Z extraction and 80mm thermal printable output

## Parser Compliance Modes (`strict`, `strict_haas`, `strict_fanuc`, `lenient`)

The `parse()` API supports a compliance mode toggle to choose between documentation-oriented parsing and legacy shop-tolerant parsing behavior:

- `strict` (default): favors Haas/Fanuc documentation compliance and safer tokenization.
- `strict_haas`: strict lexer behavior with Haas-oriented rule scoping.
- `strict_fanuc`: strict lexer behavior plus Fanuc-only numeric checks (for example N/O range checks).
- `lenient`: restores legacy tokenization quirks for backward compatibility with older fixtures/programs.

### API usage

```ts
import { parse } from "@cnc/core/node";

const astStrict = parse(code, profile); // default: strict
const astStrictHaas = parse(code, profile, { complianceMode: "strict_haas" });
const astStrictFanuc = parse(code, profile, { complianceMode: "strict_fanuc" });
const astLenient = parse(code, profile, { complianceMode: "lenient" });
```

### What changes between modes

- **Empty-value address words** (`strict` removes them)
  - Example input: `M99 P Q1`
  - `strict` words: `M99`, `Q1`
  - `lenient` words: `M99`, `P`, `Q1`

- **Unmatched parenthesis tails** (`strict` stops tokenizing at unmatched `(`)
  - Example input: `G0 X1 (no close`
  - `strict`: only `G0`, `X1`
  - `lenient`: may tokenize trailing comment text into extra words

### Recommended mode by workflow

- Use `strict` for:
  - first-article proveout
  - Haas/Fanuc compliance checks
  - CI and release verification
- Use `strict_haas` when:
  - you want strict tokenization but Haas-only compliance scope
- Use `strict_fanuc` when:
  - you want strict tokenization and Fanuc-specific strictness checks regardless of profile id
- Use `lenient` for:
  - migration of legacy programs
  - forensic comparisons with historical parser behavior
  - temporary compatibility during cleanup phases

## Parser Diagnostics, Provenance, and Suggested Fixes

The parser emits structured `parseDiagnostics` alongside the AST so UI/tools can show recoverable issues with actionable guidance. Suggestions are advisory only and never mutate source code.

### Diagnostic shape

`ParseDiagnostic` (see `packages/core/src/types.ts`) carries:

- `code` - stable identifier (e.g. `UNMATCHED_OPEN_PAREN`, `UNMATCHED_CLOSE_PAREN`, `ADDRESS_MISSING_VALUE`, `UNMATCHED_BRACKET`, `BRACKET_EXPRESSION_INVALID`, `UNKNOWN_TOKEN`, `INVALID_CHARACTER`)
- `severity` - `warning` or `error`
- `message` - human-readable explanation
- `blockIndex` - source block (line) the diagnostic refers to
- `span` (optional) - precise character range when `includeTokenSpans: true`
- `suggestedFixes` (optional) - array of `{ title, replacement? }`

```ts
import { parse } from "@cnc/core/node";

const ast = parse("G0 X1 (NO CLOSE", profile, { includeTokenSpans: true });
ast.parseDiagnostics?.forEach((d) => {
  console.log(d.code, d.message);
  d.suggestedFixes?.forEach((fix) => {
    console.log(" -", fix.title, fix.replacement ?? "");
  });
});
```

### Provenance linkage via `lintWithProvenance`

`lintWithProvenance(ast, profile)` returns lint issues tagged with the originating stage and the related parse diagnostics:

- `provenance.source` - one of `lexer | expression_parser | controller_grammar | common_lint | profile_lint`
- `provenance.relatedDiagnostics[]` - includes `code`, `span`, and `suggestedFixes` so UIs can surface auto-fix hints next to lint findings.

```ts
import { lintWithProvenance, parse } from "@cnc/core/node";

const ast = parse(code, profile, { includeTokenSpans: true });
const issuesWithProvenance = lintWithProvenance(ast, profile);
```

### Desktop UX (Lint panel -> Parse diagnostics)

The desktop app (`apps/desktop/src/App.tsx`) renders parse diagnostics under the Lint panel:

- Grouped collapsible sections by `code` with deterministic ordering (block index, then severity).
- Per-group display cap (`DEFAULT_PARSE_DIAGNOSTICS_GROUP_CAP = 25`) with **Show all** affordance for noisy programs.
- **Jump to B<index>** button to navigate to the offending block.
- Per-fix **Copy fix text** action.
- Per-group **Copy all fixes in group** action.

#### Copied line formats

Single fix line:

```
PARSE FIX | code=<CODE> block=<BLOCK_INDEX> | <fix.title>[ -> <fix.replacement>]
```

Group payload: newline-separated single fix lines.

These formats are stable contracts useful for shop handoff notes and tracker comments. Helpers live in `apps/desktop/src/parseDiagnosticsView.ts` and are covered by `apps/desktop/src/parseDiagnosticsView.spec.ts`.

### Suggestions are advisory

- Suggestions are non-mutating hints surfaced for operators and developers.
- The parser, lint engine, and runtime never apply them automatically.
- Treat replacements as starting points, not safe edits — review against your machine post and program intent before committing changes.

### Lint findings expose `suggestedFixes` too

Controller grammar lints in `packages/core/src/lints/controllerGrammar.ts` now attach the same `ParseDiagnosticFixSuggestion[]` shape directly to selected lint findings (`LintIssue.suggestedFixes`):

- `Block contains both N and O words` -> "Move N number to a separate block from the O header"
- `Duplicate <letter> words in one block` -> "Split duplicate <letter> words into two blocks; controller is last-value-wins"
- `G65 block has I/J/K out of order` -> "Reorder arguments so I appears before J before K"

`lintWithProvenance` preserves these `suggestedFixes` on each issue so UIs can render hints next to findings without re-walking parse diagnostics.

### Job Check + export bundle parse-diagnostics summary

`runJobCheck` returns a `parseDiagnosticsSummary` derived from `ast.parseDiagnostics`:

```ts
parseDiagnosticsSummary: {
  total: number;
  byCode: Record<string, number>; // e.g. { ADDRESS_MISSING_VALUE: 4, UNKNOWN_TOKEN: 1 }
  topCodes: string[];             // up to 3 codes ordered by count desc, then code asc
}
```

`buildTimelineFindingsExportBundle` accepts an optional `parseDiagnosticsSummary` field and writes a header line in both txt and markdown variants:

```
parseDiagnostics: total=<N> | top=<code1,code2> | byCode=<CODE=count …>
```

Use `summarizeParseDiagnostics(ast.parseDiagnostics)` (exported from `@cnc/core` and `@cnc/core/browser`) to compute the summary independently for status bars, briefs, or auxiliary tooling.

### Desktop summary chip and demo loader

The desktop Lint panel now shows a small summary chip beside the Lint heading driven by `parseDiagnosticsByCode`, plus a **Load diagnostics demo** button that swaps the program with a fixture exercising `UNMATCHED_OPEN_PAREN`, `ADDRESS_MISSING_VALUE`, `UNKNOWN_TOKEN`, and `BRACKET_EXPRESSION_INVALID`. The chip helper `buildDiagnosticsSummaryChip` and the fixture `DIAGNOSTICS_DEMO_PROGRAM` live in `apps/desktop/src/parseDiagnosticsView.ts`.

### Audit trail captures parse-fix actions

Copying a parse fix or expanding a capped group records an entry in the in-session policy audit trail (no new state shape; existing entries gain optional `code`, `blockIndex`, `fixCount` fields):

- `parse_fix_copied` — single fix copied
- `parse_fix_group_copied` — full-group payload copied
- `parse_fix_group_expanded` — operator opted into "Show all" for a capped group

### E2E coverage

`apps/desktop/e2e/parse-diagnostics.e2e.ts` exercises the diagnostics panel: group rendering for malformed programs, single and bulk copy clipboard payloads, the **Show all** affordance, and **Jump to B&lt;idx&gt;** focusing the program textarea.

## Verification Command

Use `npm run verify` as the standard gate before shipping changes. It runs:

1. import boundary checks
2. core test suite
3. shop regression baseline drift check
4. monorepo typecheck
5. monorepo build

## Shop Safety Policy Presets

`runJobCheck` supports policy overrides so you can tune safety posture without changing engine code:

- `simulationFindingPolicy` controls finding enablement + severity
- `exportBlockingPolicy` controls which finding codes block export

### Strict (maximum preflight safety)

```ts
await runJobCheck({
  ast,
  simulationLimits: { controllerMode: "haas-ngc" },
  simulationFindingPolicy: {
    rapidZPlunge: { severity: "blocker" },
    functionDomainError: { severity: "blocker" },
    cycleParameterIssue: { severity: "blocker" },
    gotoTargetMiss: { severity: "blocker" },
    controlFlowOrphanEnd: { severity: "blocker" }
  },
  exportBlockingPolicy: {
    includeAllBlockers: true,
    blockedFindingCodes: [
      "SIM_RAPID_Z_PLUNGE",
      "SIM_FUNCTION_DOMAIN_ERROR",
      "SIM_CYCLE_PARAMETER_ISSUE",
      "SIM_GOTO_TARGET_MISS",
      "SIM_CONTROL_FLOW_ORPHAN_END",
      "SIM_SUBPROGRAM_TARGET_MISS",
      "SIM_UNSUPPORTED_M97",
      "SIM_UNSUPPORTED_FUNCTION",
      "SIM_MAX_STEPS_LIMIT"
    ]
  },
  exportOptions: { enabled: true, allowExportWithBlockers: false, baseDirectory: "." }
});
```

### Balanced (recommended default for most shops)

```ts
await runJobCheck({
  ast,
  simulationLimits: { controllerMode: "haas-ngc" },
  // Uses built-in conservative defaults when omitted:
  // - blocker findings always block export
  // - selected warning findings also block export by code
  exportOptions: { enabled: true, allowExportWithBlockers: false, baseDirectory: "." }
});
```

### Permissive (engineering/debug workflows)

```ts
await runJobCheck({
  ast,
  simulationLimits: { controllerMode: "haas-ngc" },
  simulationFindingPolicy: {
    rapidZPlunge: { severity: "warning" },
    functionDomainError: { severity: "warning" },
    cycleParameterIssue: { severity: "warning" },
    gotoTargetMiss: { severity: "warning" },
    controlFlowOrphanEnd: { enabled: false },
    maxStepsLimit: { enabled: false }
  },
  exportBlockingPolicy: {
    includeAllBlockers: false,
    blockedFindingCodes: []
  },
  exportOptions: { enabled: true, allowExportWithBlockers: false, baseDirectory: "." }
});
```

Tip: start with `balanced`, switch to `strict` for first article proveout/new posts, and use `permissive` only for controlled internal debugging.

Desktop UI note:
- The policy selector shows `Preset source: saved | bootstrap | manual`.
- First-time bootstrap defaults by detected controller are `fanuc -> strict` and `haas-ngc/haas-legacy -> balanced`.
- Use **Revert to controller default preset** to return to controller bootstrap behavior without editing JSON.
- Keyboard shortcuts:
  - `Ctrl+Shift+R` -> Revert to controller default preset
  - `Ctrl+Shift+J` -> Save preset and run Job Check (when unsaved override is active)
- Use **Copy policy context** to copy `preset/source/controller` for operator notes and handoff comments.
- Successful export status now echoes policy context (`preset`, `source`, `controller`) for quick confirmation.
- Exported timeline/findings headers include both `policyPreset` and `policyPresetSource` for audit traceability.

Policy UX docs:
- Smoke checklist: `POLICY_UX_SMOKE_TEST.md`
- Local UI event schema: `POLICY_UI_EVENT_SCHEMA.md`
- CI gate: desktop Playwright policy suite now runs as a required `desktop-e2e` workflow job.
- Failure triage playbook: `PLAYWRIGHT_TROUBLESHOOTING.md`
- Nightly early warning: `.github/workflows/nightly-desktop-e2e.yml` runs desktop E2E on `main` daily.
- Stability tracking log: `E2E_STABILITY_LOG.md`
- Operational ownership/SLA for gate response is documented in `E2E_STABILITY_LOG.md`.
- Weekly maintenance guidance (owner rotation + last 20-run review) is documented in `E2E_STABILITY_LOG.md`.
- Stabilization checkpoint entries (green-streak criteria) are tracked in `E2E_STABILITY_LOG.md`.
- Feature-work handoff trigger (when to shift back to NGC/Fanuc slices) is tracked in `E2E_STABILITY_LOG.md`.

Policy E2E coverage includes:
- manual preset selection -> `source=manual`
- save+run flows via button and `Ctrl+Shift+J`
- revert via button/shortcut and lock-mode shortcut blocking
- export confirmation card context and copy-context actions
- session policy history entry shape (timestamp + event + preset/source/controller)

To monitor recent CI gate health for required desktop E2E checks:

```bash
npm run e2e:gate:report -- --limit=10
```

Quick summary only:

```bash
npm run e2e:gate:report -- --limit=10 --summary-only
```

Desktop E2E status + triage quick links:
- Required gate workflow: [CI / desktop-e2e](https://github.com/Don-Pablo-G/Post-2processor/actions/workflows/ci.yml)
- Nightly early-warning workflow: [Nightly Desktop E2E](https://github.com/Don-Pablo-G/Post-2processor/actions/workflows/nightly-desktop-e2e.yml)
- Failure triage guide: `PLAYWRIGHT_TROUBLESHOOTING.md`
- Ongoing gate health log: `E2E_STABILITY_LOG.md`

### Policy UX Release Notes

- Added named policy presets with persisted per-controller defaults and source states (`saved|bootstrap|manual`).
- Added one-click actions for save, save+run, revert-to-default, and copy policy/export context.
- Added keyboard shortcuts (`Ctrl+Shift+R`, `Ctrl+Shift+J`) and manual-preset drift warning on controller changes.
- Added export/setup-sheet policy context traceability (`policyPreset`, `policyPresetSource`, controller).

For a one-command local readiness summary (branch state, recent checkpoints, and verify result), run:

```bash
npm run repo:health
```

To print the latest checkpoint hash and safe recovery commands:

```bash
npm run checkpoint:latest
```

To list recent checkpoints (default 10):

```bash
npm run checkpoint:list
```

Optional custom limit:

```bash
node scripts/checkpoint-list.mjs 20
```

To open a checkpoint commit with patch/stat details:

```bash
npm run checkpoint:open
```

Optional hash:

```bash
node scripts/checkpoint-open.mjs <checkpoint-hash>
```

For checkpoint cadence metrics (total/today/average interval):

```bash
npm run checkpoint:stats
```

To list checkpoints since a date or checkpoint hash:

```bash
npm run checkpoint:since -- 2026-04-25
npm run checkpoint:since -- cd44137
```

To list checkpoints between two dates or checkpoint hashes:

```bash
npm run checkpoint:range -- 2026-04-25 2026-04-26
npm run checkpoint:range -- cd44137 e4631fd
```

To compare two checkpoints (summary + changed files):

```bash
npm run checkpoint:diff -- cd44137 7a825f3
```

For a quick daily checkpoint command dashboard:

```bash
npm run checkpoint:menu
```

To run diagnostics across all checkpoint utilities:

```bash
npm run checkpoint:doctor
```

To generate a markdown checkpoint status report:

```bash
npm run checkpoint:report
```

To export checkpoint history as machine-readable JSON:

```bash
npm run checkpoint:catalog
```

To search commit history (including checkpoints) by keyword/regex:

```bash
npm run checkpoint:search -- verify
npm run checkpoint:search -- "browser|node"
```

To see which files are touched most often across checkpoints:

```bash
npm run checkpoint:hotspots
```

Optional custom limit:

```bash
node scripts/checkpoint-hotspots.mjs 25
```

To summarize checkpoint activity by author over the recent window:

```bash
npm run checkpoint:authors
```

Optional custom day window:

```bash
node scripts/checkpoint-authors.mjs 14
```

To view daily checkpoint velocity and trend bars:

```bash
npm run checkpoint:velocity
```

Optional custom window (days):

```bash
node scripts/checkpoint-velocity.mjs 21
```

To inspect current and longest daily checkpoint streaks:

```bash
npm run checkpoint:streaks
```

To identify the largest inactive gaps between checkpoint days:

```bash
npm run checkpoint:gaps
```

Optional custom result limit:

```bash
node scripts/checkpoint-gaps.mjs 10
```

To analyze checkpoint distribution by weekday and hour:

```bash
npm run checkpoint:weekday
```

Optional custom day window:

```bash
node scripts/checkpoint-weekday.mjs 14
```

To summarize first and last checkpoint times per day:

```bash
npm run checkpoint:first-last
```

Optional custom day window:

```bash
node scripts/checkpoint-first-last.mjs 21
```

To detect short high-frequency checkpoint bursts:

```bash
npm run checkpoint:burst
```

Optional tuning (`days windowMinutes minCount`):

```bash
node scripts/checkpoint-burst.mjs 7 20 3
```

To print a combined chronological checkpoint digest (daily counts, spans, bursts):

```bash
npm run checkpoint:timeline
```

Optional custom day window:

```bash
node scripts/checkpoint-timeline.mjs 21
```

To see recurring focus keywords in checkpoint commit subjects:

```bash
npm run checkpoint:focus
```

Optional tuning (`days topN`):

```bash
node scripts/checkpoint-focus.mjs 14 20
```

To see which file pairs most often change together in checkpoints:

```bash
npm run checkpoint:cochange
```

Optional tuning (`commitLimit topN`):

```bash
node scripts/checkpoint-cochange.mjs 300 25
```

To summarize directory-level hotspot concentration and cross-scope coupling:

```bash
npm run checkpoint:scope
```

Optional tuning (`commitLimit depth topN`):

```bash
node scripts/checkpoint-scope.mjs 300 2 25
```

To rank files by checkpoint touch frequency and recency:

```bash
npm run checkpoint:touchmap
```

Optional tuning (`commitLimit topN`):

```bash
node scripts/checkpoint-touchmap.mjs 400 30
```

To measure checkpoint change concentration vs spread (entropy):

```bash
npm run checkpoint:entropy
```

Optional tuning (`commitLimit topN`):

```bash
node scripts/checkpoint-entropy.mjs 400 15
```

To compare recent checkpoint activity vs earlier baseline (drift):

```bash
npm run checkpoint:drift
```

Optional tuning (`commitLimit recentWindow topN`):

```bash
node scripts/checkpoint-drift.mjs 240 40 20
```

To rank files by checkpoint stability vs volatility across windows:

```bash
npm run checkpoint:stability
```

Optional tuning (`commitLimit windowSize minTouches topN`):

```bash
node scripts/checkpoint-stability.mjs 300 12 3 20
```

To measure short-term checkpoint momentum (acceleration/deceleration):

```bash
npm run checkpoint:momentum
```

Optional tuning (`commitLimit windowSize`):

```bash
node scripts/checkpoint-momentum.mjs 160 20
```

To print a compact checkpoint change-intensity scorecard:

```bash
npm run checkpoint:radar
```

Optional tuning (`commitLimit windowSize`):

```bash
node scripts/checkpoint-radar.mjs 220 16
```

To detect unusually large/small checkpoint commits vs baseline:

```bash
npm run checkpoint:anomalies
```

Optional tuning (`commitLimit baselineSize zThreshold`):

```bash
node scripts/checkpoint-anomalies.mjs 220 50 1.8
```

To cluster checkpoints into activity sessions by time gap:

```bash
npm run checkpoint:clusters
```

Optional tuning (`commitLimit gapMinutes topN`):

```bash
node scripts/checkpoint-clusters.mjs 300 45 15
```

To generate a concise development handoff note from recent checkpoints:

```bash
npm run checkpoint:handoff
```

Optional tuning (`commitLimit recentN`):

```bash
node scripts/checkpoint-handoff.mjs 80 12
```

To derive likely next tasks from recent checkpoint patterns:

```bash
npm run checkpoint:backlog
```

Optional tuning (`commitLimit recentN topN`):

```bash
node scripts/checkpoint-backlog.mjs 100 16 10
```

To export a compact end-of-day checkpoint markdown digest:

```bash
npm run checkpoint:digest
```

Optional tuning (`commitLimit recentN`):

```bash
node scripts/checkpoint-digest.mjs 140 24
```

To export a weekly checkpoint rollup markdown briefing:

```bash
npm run checkpoint:weekly
```

Optional tuning (`days topN`):

```bash
node scripts/checkpoint-weekly.mjs 7 15
```

To generate a central checkpoint reports index:

```bash
npm run checkpoint:index
```

Optional tuning (`limit`):

```bash
node scripts/checkpoint-index.mjs 15
```

To get safe, non-destructive cleanup suggestions for checkpoint artifacts:

```bash
npm run checkpoint:cleanup
```

Optional tuning (`keepDigests keepWeekly keepReports`):

```bash
node scripts/checkpoint-cleanup.mjs 14 12 20
```

To export a human-readable markdown checkpoint catalog:

```bash
npm run checkpoint:catalog:md
```

Optional tuning (`commitLimit topN`):

```bash
node scripts/checkpoint-catalog-md.mjs 220 25
```

To print a concise checkpoint status snapshot in terminal:

```bash
npm run checkpoint:status
```

To generate index + digest + weekly + status in one pass:

```bash
npm run checkpoint:bootstrap
```

To run deeper consistency diagnostics across reporting/export utilities:

```bash
npm run checkpoint:doctor:extended
```

To run full checkpoint readiness in one command:

```bash
npm run checkpoint:suite
```

To print a concise release-readiness checklist:

```bash
npm run checkpoint:release-ready
```

To run final pre-release gate with go/no-go summary:

```bash
npm run checkpoint:ship
```

To run an operator dashboard (status + release-ready + cleanup):

```bash
npm run checkpoint:ops
```

To run an all-in-one operations cycle (ops + ship + index refresh):

```bash
npm run checkpoint:all
```

To run nightly checkpoint maintenance and write a report:

```bash
npm run checkpoint:nightly
```

To run morning quick-start (status + handoff + backlog + digest recap):

```bash
npm run checkpoint:morning
```

To export a timeline snapshot as markdown artifact:

```bash
npm run checkpoint:timeline:md
```

To print an ultra-short standup-style checkpoint summary:

```bash
npm run checkpoint:brief
```

To generate a longer-form weekly recap with next-week priorities:

```bash
npm run checkpoint:weekend
```

To generate a retrospective template (wins, risks, actions):

```bash
npm run checkpoint:retro
```

To print a single-line checkpoint health pulse (statusline-friendly):

```bash
npm run checkpoint:pulse
```

To generate a 1-2 week prioritized checkpoint roadmap:

```bash
npm run checkpoint:roadmap
```

To auto-generate a categorized checkpoint command reference:

```bash
npm run checkpoint:command-map
```

To generate a newcomer quick-start checkpoint guide:

```bash
npm run checkpoint:onboarding
```

To generate a canonical checkpoint command taxonomy (JSON + markdown):

```bash
npm run checkpoint:taxonomy
```

To synchronize the README auto-generated checkpoint command reference:

```bash
npm run checkpoint:sync-docs
```

To run full checkpoint docs/taxonomy synchronization in one pass:

```bash
npm run checkpoint:sync-all
```

To export aggregated checkpoint metadata as JSON:

```bash
npm run checkpoint:meta
```

To serve checkpoint metadata over a tiny local HTTP API:

```bash
npm run checkpoint:api
```

Endpoints:

- `GET /health`
- `GET /meta`

One-shot JSON mode (no server):

```bash
node scripts/checkpoint-api.mjs --once
```

To stream checkpoint metadata/events as NDJSON for agents/tools:

```bash
npm run checkpoint:agent-feed
```

Optional custom recent event limit:

```bash
node scripts/checkpoint-agent-feed.mjs 30
```

To generate a deterministic webhook-ready JSON payload:

```bash
npm run checkpoint:webhook-payload
```

Optional custom recent event limit:

```bash
node scripts/checkpoint-webhook-payload.mjs 15
```

To render a human-friendly notification preview from checkpoint payload:

```bash
npm run checkpoint:notify-preview
```

To write that notification preview to a reusable text artifact:

```bash
npm run checkpoint:notify-file
```

To generate JSON schema contracts for machine-readable checkpoint outputs:

```bash
npm run checkpoint:contracts
```

This now includes the handoff metadata schema (`checkpoint-handoff-meta.schema.json`).

To validate current machine-readable artifacts against those contracts:

```bash
npm run checkpoint:validate
```

This now validates checkpoint meta, webhook payload, and generated handoff metadata payload.

To generate a handoff/archive release bundle with key artifacts:

```bash
npm run checkpoint:release-bundle
```

To verify a release bundle manifest and required files:

```bash
npm run checkpoint:bundle-verify
```

Optional custom bundle path:

```bash
node scripts/checkpoint-bundle-verify.mjs .checkpoints/release-bundles/<bundle-folder>
```

To create a compressed handoff package from a verified release bundle:

```bash
npm run checkpoint:handoff-package
```

To list recent handoff packages (default: latest 10):

```bash
npm run checkpoint:handoff-list
```

Optional examples:

```bash
# latest 5
node scripts/checkpoint-handoff-list.mjs 5

# show absolute paths
node scripts/checkpoint-handoff-list.mjs 10 --full-path
```

To open the latest handoff package (Windows):

```bash
npm run checkpoint:handoff-open
```

Open the handoff package folder instead:

```bash
node scripts/checkpoint-handoff-open.mjs --folder
```

To preview pruning older handoff packages (default keep: 10):

```bash
npm run checkpoint:handoff-cleanup
```

Examples:

```bash
# preview while keeping only newest 5
node scripts/checkpoint-handoff-cleanup.mjs 5

# apply deletion (zip + paired txt note)
node scripts/checkpoint-handoff-cleanup.mjs 5 --apply
```

To run a full handoff cycle (package -> list -> status -> cleanup preview):

```bash
npm run checkpoint:handoff-cycle
```

Optional example:

```bash
# preview cleanup with keep target 5
node scripts/checkpoint-handoff-cycle.mjs 5
```

To run a stricter handoff ship flow (includes cleanup apply):

```bash
npm run checkpoint:handoff-ship
```

Optional example:

```bash
# keep newest 5 and delete older handoff artifacts
node scripts/checkpoint-handoff-ship.mjs 5
```

To run non-invasive diagnostics for handoff tooling:

```bash
npm run checkpoint:handoff-doctor
```

Covers status, list, cleanup preview, full `checkpoint:validate` (meta, webhook, handoff), and an optional handoff package build when a release bundle exists.

To run a lightweight daily handoff profile:

```bash
npm run checkpoint:handoff:daily
```

Optional keep target for cleanup preview:

```bash
node scripts/checkpoint-handoff-daily.mjs 5
```

To run a nightly handoff profile (preview cleanup by default):

```bash
npm run checkpoint:handoff:nightly
```

Optional apply mode:

```bash
# keep newest 5 and delete older handoff artifacts
node scripts/checkpoint-handoff-nightly.mjs 5 --apply
```

To export machine-readable handoff package metadata (JSON):

```bash
npm run checkpoint:handoff:meta
```

Optional tuning (`keepTarget recentLimit`):

```bash
node scripts/checkpoint-handoff-meta.mjs 10 5
```

To generate JSON schema contract for handoff metadata:

```bash
npm run checkpoint:handoff:contracts
```

To validate handoff metadata against contract expectations:

```bash
npm run checkpoint:handoff:validate
```

`checkpoint:handoff:contracts` and `checkpoint:handoff:validate` are thin wrappers around `checkpoint:contracts` and `checkpoint:validate` (same schemas and checks as the main pipeline).

To view a compact handoff status snapshot:

```bash
npm run checkpoint:handoff-status
```

To prune old generated checkpoint reports (default keep 20):

```bash
npm run checkpoint:reports:prune
```

Optional custom keep count:

```bash
node scripts/checkpoint-reports-prune.mjs 10
```

To get non-destructive suggestions for dense checkpoint streaks:

```bash
npm run checkpoint:prune-suggestions
```

Optional tuning:

```bash
node scripts/checkpoint-prune-suggestions.mjs 8 5
```

Where `8` = max minutes between adjacent checkpoints, `5` = minimum cluster size.

## Local Git Hooks

This repo includes a local pre-commit helper that is intentionally non-blocking:

- Install hook: `npm run setup:hooks`
- Hook check command: `npm run precommit:check`
- Current behavior: runs import-boundary guard and prints a reminder to run `npm run verify`

## Checkpoint Command Matrix

<!-- checkpoint-commands:start -->
### Auto-generated Checkpoint Command Reference

_Generated from `package.json` scripts. Total: 62_

#### Status
- `checkpoint:brief` -> `node ./scripts/checkpoint-brief.mjs`
- `checkpoint:pulse` -> `node ./scripts/checkpoint-pulse.mjs`
- `checkpoint:status` -> `node ./scripts/checkpoint-status.mjs`

#### Diagnostics
- `checkpoint:doctor` -> `node ./scripts/checkpoint-doctor.mjs`
- `checkpoint:doctor:extended` -> `node ./scripts/checkpoint-doctor-extended.mjs`

#### Operations
- `checkpoint:all` -> `node ./scripts/checkpoint-all.mjs`
- `checkpoint:bootstrap` -> `node ./scripts/checkpoint-bootstrap.mjs`
- `checkpoint:morning` -> `node ./scripts/checkpoint-morning.mjs`
- `checkpoint:nightly` -> `node ./scripts/checkpoint-nightly.mjs`
- `checkpoint:onboarding` -> `node ./scripts/checkpoint-onboarding.mjs`
- `checkpoint:ops` -> `node ./scripts/checkpoint-ops.mjs`
- `checkpoint:release-ready` -> `node ./scripts/checkpoint-release-ready.mjs`
- `checkpoint:ship` -> `node ./scripts/checkpoint-ship.mjs`
- `checkpoint:suite` -> `node ./scripts/checkpoint-suite.mjs`

#### Reporting
- `checkpoint:catalog:md` -> `node ./scripts/checkpoint-catalog-md.mjs`
- `checkpoint:digest` -> `node ./scripts/checkpoint-digest.mjs`
- `checkpoint:handoff` -> `node ./scripts/checkpoint-handoff.mjs`
- `checkpoint:index` -> `node ./scripts/checkpoint-index.mjs`
- `checkpoint:report` -> `node ./scripts/checkpoint-report.mjs`
- `checkpoint:retro` -> `node ./scripts/checkpoint-retro.mjs`
- `checkpoint:roadmap` -> `node ./scripts/checkpoint-roadmap.mjs`
- `checkpoint:timeline:md` -> `node ./scripts/checkpoint-timeline-md.mjs`
- `checkpoint:weekend` -> `node ./scripts/checkpoint-weekend.mjs`
- `checkpoint:weekly` -> `node ./scripts/checkpoint-weekly.mjs`

#### Maintenance
- `checkpoint:cleanup` -> `node ./scripts/checkpoint-cleanup.mjs`
- `checkpoint:prune-suggestions` -> `node ./scripts/checkpoint-prune-suggestions.mjs`
- `checkpoint:reports:prune` -> `node ./scripts/checkpoint-reports-prune.mjs`

#### Analytics
- `checkpoint:anomalies` -> `node ./scripts/checkpoint-anomalies.mjs`
- `checkpoint:authors` -> `node ./scripts/checkpoint-authors.mjs`
- `checkpoint:backlog` -> `node ./scripts/checkpoint-backlog.mjs`
- `checkpoint:burst` -> `node ./scripts/checkpoint-burst.mjs`
- `checkpoint:catalog` -> `node ./scripts/checkpoint-catalog.mjs`
- `checkpoint:clusters` -> `node ./scripts/checkpoint-clusters.mjs`
- `checkpoint:cochange` -> `node ./scripts/checkpoint-cochange.mjs`
- `checkpoint:command-map` -> `node ./scripts/checkpoint-command-map.mjs`
- `checkpoint:diff` -> `node ./scripts/checkpoint-diff.mjs`
- `checkpoint:drift` -> `node ./scripts/checkpoint-drift.mjs`
- `checkpoint:entropy` -> `node ./scripts/checkpoint-entropy.mjs`
- `checkpoint:first-last` -> `node ./scripts/checkpoint-first-last.mjs`
- `checkpoint:focus` -> `node ./scripts/checkpoint-focus.mjs`
- `checkpoint:gaps` -> `node ./scripts/checkpoint-gaps.mjs`
- `checkpoint:hotspots` -> `node ./scripts/checkpoint-hotspots.mjs`
- `checkpoint:latest` -> `node ./scripts/checkpoint-latest.mjs`
- `checkpoint:list` -> `node ./scripts/checkpoint-list.mjs`
- `checkpoint:menu` -> `node ./scripts/checkpoint-menu.mjs`
- `checkpoint:momentum` -> `node ./scripts/checkpoint-momentum.mjs`
- `checkpoint:open` -> `node ./scripts/checkpoint-open.mjs`
- `checkpoint:radar` -> `node ./scripts/checkpoint-radar.mjs`
- `checkpoint:range` -> `node ./scripts/checkpoint-range.mjs`
- `checkpoint:scope` -> `node ./scripts/checkpoint-scope.mjs`
- `checkpoint:search` -> `node ./scripts/checkpoint-search.mjs`
- `checkpoint:since` -> `node ./scripts/checkpoint-since.mjs`
- `checkpoint:stability` -> `node ./scripts/checkpoint-stability.mjs`
- `checkpoint:stats` -> `node ./scripts/checkpoint-stats.mjs`
- `checkpoint:streaks` -> `node ./scripts/checkpoint-streaks.mjs`
- `checkpoint:sync-all` -> `node ./scripts/checkpoint-sync-all.mjs`
- `checkpoint:sync-docs` -> `node ./scripts/checkpoint-sync-docs.mjs`
- `checkpoint:taxonomy` -> `node ./scripts/checkpoint-taxonomy.mjs`
- `checkpoint:timeline` -> `node ./scripts/checkpoint-timeline.mjs`
- `checkpoint:touchmap` -> `node ./scripts/checkpoint-touchmap.mjs`
- `checkpoint:velocity` -> `node ./scripts/checkpoint-velocity.mjs`
- `checkpoint:weekday` -> `node ./scripts/checkpoint-weekday.mjs`

<!-- checkpoint-commands:end -->

## Diagnostics Policy + Lint Panel Polish

The desktop app surfaces parse diagnostics, lint findings, and policy state through a small set of
canonical primitives. This section covers the data shapes and copy formats so dashboards, CI, and
operator tools can stay in sync with the UI.

### `parseDiagnosticsPolicy` shape and persistence

The desktop UI persists the policy under
`templateJson.settings.uiDefaults[<controller>].parseDiagnosticsPolicy`:

```jsonc
{
  "settings": {
    "uiDefaults": {
      "haas-ngc": {
        "parseDiagnosticsPolicy": {
          "enabled": true,
          "severity": "blocker",
          "blockExport": true,
          "thresholdsText": "TOTAL=10, ADDRESS_MISSING_VALUE=3"
        }
      }
    }
  }
}
```

When breached, `runJobCheck` emits a `SafetyFinding` with code
`PARSE_DIAGNOSTICS_THRESHOLD_BREACH` plus a structured
`parseDiagnosticsPolicyBreaches: { key, observed, threshold, severity, firstBlockIndex? }[]`
on the result. The Job Check card renders one row per breach with a Jump-to-block button for
code-specific entries (`TOTAL` is informational only).

### Lint panel parity

The lint panel mirrors the parse diagnostics panel: groups by `provenance.source`, sorts by
`(blockIndex, severity, message)`, applies the same cap, and emits canonical fix lines through
shared `buildFixLine`/`buildLintFixLine` helpers:

```text
LINT FIX | source=controller_grammar block=0 | Move N number to a separate block from the O header
```

Both panels also expose summary chips and demo-loader buttons (`LINT_DEMO_PROGRAM`,
`DIAGNOSTICS_DEMO_PROGRAM`) for one-click reproduction of the targeted findings.

### Audit trail row format

The session-scoped audit trail panel emits one row per recorded event using
`formatPolicyAuditTrailRow`/`formatPolicyAuditTrailPayload`:

```text
AUDIT | 2026-05-01T18:00:00.000Z | event=lint_fix_copied | controller=haas-ngc | preset=balanced | source=manual | code=controller_grammar | block=0 | fix=1
```

The structured payload (`schemaVersion: 2`) carries the same fields plus `extras.{code,block,fix}`.

### Brief field additions

Operator handoff and risk briefs append two extra fields:

```text
parseDiag=total=4,top=ADDRESS_MISSING_VALUE,UNMATCHED_BRACKET
parseDiagPolicy=active,severity=blocker,blockExport=true,breached=ADDRESS_MISSING_VALUE,TOTAL
```

Both are produced by `parseDiagnosticsView.ts` helpers
(`buildDiagnosticsSummaryChip`, `buildParseDiagnosticsPolicyBriefField`) so callers stay in sync
with the on-screen chips.

### Test pointers

- Unit: `apps/desktop/src/parseDiagnosticsView.spec.ts`,
  `apps/desktop/src/policyPresetHint.spec.ts`,
  `packages/core/tests/core.spec.ts` (controller grammar suggestedFixes,
  `runJobCheckParseDiagnosticsPolicy`, `setupSheet + proveout parseDiagnostics summary`).
- Playwright E2E: `apps/desktop/e2e/lint-fix-audit.e2e.ts`,
  `apps/desktop/e2e/parse-diagnostics-audit.e2e.ts`,
  `apps/desktop/e2e/parse-diagnostics-policy.e2e.ts`,
  `apps/desktop/e2e/policy-core.e2e.ts`.

## Diagnostics Breach Polish

This wave layered breach-aware visibility on top of the parse-diagnostics policy:

### Job Check breach surface

When `runJobCheck` evaluates a `parseDiagnosticsPolicy`, every threshold violation
is returned as a structured `parseDiagnosticsPolicyBreach`
(`{ key, observed, threshold, severity, firstBlockIndex? }`).
The desktop Job Check card renders one row per breach with an inline
`Jump to first <KEY>` button (when `firstBlockIndex` is known) plus a one-click
**Copy diagnostics breach context** action that emits the canonical multi-line
payload:

```text
parseDiagBreach: ADDRESS_MISSING_VALUE=4>3 (blocker) firstBlock=1
parseDiagBreach: TOTAL=12>10 (blocker)
controller=haas-ngc
```

Above the row list, a `breaches: total=N | blockers=B | warnings=W` chip
(`data-testid="job-check-parse-diag-breach-summary"`) summarizes severities at a glance.

### Operator-review-mode parity

When `operatorReviewMode` is enabled, breach rows render through a stripped-down
read-only span (`data-testid="job-check-parse-diag-breach-readonly-<key>"`) without
the Jump or Copy buttons. The severity rollup chip stays visible.

### Audit trail entries

Two new audit events ride the existing `recordPolicyPresetTransition` flow with
extras:

| Event | Extras |
| --- | --- |
| `parse_breach_copied` | `count=<n>`, `severities=blocker:<n>,warning:<n>` |
| `policy_audit_trail_subset_copied` | `count=<n>`, `severities=subset=parse_lint` |

The `Copy diagnostics audit subset (parse + lint)` button next to the existing
`Copy policy audit trail` filters by `entry.event.startsWith("parse_") ||
entry.event.startsWith("lint_")` via `formatPolicyAuditTrailFilteredPayload` +
`isParseOrLintAuditEvent`.

### Brief field additions

Operator handoff, machine-safe startup, and the policy/Job-Check first-cut briefs
append three breach-derived fields next to the existing `parseDiag=` /
`parseDiagPolicy=` fields:

```text
parseDiagBreaches=ADDRESS_MISSING_VALUE:4/3,TOTAL:12/10  // or =none
parseDiagBreachSeverities=blockers=2,warnings=0          // or =none
```

`buildParseDiagBreachesBriefField` and `buildParseDiagBreachSeveritiesBriefField`
in `parseDiagnosticsView.ts` keep these strings deterministic.

### Workshop export breach block

`runJobCheck` now passes `parseDiagnosticsPolicyResult.breaches` into both
`generateSetupSheet` and `buildProveoutProgram`. The exporters emit a canonical
breach block right after the existing parse diagnostics block via
`formatParseDiagnosticsBreachesBlock`:

```text
PARSE DIAGNOSTICS BREACHES
parseDiagBreaches: total=2 | severities=blocker:2 | byKey=ADDRESS_MISSING_VALUE:2/0,TOTAL:2/0

## Parse diagnostics breaches
- Parse diagnostics breaches: total=2 | severities=blocker:2 | byKey=ADDRESS_MISSING_VALUE:2/0,TOTAL:2/0

(parseDiagBreaches: total=2 | severities=blocker:2 | byKey=ADDRESS_MISSING_VALUE:2/0,TOTAL:2/0)
```

A clean program emits the canonical zero form (`parseDiagBreaches: total=0`).
Format-guard tests in `packages/core/tests/core.spec.ts`
(`parseDiagBreaches block format guard`) lock these strings end-to-end so
downstream consumers cannot drift silently.

### Fanuc lint demo + controller override

`LINT_DEMO_PROGRAM_FANUC` (with `%` envelopes, duplicate-O headers, and a
strict-N-with-O block) sits next to the original `LINT_DEMO_PROGRAM`.
`selectLintDemoProgram(controller)` picks the right variant. The desktop UI
exposes a `Lint demo variant` dropdown (`data-testid="lint-demo-controller-override"`)
with options `auto | haas-ngc | haas-legacy | fanuc`; selecting a non-`auto`
value forces that demo regardless of the detected controller. The override is
persisted in `template.json` alongside `parseDiagnosticsPolicy`.

### Test pointers

- Unit: `apps/desktop/src/parseDiagnosticsView.spec.ts`
  (`buildParseDiagnosticsBreachContext`, `buildParseDiagBreachesBriefField`,
  `summarizeParseDiagBreachSeverities`, `buildParseDiagBreachSeveritiesBriefField`,
  `selectLintDemoProgram`),
  `apps/desktop/src/policyPresetHint.spec.ts`
  (`formatPolicyAuditTrailFilteredPayload`, `isParseOrLintAuditEvent`,
  `parse_breach_copied` row + V2 envelope),
  `packages/core/tests/core.spec.ts` (`parseDiagBreaches block format guard`).
- Playwright E2E: `apps/desktop/e2e/parse-diagnostics-policy.e2e.ts`
  (breach copy, severity chip, operator-review parity, lint-demo override),
  `apps/desktop/e2e/lint-fix-audit.e2e.ts`
  (parse-only audit subset copy),
  `apps/desktop/e2e/policy-core.e2e.ts`
  (`parseDiagBreaches=` / `parseDiagBreachSeverities=` brief matchers).

## Headless CLI + Policy Presets + Audit Persistence

This wave bundles four operator-facing improvements: a headless `cnc-job-check`
CLI, one-click `parseDiagnosticsPolicy` preset chips in the desktop UI,
confirmation gates around the destructive UI-defaults and fixture-prefs reset
buttons, and persistence of the last 10 audit-trail entries through
`template.json`.

### `cnc-job-check` CLI (@cnc/core)

The headless CLI lives at `packages/core/src/cli.ts` and is wired as a
`bin` entry in `@cnc/core/package.json`:

```json
"bin": { "cnc-job-check": "./dist/cli.js" }
```

After `npm run --workspace @cnc/core build`, you can invoke the CLI via
`node packages/core/dist/cli.js` (or, when the package is linked into a
target shop tools project, via the `cnc-job-check` shim). For local
TypeScript-driven development a `cli` script is provided:

```bash
npm run --workspace @cnc/core cli -- --input path/to/program.nc --format json
```

Supported flags:

- `--input <path>` (required) — G-code source file.
- `--controller <haas-ngc|haas-legacy|fanuc>` (default `haas-ngc`) — controller
  profile id used by `parse(...)`.
- `--policy <path>` — JSON file containing a
  `ParseDiagnosticsThresholdPolicy` (`{ severity, blockExport, thresholds }`).
- `--format <json|text>` (default `json`) — emit the canonical JSON envelope or
  the canonical setup-sheet `exportTxt` followed by a `===== PROVEOUT =====`
  separator and the proveout `code`.
- `--out <path>` — write to file instead of stdout.
- `--strict` — exit with code `1` when `result.blocked` is `true`.

Sample JSON output for a clean program:

```json
{
  "readyToRunScore": 92,
  "blockerCount": 0,
  "warningCount": 1,
  "parseDiagnosticsSummary": { "total": 0, "byCode": {}, "topCodes": [] },
  "parseDiagnosticsPolicyBreaches": [],
  "setupSheetExportTxt": "SETUP SHEET\nHANDOFF: GO\n…\nPARSE DIAGNOSTICS\nparseDiagnostics: total=0\n\nPARSE DIAGNOSTICS BREACHES\nparseDiagBreaches: total=0",
  "proveoutCode": "(PROVEOUT MODE ENABLED)\n…\n(parseDiagnostics: total=0)\n(parseDiagBreaches: total=0)\nG0 X1 Y1\nM30"
}
```

Pairing `--policy` with a strict threshold (e.g.
`{ "severity": "blocker", "blockExport": true, "thresholds": { "TOTAL": 0, "ADDRESS_MISSING_VALUE": 0 } }`)
on a malformed program causes the canonical
`parseDiagBreaches: total=2 | severities=blocker:2 | byKey=…` block to appear
inside `setupSheetExportTxt`. With `--strict`, the process exits `1` so
upstream automation can gate releases.

### Quick `parseDiagnostics` policy preset chips

Above the existing `parse-diagnostics-policy-row` fieldset, three chips
(`data-testid="parse-diagnostics-policy-preset-{strict,balanced,permissive}"`)
apply canonical thresholds in one click via the pure helper
`applyParseDiagnosticsPolicyPreset(preset)`:

| Preset      | Enabled | Severity | Block export | Thresholds   |
|-------------|---------|----------|--------------|--------------|
| Strict      | yes     | blocker  | yes          | `TOTAL=0`    |
| Balanced    | yes     | warning  | no           | `TOTAL=10`   |
| Permissive  | no      | warning  | no           | _(empty)_    |

Clicking a chip calls `setParseDiagnosticsPolicy(applyParseDiagnosticsPolicyPreset(preset))`
and records the audit event `parse_diag_policy_preset_applied` with
`extras.code = preset:<id>` so the policy history surfaces which preset was
applied without operator typing.

### Reset confirm gate

The destructive `Reset UI defaults for current controller profile` and
`Reset fixture import defaults for current controller profile` buttons now go
through `window.confirm(...)` (locale-aware `confirmResetUiPrefs` /
`confirmResetFixturePrefs` strings):

- Accept → existing reset behavior runs and an audit event
  `ui_defaults_reset_confirmed` (or `fixture_prefs_reset_confirmed`) is recorded
  with `extras.code = <detected controller>`.
- Cancel → status line shows the localized
  `resetUiPrefsCancelled` / `resetFixturePrefsCancelled` message and an audit
  event `ui_defaults_reset_aborted` / `fixture_prefs_reset_aborted` is
  recorded.

The buttons expose stable selectors for E2E coverage:
`data-testid="reset-ui-prefs"` and `data-testid="reset-fixture-prefs"`.

### Audit-trail persistence (`auditTrailRecent`)

`template.json` now carries a top-level `settings.auditTrailRecent` array
holding the most recent 10 audit-trail entries (capped via
`AUDIT_TRAIL_PERSIST_LIMIT`). On save, the in-flight `saved_to_template` event
is prepended before slicing so the persisted snapshot reflects the action that
just produced it; an additional `policy_audit_trail_persisted` audit event is
recorded with `extras.count` equal to the number of stored rows.

On bootstrap, `hydrateAuditEntriesFromTemplate(parsed)` validates each row
(timestamp/event/preset/source/controller plus optional code/blockIndex/fixCount/count/severities)
and prepends the surviving entries to the in-memory audit trail with a
`hydratedFromTemplate: true` flag. Hydrated rows render with
`data-testid="policy-audit-trail-entry-hydrated"` and a faint `(hydrated)`
marker so operators can tell at a glance which entries pre-date the current
session. After the first save in a session the hydration gate is closed to
avoid double-counting (see `setAuditTrailHydrated(true)` inside the save
handler).

### Test pointers

- Unit:
  - `packages/core/tests/cli.spec.ts` — argument parsing, controller mapping,
    JSON/text formatting, malformed-program strict-policy assertion (locks the
    `parseDiagBreaches: total=2 | severities=blocker:2 | byKey=…` substring
    inside `setupSheetExportTxt`), `--strict` exit-code gating, `--out`
    redirection, missing-input failure path.
  - `apps/desktop/src/parseDiagnosticsView.spec.ts` —
    `applyParseDiagnosticsPolicyPreset` + `PARSE_DIAGNOSTICS_POLICY_PRESETS`
    canonical shapes for strict/balanced/permissive.
  - `apps/desktop/src/policyPresetHint.spec.ts` —
    `selectPersistableAuditEntries` (10-cap, ordering, extras copy, negative
    limit), `hydrateAuditEntriesFromTemplate` (valid/missing/invalid rows,
    custom limit), and `AUDIT_TRAIL_PERSIST_LIMIT` constant.
- Playwright E2E:
  - `apps/desktop/e2e/parse-diagnostics-policy.e2e.ts` — preset-chip canonical
    shapes + `parse_diag_policy_preset_applied` audit row, `auditTrailRecent`
    written into `templateJson` on save (`policy_audit_trail_persisted` audit
    row), and the `(hydrated)` marker after injected templateJson hydration.
  - `apps/desktop/e2e/policy-core.e2e.ts` — confirm-cancel and confirm-accept
    paths for both `reset-ui-prefs` and `reset-fixture-prefs` (verifying
    `ui_defaults_reset_confirmed` / `_aborted` and `fixture_prefs_reset_aborted`
    audit rows). Existing brief-field matchers continue to lock
    `parseDiagBreaches=` / `parseDiagBreachSeverities=`.

## CLI Coverage + UX Completion

The latest wave rounds out the CLI envelope, adds stdin/batch ingestion,
surfaces an active-match indicator on the desktop preset chips, and completes
the audit-trail UX (clear, filter, count chip).

### CLI envelope: `schemaVersion`, `messages`, strict-block hint

`formatJobCheckJson(...)` now emits a forward-compat envelope with two new
top-level keys at the head of the object so older consumers can ignore unknown
fields and new consumers can route on schema:

```json
{
  "schemaVersion": 1,
  "readyToRunScore": 87,
  "blockerCount": 0,
  "warningCount": 1,
  "blocked": false,
  "messages": [
    "Detected 1 warning(s); review before release."
  ],
  "parseDiagnosticsSummary": { /* ... */ },
  "parseDiagnosticsPolicyBreaches": [ /* ... */ ],
  "setupSheetExportTxt": "...",
  "proveoutCode": "..."
}
```

When `--strict` blocks the run, the CLI also writes a single status line to
stderr before exiting with code `1`:

```
cnc-job-check: blocked=true (strict mode); blockers=2 warnings=0
```

Batch mode (see below) prepends `input=<path>` to the same hint so log
aggregators can identify the offending file.

### CLI policy preset shortcut: `--policy-preset`

The desktop preset chips have a CLI counterpart. `resolveParseDiagnosticsPolicyPreset(preset)`
returns the canonical `ParseDiagnosticsThresholdPolicy` (or `undefined` for
permissive) and the new flag mirrors it 1:1:

| Preset      | Resolves to                                                                        |
|-------------|------------------------------------------------------------------------------------|
| `strict`    | `{ severity: "blocker", blockExport: true, thresholds: { TOTAL: 0 } }`             |
| `balanced`  | `{ severity: "warning", blockExport: false, thresholds: { TOTAL: 10 } }`           |
| `permissive`| _(no policy — pipeline runs without breaches)_                                     |

`--policy` and `--policy-preset` are mutually exclusive (the parser exits with
code `2` if both are passed) so automation always has one source of truth.

### CLI stdin + batch ingestion: `--input -` and `--input-dir`

- `--input -` reads the program from stdin. Tests inject an
  `io.stdinReader?: () => Promise<string>` so the spec doesn't depend on the
  global stream.
- `--input-dir <path>` walks the directory once (non-recursive) and selects
  files matching `/\.(nc|tap|gcode)$/i`. Each file runs through the same
  `parse + runJobCheck` pipeline. JSON output becomes:

  ```json
  {
    "schemaVersion": 1,
    "results": [
      { "schemaVersion": 1, "input": "01-clean.nc",     "envelope": { /* same envelope */ } },
      { "schemaVersion": 1, "input": "02-malformed.nc", "envelope": { /* same envelope */ } }
    ],
    "summary": { "files": 2, "blocked": 1 }
  }
  ```

  Text output prints each file's bundle separated by
  `===== FILE: <input> =====`, followed by the existing
  `===== PROVEOUT =====` boundary inside each block. With `--strict`, the
  process exits `1` if any file reports `blocked=true` (aggregate semantic).

`--input` and `--input-dir` are mutually exclusive (the parser exits with code
`2` if both are passed).

### Preset chip active-match indicator (desktop)

`selectMatchingParseDiagnosticsPolicyPreset(state)` compares the live
`parseDiagnosticsPolicyUiState` against each canonical preset shape (using
`parseParseDiagnosticsPolicyThresholds` for whitespace tolerance) and returns
the matching preset id or `"custom"`. The chip row above
`parse-diagnostics-policy-row` reflects this:

- The matching chip gets `aria-pressed="true"` plus a highlighted background.
- A small badge rendered as
  `<span data-testid="parse-diagnostics-policy-preset-active">` shows the
  current match, e.g. `Active preset: Strict` or `Active preset: custom` once
  thresholds drift.
- New i18n keys: `parseDiagnosticsPolicyActiveLabel`,
  `parseDiagnosticsPolicyActiveCustom` (pl + en).

A disabled policy always maps to `permissive`, which keeps the indicator stable
when an operator clicks the permissive chip (canonical shape: `enabled: false`).

### Audit trail UX completion: clear, filter, count chip

The session audit trail now exposes:

- `policy-audit-trail-clear` button gated by `window.confirm(t.confirmClearAuditTrail)`.
  On accept, an audit event `policy_audit_trail_cleared` is recorded BEFORE
  clearing (so the cleared event becomes the only entry afterwards) with
  `extras.count = priorLength`. The status line shows `auditTrailClearedStatus`.
  On dismiss, the trail stays untouched and no `policy_audit_trail_cleared`
  entry is recorded.
- `policy-audit-trail-filter-{all,parse_lint,reset,policy}` chips drive a
  client-side filter via the pure helper `filterPolicyAuditTrailByCategory` /
  `classifyPolicyAuditTrailEntry` (parse_/lint_ events → `parse_lint`, any event
  containing `reset` → `reset`, everything else → `policy`).
- `<span data-testid="policy-audit-trail-count-chip">` next to the
  `<details>` summary shows `N entries (M hydrated)` via the helper
  `summarizePolicyAuditTrail(entries)`.
- New i18n keys: `clearAuditTrail`, `confirmClearAuditTrail`,
  `auditTrailClearedStatus`, `auditTrailFilterAll`,
  `auditTrailFilterParseLint`, `auditTrailFilterReset`, `auditTrailFilterPolicy`,
  `auditTrailCountChip`, `auditTrailHydratedChip` (pl + en).

### Test pointers

- Unit:
  - `packages/core/tests/cli.spec.ts` — `--policy-preset` mutually-exclusive
    rules, strict + preset producing canonical breaches block, preset-permissive
    clean exit, `schemaVersion: 1` and `messages` envelope keys, strict-block
    stderr hint shape, stdin reader path (`--input -`), `--input-dir` aggregate
    JSON envelope shape and `summary.blocked`, text-format batch separators,
    empty-directory failure path.
  - `apps/desktop/src/parseDiagnosticsView.spec.ts` —
    `selectMatchingParseDiagnosticsPolicyPreset` for canonical strict/balanced
    shapes, permissive disable-only matching, whitespace tolerance, custom
    fallback (severity mismatch, extra threshold key, value mismatch, invalid
    threshold entry).
  - `apps/desktop/src/policyPresetHint.spec.ts` — `summarizePolicyAuditTrail`
    counts (total/hydrated/parseLint/resetEvents),
    `classifyPolicyAuditTrailEntry` (parse_/lint_ → `parse_lint`, reset → `reset`,
    unknown → `policy`), `filterPolicyAuditTrailByCategory` per-category routing
    plus the `all` copy.
- Playwright E2E:
  - `apps/desktop/e2e/parse-diagnostics-policy.e2e.ts` — active-match indicator
    test verifies `aria-pressed="true"` migrates between chips, the badge text
    matches the localized preset label, and editing the threshold flips the
    badge to `custom`.
  - `apps/desktop/e2e/policy-core.e2e.ts` — audit-trail clear-with-confirm
    (cancel keeps existing rows; accept leaves only `policy_audit_trail_cleared`),
    `count` extras presence, and filter chip toggles confirming reset/parse_lint
    routing.

## Lint Surface + CLI Streaming + Demo Parity

This wave closes three Known Gaps in one motion: it routes controller-grammar
lints through `runJobCheck` / CLI envelope, adds streaming + utility flags to
the CLI, and ships a Haas-legacy lint demo program. It also re-exports the
preset resolver from the Node entrypoints so headless consumers can mirror the
desktop policy chips without reaching into internal modules.

### Lint surface in `RunJobCheckResult` and CLI envelope

`runJobCheckWorkflow` now runs `simpleLint(ast)` (which already includes the
controller-grammar rule pack) and wraps the result via `withLintProvenance` so
each issue carries a `provenance.source` tag (`lexer`, `expression_parser`,
`controller_grammar`, `common_lint`, `profile_lint`). Result shape extension:

```ts
type RunJobCheckResult = {
  // ...existing fields...
  lintIssues: LintIssueWithProvenance[];
  lintIssuesSummary: {
    total: number;
    blockers: number;
    warnings: number;
    bySource: Partial<Record<LintIssueProvenanceSource, number>>;
    topSources: LintIssueProvenanceSource[];
  };
};
```

The CLI envelope appends two new keys (still under `schemaVersion: 1`, so
old/new consumers stay compatible — append-only):

```jsonc
{
  "schemaVersion": 1,
  /* ...readyToRunScore, blockerCount, warningCount, blocked, messages,
        parseDiagnosticsSummary, parseDiagnosticsPolicyBreaches as before... */
  "lintIssuesSummary": {
    "total": 4,
    "blockers": 0,
    "warnings": 4,
    "bySource": { "controller_grammar": 3, "common_lint": 1 },
    "topSources": ["controller_grammar", "common_lint"]
  },
  "controllerLints": [
    {
      "severity": "warning",
      "message": "...",
      "blockIndex": 3,
      "provenance": { "source": "controller_grammar", "relatedDiagnostics": [] }
    }
  ],
  "setupSheetExportTxt": "...",
  "proveoutCode": "..."
}
```

`controllerLints` is the subset of `lintIssues` filtered to
`provenance.source === "controller_grammar"` so headless consumers can route on
Fanuc-strict / Haas-strict findings without re-running the lint pipeline.

`setupSheet.exportTxt` (and the matching markdown) and `proveout.code` now
include a deterministic single-line block:

```
LINT ISSUES
lintIssues: total=4 | severities=blocker:0,warning:4 | top=controller_grammar,common_lint | bySource=controller_grammar=3 common_lint=1
```

…mirroring the `parseDiagBreaches:` block format exactly so brief-field parsers
can keep using the same line layout.

### CLI streaming + utility flags: `--format ndjson`, `--schema-version`, `--quiet`

The CLI gains three new flags:

- `--format ndjson` — emits the same `CliJobCheckEnvelope` as `--format json`,
  but as one self-contained line instead of pretty-printed JSON. For
  `--input-dir`, NDJSON emits one `{ schemaVersion, input, envelope }` line per
  file with no top-level `summary` object so downstream pipes can stream
  results homogeneously.
- `--schema-version` — prints `cnc-job-check schema=1\n` to stdout and exits
  `0` without running anything. CI and packaging scripts can use this as a
  cheap "is this build new enough?" probe.
- `--quiet` — suppresses non-fatal stderr messages: the strict-block hint and
  the `No .nc/.tap/.gcode files found` notice. Genuine I/O failures (missing
  `--input` file, unwritable `--out`) still surface to stderr so debugging
  stays possible.

Examples:

```bash
# Probe the build's schema version
$ cnc-job-check --schema-version
cnc-job-check schema=1

# Stream a directory as NDJSON for downstream tooling
$ cnc-job-check --input-dir ./shop --format ndjson | jq -c .summary
# (no .summary line in NDJSON — one envelope per line, homogeneous stream)

# Strict CI gate with a quiet stderr (exit code is what matters here)
$ cnc-job-check --input job.nc --policy-preset strict --strict --quiet
# exit code 1 if blocked; stdout still contains the JSON envelope
```

### Haas-legacy lint demo parity

`selectLintDemoProgram("haas-legacy")` now returns
`LINT_DEMO_PROGRAM_HAAS_LEGACY`, a legacy-specific program exercising legacy
idioms (`M97 P10` local-subprogram call, `M88` / `M89` through-spindle coolant,
`G187 P3 E0.0005` tolerance, terse decimals like `X1./F100.` to trigger
suggested fixes). Loading it from the desktop UI records a `lint_demo_loaded`
audit entry with `code=override=haas-legacy`. The Haas NGC ("auto") demo
remains unchanged.

### Node API re-exports + boundary stability

`@cnc/core/node` (and `@cnc/core/browser`) now re-export the policy preset
resolver and its id list so headless consumers can mirror the desktop chips
without touching internal `workshop/` paths:

```ts
import {
  PARSE_DIAGNOSTICS_POLICY_PRESET_IDS,
  resolveParseDiagnosticsPolicyPreset
} from "@cnc/core/node";

const strict = resolveParseDiagnosticsPolicyPreset("strict");
// → { severity: "blocker", blockExport: true, thresholds: { TOTAL: 0 } }
```

`LintIssue`, `LintIssueWithProvenance`, `LintIssueProvenance`,
`LintIssueProvenanceSource`, and the new `LintIssuesSummary` all flow through
`export type * from "./types.js"` so consumers can type their pipelines
end-to-end.

### Test pointers

- Unit:
  - `packages/core/tests/core.spec.ts` — `lintIssuesSummary` zero-form on a
    clean program, controller_grammar findings on a malformed Fanuc program,
    `LINT ISSUES` block format guard on setupSheet + proveout, public-surface
    smoke test importing `resolveParseDiagnosticsPolicyPreset`,
    `PARSE_DIAGNOSTICS_POLICY_PRESET_IDS`, and `lintWithProvenance` from
    `../src/index.node.js`.
  - `packages/core/tests/cli.spec.ts` — `--schema-version` shape, `--format
    ndjson` single-input single-line output, `--format ndjson --input-dir`
    homogeneous N-line stream (no `summary`), `--quiet --strict` blocked path
    suppresses the strict-block hint, `--quiet --input-dir` empty-dir notice
    suppression, malformed Fanuc populates `controllerLints` +
    `lintIssuesSummary` with `provenance.source: "controller_grammar"`.
  - `apps/desktop/src/parseDiagnosticsView.spec.ts` —
    `selectLintDemoProgram("haas-legacy") === LINT_DEMO_PROGRAM_HAAS_LEGACY`,
    legacy-marker assertions (`M97 P10`, `M88`, `M89`, `G187 P3 E0.0005`),
    distinctness vs. `LINT_DEMO_PROGRAM` and `LINT_DEMO_PROGRAM_FANUC`.
- Playwright E2E:
  - `apps/desktop/e2e/parse-diagnostics-policy.e2e.ts` — Haas-legacy demo
    selection: setting the controller-override select to `haas-legacy` and
    clicking Load lint demo loads the program with `M97 P10`, `M88`, `M89`,
    and `G187 P3 E0.0005`; the `lint_demo_loaded` audit row contains
    `code=override=haas-legacy`.

## Lint UX Completion + Profile Lints + Recursive Walk + Audit Export Formats

This wave closes five long-standing gaps so the lint surface is now first-class
across the desktop card, the CLI envelope, and the audit-trail clipboard
export — and the `expression_parser` provenance source finally has a real
producer.

### 1) `lintIssuesSummary` chip in the desktop Job Check card

Run-Job-Check now renders a canonical lint roll-up directly inside the result
card, immediately after the parse-diagnostics summary line. The chip is
backed by `formatLintIssuesSummaryChip` in
`apps/desktop/src/parseDiagnosticsView.ts` and uses the exact wire format
emitted by `formatLintIssuesSummaryBlock` in
`packages/core/src/workshop/exportBundle.ts`, so desktop / setup-sheet /
proveout / CLI all agree byte-for-byte:

```
lintIssues: total=4 | severities=blocker:1,warning:3 | top=controller_grammar,common_lint
```

The chip carries `data-testid="job-check-lint-summary-chip"`. Severity wording
sticks to `blocker` / `warning` (no separate `errors` term) to match the
canonical `LintIssuesSummary.blockers` / `.warnings` fields.

### 2) Profile-specific lints flow through the CLI envelope

`runOnce` in `packages/core/src/cli.ts` now dynamically imports
`@cnc/profile-haas-ngc` when `--controller haas-ngc`, calls
`haasNgcProfile.validateAst(ast)`, and forwards the result via
`RunJobCheckInput.profileLintIssues`. `@cnc/profile-haas-ngc` was promoted
from `devDependencies` to `dependencies` in `packages/core/package.json` so
the import is resolvable at runtime in any consumer install.

CLI consequence: on Haas-NGC programs that trigger profile rules, the JSON
envelope's `lintIssuesSummary.bySource.profile_lint` is now non-zero, e.g.

```
$ node packages/core/dist/cli.js --input some-haas-ngc.nc --controller haas-ngc | jq .lintIssuesSummary.bySource
{
  "controller_grammar": 0,
  "profile_lint": 1
}
```

Negative path: `--controller fanuc` does NOT pull profile lints (no Haas
dependency invoked), so `bySource.profile_lint` stays `0`. `controllerLints`
remains filtered to `provenance.source === "controller_grammar"` and is
unaffected. Coverage: `packages/core/tests/cli.spec.ts`.

### 3) `--recursive` walk for `--input-dir`

The CLI now supports a `--recursive` flag that walks subtrees of
`--input-dir` using `readdir(dir, { withFileTypes: true })`. Without
`--recursive`, only direct children matching `BATCH_INPUT_EXTENSIONS`
(`/\.(nc|tap|gcode)$/i`) run, exactly as before. Output ordering is stable
lexicographic on the full path so NDJSON streams diff cleanly between runs.

```
$ node packages/core/dist/cli.js --input-dir packages/test-fixtures --recursive --format ndjson | wc -l
17
```

`CliIo` gained an optional `readDirEntriesFn` for tests that want to inject a
synthetic directory tree without touching the filesystem; the default falls
back to `withFileTypes: true`. Coverage:
`packages/core/tests/cli.spec.ts` (top-level only vs recursive, extension
filter at depth, deterministic ordering).

### 4) Markdown / CSV audit-trail clipboard export + format select

`selectPolicyAuditTrailExportPayload(entries, options)` in
`apps/desktop/src/policyPresetHint.ts` is the single source of truth for
audit-trail clipboard payloads. It accepts
`format: "text" | "markdown" | "csv"` and an optional `categoryFilter`. The
plain-text format is byte-for-byte identical to the legacy
`formatPolicyAuditTrailPayload` (parity asserted in
`apps/desktop/src/policyPresetHint.spec.ts`).

Sample shapes (2-row input):

```
# text
AUDIT | 2026-05-01T22:00:00.000Z | event=parse_diag_policy_preset_applied preset=strict source=manual controller=haas-ngc | code=TOTAL
AUDIT | 2026-05-01T22:01:00.000Z | event=parse_breach_copied preset=strict source=manual controller=haas-ngc | count=2 | severities=blocker:2

# markdown
| Time | Event | Preset | Source | Controller | Extras |
| --- | --- | --- | --- | --- | --- |
| 2026-05-01T22:00:00.000Z | parse_diag_policy_preset_applied | strict | manual | haas-ngc | code=TOTAL |
| 2026-05-01T22:01:00.000Z | parse_breach_copied | strict | manual | haas-ngc | count=2 \| severities=blocker:2 |

# csv
time,event,preset,source,controller,code,blockIndex,fixCount,count,severities
2026-05-01T22:00:00.000Z,parse_diag_policy_preset_applied,strict,manual,haas-ngc,TOTAL,,,,
2026-05-01T22:01:00.000Z,parse_breach_copied,strict,manual,haas-ngc,,,,2,blocker:2
```

CSV escaping: any field containing `"`, `,`, `\r`, or `\n` is wrapped in
double quotes with internal `"` doubled. Empty optional fields stay empty
(no quoting).

UI-side: a small `<select data-testid="policy-audit-trail-export-format">`
chip lives in the audit-trail control cluster (Text / Markdown / CSV). The
choice is persisted in `templateJson.uiDefaults.<controller>.auditTrailExportFormat`
so it survives reload (mirrors `lintDemoControllerOverride`). Both the
"Copy policy audit trail" and the parse/lint-only subset copy buttons read
the same selected format. The audit telemetry emits the chosen format in
the `severities` extras field, e.g. `severities=format=markdown` or
`severities=subset=parse_lint;format=csv`.

### 5) `expression_parser` provenance producer

`sourceForIssue` in `packages/core/src/lints/lintProvenance.ts` now routes
any lint message containing `bracket expression`, `Bracket expression`, or
`Unbalanced bracket` into `provenance.source: "expression_parser"`. To make
that source reachable from real input, `simpleLint` gained a tiny
bracket-balance scan (paired with the existing `()` scanner) that emits:

```
Unbalanced bracket expression — controller may alarm or evaluate incorrectly.
```

Example triggering input:

```
G1 X[1+2 Y2
M30
```

The resulting envelope contains:

```
"lintIssuesSummary": {
  "bySource": { "expression_parser": 1, "common_lint": 0, ... },
  "topSources": ["expression_parser"]
}
```

### Test pointers

- Vitest:
  - `packages/core/tests/cli.spec.ts` — `--recursive` flag parsing, top-level
    vs. nested fixture walk with deterministic ordering and extension filter
    at depth; `--controller haas-ngc` populates
    `lintIssuesSummary.bySource.profile_lint`; `--controller fanuc` stays at
    `profile_lint=0`.
  - `packages/core/tests/core.spec.ts` — bracket-imbalance lint emits
    `provenance.source: "expression_parser"` and increments
    `lintIssuesSummary.bySource.expression_parser`.
  - `apps/desktop/src/parseDiagnosticsView.spec.ts` — `formatLintIssuesSummaryChip`
    canonical zero-form line and severities/top rendering.
  - `apps/desktop/src/policyPresetHint.spec.ts` — `selectPolicyAuditTrailExportPayload`
    text-byte-parity vs `formatPolicyAuditTrailPayload`, canonical first/last
    lines for markdown + CSV, CSV escaping for `,` / `"` / newline,
    headers-only output for empty input.
- Playwright E2E:
  - `apps/desktop/e2e/parse-diagnostics-policy.e2e.ts` — Job Check card
    chip visible with regex-matched canonical line after Run Job Check.
  - `apps/desktop/e2e/lint-fix-audit.e2e.ts` — selecting `markdown` in the
    export-format chip and clicking Copy emits a Markdown table; the
    resulting `policy_audit_trail_copied` audit row contains
    `severities=format=markdown`.

## Lint Drilldown + CLI Globs + NDJSON Audit + Profile Registry + Schema v2

This wave drains the four Known Gaps left by the previous wave and bumps
the CLI envelope to `schemaVersion: 2` with an append-only per-source lint
breakdown. None of these changes are breaking — every existing v1 consumer
keeps working.

### 1) Per-source drilldown in the Job Check card

`summarizeLintIssuesBySource` (in
`apps/desktop/src/parseDiagnosticsView.ts`) returns
`Array<[LintIssueProvenanceSource, number]>` ordered by `topSources` first
(preserving the chip's `top=` ordering), then by count desc, then by the
canonical `LINT_ISSUE_SOURCE_ORDER` for ties. The Job Check card renders a
collapsed `<details data-testid="job-check-lint-summary-drilldown">` right
under the chip that lists each source as:

```
controller_grammar: 3 (blocker:1, warning:2) — Controller grammar
profile_lint: 1 (blocker:0, warning:1) — Profile lint
```

Each row carries `data-testid="job-check-lint-summary-source-<source>"` for
stable E2E selectors. The drilldown is suppressed entirely when
`lintIssuesSummary.total === 0` so the empty-state stays minimal. Source
labels reuse the existing `t.lintIssuesGroupSourceLabels[source]` map.

### 2) `--include` / `--exclude` globs for `--input-dir`

The CLI now supports two repeatable flags that filter directory walks:

- `--include <glob>` — when present, REPLACES the
  `BATCH_INPUT_EXTENSIONS` floor. Without `--include`, the CLI keeps its
  default `/\.(nc|tap|gcode)$/i` filter.
- `--exclude <glob>` — wins over both `--include` and the extension floor.

Glob grammar (private to the CLI, no third-party deps):

| Token | Meaning |
| ----- | ------- |
| `*` | Matches any non-`/` character run |
| `**/` | Matches zero or more directory segments |
| `**` | Matches anything (including `/`) |
| `?` | Matches a single non-`/` character |
| `[abc]` | Bracket character class (passes through to regex) |

Globs are matched against forward-slash-normalized paths relative to
`--input-dir`, so behavior is consistent on Windows. Examples:

```
# default extensions only
$ cnc-job-check --input-dir programs/

# customer suffix instead of defaults
$ cnc-job-check --input-dir programs/ --include "*.cnc"

# walk subtrees but skip drafts
$ cnc-job-check --input-dir programs/ --recursive --exclude "**/draft/*"

# combine: only .nc anywhere, but never under sub/
$ cnc-job-check --input-dir programs/ --recursive \
    --include "**/*.nc" --exclude "**/sub/*"
```

Coverage: `packages/core/tests/cli.spec.ts`.

### 3) NDJSON audit-trail clipboard export

`selectPolicyAuditTrailExportPayload` (in
`apps/desktop/src/policyPresetHint.ts`) now accepts
`format: "ndjson"` in addition to `text`/`markdown`/`csv`. The payload is
one JSON object per line, identical-shape with `selectPersistableAuditEntries`:
required fields always present, optional fields (`code`, `blockIndex`,
`fixCount`, `count`, `severities`) omitted when `undefined`, and special
characters round-trip through `JSON.parse`. Empty input emits an empty
string (no header line, unlike md/csv).

```jsonl
{"timestampIso":"2026-05-01T22:00:00.000Z","event":"parse_diag_policy_preset_applied","preset":"strict","source":"manual","controller":"haas-ngc","code":"TOTAL"}
{"timestampIso":"2026-05-01T22:01:00.000Z","event":"parse_breach_copied","preset":"strict","source":"manual","controller":"haas-ngc","count":2,"severities":"blocker:2"}
```

The `<select data-testid="policy-audit-trail-export-format">` chip in the
audit-trail control cluster picks up an `NDJSON` option (label canonical in
both PL and EN). Persistence and the `severities=format=ndjson` audit
extras flow through unchanged (the `isAuditTrailExportFormat` predicate
already gates persistence).

### 4) Dynamic profile registry in the CLI (Fanuc-ready)

`loadProfileLintIssues` in `packages/core/src/cli.ts` is now backed by a
typed registry:

```typescript
type CliProfileLintLoader = (ast: ProgramAst) => Promise<LintIssue[] | undefined>;

const PROFILE_LINT_LOADERS: Partial<Record<CliControllerKey, CliProfileLintLoader>> = {
  "haas-ngc": async (ast) => { /* dynamic import @cnc/profile-haas-ngc */ }
  // "fanuc": async (ast) => { /* dynamic import @cnc/profile-fanuc-iso */ }
};
```

Behavior is unchanged for shipping controllers (`haas-ngc` still pulls in
`@cnc/profile-haas-ngc.haasNgcProfile.validateAst`; `fanuc` and
`haas-legacy` stay at `bySource.profile_lint = 0`), but adding a future
profile package is now a single `import` line. The registry contract
(`CliProfileLintLoader`) is exported so future profiles can document the
hook explicitly.

### 5) Envelope schema v2: `lintIssuesBySource`

`CLI_SCHEMA_VERSION` bumped from `1` to `2`. The envelope grew one
append-only field:

```typescript
export type CliLintIssuesBySourceEntry = {
  source: LintIssueProvenanceSource;
  count: number;
  blockers: number;
  warnings: number;
};
// Inside CliJobCheckEnvelope:
lintIssuesBySource: CliLintIssuesBySourceEntry[];
```

`lintIssuesBySource` is computed inside `buildJobCheckEnvelope`, so JSON,
NDJSON, and batch outputs all benefit. Ordering matches the desktop
helper from move 1 (topSources first, then count desc, then canonical
order). For consumers, the field is a strict superset of
`lintIssuesSummary.bySource` (`count` is identical) augmented with
severity sub-counts. The change is read-only and append-only:

- v1 readers ignore the new field automatically (JSON parsers don't fail
  on extra keys).
- v2 readers can opt-in lazily; `lintIssuesSummary.bySource` is preserved
  as the canonical `Record<source, count>` shape.
- `cnc-job-check --schema-version` now prints
  `cnc-job-check schema=2`.

```
$ cnc-job-check --input fixture.nc | jq .lintIssuesBySource
[
  { "source": "controller_grammar", "count": 3, "blockers": 1, "warnings": 2 },
  { "source": "profile_lint",       "count": 1, "blockers": 0, "warnings": 1 }
]
```

### Test pointers

- Vitest:
  - `apps/desktop/src/parseDiagnosticsView.spec.ts` —
    `summarizeLintIssuesBySource` ordering rules (topSources first, count
    desc, canonical order) + zero-count filtering.
  - `apps/desktop/src/policyPresetHint.spec.ts` — NDJSON one-line-per-entry
    output, optional-field omission, special-character JSON round-trip,
    empty-input no-header-line behavior.
  - `packages/core/tests/cli.spec.ts` — `--include` replaces the extension
    floor; `--exclude` precedence over `--include` and the floor;
    `parseCliArgs` accumulates repeated flags; envelope schema v2
    consistency check (`lintIssuesBySource` mirrors
    `lintIssuesSummary.bySource`); `--controller haas-legacy` keeps
    `profile_lint=0` (registry contract).
- Playwright E2E:
  - `apps/desktop/e2e/parse-diagnostics-policy.e2e.ts` — drilldown
    `<details>` reveals at least one
    `[data-testid^="job-check-lint-summary-source-"]` row matching
    `^[a-z_]+: \d+ \(blocker:\d+, warning:\d+\)`.
  - `apps/desktop/e2e/lint-fix-audit.e2e.ts` — NDJSON copy: each clipboard
    line is `JSON.parse`-able and the `policy_audit_trail_copied` audit
    row contains `severities=format=ndjson`.

## Fanuc Profile + CLI --out-dir + Setup-Sheet Histogram + Audit-Trail Download + Schema v3

This wave drains all five Known Gaps left by the previous wave and bumps
the CLI envelope to schema v3. Every change is append-only and backwards
compatible with consumers running on schema v2 (or v1) payloads.

### Move 1 — `@cnc/profile-fanuc-iso` profile package (CLI registry, second entry)

A new workspace package
[`packages/profiles/fanuc-iso/`](packages/profiles/fanuc-iso/)
mirrors the layout of `@cnc/profile-haas-ngc`. It exports
`fanucIsoProfile` (`ControllerProfile`) and `lintFanucIsoMill`. The
shipping rule warns when a Fanuc-style program lacks an explicit
`O####` program-number header before the first motion block:

```text
Fanuc program lacks an explicit O#### program-number header before the first motion block — most Fanuc controls expect O followed by a numeric program ID.
```

The CLI registry stub in
[`packages/core/src/cli.ts`](packages/core/src/cli.ts)
(`PROFILE_LINT_LOADERS`) gained a real `fanuc` entry, swallowing import
errors so the CLI never blocks if a profile package is missing at install
time. `@cnc/profile-fanuc-iso` is a `dependency` of `@cnc/core`; the root
`build` script builds it after `@cnc/core` and before `@cnc/desktop`.
Coverage:

- `packages/profiles/fanuc-iso/tests/fanucIsoMill.spec.ts` — six unit
  tests covering positive/negative O-header cases, comment-only programs,
  N-only sequence-number leaders, and idempotence on empty input.
- `packages/core/tests/cli.spec.ts` — contract tests:
  - `--controller fanuc` on a no-O-header Fanuc program emits at least
    one `profile_lint` issue and `lintIssuesBySource` includes a
    `profile_lint` entry.
  - `--controller fanuc` on a Fanuc program WITH an O-header emits zero
    `profile_lint` issues (Haas-only G43-without-H rule must NOT cross
    over).
  - `--controller haas-legacy` (no registered loader) keeps
    `profile_lint=0` regardless of program shape (cross-controller
    registry contract).

### Move 2 — CLI `--out-dir <path>` for per-file batch writes

`--out-dir` mirrors the relative tree under `--input-dir`, writing one
rendered file per input. Filename derivation:
`<out-dir>/<rel-path-stripped-extension>.<ext>` where `<ext>` is
`.json` / `.ndjson` / `.txt` driven by `--format`. Parent directories are
created with `mkdir({recursive:true})`. Defense in depth:

- `--out` and `--out-dir` are mutually exclusive (parser-level
  `CliArgumentError` → exit 2).
- `--out-dir` requires `--input-dir` (per-file output is batch-only).
- A path that resolves outside the input root (`..` segments or absolute
  filenames sneaking in via injected IO) is rejected:
  `cnc-job-check: refusing to write outside --out-dir (input … resolved outside --input-dir)`
  → exit 2.
- A short stdout summary line replaces the consolidated payload:
  `cnc-job-check: wrote <N> files to <out-dir>` (suppressed by `--quiet`).

`CLI_USAGE` was extended with one alphabetized line near `--out`. Tests
in [`packages/core/tests/cli.spec.ts`](packages/core/tests/cli.spec.ts):

- 3-file recursive tree + `--out-dir` + `--format json` writes 3
  parseable envelopes mirroring the relative tree.
- `--format ndjson` writes one JSON envelope per `.ndjson` file.
- `--out` + `--out-dir` exits with code 2 and the documented stderr
  message.
- An injected `readDirEntriesFn` returning `../escape.nc` triggers the
  refusal message and exit 2 (no writes).

### Move 3 — Per-source severity histogram in `setupSheet.exportTxt`

`LintIssuesSummary` gained an optional `bySourceSeverity` field
(`Partial<Record<source, { blockers, warnings }>>`) that
`summarizeLintIssues` now populates with sub-counts that always sum to
`bySource[source]`. `formatLintIssuesSummaryBlock` returns an additional
optional `histogram?: { txt; md }` field, populated only when ≥2 sources
contributed (single-source case stays as the existing one-line rollup,
which keeps `proveout.code` clean — proveout intentionally only consumes
`txt`, not the histogram).

The setup sheet appends the histogram block right under the existing
rollup line:

```text
LINT ISSUES
lintIssues: total=4 | severities=blocker:1,warning:3 | top=controller_grammar,profile_lint | bySource=...
  controller_grammar  ##########  3 (blocker:1, warning:2)
  profile_lint        ###          1 (blocker:0, warning:1)
```

Bars are scaled to the max-count source and capped at 10 `#` characters.
Source ordering matches `summarizeLintIssuesBySource`: `topSources` first,
then count desc, then canonical order. Tests in
[`packages/core/tests/core.spec.ts`](packages/core/tests/core.spec.ts)
cover `bySourceSeverity` sub-count consistency, the no-histogram-on-
single-source guard, the bar scaling, and live-pipeline assertions
against `result.setupSheet.exportTxt`.

### Move 4 — Audit-trail file download (browser-native, no Electron)

[`apps/desktop/src/auditTrailDownload.ts`](apps/desktop/src/auditTrailDownload.ts)
ships a small helper `downloadPolicyAuditTrail(payload, format,
timestampIso)` that creates a `Blob` with the right MIME, builds an
object URL, programmatically clicks an injected `<a download>`, and
revokes the URL after a microtask. No new runtime dependencies — pure
browser plumbing. Filename pattern:
`cnc-audit-trail-YYYYMMDDTHHMMSS.<ext>` (extension by format:
`.txt`/`.md`/`.csv`/`.ndjson`).

The desktop UI gained a sibling `Download audit trail` button next to the
existing Copy buttons, sharing the same `auditTrailExportFormat` state
and `selectPolicyAuditTrailExportPayload` payload. Telemetry mirrors the
copy events: a new `policy_audit_trail_downloaded` row records
`severities=format=<format>` and `count=<rowCount>`.

Coverage:

- 10 unit tests in
  [`apps/desktop/src/auditTrailDownload.spec.ts`](apps/desktop/src/auditTrailDownload.spec.ts)
  covering MIME / extension uniqueness, ISO timestamp formatting + fallback,
  Blob assembly per format, anchor click + revoke ordering, and
  filename-echo behavior.
- One Playwright E2E in
  [`apps/desktop/e2e/lint-fix-audit.e2e.ts`](apps/desktop/e2e/lint-fix-audit.e2e.ts)
  that stubs `URL.createObjectURL` / `revokeObjectURL` /
  `document.createElement('a')` via `addInitScript`, clicks the new
  download button, and asserts the captured MIME, filename, click count,
  revoke count, and audit-trail telemetry row.

### Move 5 — CLI envelope schema v3 with `parseDiagnosticsByCode`

`CLI_SCHEMA_VERSION` bumped from 2 to 3; `--schema-version` now prints
`cnc-job-check schema=3`. `CliJobCheckEnvelope` gained an append-only
`parseDiagnosticsByCode: CliParseDiagnosticsByCodeEntry[]` field where
each entry is `{ code: string; count: number; warnings: number;
errors: number }`. The shape is a strict superset of
`parseDiagnosticsSummary.byCode`, augmented with severity sub-counts:

```json
{
  "schemaVersion": 3,
  "parseDiagnosticsByCode": [
    { "code": "UNMATCHED_OPEN_PAREN", "count": 2, "warnings": 2, "errors": 0 },
    { "code": "UNMATCHED_BRACKET",    "count": 1, "warnings": 1, "errors": 0 }
  ]
}
```

Naming note: the previous wave's "Known Gaps" entry called this
`parseDiagnosticsBySource`, but `ParseDiagnostic` is keyed by `code`
(not `source` — see
[`packages/core/src/types.ts`](packages/core/src/types.ts) `ParseDiagnostic`),
so the shipping field uses the more accurate
`parseDiagnosticsByCode` name.

The plumbing change: `ParseDiagnosticsSummary` gained an optional
`bySeverity?: Record<string, { warnings; errors }>` populated by
`summarizeParseDiagnostics`; the CLI envelope reads from this enriched
summary so `RunJobCheckResult` itself stays unchanged. Sort order:
count desc, then code ascending. Tests in
[`packages/core/tests/cli.spec.ts`](packages/core/tests/cli.spec.ts):

- Updated key-order assertion to include `parseDiagnosticsByCode`.
- `parseDiagnosticsByCode` is consistent with
  `parseDiagnosticsSummary.byCode` on every run; severity sub-counts sum
  to `count` per entry; total across entries equals
  `parseDiagnosticsSummary.total`.
- Empty array on a clean program (no parse diagnostics).
- Entries are ordered count desc, then code asc.
- `--schema-version` literal output asserts both `CLI_SCHEMA_VERSION` and
  the literal string `cnc-job-check schema=3` (drift sentinel).

## Fanuc Catalog + --out-dir-format + Setup-Sheet PDF + Audit Sidecar + Schema v4

This wave drained the five Known Gaps left by the prior wave. Every
change is strictly append-only — no public-API removals, no enum
tightening — and was driven from
`.cursor/plans/next_5_moves_wave_210656b2.plan.md`.

### 1. Fanuc profile coverage expansion

`lintFanucIsoMill` (in
[`packages/profiles/fanuc-iso/src/fanucIsoMill.ts`](packages/profiles/fanuc-iso/src/fanucIsoMill.ts))
now ships three additional Fanuc-distinct rules that were previously
covered only by docstring guidance:

- **`G65 missing P` (warning)** — any `G65` block without an explicit
  `P` (program-number) word.
- **`G65 non-integer L` (warning)** — `G65` block whose `L` (loop
  count) word is fractional or negative. Macro-variable / bracketed
  expression `L` values are intentionally ignored — those are resolved
  at run time.
- **`T0 cancel without preceding tool change` (warning)** — first
  appearance of `T0` (tool cancel) before any prior `Tn` (`n>0`).

Coverage: positive + negative case per rule in
[`packages/profiles/fanuc-iso/tests/fanucIsoMill.spec.ts`](packages/profiles/fanuc-iso/tests/fanucIsoMill.spec.ts);
end-to-end contract test in
[`packages/core/tests/cli.spec.ts`](packages/core/tests/cli.spec.ts)
exercising `G65 missing P` via `--controller fanuc` and asserting the
finding lands in `lintIssuesBySource.profile_lint`.

### 2. CLI `--out-dir-format <format>:<ext>`

Repeatable per-format extension override that pairs with `--out-dir`.
`<format>` MUST be one of `json` / `text` / `ndjson`; `<ext>` MUST
start with a literal `.`. Standalone use (without `--out-dir`) exits
2 with the documented message.

```text
cnc-job-check --input-dir ./programs --out-dir ./out \
  --format json --out-dir-format json:.envelope.json
```

writes `./out/<name>.envelope.json` files instead of the default
`.json`. Internally `outputExtensionForFormat` was refactored to take
an optional override map; default behavior is unchanged when no
override is supplied.

### 3. Setup-sheet PDF export

New module
[`packages/core/src/workshop/setupSheetPdf.ts`](packages/core/src/workshop/setupSheetPdf.ts)
exposes `buildSetupSheetPdf(setupSheet, options?)` returning a hand-
rolled minimal PDF1.4 byte sequence (zero new dependencies, browser-
safe `Uint8Array`). Uses the built-in Helvetica font (one of the 14
PDF standard fonts every reader bundles, so no font embedding is
needed). When `options.lintIssuesSummary` carries lint issues from
≥2 distinct sources, the PDF appends a per-source severity histogram
as actual filled rectangles below the body text.

A new CLI flag `--export-setup-sheet-pdf <path>` writes the PDF to
disk in single-`--input` mode (rejected with `--input-dir` — per-input
batch PDF is intentionally a future increment). The helper is also
re-exported from
[`packages/core/src/index.node.ts`](packages/core/src/index.node.ts)
as `buildSetupSheetPdf` for future desktop wiring.

### 4. Audit-trail SHA-256 sidecar

[`apps/desktop/src/auditTrailDownload.ts`](apps/desktop/src/auditTrailDownload.ts)
now exports `computeAuditTrailSha256(payload)` (Web Crypto
`subtle.digest("SHA-256", …)` → lower-case hex) plus
`buildAuditTrailSidecarFilename` / `buildAuditTrailSidecarBody`
helpers that emit BSD-`shasum` / GNU-`sha256sum` compatible
`<hex>  <name>\n` records.

`downloadPolicyAuditTrail` now accepts `{ withSidecar?: boolean }` and
returns `{ filename, sidecarFilename? }`. When `withSidecar: true`,
a second download named `<filename>.sha256` fires after the main
download, using the SHA-256 of the payload.

In the desktop UI, a checkbox
`data-testid="policy-audit-trail-download-with-sidecar"` (i18n keys
`auditTrailDownloadSidecarLabel` and
`auditTrailDownloadSidecarStatus`) sits next to the existing download
button. When checked, the click handler awaits the digest, fires the
sidecar, and records `policy_audit_trail_downloaded_with_sidecar`
telemetry with `severities=format=<format>;sidecar=sha256` (mirroring
the existing event shape).

E2E coverage in
[`apps/desktop/e2e/lint-fix-audit.e2e.ts`](apps/desktop/e2e/lint-fix-audit.e2e.ts)
stubs `URL.createObjectURL` + `crypto.subtle.digest` via
`addInitScript` and asserts both anchor clicks fire and the sidecar
audit row is recorded.

### 5. CLI envelope schema v4 + `lintIssuesByParseDiagCode` cross-table

`CLI_SCHEMA_VERSION` bumped from `3` to `4`; `--schema-version` now
prints `cnc-job-check schema=4`. New append-only field
`lintIssuesByParseDiagCode: CliLintIssuesByParseDiagCodeEntry[]` on
`CliJobCheckEnvelope`. Each entry has shape `{ source, code, count }`
and is built by aggregating
`result.lintIssues[].provenance.relatedDiagnostics[].code`. Sorted by
`count` desc, then `source` asc, then `code` asc. Every `(source,
code)` pair appears at most once. Empty array when no lint issue
references any parse diagnostic.

Tests updated:

- Key-list assertion includes `lintIssuesByParseDiagCode`.
- `--schema-version` literal output asserts both
  `CLI_SCHEMA_VERSION` and the literal `cnc-job-check schema=4`
  (drift sentinel).
- Empty cross-table on a clean program.
- Populated + uniqueness + count-bound on a parse-diag-rich program.
- Ordering invariant (count desc, source asc, code asc).

## Profile-Pack Docs + PDF Batch + HMAC Sidecar + Schema v5 Cross-Table + Registry Auto-Discovery

This wave drained the five Known Gaps left by the prior wave. Every
change is strictly append-only — no public-API removals, no enum
tightening — and was driven from
`.cursor/plans/next_5_moves_wave_a5ddcab8.plan.md`.

### 1. Auto-generated profile-pack documentation

Each profile pack now ships a structured `ProfileRuleDoc` registry
next to its lint module:

- [`packages/profiles/haas-ngc/src/rules.meta.ts`](packages/profiles/haas-ngc/src/rules.meta.ts)
  exports `haasNgcRuleDocs` (10 rules).
- [`packages/profiles/fanuc-iso/src/rules.meta.ts`](packages/profiles/fanuc-iso/src/rules.meta.ts)
  exports `fanucIsoRuleDocs` (4 rules).
- The shared `ProfileRuleDoc` type lives in
  [`packages/core/src/types.ts`](packages/core/src/types.ts).

A new Node-only generator
[`scripts/generate-profile-pack-docs.mjs`](scripts/generate-profile-pack-docs.mjs)
imports both registries, runs each pack's `validateAst` against every
rule's `positiveSnippet` / `negativeSnippet`, asserts the matcher
fires on positive and not on negative, and emits
[`PROFILE_PACKS.md`](PROFILE_PACKS.md). Wired in via the
`docs:profile-packs` npm script and chained at the end of the root
`verify` script so PRs that break a snippet (or skip docs entirely
for a new code-emitting rule) fail loudly.

Per-pack contract tests cover every registry entry and run as part
of each pack's own `npm test`. The root `test` script now also runs
the haas-ngc package (which previously had no `test` script).

### 2. CLI `--export-setup-sheet-pdf-batch <dir>`

Batch counterpart to `--export-setup-sheet-pdf`. Requires
`--input-dir`, mutually exclusive with the single-input flag. Reuses
`buildSetupSheetPdf` and `resolveOutDirTarget`, so:

```text
cnc-job-check --input-dir ./programs --recursive \
  --export-setup-sheet-pdf-batch ./pdfs
```

writes one `<basename>.pdf` per input under `./pdfs`, mirroring the
relative tree under `--input-dir`. Composable with `--out-dir`
(both write into their respective directories independently).
Honors `--include` / `--exclude`. Tests in
[`packages/core/tests/cli.spec.ts`](packages/core/tests/cli.spec.ts)
cover parser acceptance, the two-rejection arms, and a 2-file
end-to-end batch that asserts both files start with `%PDF-1.4` and
end with `%%EOF`.

### 3. Audit-trail HMAC-SHA-256 sidecar (Option A)

[`apps/desktop/src/auditTrailDownload.ts`](apps/desktop/src/auditTrailDownload.ts)
now exports `computeAuditTrailHmacSha256(payload, secretKey)`
(Web Crypto `subtle.importKey` + `subtle.sign`),
`buildAuditTrailHmacSidecarFilename` (suffix `.hmac-sha256` —
distinct from the SHA-256 `.sha256` so both sidecars can co-exist),
and `buildAuditTrailHmacSidecarBody` (same `<hex>  <name>\n` shape
as the SHA-256 sidecar).

`DownloadPolicyAuditTrailOptions` gains `withHmacSidecar?: { secretKey }`
(composable with `withSidecar`), and the result type grows
`hmacSidecarFilename?`. Empty / whitespace-only secrets are
**rejected at compute time** — no silent downgrade to plain
SHA-256 (that would defeat the entire point of opting in).

In the desktop UI, three new controls sit next to the existing
sidecar checkbox:

- `data-testid="policy-audit-trail-download-with-hmac"` — checkbox
  toggling the HMAC leg.
- `data-testid="policy-audit-trail-hmac-secret"` — `<input type="password">`
  for the shared key (autoComplete off, spellCheck off).
- New i18n keys: `auditTrailHmacSecretLabel`,
  `auditTrailDownloadHmacLabel`, `auditTrailDownloadHmacStatus`,
  `auditTrailDownloadHmacMissingSecret` (PL + EN).

When the secret is non-empty and the checkbox is checked, the
download handler awaits the HMAC, fires a third anchor click, and
records `policy_audit_trail_downloaded_with_hmac_sidecar` telemetry
with `severities=format=<format>;hmac=sha256` (mirroring the existing
sidecar event shape). When the checkbox is checked but the secret is
blank, the handler appends a `auditTrailDownloadHmacMissingSecret`
suffix to the status string and skips ONLY the HMAC leg.

E2E coverage in
[`apps/desktop/e2e/lint-fix-audit.e2e.ts`](apps/desktop/e2e/lint-fix-audit.e2e.ts)
stubs Web Crypto's `digest` + `importKey` + `sign` via
`addInitScript`, types a secret, checks both checkboxes, and asserts
**three** captured downloads (main + `.sha256` + `.hmac-sha256`) plus
the new audit row. Unit tests in
[`apps/desktop/src/auditTrailDownload.spec.ts`](apps/desktop/src/auditTrailDownload.spec.ts)
also cover the empty-secret rejection, the importKey/sign call
shapes, and the composable + standalone HMAC-only paths.

### 4. Stable controller-grammar codes + envelope schema v5 cross-table

`LintIssue` gains an optional `code?: string` (additive — existing
rules keep emitting code-less issues). Every controller-grammar rule
in [`packages/core/src/lints/controllerGrammar.ts`](packages/core/src/lints/controllerGrammar.ts)
now emits a stable code:

- `CG_N_AND_O_MIXED`
- `CG_FANUC_INVALID_N_O_FORMAT`
- `CG_FANUC_MACRO_IJK_ORDER`
- `CG_DUPLICATE_ADDRESSES_<LETTER>` (one suffix per duplicated address)
- `CG_DUPLICATE_O_HEADER`
- `CG_FANUC_PROGRAM_ENVELOPE`

`CLI_SCHEMA_VERSION` bumped from `4` to `5`; `--schema-version` now
prints `cnc-job-check schema=5`. New append-only field
`lintIssuesByControllerCode: CliLintIssuesByControllerCodeEntry[]` on
`CliJobCheckEnvelope`. Each entry has shape
`{ source, code, count, blockers, warnings }` and is built by
aggregating `result.lintIssues[]` filtered to issues with
`code !== undefined`. Sorted by `count` desc, then `source` asc, then
`code` asc. Empty array when no coded issues are present.

Tests updated:

- Key-list assertion includes `lintIssuesByControllerCode`.
- `--schema-version` literal output asserts both
  `CLI_SCHEMA_VERSION` and the literal `cnc-job-check schema=5`
  (drift sentinel).
- Empty cross-table on a clean program.
- Populated + uniqueness on a malformed Fanuc program (two distinct
  `CG_*` codes appear).
- Ordering invariant (count desc, source asc, code asc).

### 5. Profile-pack registry auto-discovery

New Node-only helper
[`packages/core/src/cli/profilePackRegistry.ts`](packages/core/src/cli/profilePackRegistry.ts)
exports `discoverProfilePackLoaders(opts?)`. The walker scans
`<process.cwd()>/node_modules/@cnc/profile-*` (overridable via
`opts.scopeRoot`), reads each `package.json`, and registers a
`CliProfileLintLoader` for any pack that declares
`cnc-workbench.profilePack: { controllerKey, validateAstExport }`.
All filesystem and import calls are injectable; discovery is
intentionally non-throwing so a malformed third-party pack never
blocks a CI run that doesn't even use it.

Both shipped packs now declare their metadata in their
`package.json`:

- [`packages/profiles/haas-ngc/package.json`](packages/profiles/haas-ngc/package.json)
  → `{ controllerKey: "haas-ngc", validateAstExport: "haasNgcProfile" }`.
- [`packages/profiles/fanuc-iso/package.json`](packages/profiles/fanuc-iso/package.json)
  → `{ controllerKey: "fanuc", validateAstExport: "fanucIsoProfile" }`.

`loadProfileLintIssues` in [`packages/core/src/cli.ts`](packages/core/src/cli.ts)
first consults the hand-wired `PROFILE_LINT_LOADERS` (back-compat
fast-path: zero filesystem I/O for shipped packs), and on miss
falls back to a memoized `await discoverProfilePackLoaders()` result.
Test seam `setDiscoveredProfilePackLoadersForTesting` lets cli.spec
inject deterministic loaders.

Tests in
[`packages/core/tests/profilePackRegistry.spec.ts`](packages/core/tests/profilePackRegistry.spec.ts)
cover synthetic third-party packs, missing metadata, malformed JSON,
unknown `controllerKey`, first-wins-when-duplicate, and
import-failure swallowing. Tests in
[`packages/core/tests/cli.spec.ts`](packages/core/tests/cli.spec.ts)
cover both the discovery-fallback path (haas-legacy slot, no
hand-wired loader, synthetic discovered loader DOES fire) and the
hand-wired-wins precedence (haas-ngc, both registries populated,
synthetic discovered loader does NOT fire).

## CG Code Fixes Catalogue + AES-GCM Encryption + verify-audit-trail CLI + Profile-Pack Hot-Reload + Schema v6 Per-Input Cross-Table

This wave drains four of the five Known Gaps left by the prior wave —
the fifth (PGP-signed export) is intentionally deferred because it
would force a ~500KB runtime dependency on `openpgp`. In its place,
the wave ships a paired CLI verifier (`cnc-job-check verify-audit-trail`)
that closes the loop on every sidecar shape (SHA-256 + HMAC + the new
AES-GCM artifact) without any new dependencies.

### Controller-grammar code → canonical-fix catalogue

Every `CG_*` code emitted today by
[`packages/core/src/lints/controllerGrammar.ts`](packages/core/src/lints/controllerGrammar.ts)
now has a stable entry in the new
[`packages/core/src/lints/controllerGrammarFixes.ts`](packages/core/src/lints/controllerGrammarFixes.ts)
catalogue, exported from `@cnc/core` as `CONTROLLER_GRAMMAR_FIXES`,
`getControllerGrammarFix(code)`, and `CG_DUPLICATE_ADDRESSES_PREFIX`.
The catalogue covers the five exact-match codes
(`CG_N_AND_O_MIXED`, `CG_FANUC_INVALID_N_O_FORMAT`,
`CG_FANUC_MACRO_IJK_ORDER`, `CG_DUPLICATE_O_HEADER`,
`CG_FANUC_PROGRAM_ENVELOPE`) plus the `CG_DUPLICATE_ADDRESSES_*`
per-letter family (matched by prefix at lookup time). Each entry
carries a canonical `title`, a one-line `rationale` suitable for IDE
tooltips, and an optional `replacementTemplate`.

A new auto-generator
[`scripts/generate-controller-grammar-codes.mjs`](scripts/generate-controller-grammar-codes.mjs)
emits [`CONTROLLER_GRAMMAR_CODES.md`](CONTROLLER_GRAMMAR_CODES.md) from
the catalogue and runs every emitted code through `getControllerGrammarFix`
as a drift sentinel — any new `CG_*` code without a catalogue entry
fails generation. Wired into the root `verify` chain via the new
`docs:cg-codes` npm script. The matching unit-test contract lives in
[`packages/core/tests/controllerGrammarFixes.spec.ts`](packages/core/tests/controllerGrammarFixes.spec.ts)
and runs the same drift assertion under `npm test`.

### Audit-trail at-rest encryption (AES-256-GCM)

[`apps/desktop/src/auditTrailDownload.ts`](apps/desktop/src/auditTrailDownload.ts)
now exports `computeAuditTrailEncryptedAesGcm(payload, secretKey)` and
`buildAuditTrailEncryptedFilename(name)`. The encrypt helper derives a
256-bit AES key via PBKDF2-SHA-256 (250k iterations, OWASP-grade salt
length 16 bytes) and emits a `[salt(16) | iv(12) | ciphertext+tag]`
binary blob suffixed `.aes-gcm`. Empty / whitespace-only secrets are
REJECTED at compute time — silently encrypting with a blank password
would defeat the opt-in (mirrors the HMAC contract from the prior wave).

`DownloadPolicyAuditTrailOptions` grew a composable
`withEncryption?: { secretKey }` flag. When set together with
`withSidecar` and `withHmacSidecar`, the helper fires four downloads
(main + `.sha256` + `.hmac-sha256` + `.aes-gcm`) and returns
`{ filename, sidecarFilename, hmacSidecarFilename, encryptedFilename }`.

The desktop UI now exposes an `Attach encrypted copy (AES-256-GCM)`
checkbox + password input next to the HMAC controls, with full PL/EN
i18n (`auditTrailEncryptionSecretLabel`,
`auditTrailDownloadEncryptionLabel`,
`auditTrailDownloadEncryptionStatus`,
`auditTrailDownloadEncryptionMissingSecret`). Successful downloads
record a new `policy_audit_trail_downloaded_with_encryption`
telemetry event with `severities=format=<f>;encryption=aes-gcm` (plus
`;hmac=sha256` and/or `;sidecar=sha256` when composed). Empty secret
short-circuits to the `auditTrailDownloadEncryptionMissingSecret`
status fragment without firing the encrypted leg.

Unit tests in
[`apps/desktop/src/auditTrailDownload.spec.ts`](apps/desktop/src/auditTrailDownload.spec.ts)
stub `crypto.subtle.deriveKey` + `encrypt` and assert the binary
layout, the filename suffix distinction, and the four-download
composition. The new E2E test in
[`apps/desktop/e2e/lint-fix-audit.e2e.ts`](apps/desktop/e2e/lint-fix-audit.e2e.ts)
stubs Web Crypto end-to-end and asserts that all four anchor clicks
fire and that the new audit row carries `encryption=aes-gcm`.

### `verify-audit-trail` CLI subcommand

The audit-sidecar primitives now live in a Node-safe shared module
[`packages/core/src/audit/auditTrailIntegrity.ts`](packages/core/src/audit/auditTrailIntegrity.ts)
exporting `computeSha256`, `computeHmacSha256`, `decryptAesGcm`,
`encryptAesGcm`, and `parseSidecarBodyDigest`. Pure Web Crypto, works
in both browser and Node ≥18, no external dependencies.

`cnc-job-check` gained a new subcommand:

```
cnc-job-check verify-audit-trail --main <file>
  [--sha256 <file>]
  [--hmac <file> --secret <key>]
  [--encrypted <file> --encryption-secret <key>]
```

Exit codes follow the standard `--strict` convention:
`0` when every supplied sidecar matches; `1` on any mismatch (with a
canonical `cnc-job-check verify-audit-trail: <which> mismatch …` line
on stderr); `2` on argument or IO error. `--quiet` suppresses per-check
`OK` lines but never the failure messages. `parseVerifyAuditTrailArgs`
exists as a separate parser; the run entry point
`runVerifyAuditTrail(parsed, io)` is also exported for embedding.

Tests in
[`packages/core/tests/cli.spec.ts`](packages/core/tests/cli.spec.ts)
cover every parser combination (sha256 only, hmac only, encrypted
only, all three; `--hmac` without `--secret` rejected; missing
`--main` rejected; no-sidecar rejected; unknown flags rejected) plus
end-to-end happy / mismatch paths driven through `main()` against
real sidecars produced by the shared helpers. Tests in
[`packages/core/tests/auditTrailIntegrity.spec.ts`](packages/core/tests/auditTrailIntegrity.spec.ts)
cover the primitives directly (round-trip encrypt+decrypt, stable
HMAC + SHA-256, empty-secret rejection, blob-too-short rejection,
`parseSidecarBodyDigest` lower-casing).

### Profile-pack hot-reload + multi-scope discovery

`DiscoverProfilePackOptions` gained `scopeRoots?: string[]`. When a
caller (or the env var `CNC_PROFILE_PACK_SCOPE_ROOTS`) lists multiple
roots, the walker visits them in declaration order and resolves
duplicates by first-wins (root[0] beats root[1] for a shared
`controllerKey`). The env-var separator is `;` on Windows, `:`
elsewhere, with both injectable for cross-platform tests via the new
`envFn` / `envSeparator` options. A new `resolveScopeRoots` helper
exposes the same logic so external callers can introspect the merged
list without invoking discovery.

`@cnc/core` now exports
`clearDiscoveredProfilePackLoadersCache()` — a production-grade,
non-test cache flush distinct from the existing
`setDiscoveredProfilePackLoadersForTesting`. The CLI flag
`--rediscover-profile-packs` invokes it before the run, useful when a
long-running shell session installs a new pack mid-session or when
`CNC_PROFILE_PACK_SCOPE_ROOTS` changes between invocations.

Tests in
[`packages/core/tests/profilePackRegistry.spec.ts`](packages/core/tests/profilePackRegistry.spec.ts)
cover the multi-root walk, first-wins precedence across roots, and
both POSIX (`:`) and Windows-style (`;`) env-var parsing including
blank-entry tolerance. Tests in
[`packages/core/tests/cli.spec.ts`](packages/core/tests/cli.spec.ts)
verify both that `clearDiscoveredProfilePackLoadersCache()` flushes
between two seeded loader sets and that the
`--rediscover-profile-packs` flag wipes the seeded cache before the
run.

### Schema v6 — batch-mode `lintIssuesByControllerCodePerInputFile`

`CLI_SCHEMA_VERSION` is bumped from `5` to `6`;
`cnc-job-check --schema-version` now prints `cnc-job-check schema=6`.
`CliBatchEnvelope.summary` grew a strictly additive
`lintIssuesByControllerCodePerInputFile` field. Each row attributes
one `(input, source, code)` triple to the batch entry that produced
it, with `count`, `blockers`, and `warnings` sub-counts:

```ts
type CliBatchControllerCodeAttribution = {
  input: string;             // batch entry path (absolute or input-dir-relative)
  source: LintIssueProvenanceSource;
  code: string;              // CG_* code
  count: number;
  blockers: number;
  warnings: number;
};
```

Sorting is `input` ascending → `count` descending → `source`
ascending → `code` ascending. The field is empty when no batch entry
contributes coded lint issues. Single-input mode is unchanged (the
field only appears in batch JSON).

Tests in
[`packages/core/tests/cli.spec.ts`](packages/core/tests/cli.spec.ts)
cover the schema-drift sentinel
(`expect(stdout).toBe("cnc-job-check schema=6\n")`), the batch
summary key-list assertion, the empty-array-on-clean-batch case, and
a populated-attribution case where each of two malformed Fanuc
inputs contributes its own distinct `CG_*` codes (uniqueness
invariant + ordering invariant + cross-input non-pollution).

## PDF-Batch Pagination + Profile-Pack Deprecation + --strict-controller-codes Gate + rotate-audit-trail-key CLI + @cnc/ide-bridge + Schema v7

This wave drains every non-PGP Known Gap left by the prior wave and
bumps the CLI envelope to `schemaVersion: 7`. Every change is
strictly append-only — no field removals, no enum tightening, and no
new runtime dependencies. PGP-signed export stays deferred for the
same reason as before (would force a ~500KB `openpgp` dependency);
all other gaps are closed below.

### 1. PDF-batch pagination for long setup sheets

[`packages/core/src/workshop/setupSheetPdf.ts`](packages/core/src/workshop/setupSheetPdf.ts)
gained two private helpers:

- `paginateBodyLines(lines, firstPageCapacity, subsequentPageCapacity)`
  splits the wrapped body lines into per-page chunks. The first-page
  capacity accounts for the title block + `TITLE_GAP`; subsequent
  pages get the full `(PAGE_HEIGHT_PT - 2 * MARGIN_PT) / LINE_LEADING`
  flooring.
- `assemblePdfMultiPage` (replaces the original `assemblePdf`) emits
  one `Page` object per chunk, all sharing the existing Helvetica
  `/F1` resource. Object IDs are renumbered deterministically so the
  generalised xref-offset assertion in
  [`packages/core/tests/setupSheetPdf.spec.ts`](packages/core/tests/setupSheetPdf.spec.ts)
  is no longer fragile.

The histogram block always lands on the **last** page; if the last
page's remaining height is below the histogram footprint, the
histogram is pushed onto an additional final page. Short content
still emits a byte-identical single-page PDF — the existing
single-page assertions in `setupSheetPdf.spec.ts` stay green as the
drift sentinel.

Tests in
[`packages/core/tests/setupSheetPdf.spec.ts`](packages/core/tests/setupSheetPdf.spec.ts)
add a 200-line synthetic body emitting `/Count >= 2` with multiple
`/Contents` streams (every body line reachable in some content
stream), a histogram-on-overflow test asserting the histogram lands
on the final page only, and the generalised xref-offsets check
covering every emitted page.

### 2. Profile-pack rule deprecation (`deprecatedSince` + `--no-deprecated-rules`)

`ProfileRuleDoc` in
[`packages/core/src/types.ts`](packages/core/src/types.ts) gained an
optional `deprecatedSince?: string` field — strictly additive,
shaped as a `YYYY-MM` ISO year-month so future tooling can sweep
deprecation dates programmatically. A new helper
[`packages/core/src/lints/profileRuleDeprecation.ts`](packages/core/src/lints/profileRuleDeprecation.ts)
exports `filterDeprecatedProfileLintIssues(issues, ruleDocs)`: drops
every issue whose message matches a `ProfileRuleDoc.messageMatcher`
that has `deprecatedSince` set. The helper resets `lastIndex = 0`
before each `test()` call so a `/g` or `/y` flag from third-party
docs cannot leak state across issues.

`ProfilePackMetadata` in
[`packages/core/src/cli/profilePackRegistry.ts`](packages/core/src/cli/profilePackRegistry.ts)
now reads an optional `ruleDocsExport?: string` from each pack's
`cnc-workbench.profilePack` metadata block, and a sibling
`discoverProfilePackRuleDocs` walker resolves `pkg[ruleDocsExport]`
→ `ProfileRuleDoc[]` for every discovered pack. The CLI memoises the
result via `discoveredProfilePackRuleDocsPromise` and flushes it
together with the loader cache from
`clearDiscoveredProfilePackLoadersCache`.

The new `--no-deprecated-rules` CLI flag plumbs through
`parseCliArgs` → `CliArgs.noDeprecatedRules` →
`loadProfileLintIssues({ suppressDeprecated })`, where the helper
filters the pack's returned issues against both hand-wired
(`PROFILE_RULE_DOCS_LOADERS`) and discovered rule-doc registries.

The fanuc-iso pack ships a deprecation pilot:
[`packages/profiles/fanuc-iso/src/rules.meta.ts`](packages/profiles/fanuc-iso/src/rules.meta.ts)
marks `fanuc.t0-before-real-tool` with `deprecatedSince: "2026-05"`.
The auto-generator
[`scripts/generate-profile-pack-docs.mjs`](scripts/generate-profile-pack-docs.mjs)
gained a "Deprecated since" column in each pack's table and a
deprecation badge in rule details, so
[`PROFILE_PACKS.md`](PROFILE_PACKS.md) now exposes the pilot row.

Tests cover the helper unit
([`packages/core/tests/profileRuleDeprecation.spec.ts`](packages/core/tests/profileRuleDeprecation.spec.ts)),
the CLI plumbing
([`packages/core/tests/cli.spec.ts`](packages/core/tests/cli.spec.ts):
`--no-deprecated-rules` parsing, with-and-without filtering,
discovered-rule-docs cache flushing), and the per-pack
`deprecatedSince` shape
([`packages/profiles/fanuc-iso/tests/rulesMeta.spec.ts`](packages/profiles/fanuc-iso/tests/rulesMeta.spec.ts)
and
[`packages/profiles/haas-ngc/tests/rulesMeta.spec.ts`](packages/profiles/haas-ngc/tests/rulesMeta.spec.ts)).

### 3. `--strict-controller-codes <code,…>` CLI gate (schema v7)

`CLI_SCHEMA_VERSION` is bumped from `6` to `7`;
`cnc-job-check --schema-version` now prints
`cnc-job-check schema=7`. Both `CliJobCheckEnvelope` and
`CliBatchEnvelope.summary` grew a strictly additive optional field:

```ts
type CliJobCheckEnvelope = {
  schemaVersion: number; // now 7
  // ...existing fields...
  strictControllerCodesGated?: string[]; // sorted asc, deduped
};
type CliBatchEnvelope = {
  schemaVersion: number; // now 7
  // ...existing fields...
  summary: {
    // ...existing fields...
    strictControllerCodesGated?: string[]; // union of every entry's gated codes
  };
};
```

The new `--strict-controller-codes <code,…>` flag in
[`packages/core/src/cli.ts`](packages/core/src/cli.ts) accepts
comma-separated tokens, trims whitespace, and rejects empty values
(exit 2). Each token is either an exact `CG_*` code or a family
wildcard (trailing `*`, e.g. `CG_DUPLICATE_ADDRESSES_*`).

`applyStrictControllerCodesGate(envelope, patterns)` walks
`envelope.lintIssuesByControllerCode` and matches each entry's
`code` against the patterns. When at least one matches, the helper
flips `envelope.blocked = true`, populates
`strictControllerCodesGated` with the matched codes (sorted ascending,
deduplicated), and appends a synthetic
`Blocked by --strict-controller-codes: <codes>` block reason to
`envelope.messages`. The gate is applied uniformly across both the
single-input and batch paths in `main()`. In batch mode,
`buildBatchEnvelope` aggregates every entry's gated codes into
`summary.strictControllerCodesGated` (same ordering invariants).

Tests in
[`packages/core/tests/cli.spec.ts`](packages/core/tests/cli.spec.ts)
cover the schema-drift sentinel
(`expect(stdout).toBe("cnc-job-check schema=7\n")`), every parser
combination (single, comma-separated, wildcard, trimming, empty
rejection, missing value), single-input + batch gating, wildcard
families, the `--strict` interaction (gate failures count as
blockers under `--strict` exit-code rules), and unrelated patterns
leaving the envelope unchanged.

### 4. `rotate-audit-trail-key` CLI subcommand

A new sibling subcommand to `verify-audit-trail`, dispatched at the
same point in `main()`:

```
cnc-job-check rotate-audit-trail-key
  --encrypted <input.aes-gcm>
  --old-secret <key>
  --new-secret <key>
  --out <output.aes-gcm>
  [--in-place]                    # atomic temp file + rename onto source
```

The new module
[`packages/core/src/audit/auditTrailRotation.ts`](packages/core/src/audit/auditTrailRotation.ts)
exports `rotateAuditTrailKey(encrypted, oldSecret, newSecret)`,
which pipelines `decryptAesGcm` → `encryptAesGcm` so the rotated
blob always carries a freshly derived salt + IV (even when the new
secret equals the old, the output is byte-different — a no-op
rotation still rolls the salt). The `encryptAesGcm` JSDoc comment
in
[`packages/core/src/audit/auditTrailIntegrity.ts`](packages/core/src/audit/auditTrailIntegrity.ts)
is promoted from "test helper only" to acknowledge the production
rotation use-case.

`CliIo` grew `writeFileBytesFn` (binary-symmetric counterpart to
`readFileBytesFn`) and `renameFn` (atomic in-place replacement). The
default `runRotateAuditTrailKey` implementation uses
`node:fs/promises` `rename` so the source file is never deleted on a
rotation failure. A new `CLI_USAGE_ROTATE_AUDIT_TRAIL_KEY` block is
added; `parseRotateAuditTrailKeyArgs` rejects every unsupported
combination (missing required arg, `--out` + `--in-place` together,
identical `--encrypted` / `--out` paths without `--in-place`).

Exit codes: `0` on successful rotation, `1` on decrypt failure
(canonical `cnc-job-check rotate-audit-trail-key: decryption with
old secret failed (…)` line on stderr — wrong `--old-secret`), `2`
on argument or IO error. `--quiet` suppresses the per-step `OK` line
but never the failure messages.

Tests in
[`packages/core/tests/auditTrailRotation.spec.ts`](packages/core/tests/auditTrailRotation.spec.ts)
cover the round-trip primitive (encrypt with old → rotate → decrypt
with new succeeds; decrypt with old now fails), the
no-op-still-rolls-salt invariant, two consecutive A→B→C rotations,
and empty-secret rejection. CLI integration tests in
[`packages/core/tests/cli.spec.ts`](packages/core/tests/cli.spec.ts)
drive the subcommand through `main()` for both `--out` and
`--in-place` modes (with the injected `renameFn` fully verified for
atomic temp-file semantics) and exercise the wrong-old-secret /
`--quiet` paths.

### 5. `@cnc/ide-bridge` package — `lintIssuesByControllerCode` → IDE quick-fix bridge

A new private workspace
[`packages/ide-bridge`](packages/ide-bridge) ships
`@cnc/ide-bridge` with no runtime dependencies and a
`peerDependencies` entry on `@cnc/core`. The package mirrors the
profile-pack layout (`tsconfig.json`, `src/index.ts`, `tests/`) and
is wired into the root `package.json`'s `build` and `test` chains.
Three exported entry points cover the two ways IDEs consume
`cnc-job-check` output:

```ts
export type IdeQuickFix = {
  code: string;
  title: string;
  rationale: string;
  replacementTemplate?: string;
  range?: {
    startLine: number;
    startColumn?: number;
    endLine: number;
    endColumn?: number;
  };
};

export function getQuickFixForLintIssue(issue: LintIssue): IdeQuickFix | undefined;
export function mapJobCheckEnvelopeToQuickFixes(envelope: CliJobCheckEnvelope): IdeQuickFix[];
export function mapBatchAttributionToFileQuickFixes(
  envelope: CliBatchEnvelope
): Map<string, IdeQuickFix[]>;
```

`getQuickFixForLintIssue` is a thin wrapper over `getControllerGrammarFix`
that honors the `CG_DUPLICATE_ADDRESSES_*` family by prefix.
`mapJobCheckEnvelopeToQuickFixes` walks
`envelope.controllerLints` and returns one `IdeQuickFix` per coded
issue, in envelope order. `mapBatchAttributionToFileQuickFixes` walks
`envelope.summary.lintIssuesByControllerCodePerInputFile` and
returns a `Map<string, IdeQuickFix[]>` keyed by `input`, with one
quick-fix per `(input, code)` pair (deduplicated when the same code
appears under multiple `source` rows for the same input). The map
preserves the cross-table's `input` ordering so IDEs can iterate
deterministically.

The bridge package is added to
[`scripts/verify-import-boundaries.mjs`](scripts/verify-import-boundaries.mjs)'s
allow-list with a dedicated rule: the package may only depend on the
peer-shape `@cnc/core` import, never on the runtime-specific
`@cnc/core/node` or `@cnc/core/browser` entry points (so the bridge
stays transport-neutral and the IDE host's installed version is
reused).

Several CLI envelope types
(`CliJobCheckEnvelope`, `CliBatchEnvelope`, `CliBatchEntry`,
`CliBatchControllerCodeAttribution`, `CliLintIssuesByControllerCodeEntry`,
and the supporting per-source / per-code entries) are now re-exported
from both `@cnc/core` and `@cnc/core/browser` so the bridge (and any
other downstream consumer) can pin to a single public surface.

Tests in
[`packages/ide-bridge/tests/ideBridge.spec.ts`](packages/ide-bridge/tests/ideBridge.spec.ts)
cover catalogue resolution for every `CG_*` exact-match code, the
duplicate-address family resolution (per-letter codes share the
family entry's `title` + `rationale`), the unknown-code → `undefined`
fallback, the bare-LintIssue (no provenance) path, the envelope
walker (skip uncoded + uncatalogued issues, preserve order), and
the batch-attribution `Map` semantics (key ordering, `(input, code)`
dedup, empty-input pruning).

## IdeQuickFix Template Expansion + audit-deprecated-rules CLI + PDF Embedded-Font Opt-In + Batch Block-Reason Aggregation + rotate-audit-trail-key --recover-temp + Schema v8

This wave drains every non-PGP gap surfaced by the prior wave —
five appended deltas, no new runtime dependencies, all changes
additive.

### `expandIdeQuickFixTemplate` + `deriveQuickFixBindings` in `@cnc/ide-bridge`

Two new exports in
[`packages/ide-bridge/src/index.ts`](packages/ide-bridge/src/index.ts)
let IDE plugins finish the catalogue's `{{NAME}}` interpolation
without bringing in a templating library:

```ts
import {
  deriveQuickFixBindings,
  expandIdeQuickFixTemplate,
  getQuickFixForLintIssue
} from "@cnc/ide-bridge";

const fix = getQuickFixForLintIssue(issue);
const bindings = {
  ...deriveQuickFixBindings(issue),
  UNIQUE_PROGRAM_NUMBER: askOperator()
};
const snippet = expandIdeQuickFixTemplate(fix!, bindings);
```

`expandIdeQuickFixTemplate` is a deterministic `{{[A-Z0-9_]+}}`
interpolator: matched tokens are substituted from the binding map,
unbound tokens are left intact verbatim so consumers can compose
multiple binding passes. Returns `undefined` when
`fix.replacementTemplate` is absent — no template to expand.

`deriveQuickFixBindings(issue)` is intentionally narrow: today's
heuristic recognises `CG_DUPLICATE_ADDRESSES_<L>` and emits
`{ LETTER: <L> }`. Other codes (and codeless issues) return a
frozen empty object so consumers can spread their own bindings on
top without mutating the heuristic baseline.

Public surface stays additive — `IdeQuickFix` shape unchanged.
Twelve new tests in
[`packages/ide-bridge/tests/ideBridge.spec.ts`](packages/ide-bridge/tests/ideBridge.spec.ts)
cover partial bindings, repeated tokens, missing template, codeless
issues, lowercase-name pass-through, frozen-object spread, and the
end-to-end family-template path. Total ide-bridge test count: 30.

### `cnc-job-check audit-deprecated-rules` subcommand + DEPRECATION_POLICY.md

A new sibling subcommand to `verify-audit-trail` and
`rotate-audit-trail-key` in
[`packages/core/src/cli.ts`](packages/core/src/cli.ts) walks every
loaded profile pack (built-in `@cnc/profile-fanuc-iso` + auto-discovered)
and surfaces a row per `ProfileRuleDoc.deprecatedSince`. Three modes:

```bash
# Informational — every deprecated rule, ageMonths unchecked
node packages/core/dist/cli.js audit-deprecated-rules

# Same data, machine-readable for CI dashboards
node packages/core/dist/cli.js audit-deprecated-rules --format json

# Enforce the 6-month removal floor — exit 1 when any row is over
node packages/core/dist/cli.js audit-deprecated-rules \
  --older-than 6mo --strict
```

The threshold parser accepts `<N>mo` (whole months) or `<N>d` (days,
converted via `Math.ceil(days/30)` so a non-zero day count never
collapses to a trivial 0-month threshold). Exit codes:
`0` informational / `0` strict-no-violations / `1` strict-with-violations
/ `2` argument error.

The audit logic lives in
[`packages/core/src/cli/auditDeprecatedRules.ts`](packages/core/src/cli/auditDeprecatedRules.ts)
as the pure function `buildDeprecatedRuleAudit(docsByPack, opts)` —
no I/O, deterministic given the same inputs and a frozen `nowFn`,
13 unit tests in
[`packages/core/tests/auditDeprecatedRules.spec.ts`](packages/core/tests/auditDeprecatedRules.spec.ts)
plus 13 CLI integration tests in
[`packages/core/tests/cli.spec.ts`](packages/core/tests/cli.spec.ts).

The cadence — "removed in the second minor version after
`deprecatedSince`, never sooner than 6 months" — is documented in
the new top-level
[`DEPRECATION_POLICY.md`](DEPRECATION_POLICY.md) and cross-referenced
from the auto-generated `PROFILE_PACKS.md`.

### PDF setup-sheet opt-in DejaVu Sans subset (`embeddedFont` + `onWarning`)

`BuildSetupSheetPdfOptions` in
[`packages/core/src/workshop/setupSheetPdf.ts`](packages/core/src/workshop/setupSheetPdf.ts)
gains two append-only fields:

```ts
type BuildSetupSheetPdfOptions = {
  // …existing fields…
  embeddedFont?: "helvetica" | "dejavu-sans-subset"; // default: "helvetica"
  onWarning?: (warning: string) => void;
};
```

The default `"helvetica"` path stays **byte-identical** to the
pre-Schema-v8 contract — every one of the 15 existing PDF tests
still passes, including the byte-identity sentinel for short docs
and the multi-page Resources reference invariant.

The `onWarning` callback fires once per non-WinAnsi codepoint
encountered in any text run (title, body, histogram labels). The
canonical message is
`cnc-job-check setup-sheet-pdf: codepoint U+<HEX> not in winansi`
(or `… not in dejavu-sans-subset` when the subset path is active).
Codepoints that WinAnsi DOES map (German `ä`/`ö`/`ü`/`ß`/`Ø`)
correctly do NOT fire the callback.

The `dejavu-sans-subset` mode requires the bundled subset bytes to
be populated by an offline `pyftsubset` workflow documented in the
new
[`scripts/regenerate-dejavu-sans-subset.mjs`](scripts/regenerate-dejavu-sans-subset.mjs).
Until the regen runs, requesting `embeddedFont: "dejavu-sans-subset"`
throws a canonical error pointing at the script — operators can
ship the bytes whenever they're ready without an API change.
Bundle module:
[`packages/core/src/workshop/embeddedFontDejaVuSubset.ts`](packages/core/src/workshop/embeddedFontDejaVuSubset.ts).

Seven new tests in
[`packages/core/tests/setupSheetPdf.spec.ts`](packages/core/tests/setupSheetPdf.spec.ts)
exercise the opt-in path: byte-identity for explicit `"helvetica"`,
canonical warnings for Polish `Ł`/`ł`/`ż`, no-warnings for Latin-1
supplement, per-codepoint deduplication, and the canonical
"requires the bundled subset" error for `"dejavu-sans-subset"`.
Total setupSheetPdf test count: 22.

### Cross-input block-reason aggregation (Schema v8)

`CLI_SCHEMA_VERSION` bumps from `7` to `8`. The CLI's
`--schema-version` smoke now prints `cnc-job-check schema=8`.

`CliJobCheckEnvelope` gains an optional structured `blockReasons`
field parallel to the existing `messages[]` for back-compat:

```ts
type CliBlockReason = {
  reason: string;        // canonical discriminator
  message: string;       // mirrors messages[] line verbatim
  matchedCodes?: string[]; // optional payload (sorted asc, deduped)
};
```

Three canonical reasons ship in this build:

- `parse_diagnostics_policy_breach` — `parseDiagnosticsPolicyBreaches`
  is non-empty; `matchedCodes` is the union of breach `key` values.
- `lint_blocker` — `blockerCount > 0`; no `matchedCodes` (consumers
  consult `lintIssuesByControllerCode` for the per-code attribution).
- `strict_controller_codes` — pushed by
  `applyStrictControllerCodesGate` when at least one lint code matched
  a `--strict-controller-codes` pattern; `matchedCodes` mirrors
  `strictControllerCodesGated`.

The field is `undefined` (not empty array) when no reason fired —
v7 readers consulting `messages[]` still see the canonical wording.

`CliBatchEnvelope.summary.blockReasonsAggregated` is a new optional
cross-input rollup:

```ts
type CliBatchBlockReasonAggregation = {
  reason: string;
  count: number;        // entries that hit this reason
  inputs: string[];     // sorted asc, deduped
  matchedCodes?: string[]; // union across entries, sorted asc, deduped
};
```

Sorted by `count` desc → `reason` asc, absent when no entry has
any structured block reason. Lets CI dashboards render a one-line
"why did the batch fail?" summary without iterating every entry's
envelope. Pure function in `buildBatchEnvelope`; six new CLI tests
in [`packages/core/tests/cli.spec.ts`](packages/core/tests/cli.spec.ts)
cover the schema-drift sentinel update, single-input reason
population, three-file aggregation, sort order, dedup invariant,
and back-compat with `messages[]`.

### `rotate-audit-trail-key --recover-temp` arm + exit code 3

A new mutually-exclusive arm of `rotate-audit-trail-key`:

```bash
cnc-job-check rotate-audit-trail-key --recover-temp \
  --temp <stranded.tmp> \
  --target <input.aes-gcm> \
  --new-secret <key>
```

Operators reach this path when an `--in-place` rotation succeeds
in writing the `.rotating` temp but fails at the atomic rename step
(e.g. another process has the target open, or the rename crosses a
filesystem boundary). The temp is on disk encrypted under the new
secret; `--recover-temp` validates the decryption then atomically
renames it onto the target.

The new error class `AuditTrailRotationStrandedTempError` in
[`packages/core/src/audit/auditTrailRotation.ts`](packages/core/src/audit/auditTrailRotation.ts)
carries the `tempPath` and chains the underlying rename failure as
ES2022 `cause`. The CLI dispatcher catches it, prints the canonical
`cnc-job-check rotate-audit-trail-key: stranded temp file at <path>
(run --recover-temp to finish)` line on stderr, and exits **`3`** —
a new exit code distinct from the existing `0`/`1`/`2` surface
(append-only).

Eleven new tests in
[`packages/core/tests/cli.spec.ts`](packages/core/tests/cli.spec.ts)
cover the parser combos (recover-temp + encrypted/old-secret/out/
in-place each rejected), the dispatcher's exit-3 surface for a
real-disk rename failure, the recovery happy path, the wrong-secret
exit-1 path, the missing-temp exit-2 path, and the help-block
surface. Plus three new tests in
[`packages/core/tests/auditTrailRotation.spec.ts`](packages/core/tests/auditTrailRotation.spec.ts)
for the error class itself (tempPath, cause chaining, no-undefined-cause
own-property invariant).

### Verification

Workspace-wide totals after this wave:

```
npm run typecheck   # passes; @cnc/core + @cnc/desktop + profiles + ide-bridge
npm run guard:imports
npm test            # 1040 tests pass across @cnc/core (616), profiles (20),
                    # @cnc/ide-bridge (30), @cnc/desktop (174)
npm run build       # all dist/ artifacts emitted, vite bundles desktop
node packages/core/dist/cli.js --schema-version
# => cnc-job-check schema=8
node packages/core/dist/cli.js audit-deprecated-rules --format json
# => { "rows": [{ "pack": "@cnc/profile-fanuc-iso",
#       "ruleId": "fanuc.t0-before-real-tool",
#       "deprecatedSince": "2026-05", "ageMonths": 0,
#       "overThreshold": false }] }
```

## ProfileRuleDoc replacementSuggestion + PDF RTL + audit policy presets + batch lint-by-source rollup + ide-bridge range helper + Schema v9

This wave drains five Known Gaps from the prior wave in one motion — all changes
are append-only with no new runtime dependencies.

### Move 1 — `replacementSuggestion` on `ProfileRuleDoc`

`ProfileRuleDoc` gains an optional `replacementSuggestion?: string` field.
The Fanuc pilot rule `fanuc.t0-before-real-tool` ships the first migration hint.
`buildDeprecatedRuleAudit` propagates it into `DeprecatedRuleAuditRow`, surfaced
in both `--format text` and `--format json` audit output. `PROFILE_PACKS.md`
gains a **Replacement suggestion** column via `scripts/generate-profile-pack-docs.mjs`.

### Move 2 — PDF setup-sheet RTL / bidi text support

`BuildSetupSheetPdfOptions.bidi?: "auto" | "ltr" | "rtl"` (default `"auto"`)
reorders RTL-dominant lines before PDF glyph placement via the new pure helper
`packages/core/src/workshop/bidiVisualOrder.ts`. Covers Arabic / Hebrew shop
names without a full UAX#9 engine — pure RTL lines reverse; mixed lines reverse
RTL runs and reorder segments when RTL-dominant.

### Move 3 — `audit-deprecated-rules --policy <preset>`

New presets in `packages/core/src/cli/auditDeprecatedRulesPresets.ts`:

| Preset | Effect |
| --- | --- |
| `informational` | List all deprecated rules, never fail |
| `six-month-strict` | `--older-than 6mo --strict` |
| `yearly-strict` | `--older-than 12mo --strict` |

Mutually exclusive with raw `--older-than` / `--strict`. CI can now write
`cnc-job-check audit-deprecated-rules --policy six-month-strict`.

### Move 4 — Cross-input `lintIssuesBySourceAggregated` (Schema v9)

`CLI_SCHEMA_VERSION` bumps `8 → 9`. `CliBatchEnvelope.summary.lintIssuesBySourceAggregated`
rolls up per-entry `lintIssuesBySource` across the batch: one row per `source`
with summed `count` / `blockers` / `warnings` and a deduped `inputs[]` list.
Sorted `count` desc → canonical source order asc. Absent when no entry has lint
issues by source.

### Move 5 — `@cnc/ide-bridge` range-resolution helper

`resolveQuickFixRange(source, blockIndex)` maps parser block indices to 1-based
editor ranges using the same non-empty-line semantics as `splitIntoRawBlocks`.
`getQuickFixForLintIssue(issue, source?)` and `mapJobCheckEnvelopeToQuickFixes(envelope, source?)`
populate `IdeQuickFix.range` when source is supplied.

### Verification

```
npm run typecheck   # passes across all workspaces
npm test            # 867 tests pass (@cnc/core 637, profiles 20, ide-bridge 36, desktop 174)
node packages/core/dist/cli.js --schema-version
# => cnc-job-check schema=9
```

## Semicolon-EOB block split + parse-diag batch rollup + desktop audit chips + mixed bidi + Schema v10

This wave drains five Known Gaps from the prior wave in one motion — all changes
are append-only with no new runtime dependencies.

### Move 1 — Cross-input `lintIssuesByParseDiagCodeAggregated` (Schema v10)

`CLI_SCHEMA_VERSION` bumps `9 → 10`. `CliBatchEnvelope.summary.lintIssuesByParseDiagCodeAggregated`
rolls up per-entry `lintIssuesByParseDiagCode` across the batch: one row per `(source, code)`
with summed `count` and a deduped `inputs[]` list. Sorted `count` desc → `source` asc →
`code` asc. Absent when no entry has parse-diag attribution rows.

### Move 2 — `resolveQuickFixRange` semicolon-EOB mode

New shared helper `packages/core/src/parser/blockSplit.ts` centralises block splitting
with optional `semicolonEob` (matching `simpleParser.splitIntoRawBlocks`). `@cnc/ide-bridge`
imports it for `resolveQuickFixRange(source, blockIndex, { semicolonEob?: boolean })` and
`getQuickFixForLintIssue(issue, source?, rangeOptions?)`.

### Move 3 — Desktop `audit-deprecated-rules` policy chip parity

`apps/desktop/src/deprecatedRulesAuditView.ts` wires the three CLI presets
(`informational`, `six-month-strict`, `yearly-strict`) into the Job Check card as
operator-triggered chips with a live summary line (`deprecated-rules: …`).

### Move 4 — Improved mixed Arabic/Latin bidi for PDF

`bidiVisualOrder` now assigns digit runs to the preceding strong direction (UAX#9-lite)
instead of treating all ASCII digits as LTR-strong, improving mixed RTL shop-name lines.

### Move 5 — Verification

```
npm run typecheck   # passes across all workspaces
npm test            # 878 tests pass (@cnc/core 644, profiles 20, ide-bridge 37, desktop 177)
node packages/core/dist/cli.js --schema-version
# => cnc-job-check schema=10
```

## Controller-code batch rollup + blockSplit parser refactor + audit export formatters + desktop export + nested bidi islands + Schema v11

This wave drains five Known Gaps from the prior wave in one motion — all changes
are append-only with no new runtime dependencies.

### Move 1 — Cross-input `lintIssuesByControllerCodeAggregated` (Schema v11)

`CLI_SCHEMA_VERSION` bumps `10 → 11`. `CliBatchEnvelope.summary.lintIssuesByControllerCodeAggregated`
rolls up per-entry `lintIssuesByControllerCode` across the batch: one row per `(source, code)`
with summed `count` / `blockers` / `warnings` and a deduped `inputs[]` list.
Sorted `count` desc → `source` asc → `code` asc. Absent when no entry has controller-code rows.

### Move 2 — `simpleParser` → `blockSplit` internal refactor

`simpleParser` now calls `splitProgramIntoBlocks` from `blockSplit.ts` instead of
maintaining a parallel `splitIntoRawBlocks` copy — single source of truth for newline
and semicolon-EOB block semantics.

### Move 3 — Shared deprecated-rule audit export formatters

`packages/core/src/cli/deprecatedRuleAuditFormat.ts` centralises JSON, CSV, and text
table formatting for `DeprecatedRuleAuditRow[]`. The CLI `audit-deprecated-rules` subcommand
and desktop export both consume the same helpers.

### Move 4 — Desktop deprecated-rules audit report export

The Job Check card gains **Export JSON** and **Export CSV** buttons that download the full
`DeprecatedRuleAuditRow[]` table for the active policy preset via
`deprecatedRulesAuditDownload.ts`.

### Move 5 — Nested LTR islands in RTL PDF runs

`bidiVisualOrder` reverses RTL segments while preserving embedded Latin/digit islands
(e.g. `אב Shop גד` keeps `Shop` readable) — incremental UAX#9-lite without ICU.

### Verification

```
npm run typecheck   # passes across all workspaces
npm test            # 896 tests pass (@cnc/core 656, profiles 20, ide-bridge 40, desktop 180)
node packages/core/dist/cli.js --schema-version
# => cnc-job-check schema=11
```

## Parse-diag batch rollup + ide-bridge aggregated quick-fixes + audit clipboard + paragraph bidi + Schema v12

This wave drains five Known Gaps from the prior wave in one motion — all changes
are append-only with no new runtime dependencies.

### Move 1 — Cross-input `parseDiagnosticsByCodeAggregated` (Schema v12)

`CLI_SCHEMA_VERSION` bumps `11 → 12`. `CliBatchEnvelope.summary.parseDiagnosticsByCodeAggregated`
rolls up per-entry `parseDiagnosticsByCode` across the batch: one row per `code`
with summed `count` / `warnings` / `errors` and a deduped `inputs[]` list.
Sorted `count` desc → `code` asc. Absent when no entry has parse diagnostics.

### Move 2 — `@cnc/ide-bridge` batch aggregated controller-code quick-fix map

`mapBatchControllerCodeAggregatedToQuickFixes(envelope)` maps Schema v11
`lintIssuesByControllerCodeAggregated` rows to catalogue `IdeQuickFix` entries
with `count`, `blockers`, `warnings`, and `inputs[]` — no per-input walk required.

### Move 3 — Desktop deprecated-rules audit clipboard copy

Job Check card gains a **Copy JSON** button that mirrors the policy-audit-trail
clipboard UX for the active deprecation audit preset.

### Move 4 — Multiline RTL paragraph bidi for PDF

`applyBidiVisualOrderParagraphs` reverses visual line order in RTL-dominant
blank-line-separated paragraphs. `BuildSetupSheetPdfOptions.bidiParagraphs`
opts `exportTxt` into paragraph mode.

### Move 5 — Verification

```
npm run typecheck   # passes across all workspaces
npm test            # see test run for current count
node packages/core/dist/cli.js --schema-version
# => cnc-job-check schema=12
```

## Strict-gate rollup + CSV clipboard + ide-bridge ranges + gate chips + bracket bidi + Schema v13

This wave drains five Known Gaps from the prior wave in one motion — all changes
are append-only with no new runtime dependencies.

### Move 1 — Cross-input `strictControllerCodesGatedAggregated` (Schema v13)

`CLI_SCHEMA_VERSION` bumps `12 → 13`. `CliBatchEnvelope.summary.strictControllerCodesGatedAggregated`
rolls up per-entry `strictControllerCodesGated` across the batch: one row per gated
`code` with a deduped `inputs[]` list. Sorted `inputs.length` desc → `code` asc.
Absent when no entry matched the strict gate.

### Move 2 — Desktop deprecated-rules audit CSV clipboard copy

Job Check card gains a **Copy CSV** button alongside **Copy JSON** for the active
deprecation audit preset — parity with export buttons.

### Move 3 — `@cnc/ide-bridge` aggregated quick-fix range resolution

`mapBatchControllerCodeAggregatedToFileQuickFixes(envelope, sourcesByInput, rangeOptions?)`
maps Schema v11 aggregated controller-code rows to per-input `IdeQuickFix` entries
with optional editor `range` when program sources and `blockIndex` are available.

### Move 4 — Desktop strict-controller-codes gate watch chips

Job Check card surfaces CLI-aligned strict-gate watch presets as chips that evaluate
`lintIssues` locally and show which patterns would block under `--strict-controller-codes`.

### Move 5 — Bracket/quote LTR islands in bidi PDF helper

`reverseRtlRunPreservingEmbeddedLtr` now preserves `()`, `[]`, `"`, and `'` delimited
islands inside RTL runs so mixed shop labels like `מפעל (CNC) שם` stay readable in PDF.

### Move 6 — Verification

```
npm run typecheck   # passes across all workspaces
npm test            # see test run for current count
node packages/core/dist/cli.js --schema-version
# => cnc-job-check schema=13
```

## Policy-breach rollup + parse-diag catalogue + ide-bridge parse hints + strict-gate export + Schema v14

This wave drains five Known Gaps from the prior wave in one motion — all changes
are append-only with no new runtime dependencies.

### Move 1 — Cross-input `parseDiagnosticsPolicyBreachesAggregated` (Schema v14)

`CLI_SCHEMA_VERSION` bumps `13 → 14`. `CliBatchEnvelope.summary.parseDiagnosticsPolicyBreachesAggregated`
rolls up per-entry `parseDiagnosticsPolicyBreaches` across the batch: one row per breach
`key` with contributing `inputs[]`, `totalObserved`, and worst `severity`. Sorted
`count` desc → `key` asc. Absent when no entry breached policy thresholds.

Per-entry `parseDiagnosticsByCode[]` rows gain optional `firstBlockIndex` for editor
jump-to-block in downstream tooling.

### Move 2 — Parser `parseDiagnosticFixes` catalogue

`getParseDiagnosticFix(code)` maps every parser `ParseDiagnostic.code` to a stable
title, rationale, and optional `replacementTemplate` — parallel to controller-grammar fixes.

### Move 3 — `@cnc/ide-bridge` aggregated parse-diag quick-fix maps

`mapBatchParseDiagnosticsByCodeAggregatedToQuickFixes(envelope)` and
`mapBatchParseDiagnosticsByCodeAggregatedToFileQuickFixes(envelope, sourcesByInput, rangeOptions?)`
map Schema v12 aggregated parse-diag rows to catalogue fixes with optional editor `range`.

### Move 4 — Desktop strict-controller-codes gate clipboard export

Job Check strict-gate watch row gains **Copy JSON** and **Copy CSV** buttons mirroring
the deprecation audit clipboard UX.

### Move 5 — Verification

```
npm run typecheck   # passes across all workspaces
npm test            # see test run for current count
node packages/core/dist/cli.js --schema-version
# => cnc-job-check schema=14
```

## Safety-findings rollup + parse-diag bindings + policy-breach export + Schema v15

This wave drains five Known Gaps from the prior wave in one motion — all changes
are append-only with no new runtime dependencies.

### Move 1 — Per-entry `safetyFindingsByCode` + batch rollup (Schema v15)

`CLI_SCHEMA_VERSION` bumps `14 → 15`. Each envelope gains `safetyFindingsByCode[]`
(advisor + simulation findings rolled up by `code` with `count` / `blockers` /
`warnings` / optional `firstBlockIndex`). Batch summary gains
`safetyFindingsByCodeAggregated` (one row per code with deduped `inputs[]`).
Sorted `count` desc → `code` asc. Batch field absent when no entry has findings.

### Move 2 — Pure builders for safety-findings rollups

`buildSafetyFindingsByCode` and `buildBatchSafetyFindingsByCodeAggregation` are
exported pure helpers used by the envelope and batch builders.

### Move 3 — ide-bridge `deriveParseDiagnosticFixBindings`

Heuristic bindings for parse-diag catalogue templates:
`ADDRESS_MISSING_VALUE` → `{ LETTER }`, `UNKNOWN_TOKEN` → `{ TOKEN }`.

### Move 4 — Desktop policy-breach rollup chip + JSON/CSV clipboard

Job Check breach section gains a rollup-shaped chip and **Copy breach JSON** /
**Copy breach CSV** buttons.

### Move 5 — Desktop safety-findings chip + JSON clipboard

Job Check card surfaces a safety rollup chip (blockers first) with **Copy safety JSON**.

### Move 6 — Verification

```
npm run typecheck   # passes across all workspaces
npm test            # see test run for current count
node packages/core/dist/cli.js --schema-version
# => cnc-job-check schema=15
```

## Known Gaps / Next Increments

The following deferred items are intentionally tracked here so the
next planning wave can pick them up:

- **Audit-trail PGP-signed export variant** — pair the
  SHA-256 + HMAC + AES-GCM sidecars with a detached PGP signature
  (BYO key) for shops that need full asymmetric non-repudiation.
  Deferred because it would force a `dependencies` entry on
  `openpgp` (~500KB runtime). The `verify-audit-trail` CLI
  subcommand already gives operators a no-deps integrity-checking
  path, so PGP is now a strict opt-in for shops that explicitly
  want detached signatures.
- **Full UAX#9 bidi for complex mixed paragraphs** — paragraph line
  reorder, embedded LTR islands, and bracket/quote preservation ship;
  deeply nested embeddings and multi-script runs still need ICU or a
  full UAX#9 implementation.
- **Desktop multi-file batch Job Check** — v15 exports are rollup-shaped
  but desktop still runs single-file; a batch walker UI would close parity.
- **Simulation/advisor ide-bridge quick-fix catalogue** — rollup ships;
  no `SIM_*` / advisor fix catalogue yet.
- **Broader parse-diag binding heuristics** — LETTER/TOKEN ship; additional
  codes may need message-derived bindings later.
