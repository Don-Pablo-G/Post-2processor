# Shop Regression Fixtures

This folder is for real-world CNC programs captured from shop workflows.

## Goal

Keep parser/simulator/job-check behavior stable as the codebase evolves.
Each fixture should represent a real pattern that previously failed, regressed,
or is safety-critical in production proveout.

## How to add a fixture

1. Drop the `.nc` file under the appropriate controller subfolder:
   - `haas-ngc/`
   - `haas-legacy/`
   - `fanuc/`
2. Add an entry in `manifest.json` with:
   - `id`
   - `controller`
   - `path`
   - `expectations` flags
3. Keep source code as close as possible to posted machine code
   (messy spacing/comments included).

## Current expectations flags

- `expectsMainM99`: fixture intentionally contains main-level `M99`.
- `expectsSimulationWarnings`: simulation warnings are expected.
- `expectsSimulationFindings`: job check simulation findings are expected.
- `expectedFindingCodes` (optional): strict assertion list for simulation finding
  codes, e.g. `["SIM_MAIN_M99"]`.

This suite starts as smoke+baseline coverage and can be expanded to strict
golden assertions over time.

## Baselines

Simulation/lint smoke baselines can be stored under `shop-regressions/baselines/`
as JSON snapshots keyed by fixture and controller mode. These files capture
expected high-level outcomes (issue counts, warning/alarm counts, cycle-time estimate)
to make behavior drift visible during future simulator/lint changes.

Validate stored snapshots against current runtime behavior:

```bash
npm run check:shop-baselines
```

If drift is intentional, refresh snapshots in place:

```bash
npm run check:shop-baselines:update
```
