# E2E Stability Log

Track required `desktop-e2e` gate behavior and triage outcomes.

## How to update

- Run: `npm run e2e:gate:report -- --limit=10`
- Record one line per observation window.
- Classify each failure as one of:
  - `selector_drift`
  - `timing_flake`
  - `behavior_regression`
  - `environment_issue`
  - `other`

## Entries

| Date (UTC) | Window | success | failure | in_progress | Top failure class | Notes / Next action |
| --- | --- | ---: | ---: | ---: | --- | --- |
| 2026-04-27 | last 10 CI runs | 0 | 8 | 2 | environment_issue | Initial baseline after required-gate rollout; investigate failing runs with `PLAYWRIGHT_TROUBLESHOOTING.md` and artifact bundles. |
| 2026-04-27 | triage follow-up | - | - | - | environment_issue | Root cause identified from failed logs: desktop-e2e workflow skipped prebuild for `@cnc/core` and `@cnc/profile-haas-ngc`; added explicit prebuild steps in CI and nightly workflows. |
