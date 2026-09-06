export type SafetyFindingLike = {
  code: string;
  severity: "blocker" | "warning";
  blockIndex?: number;
};

export type SafetyFindingsByCodeRow = {
  code: string;
  count: number;
  blockers: number;
  warnings: number;
  firstBlockIndex?: number;
};

/**
 * Build a per-code rollup from advisor + simulation findings (mirrors CLI
 * Schema v15 `safetyFindingsByCode`).
 */
export function buildSafetyFindingsByCodeFromFindings(
  findings: readonly SafetyFindingLike[] | undefined
): SafetyFindingsByCodeRow[] {
  const list = findings ?? [];
  if (list.length === 0) return [];
  const buckets = new Map<
    string,
    { count: number; blockers: number; warnings: number; firstBlockIndex?: number }
  >();
  for (const finding of list) {
    if (typeof finding.code !== "string" || finding.code.length === 0) continue;
    let bucket = buckets.get(finding.code);
    if (!bucket) {
      bucket = { count: 0, blockers: 0, warnings: 0 };
      buckets.set(finding.code, bucket);
    }
    bucket.count += 1;
    if (finding.severity === "blocker") bucket.blockers += 1;
    else bucket.warnings += 1;
    if (finding.blockIndex !== undefined) {
      if (bucket.firstBlockIndex === undefined || finding.blockIndex < bucket.firstBlockIndex) {
        bucket.firstBlockIndex = finding.blockIndex;
      }
    }
  }
  const rows: SafetyFindingsByCodeRow[] = [];
  for (const [code, bucket] of buckets) {
    rows.push({
      code,
      count: bucket.count,
      blockers: bucket.blockers,
      warnings: bucket.warnings,
      ...(bucket.firstBlockIndex !== undefined ? { firstBlockIndex: bucket.firstBlockIndex } : {})
    });
  }
  rows.sort((a, b) => {
    if (a.blockers !== b.blockers) return b.blockers - a.blockers;
    if (a.count !== b.count) return b.count - a.count;
    return a.code.localeCompare(b.code);
  });
  return rows;
}

export function formatSafetyFindingsChip(rows: readonly SafetyFindingsByCodeRow[]): string {
  if (rows.length === 0) return "safety: none";
  const blockers = rows.reduce((acc, r) => acc + r.blockers, 0);
  const warnings = rows.reduce((acc, r) => acc + r.warnings, 0);
  const top = rows
    .slice(0, 3)
    .map((r) => r.code)
    .join(",");
  return `safety: blockers=${blockers}, warnings=${warnings} | top=${top || "n/a"}`;
}

export function formatSafetyFindingsForExport(
  rows: readonly SafetyFindingsByCodeRow[],
  format: "json" | "csv" = "json"
): string {
  if (format === "json") {
    return JSON.stringify({ safetyFindingsByCode: rows }, null, 2);
  }
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const lines = ["code,count,blockers,warnings,firstBlockIndex"];
  for (const row of rows) {
    lines.push(
      [
        escape(row.code),
        String(row.count),
        String(row.blockers),
        String(row.warnings),
        row.firstBlockIndex !== undefined ? String(row.firstBlockIndex) : ""
      ].join(",")
    );
  }
  return lines.join("\n");
}
