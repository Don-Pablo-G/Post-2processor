# Playwright Troubleshooting

Use this checklist when the required `desktop-e2e` CI job fails.

## 1) Open CI artifacts

- Go to the failed `desktop-e2e` run.
- Download `desktop-e2e-playwright-artifacts`.
- Inspect:
  - `apps/desktop/test-results` (screenshots, traces)
  - `apps/desktop/playwright-report` (HTML report)

## 2) Identify failure class

- **Selector drift**: element names/labels changed.
- **Timing issue**: flaky waits, animation/render latency.
- **Behavior regression**: expected source/state no longer valid.
- **Environment issue**: browser/runtime/toolchain differences.

## 3) Reproduce locally

- Run:
  - `npm run --workspace @cnc/desktop e2e`
- Optionally run specific file:
  - `npm run --workspace @cnc/desktop e2e -- apps/desktop/e2e/policy-core.e2e.ts`

## 4) Debug with trace

- Re-run with trace enabled via config (already `on-first-retry` in CI).
- Open trace from artifact and inspect:
  - exact failing step
  - locator resolution
  - DOM snapshot around the failure

## 5) Apply targeted fix

- For selectors, prefer resilient role/text patterns already used in specs.
- For timing, wait on user-visible state transitions, not arbitrary sleeps.
- For behavior regressions, decide whether app logic or test expectation is wrong.

## 6) Verify before merge

- `npm run verify`
- `npm run --workspace @cnc/desktop e2e -- --list`
- Full `desktop-e2e` run passes in CI.
