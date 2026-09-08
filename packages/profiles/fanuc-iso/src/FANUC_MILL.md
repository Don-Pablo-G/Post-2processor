# Fanuc Mill Lint

Phase A scaffolds Fanuc ISO mill lint from the Haas NGC infrastructure by copying the helper, modal-state, end-hygiene, and same-block patterns into this package and adapting the dialect in place.

## Dialect Scope

- Rule ids use the `fanuc.*` prefix.
- Work offsets are limited to `G54`-`G59` for v1. Haas `G154` extended offsets are excluded.
- Spindle-on tracking recognizes `M3` and `M4` only. Haas `M13`/`M14` spindle-plus-coolant idioms are excluded.
- Through-spindle coolant `M88`/`M89` is excluded from Phase A.
- Haas `M97` local subprogram calls are not ported as a supported call style; Phase A warns with `fanuc.m97-unsupported`.

## Phase A Rule Slice

The first portable slice covers high-value tool-change pairing, tool-length activation, feed/tapping while spindle-off, active modal state at program end, reduced same-block apply/cancel conflicts, unsupported `M97`, and missing feed rate on first feed motion.

Slice 2 adds portable stop/end while-state guards for `M00`/`M02`/`M30`, `M6` while rotation/scaling is active, `G28`/`G53` while cutter compensation or canned cycles are active, `M98` without same-block `P`, and same-block `G68`/`G69`, `G51`/`G50`, and `G41`/`G42` conflicts.

## Roadmap

Phase B can deduplicate shared Haas/Fanuc helpers after the copied Fanuc behavior settles. Future Fanuc work may add optional `G54.1 Pn` offsets, shop-configurable dialect flags, and broader same-block/modal hygiene once controller expectations are validated.
