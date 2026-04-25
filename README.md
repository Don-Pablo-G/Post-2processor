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
npm run test
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

## Current Status

This is a foundation scaffold. Core logic is intentionally simple and ready for incremental replacement with full Haas NGC semantics.

Current backend includes:

- macro flow simulation (`IF/GOTO`, `WHILE/DO/END`)
- canned cycle timing handlers (`G73`, `G81` to `G89`)
- feed/rapid based cycle-time estimate
- tooling report generation with lowest-Z extraction and 80mm thermal printable output
