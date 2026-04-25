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

## Local Git Hooks

This repo includes a local pre-commit helper that is intentionally non-blocking:

- Install hook: `npm run setup:hooks`
- Hook check command: `npm run precommit:check`
- Current behavior: runs import-boundary guard and prints a reminder to run `npm run verify`
