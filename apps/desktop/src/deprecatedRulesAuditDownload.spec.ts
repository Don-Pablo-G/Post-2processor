import { describe, expect, it } from "vitest";

import {
  buildDeprecatedRulesAuditFilename,
  downloadDeprecatedRulesAuditReport
} from "./deprecatedRulesAuditDownload";

describe("deprecatedRulesAuditDownload", () => {
  it("buildDeprecatedRulesAuditFilename sanitizes ISO timestamps", () => {
    expect(buildDeprecatedRulesAuditFilename("json", "2026-06-22T12:30:15.000Z")).toBe(
      "deprecated-rules-audit-2026-06-22T12-30-15-000Z.json"
    );
  });

  it("downloadDeprecatedRulesAuditReport triggers a browser download", async () => {
    const log = {
      href: undefined as string | undefined,
      download: undefined as string | undefined,
      clicks: 0,
      revoked: false
    };
    const env = {
      createObjectURL: () => "blob:deprecated-audit",
      revokeObjectURL: () => {
        log.revoked = true;
      },
      createAnchor: () =>
        ({
          set href(value: string) {
            log.href = value;
          },
          set download(value: string) {
            log.download = value;
          },
          click: () => {
            log.clicks += 1;
          }
        }) as HTMLAnchorElement,
      scheduleRevoke: (fn: () => void) => fn()
    };

    const result = await downloadDeprecatedRulesAuditReport(
      '{"rows":[]}',
      "json",
      "2026-06-22T12:30:15.000Z",
      env
    );

    expect(result.filename).toBe("deprecated-rules-audit-2026-06-22T12-30-15-000Z.json");
    expect(log.href).toBe("blob:deprecated-audit");
    expect(log.download).toBe(result.filename);
    expect(log.clicks).toBe(1);
    expect(log.revoked).toBe(true);
  });
});
