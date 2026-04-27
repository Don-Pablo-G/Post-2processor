# E2E Stability Log

Track required `desktop-e2e` gate behavior and triage outcomes.

## Ownership and SLA

- **Owner:** Core maintainers rotating on CI watch duty.
- **Check cadence:** once daily (weekday) + after notable CI workflow changes.
- **SLA (first response):** within 24h for new required-gate failures.
- **SLA (mitigation/fix PR):** within 48h for reproducible regressions.
- **Escalation:** if gate is red for >48h, pause non-critical merges until root cause and mitigation are documented.

## Weekly Maintenance

- Rotate CI watch owner once per week.
- Run: `npm run e2e:gate:report -- --limit=20`
- Add one weekly summary row in the entries table with dominant failure class (if any).
- Confirm nightly workflow still uploads artifacts on failure.

## How to update

- Run: `npm run e2e:gate:report -- --limit=10`
- Record one line per observation window.
- Optional helper for appending rows:
  - `npm run e2e:stability:log-entry -- --window=\"last 10 CI runs\" --success=2 --failure=1 --in_progress=0 --class=timing_flake --notes=\"retry tuned\"`
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

| 2026-04-27 | last 10 CI runs (post-triage snapshot) | 0 | 6 | 4 | environment_issue | Multiple runs still failing/in-progress; proceed to isolate whether #150 prebuild fix resolved package-resolution errors once completed. |
| 2026-04-27 | triage follow-up 2 | - | - | - | selector_drift | Failed run logs show language-sensitive selector dependency (`/safety policy preset/i`); hardened E2E selectors to stable preset option values (`strict/balanced/permissive`). |
| 2026-04-27 | triage follow-up 3 | - | - | - | timing_flake | Hardened startup waits (`networkidle`, visible+enabled checks) and raised Playwright action/navigation/expect timeouts to reduce transient render timing failures. |
| 2026-04-27 | last 10 CI runs (post-#158 closure snapshot) | 0 | 10 | 0 | behavior_regression | All recent runs completed and failed; next step is isolate a single dominant failing assertion path from latest run artifacts/logs and patch one focused fix. |