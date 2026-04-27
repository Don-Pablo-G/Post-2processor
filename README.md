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
