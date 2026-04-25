# CNC Workbench (Scaffold)

Haas NGC-first starter project for:

- G-code parsing and formatting
- program parameterization suggestions
- safe macro simulation sandbox

## Workspace Layout

- `apps/desktop` - React + Vite desktop UI scaffold
- `packages/core` - parser/formatter/parameterizer/simulator/lint contracts
- `packages/profiles/haas-ngc` - Haas NGC profile starter
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
3. monorepo typecheck
4. monorepo build

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
