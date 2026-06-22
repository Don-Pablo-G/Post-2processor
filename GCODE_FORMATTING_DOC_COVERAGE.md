# G-code Formatting Documentation Coverage

This checklist maps documented machine behavior (Haas/Fanuc training references and RS274 interpreter grammar notes) to current automated coverage in `packages/core/tests/core.spec.ts`.

## Documentation Statements Tracked

- Address codes can be placed in any order within a block.
- Controls evaluate a full block, not strict left-to-right token order.
- Spaces/tabs are allowed almost anywhere and should not change meaning.
- Odd-looking numeric spacing like `G0X +0. 12 34Y 7` is legal and equivalent to normalized forms.
- Input is case-insensitive (outside comments), though output style may still enforce uppercase for machine safety.
- Percent delimiters are structural program markers and must be standalone when required by shop/controller convention.
- Fanuc strict target behavior differs from shop-friendly interpretation for subprogram target resolution.

## Coverage Matrix (Rule -> Status)

- **Address order flexibility** -> **Covered**
  - Tests:
    - `accepts additional machine-valid spacing and ordering variants from controller docs`
    - `accepts broad machine-valid g-code syntax variants without false interpreter errors`
  - Includes reordered `X/Y/Z`, `G/M`, and mixed block token ordering.

- **Packed words / optional inter-word spacing** -> **Covered**
  - Tests:
    - `accepts machine-valid compact address formatting without false parse warnings`
    - `accepts broad machine-valid g-code syntax variants without false interpreter errors`
  - Includes compact forms like `G0X0Y0Z0`, mixed tabs/spaces, and packed sequence/motion words.

- **Intra-number whitespace normalization** -> **Covered**
  - Tests:
    - `accepts additional machine-valid spacing and ordering variants from controller docs`
    - `accepts broad machine-valid g-code syntax variants without false interpreter errors`
  - Includes documented-style variants such as `X +0. 12 34` -> parsed as `X+0.1234`.

- **Case-insensitive input acceptance** -> **Covered**
  - Tests:
    - `accepts broad machine-valid g-code syntax variants without false interpreter errors`
    - `uppercases lowercase macro/control-flow lines for machine-safe output`
    - `keeps uppercase output even when lowercase style is requested`
  - Parser accepts lowercase; formatter emits uppercase for safety.

- **Macro/control-flow spacing variants** -> **Covered**
  - Tests:
    - `accepts broad machine-valid macro/control-flow formatting variants`
    - `handles IF…THEN formatting variants in haas-ngc mode`
    - `keeps machine-valid macro formatting parse-safe across haas and fanuc modes`
  - Includes packed IF/THEN, spaced bracket expressions, WHILE/END forms, and mixed tabs.

- **Controller-specific macro function compatibility** -> **Covered**
  - Tests:
    - `flags unsupported macro functions only in fanuc while keeping haas clean`
  - Ensures no false Haas warning while Fanuc unsupported-function warnings remain intentional.

- **Strict vs shop-friendly subprogram target policy** -> **Covered**
  - Simulator-level tests:
    - `applies strict-vs-shop-friendly target policy matrix for M98 and G65 in fanuc mode`
  - Reporting/policy-layer tests:
    - `applies runJobCheck policy matrix to strict-vs-shop-friendly subprogram target handling`

- **Program delimiter `%` must be standalone at start/end** -> **Covered**
  - Tests:
    - `requires standalone % lines at start and end`
    - `warns when a percent delimiter line contains extra tokens`
    - `preserves standalone % delimiter lines in formatter output`

## Partial Coverage / Remaining Gaps

- **Optional block delete (`/`) behavior variants** -> **Partial**
  - We cover many formatting forms but do not yet have a dedicated matrix around block-delete parsing/formatting interactions.

- **Version-specific function and dialect differences (Fanuc series/Haas revisions)** -> **Partial**
  - Core behaviors are covered, but not exhaustively stratified by control generation/options.

- **Comment-edge interactions with extreme whitespace/casing in every macro construct** -> **Partial**
  - Many cases are covered; exhaustive combinatorial coverage is not yet present.

## Not Yet Explicitly Covered

- Full explicit matrix for slash-prefixed optional blocks mixed with packed tokens/comments.
- Exhaustive per-function support matrix by controller generation (beyond current Fanuc/Haas mode checks).
- Multi-program files with multiple `%` sections and cross-program edge validation.

## Practical Conclusion

Current coverage is strong for false-error prevention in real shop programming styles and directly validates the major documented formatting tolerances we targeted (spacing, ordering, case, macro formatting, strict-vs-shop policy, and `%` delimiters). Remaining work is mainly exhaustive dialect/version breadth rather than high-risk core formatting behavior.
