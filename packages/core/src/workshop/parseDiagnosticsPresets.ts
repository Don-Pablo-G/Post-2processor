import type { ParseDiagnosticsThresholdPolicy } from "../types.js";

export type ParseDiagnosticsPolicyPresetId = "strict" | "balanced" | "permissive";

export const PARSE_DIAGNOSTICS_POLICY_PRESET_IDS: ReadonlyArray<ParseDiagnosticsPolicyPresetId> = [
  "strict",
  "balanced",
  "permissive"
];

export function resolveParseDiagnosticsPolicyPreset(
  preset: ParseDiagnosticsPolicyPresetId
): ParseDiagnosticsThresholdPolicy | undefined {
  switch (preset) {
    case "strict":
      return { severity: "blocker", blockExport: true, thresholds: { TOTAL: 0 } };
    case "balanced":
      return { severity: "warning", blockExport: false, thresholds: { TOTAL: 10 } };
    case "permissive":
      return undefined;
  }
}
