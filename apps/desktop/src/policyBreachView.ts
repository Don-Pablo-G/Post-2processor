export type PolicyBreachLike = {
  key: string;
  observed: number;
  threshold: number;
  severity: "warning" | "blocker";
  firstBlockIndex?: number;
};

export type PolicyBreachExportFormat = "json" | "csv";

/**
 * Rollup-shaped chip matching CLI batch aggregation language:
 * `policy-breach: TOTAL (obs=3), ADDRESS_MISSING_VALUE (obs=1)`.
 */
export function formatPolicyBreachRollupChip(
  breaches: readonly PolicyBreachLike[] | undefined
): string {
  const list = [...(breaches ?? [])].sort((a, b) => a.key.localeCompare(b.key));
  if (list.length === 0) return "policy-breach: none";
  return `policy-breach: ${list
    .map((b) => `${b.key} (obs=${b.observed})`)
    .join(", ")}`;
}

export function formatPolicyBreachesForExport(
  breaches: readonly PolicyBreachLike[] | undefined,
  format: PolicyBreachExportFormat
): string {
  const list = [...(breaches ?? [])].sort((a, b) => a.key.localeCompare(b.key));
  if (format === "json") {
    return JSON.stringify(
      {
        breaches: list.map((b) => ({
          key: b.key,
          observed: b.observed,
          threshold: b.threshold,
          severity: b.severity,
          ...(b.firstBlockIndex !== undefined ? { firstBlockIndex: b.firstBlockIndex } : {})
        }))
      },
      null,
      2
    );
  }
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const lines = ["key,observed,threshold,severity,firstBlockIndex"];
  for (const b of list) {
    lines.push(
      [
        escape(b.key),
        String(b.observed),
        String(b.threshold),
        escape(b.severity),
        b.firstBlockIndex !== undefined ? String(b.firstBlockIndex) : ""
      ].join(",")
    );
  }
  return lines.join("\n");
}
