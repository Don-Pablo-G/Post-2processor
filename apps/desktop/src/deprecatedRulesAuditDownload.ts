export type DeprecatedRulesAuditExportFormat = "json" | "csv";

export type DeprecatedRulesAuditDownloadEnvironment = {
  createObjectURL(blob: Blob): string;
  revokeObjectURL(url: string): void;
  createAnchor(): HTMLAnchorElement;
  scheduleRevoke(fn: () => void): void;
};

function defaultEnvironment(): DeprecatedRulesAuditDownloadEnvironment {
  return {
    createObjectURL: (blob) => URL.createObjectURL(blob),
    revokeObjectURL: (url) => URL.revokeObjectURL(url),
    createAnchor: () => document.createElement("a"),
    scheduleRevoke: (fn) => {
      queueMicrotask(fn);
    }
  };
}

function mimeTypeForFormat(format: DeprecatedRulesAuditExportFormat): string {
  return format === "json" ? "application/json;charset=utf-8" : "text/csv;charset=utf-8";
}

export function buildDeprecatedRulesAuditFilename(
  format: DeprecatedRulesAuditExportFormat,
  timestampIso: string
): string {
  const stamp = timestampIso.replace(/[:.]/g, "-");
  return `deprecated-rules-audit-${stamp}.${format}`;
}

export type DownloadDeprecatedRulesAuditResult = {
  filename: string;
};

/**
 * Trigger a browser download of a deprecated-rules audit report payload.
 */
export async function downloadDeprecatedRulesAuditReport(
  payload: string,
  format: DeprecatedRulesAuditExportFormat,
  timestampIso: string,
  env: DeprecatedRulesAuditDownloadEnvironment = defaultEnvironment()
): Promise<DownloadDeprecatedRulesAuditResult> {
  const filename = buildDeprecatedRulesAuditFilename(format, timestampIso);
  const blob = new Blob([payload], { type: mimeTypeForFormat(format) });
  const url = env.createObjectURL(blob);
  const anchor = env.createAnchor();
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  env.scheduleRevoke(() => env.revokeObjectURL(url));
  return { filename };
}
