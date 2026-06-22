import type { ProfileRuleDoc } from "../types.js";

/**
 * One row in the deprecated-rule audit produced by
 * {@link buildDeprecatedRuleAudit}. Each row attributes a single
 * deprecated `ProfileRuleDoc` to the pack that owns it, and carries
 * the age (in whole months) since `deprecatedSince`.
 *
 * Rows are emitted in `pack` ascending → `ruleId` ascending order,
 * which is stable across runs so consuming CI tooling (and snapshot
 * tests) can diff outputs deterministically.
 */
export type DeprecatedRuleAuditRow = {
  /**
   * Pack identifier as supplied by the caller — typically the npm
   * package name (e.g. `"@cnc/profile-fanuc-iso"`) for built-in packs
   * and the controller key (`"fanuc"`, `"haas-ngc"`) as a fallback.
   * Surfaced verbatim in both `--format text` and `--format json` output.
   */
  pack: string;
  /** Mirrors `ProfileRuleDoc.id` (e.g. `"fanuc.t0-before-real-tool"`). */
  ruleId: string;
  /**
   * `YYYY-MM` ISO year-month string mirrored from
   * `ProfileRuleDoc.deprecatedSince`. Carried verbatim so consumers can
   * re-derive the exact deprecation month without parsing `ageMonths`
   * back into a date.
   */
  deprecatedSince: string;
  /**
   * Whole months elapsed between `deprecatedSince` and the audit's
   * `nowFn()` (defaults to `new Date()`). Computed in UTC year-month
   * arithmetic so wall-clock timezone doesn't perturb the result. Always
   * `>= 0` (a `deprecatedSince` in the future clamps to `0`).
   */
  ageMonths: number;
  /**
   * `true` when the caller supplied a `thresholdMonths` and
   * `ageMonths >= thresholdMonths`. Always `false` when no threshold
   * was supplied, even for very-old deprecations — the audit is
   * informational by default and only flips this flag when explicitly
   * asked to enforce a cadence.
   */
  overThreshold: boolean;
};

export type BuildDeprecatedRuleAuditOptions = {
  /**
   * When set, every row whose `ageMonths >= thresholdMonths` is marked
   * `overThreshold: true`. Omit (or set to `undefined`) to disable
   * threshold checking entirely; rows still surface, just with
   * `overThreshold: false`.
   */
  thresholdMonths?: number;
  /**
   * Inject the "now" clock so deterministic tests can drive the
   * `ageMonths` computation. Defaults to `() => new Date()`.
   */
  nowFn?: () => Date;
};

/**
 * Walk every pack's `ProfileRuleDoc[]` and produce one
 * {@link DeprecatedRuleAuditRow} per rule that has a `deprecatedSince`
 * value. Rules without `deprecatedSince` are silently skipped (the
 * audit only reports rules that have explicitly opted into the
 * deprecation flow). Rules with a malformed `deprecatedSince` (not
 * `YYYY-MM` or with an out-of-range month) are also skipped — the
 * audit is informational, not a validator for the deprecation field.
 *
 * Pure function: no I/O, no globals consulted, deterministic given the
 * same inputs and frozen `nowFn`. Sort order is `pack` asc → `ruleId`
 * asc so downstream tooling can render stable tables.
 */
export function buildDeprecatedRuleAudit(
  docsByPack: ReadonlyMap<string, readonly ProfileRuleDoc[]>,
  opts: BuildDeprecatedRuleAuditOptions = {}
): DeprecatedRuleAuditRow[] {
  const now = opts.nowFn ? opts.nowFn() : new Date();
  const threshold = opts.thresholdMonths;
  const rows: DeprecatedRuleAuditRow[] = [];
  for (const [pack, docs] of docsByPack) {
    for (const doc of docs) {
      if (typeof doc.deprecatedSince !== "string" || doc.deprecatedSince.length === 0) {
        continue;
      }
      const ageMonths = computeAgeMonthsUtc(doc.deprecatedSince, now);
      if (ageMonths === undefined) continue;
      const overThreshold = threshold !== undefined && ageMonths >= threshold;
      rows.push({
        pack,
        ruleId: doc.id,
        deprecatedSince: doc.deprecatedSince,
        ageMonths,
        overThreshold
      });
    }
  }
  rows.sort((a, b) => {
    if (a.pack !== b.pack) return a.pack.localeCompare(b.pack);
    return a.ruleId.localeCompare(b.ruleId);
  });
  return rows;
}

function computeAgeMonthsUtc(yyyymm: string, now: Date): number | undefined {
  const match = /^(\d{4})-(\d{2})$/.exec(yyyymm);
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return undefined;
  if (month < 1 || month > 12) return undefined;
  const docTotalMonths = year * 12 + (month - 1);
  const nowTotalMonths = now.getUTCFullYear() * 12 + now.getUTCMonth();
  const delta = nowTotalMonths - docTotalMonths;
  return delta < 0 ? 0 : delta;
}

/**
 * Parse the `--older-than <N>{mo|d}` value into a whole-month
 * threshold. Rejects malformed inputs by returning `undefined` so the
 * CLI can map that into a `CliArgumentError` with a canonical message.
 *
 * Conversions:
 *  - `mo` → integer month count, must be `>= 0`.
 *  - `d`  → days converted to months via `Math.ceil(days / 30)`. The
 *    ceiling avoids the trivial `1d → 0mo` collapse (which would mark
 *    every deprecated rule as over-threshold). `0d` legitimately maps
 *    to `0mo` (caller asked for "every deprecation").
 */
export function parseOlderThanThreshold(value: string): number | undefined {
  const match = /^(\d+)(mo|d)$/.exec(value);
  if (!match) return undefined;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount < 0) return undefined;
  if (match[2] === "mo") return amount;
  if (amount === 0) return 0;
  return Math.ceil(amount / 30);
}
