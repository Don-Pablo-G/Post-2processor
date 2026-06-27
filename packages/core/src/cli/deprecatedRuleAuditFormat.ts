import type { DeprecatedRuleAuditRow } from "./auditDeprecatedRules.js";

/**
 * JSON payload shape for `audit-deprecated-rules --format json` and desktop
 * export. Stable `{ rows }` wrapper so consumers can diff outputs.
 */
export function formatDeprecatedRuleAuditAsJson(rows: readonly DeprecatedRuleAuditRow[]): string {
  return JSON.stringify({ rows }, null, 2);
}

function csvEscape(cell: string): string {
  if (/[",\n\r]/.test(cell)) {
    return `"${cell.replace(/"/g, '""')}"`;
  }
  return cell;
}

const CSV_HEADERS = [
  "pack",
  "ruleId",
  "deprecatedSince",
  "ageMonths",
  "overThreshold",
  "replacementSuggestion"
] as const;

/**
 * RFC-4180-style CSV for deprecated-rule audit rows. Header row included.
 */
export function formatDeprecatedRuleAuditAsCsv(rows: readonly DeprecatedRuleAuditRow[]): string {
  const lines = [CSV_HEADERS.join(",")];
  for (const row of rows) {
    lines.push(
      [
        row.pack,
        row.ruleId,
        row.deprecatedSince,
        String(row.ageMonths),
        row.overThreshold ? "true" : "false",
        row.replacementSuggestion ?? ""
      ]
        .map(csvEscape)
        .join(",")
    );
  }
  return `${lines.join("\n")}\n`;
}

/**
 * Fixed-width terminal table for `audit-deprecated-rules --format text`.
 */
export function formatDeprecatedRuleAuditAsText(rows: readonly DeprecatedRuleAuditRow[]): string {
  const headers = [...CSV_HEADERS];
  const widths = headers.map((h) => h.length);
  const cells = rows.map((row) => [
    row.pack,
    row.ruleId,
    row.deprecatedSince,
    String(row.ageMonths),
    row.overThreshold ? "true" : "false",
    row.replacementSuggestion ?? "—"
  ]);
  for (const row of cells) {
    for (let i = 0; i < row.length; i += 1) {
      if (row[i].length > widths[i]) widths[i] = row[i].length;
    }
  }
  const formatRow = (rowCells: readonly string[]) =>
    rowCells.map((cell, i) => cell.padEnd(widths[i], " ")).join("  ").trimEnd();
  return [formatRow(headers), ...cells.map(formatRow)].join("\n");
}
