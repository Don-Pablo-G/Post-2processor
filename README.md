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

## Current Status

This is a foundation scaffold. Core logic is intentionally simple and ready for incremental replacement with full Haas NGC semantics.

Current backend includes:

- macro flow simulation (`IF/GOTO`, `WHILE/DO/END`)
- canned cycle timing handlers (`G73`, `G81` to `G89`)
- feed/rapid based cycle-time estimate
- tooling report generation with lowest-Z extraction and 80mm thermal printable output
