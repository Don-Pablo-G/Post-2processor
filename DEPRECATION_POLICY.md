# Profile-Pack Rule Deprecation Policy

This document defines the cadence at which a profile-pack lint rule
moves through the deprecation lifecycle, from `deprecatedSince` opt-in
all the way to physical removal.

## Lifecycle

A profile-pack rule lives in one of three stages:

1. **Live** — the rule's `ProfileRuleDoc` carries no
   `deprecatedSince` value. Issues emitted by the rule surface in the
   `profile_lint` source bucket on every CLI run, regardless of which
   flags the operator passes.
2. **Soft-deprecated** — the rule's `ProfileRuleDoc.deprecatedSince`
   carries an ISO `YYYY-MM` value. Issues still surface by default
   (so existing CI gates keep their behaviour), but operators can
   suppress them with the `--no-deprecated-rules` CLI flag for a
   per-run opt-out, and CI dashboards can audit the deprecation age
   via `cnc-job-check audit-deprecated-rules` (see below).
3. **Removed** — the rule is dropped from the pack's `validateAst`
   implementation AND its `ProfileRuleDoc` entry. Once removed, the
   `id` is treated as retired and MUST NOT be reused for an unrelated
   rule (downstream tooling treats `id` as a stable, lifetime-unique
   identifier).

## Removal cadence

A soft-deprecated rule MUST satisfy ALL of the following before it
can move to the **Removed** stage:

- At least **6 months** have elapsed since `deprecatedSince`. The
  audit subcommand surfaces this as `ageMonths >= 6`.
- The pack has shipped at least **two minor versions** with the
  rule in soft-deprecated state (so consumers pinning a minor have
  at least one full minor of warning + one minor of explicit
  opt-out window).
- The deprecation reason is recorded in the pack's release notes
  (typically `CHANGELOG.md`) for the minor version that flipped the
  rule into soft-deprecated state. The release notes for the minor
  version that removes the rule MUST cite the same reason and
  reference the `id`.

Pack maintainers SHOULD wait longer than the floor when a rule's
deprecation reason is "controller-native check is now reliable enough"
— the controller-vendor's reliability claim is rarely uniform across
fleets, and an extra minor cycle is cheap insurance.

## Auditing the cadence

The CLI subcommand
`cnc-job-check audit-deprecated-rules [--older-than <N>{mo|d}]
[--strict]` walks every profile pack the lint hot-path can already
load (built-in + auto-discovered) and reports one row per rule with
`deprecatedSince` set. The relevant flag combinations:

- `cnc-job-check audit-deprecated-rules` — informational text dump
  of every deprecated rule with its age in months.
- `cnc-job-check audit-deprecated-rules --format json` — same data
  as a machine-readable JSON envelope (`{ rows: [...] }`) suitable
  for piping into a CI dashboard.
- `cnc-job-check audit-deprecated-rules --older-than 6mo` — flips
  the `overThreshold` flag on every row whose `ageMonths >= 6`. Exit
  code stays `0`; the audit is informational unless `--strict` is
  also passed.
- `cnc-job-check audit-deprecated-rules --older-than 6mo --strict`
  — exits **`1`** when at least one rule is over the threshold.
  Wire this combination into CI to enforce the 6-month removal
  floor automatically.

The `<N>{mo|d}` grammar accepts whole months (`6mo`, `12mo`) or
days (`30d`, `180d`). Days are converted via `Math.ceil(days / 30)`
so a non-zero day count never collapses to a zero-month threshold.

## Adding a deprecation

Pack maintainers opt into the lifecycle by setting
`deprecatedSince: "YYYY-MM"` on the relevant `ProfileRuleDoc`. Pick
the year-month the deprecation is announced (typically the release
month of the minor version that introduces the flag). Once set, the
field is **append-only** — never unset and never moved backwards in
time. Bumping `deprecatedSince` forward is allowed but discouraged
(it resets the cadence clock).

The CLI smoke after adding a deprecation is:

```bash
node packages/core/dist/cli.js audit-deprecated-rules --format json
```

The new row should appear with `ageMonths: 0` (assuming the date is
the current month) and `overThreshold: false`.

## Cross-references

- [`packages/core/src/cli/auditDeprecatedRules.ts`](packages/core/src/cli/auditDeprecatedRules.ts)
  — `buildDeprecatedRuleAudit` + `parseOlderThanThreshold`.
- [`packages/core/src/cli.ts`](packages/core/src/cli.ts)
  — `parseAuditDeprecatedRulesArgs` + `runAuditDeprecatedRules` +
  `CLI_USAGE_AUDIT_DEPRECATED_RULES`.
- [`packages/core/src/lints/profileRuleDeprecation.ts`](packages/core/src/lints/profileRuleDeprecation.ts)
  — the `--no-deprecated-rules` filter the soft-deprecated stage
  enables.
- [`PROFILE_PACKS.md`](PROFILE_PACKS.md) — the auto-generated
  reference table where every deprecated rule shows up under the
  "Deprecated since" column.
