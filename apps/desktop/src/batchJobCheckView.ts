import type { RunJobCheckResult } from "@cnc/core/browser";

import {
  buildSafetyFindingsByCodeFromFindings,
  type SafetyFindingsByCodeRow
} from "./safetyFindingsView";
import type { PolicyBreachLike } from "./policyBreachView";

const BATCH_INPUT_EXTENSIONS = /\.(nc|tap|gcode)$/i;

export type DesktopBatchFile = {
  input: string;
  source: string;
};

export type DesktopBatchEntry = {
  input: string;
  blocked: boolean;
  result: RunJobCheckResult;
};

export type DesktopBatchPolicyBreachAgg = {
  key: string;
  count: number;
  inputs: string[];
  totalObserved: number;
  severity: "warning" | "blocker";
};

export type DesktopBatchSafetyAgg = SafetyFindingsByCodeRow & {
  inputs: string[];
};

export type DesktopBatchSummary = {
  files: number;
  blocked: number;
  safetyFindingsByCodeAggregated?: DesktopBatchSafetyAgg[];
  parseDiagnosticsPolicyBreachesAggregated?: DesktopBatchPolicyBreachAgg[];
};

export type DesktopBatchJobCheckResult = {
  summary: DesktopBatchSummary;
  entries: DesktopBatchEntry[];
};

export function isBatchJobCheckFilename(name: string): boolean {
  return BATCH_INPUT_EXTENSIONS.test(name);
}

export function filterBatchJobCheckFiles(
  files: ReadonlyArray<{ name: string; webkitRelativePath?: string }>
): Array<{ name: string; relativePath: string }> {
  const out: Array<{ name: string; relativePath: string }> = [];
  for (const file of files) {
    const relativePath =
      typeof file.webkitRelativePath === "string" && file.webkitRelativePath.length > 0
        ? file.webkitRelativePath
        : file.name;
    const base = relativePath.split(/[/\\]/).pop() ?? file.name;
    // Non-recursive: only files directly in the selected folder (no subdirs).
    const depth = relativePath.split(/[/\\]/).filter(Boolean).length;
    if (depth > 1) continue;
    if (!isBatchJobCheckFilename(base)) continue;
    out.push({ name: base, relativePath: base });
  }
  out.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  return out;
}

export function buildDesktopBatchSummary(entries: readonly DesktopBatchEntry[]): DesktopBatchSummary {
  const blocked = entries.reduce((acc, e) => acc + (e.blocked ? 1 : 0), 0);
  const safetyByCode = new Map<string, DesktopBatchSafetyAgg>();
  const breachByKey = new Map<string, DesktopBatchPolicyBreachAgg>();

  for (const entry of entries) {
    const safetyRows = buildSafetyFindingsByCodeFromFindings([
      ...(entry.result.advisor?.safetyFindings ?? []),
      ...(entry.result.simulationFindings ?? [])
    ]);
    for (const row of safetyRows) {
      let bucket = safetyByCode.get(row.code);
      if (!bucket) {
        bucket = { ...row, inputs: [] };
        safetyByCode.set(row.code, bucket);
      } else {
        bucket.count += row.count;
        bucket.blockers += row.blockers;
        bucket.warnings += row.warnings;
        if (
          row.firstBlockIndex !== undefined &&
          (bucket.firstBlockIndex === undefined || row.firstBlockIndex < bucket.firstBlockIndex)
        ) {
          bucket.firstBlockIndex = row.firstBlockIndex;
        }
      }
      if (!bucket.inputs.includes(entry.input)) bucket.inputs.push(entry.input);
    }

    for (const breach of entry.result.parseDiagnosticsPolicyBreaches ?? []) {
      let bucket = breachByKey.get(breach.key);
      if (!bucket) {
        bucket = {
          key: breach.key,
          count: 0,
          inputs: [],
          totalObserved: 0,
          severity: "warning"
        };
        breachByKey.set(breach.key, bucket);
      }
      if (!bucket.inputs.includes(entry.input)) {
        bucket.count += 1;
        bucket.inputs.push(entry.input);
      }
      bucket.totalObserved += breach.observed;
      if (breach.severity === "blocker") bucket.severity = "blocker";
    }
  }

  const safetyFindingsByCodeAggregated = [...safetyByCode.values()]
    .map((row) => ({
      ...row,
      inputs: [...row.inputs].sort((a, b) => a.localeCompare(b))
    }))
    .sort((a, b) => {
      if (a.count !== b.count) return b.count - a.count;
      return a.code.localeCompare(b.code);
    });

  const parseDiagnosticsPolicyBreachesAggregated = [...breachByKey.values()]
    .map((row) => ({
      ...row,
      inputs: [...row.inputs].sort((a, b) => a.localeCompare(b))
    }))
    .sort((a, b) => {
      if (a.count !== b.count) return b.count - a.count;
      return a.key.localeCompare(b.key);
    });

  const summary: DesktopBatchSummary = {
    files: entries.length,
    blocked
  };
  if (safetyFindingsByCodeAggregated.length > 0) {
    summary.safetyFindingsByCodeAggregated = safetyFindingsByCodeAggregated;
  }
  if (parseDiagnosticsPolicyBreachesAggregated.length > 0) {
    summary.parseDiagnosticsPolicyBreachesAggregated = parseDiagnosticsPolicyBreachesAggregated;
  }
  return summary;
}

export async function runDesktopBatchJobCheck(
  files: ReadonlyArray<DesktopBatchFile>,
  runOne: (source: string) => Promise<RunJobCheckResult>
): Promise<DesktopBatchJobCheckResult> {
  const entries: DesktopBatchEntry[] = [];
  for (const file of files) {
    const result = await runOne(file.source);
    entries.push({
      input: file.input,
      blocked: result.blocked,
      result
    });
  }
  return {
    summary: buildDesktopBatchSummary(entries),
    entries
  };
}

export function formatDesktopBatchSummaryChip(summary: DesktopBatchSummary): string {
  const safety = summary.safetyFindingsByCodeAggregated?.length ?? 0;
  const breaches = summary.parseDiagnosticsPolicyBreachesAggregated?.length ?? 0;
  return `batch: files=${summary.files}, blocked=${summary.blocked}, safetyCodes=${safety}, breachKeys=${breaches}`;
}

export function formatDesktopBatchSummaryForExport(summary: DesktopBatchSummary): string {
  return JSON.stringify(summary, null, 2);
}

export function formatDesktopBatchPolicyBreachChip(
  rows: readonly DesktopBatchPolicyBreachAgg[] | undefined
): string {
  const list = [...(rows ?? [])].sort((a, b) => a.key.localeCompare(b.key));
  if (list.length === 0) return "batch-policy-breach: none";
  return `batch-policy-breach: ${list
    .map((b) => `${b.key} (files=${b.count}, obs=${b.totalObserved})`)
    .join(", ")}`;
}

export function formatDesktopBatchSafetyChip(
  rows: readonly DesktopBatchSafetyAgg[] | undefined
): string {
  const list = rows ?? [];
  if (list.length === 0) return "batch-safety: none";
  const top = list
    .slice(0, 3)
    .map((r) => r.code)
    .join(",");
  return `batch-safety: codes=${list.length} | top=${top || "n/a"}`;
}

export type { PolicyBreachLike };
