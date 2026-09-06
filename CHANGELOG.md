# Changelog

## schema-48 (seal/verify surface complete)

Soft verify/inventory symmetry is **frozen** at CLI `schemaVersion` **48**
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
