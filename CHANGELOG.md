# Changelog

## schema-49 (separable rules registry)

CLI `schemaVersion` **49** — rule-policy / separable-rules foundation.

### Added

- `RulePolicy` enable/disable by stable lint `code` (`--disable-rule`, `--enable-rule`, `--rules-policy`)
- Profile lint issues attach `haas.*` / `fanuc.*` codes from rule docs
- Open controller pack keys + optional pack manifests
- Data-driven controller grammar tables
- Declarative custom rules + desktop controller/rule toggles
- Haas/Fanuc rule module registry exports (`buildHaasNgcRuleRegistry`, coded `validateAst`)

## schema-48 (seal/verify surface complete)

Soft verify/inventory symmetry closed at CLI `schemaVersion` **48**
(`d569390` and later on `main`). Do not bump the schema only to mirror
`batchWalk.export` stamps into `verify-batch-export` or desktop chips.

### Included through schema 48

- Batch export seal + sidecars (summary, manifest, CSV/NDJSON, SARIF, fix-previews, dirs/counts/bytes).
- `cnc-job-check verify-batch-export` / `verify-audit-trail`.
- Desktop inventory chips for stamped export fields.

### After this cut

- Product work: Haas NGC / Fanuc lint and simulation slices.
- Hard Known Gaps (PGP, full UAX#9 bidi, IDE-host editor write) only when a shop requirement forces them.

See README **Operator loop** and **Known Gaps / Next Increments**.
