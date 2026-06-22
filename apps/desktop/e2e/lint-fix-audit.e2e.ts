import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

async function installClipboardStub(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const nav = navigator as Navigator & { clipboard: { writeText: (value: string) => Promise<void> } };
    Object.defineProperty(nav, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          (window as Window & { __CNC_E2E_LAST_COPIED__?: string }).__CNC_E2E_LAST_COPIED__ = value;
        }
      }
    });
    (window as Window & { __CNC_E2E_LAST_COPIED__?: string }).__CNC_E2E_LAST_COPIED__ = "";
  });
}

async function readLastCopied(page: Page): Promise<string> {
  return await page.evaluate(
    () => (window as Window & { __CNC_E2E_LAST_COPIED__?: string }).__CNC_E2E_LAST_COPIED__ ?? ""
  );
}

async function fillProgram(page: Page, program: string): Promise<void> {
  await page.locator("textarea").first().fill(program);
}

async function openLintGroup(page: Page, source: string): Promise<void> {
  const group = page.locator(`[data-testid="lint-issues-group-${source}"]`);
  await expect(group).toBeVisible();
  await group.evaluate((el) => {
    (el as HTMLDetailsElement).open = true;
  });
}

async function openAuditTrail(page: Page): Promise<void> {
  const summary = page.locator("summary", {
    hasText: /Policy history \(session\)|Historia polityki \(sesja\)/i
  });
  await expect(summary).toBeVisible();
  await summary.click();
}

test.describe("lint fix audit trail", () => {
  test("Copy lint fix writes the canonical LINT FIX line and records lint_fix_copied", async ({ page }) => {
    await installClipboardStub(page);
    await page.goto("/", { waitUntil: "networkidle" });
    await expect(page.locator('[data-testid="parse-diagnostics-heading"]')).toBeVisible({ timeout: 12_000 });

    await fillProgram(page, "N10 O1000\nM30");
    await openLintGroup(page, "controller_grammar");
    await page
      .locator('[data-testid="lint-issues-copy-fix-controller_grammar-0-0"]')
      .click();

    const payload = await readLastCopied(page);
    expect(payload).toMatch(
      /^LINT FIX \| source=controller_grammar block=0 \| Move N number to a separate block from the O header$/
    );

    await openAuditTrail(page);
    const entry = page.locator("li", { hasText: /lint_fix_copied/i });
    await expect(entry.first()).toBeVisible();
    await expect(entry.first()).toContainText(/code=controller_grammar/);
    await expect(entry.first()).toContainText(/block=0/);
    await expect(entry.first()).toContainText(/fix=1/);
  });

  test("Copy all lint fixes in group emits newline-joined payload and lint_fix_group_copied", async ({ page }) => {
    await installClipboardStub(page);
    await page.goto("/", { waitUntil: "networkidle" });
    await expect(page.locator('[data-testid="parse-diagnostics-heading"]')).toBeVisible({ timeout: 12_000 });

    await fillProgram(page, "N10 O1000\nG1 X1. X2.\nG65 P9010 K4. J2. I3.\nM30");
    await page
      .locator('[data-testid="lint-issues-copy-all-controller_grammar"]')
      .click();

    const payload = await readLastCopied(page);
    const lines = payload.split("\n").filter((line) => line.length > 0);
    expect(lines.length).toBeGreaterThanOrEqual(3);
    expect(lines.every((line) => line.startsWith("LINT FIX | source=controller_grammar"))).toBe(true);
    expect(payload).toMatch(/Move N number to a separate block from the O header/);
    expect(payload).toMatch(/Split duplicate X words into two blocks; controller is last-value-wins/);
    expect(payload).toMatch(/Reorder arguments so I appears before J before K/);

    await openAuditTrail(page);
    const entry = page.locator("li", { hasText: /lint_fix_group_copied/i });
    await expect(entry.first()).toBeVisible();
    await expect(entry.first()).toContainText(/code=controller_grammar/);
    await expect(entry.first()).toContainText(new RegExp(`fix=${lines.length}`));
  });

  test("Copy diagnostics audit subset writes only parse_/lint_ rows and records policy_audit_trail_subset_copied", async ({
    page
  }) => {
    await installClipboardStub(page);
    await page.goto("/", { waitUntil: "networkidle" });
    await expect(page.locator('[data-testid="parse-diagnostics-heading"]')).toBeVisible({
      timeout: 12_000
    });

    await fillProgram(page, "N10 O1000\nM30");
    await openLintGroup(page, "controller_grammar");
    await page
      .locator('[data-testid="lint-issues-copy-fix-controller_grammar-0-0"]')
      .click();

    await openAuditTrail(page);
    await page.locator('[data-testid="policy-audit-trail-copy-parse-only"]').click();

    const subsetPayload = await readLastCopied(page);
    const subsetLines = subsetPayload.split("\n").filter((line) => line.length > 0);
    expect(subsetLines.length).toBeGreaterThan(0);
    for (const line of subsetLines) {
      expect(line).toMatch(/event=(parse_|lint_)/);
    }
    expect(subsetPayload).not.toContain("event=manual_selection_changed");
    expect(subsetPayload).not.toContain("event=bootstrap_default_applied");

    const subsetEntry = page.locator("li", { hasText: /policy_audit_trail_subset_copied/i });
    await expect(subsetEntry.first()).toBeVisible();
    await expect(subsetEntry.first()).toContainText(
      new RegExp(`count=${subsetLines.length}`)
    );
    await expect(subsetEntry.first()).toContainText(/severities=subset=parse_lint/);
  });

  test("audit trail export format dropdown emits Markdown payload when set to markdown", async ({
    page
  }) => {
    await installClipboardStub(page);
    await page.goto("/", { waitUntil: "networkidle" });
    await expect(page.locator('[data-testid="parse-diagnostics-heading"]')).toBeVisible({
      timeout: 12_000
    });

    await fillProgram(page, "N10 O1000\nM30");
    await openLintGroup(page, "controller_grammar");
    await page
      .locator('[data-testid="lint-issues-copy-fix-controller_grammar-0-0"]')
      .click();

    await openAuditTrail(page);
    await page
      .locator('[data-testid="policy-audit-trail-export-format"]')
      .selectOption("markdown");
    await page.locator('[data-testid="policy-audit-trail-copy"]').click();

    const payload = await readLastCopied(page);
    const lines = payload.split("\n");
    expect(lines[0]).toBe("| Time | Event | Preset | Source | Controller | Extras |");
    expect(lines[1]).toBe("| --- | --- | --- | --- | --- | --- |");
    expect(lines.length).toBeGreaterThan(2);
    expect(lines[2]).toMatch(/^\| .+ \| .+ \| (strict|balanced|permissive) \| /);

    const auditEntry = page.locator("li", { hasText: /policy_audit_trail_copied/i });
    await expect(auditEntry.first()).toBeVisible();
    await expect(auditEntry.first()).toContainText(/severities=format=markdown/);
  });

  test("audit trail export format dropdown emits NDJSON payload (one JSON object per line) when set to ndjson", async ({
    page
  }) => {
    await installClipboardStub(page);
    await page.goto("/", { waitUntil: "networkidle" });
    await expect(page.locator('[data-testid="parse-diagnostics-heading"]')).toBeVisible({
      timeout: 12_000
    });

    await fillProgram(page, "N10 O1000\nM30");
    await openLintGroup(page, "controller_grammar");
    await page
      .locator('[data-testid="lint-issues-copy-fix-controller_grammar-0-0"]')
      .click();

    await openAuditTrail(page);
    await page
      .locator('[data-testid="policy-audit-trail-export-format"]')
      .selectOption("ndjson");
    await page.locator('[data-testid="policy-audit-trail-copy"]').click();

    const payload = await readLastCopied(page);
    const lines = payload.split("\n").filter((line) => line.length > 0);
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      const parsed = JSON.parse(line);
      expect(typeof parsed.timestampIso).toBe("string");
      expect(typeof parsed.event).toBe("string");
      expect(typeof parsed.preset).toBe("string");
      expect(typeof parsed.controller).toBe("string");
    }

    const auditEntry = page.locator("li", { hasText: /policy_audit_trail_copied/i });
    await expect(auditEntry.first()).toBeVisible();
    await expect(auditEntry.first()).toContainText(/severities=format=ndjson/);
  });

  test("audit trail download button: stubbed Blob URL is created with the right MIME, anchor click fires, telemetry records policy_audit_trail_downloaded", async ({
    page
  }) => {
    // Stub URL.createObjectURL / revokeObjectURL + document.createElement('a')
    // before navigation so the download path never escapes the test sandbox.
    await page.addInitScript(() => {
      const w = window as Window & {
        __CNC_E2E_DOWNLOAD__?: {
          mime: string;
          size: number;
          filename: string;
          clicks: number;
          revokes: string[];
        };
      };
      w.__CNC_E2E_DOWNLOAD__ = {
        mime: "",
        size: 0,
        filename: "",
        clicks: 0,
        revokes: []
      };
      let blobSeq = 0;
      const origCreateObject = URL.createObjectURL.bind(URL);
      URL.createObjectURL = (blob: Blob) => {
        w.__CNC_E2E_DOWNLOAD__!.mime = blob.type;
        w.__CNC_E2E_DOWNLOAD__!.size = blob.size;
        return `blob:cnc-e2e/${++blobSeq}`;
      };
      const origRevoke = URL.revokeObjectURL.bind(URL);
      URL.revokeObjectURL = (url: string) => {
        w.__CNC_E2E_DOWNLOAD__!.revokes.push(url);
      };
      const origCreate = document.createElement.bind(document);
      document.createElement = ((tag: string) => {
        const el = origCreate(tag);
        if (tag === "a") {
          const anchor = el as HTMLAnchorElement;
          const origClick = anchor.click.bind(anchor);
          anchor.click = () => {
            w.__CNC_E2E_DOWNLOAD__!.filename = anchor.download;
            w.__CNC_E2E_DOWNLOAD__!.clicks += 1;
            // Do NOT call origClick - it would attempt a real navigation.
          };
        }
        return el;
        // Unused refs, suppress lint:
        void origCreateObject;
        void origRevoke;
      }) as typeof document.createElement;
    });
    await installClipboardStub(page);
    await page.goto("/", { waitUntil: "networkidle" });
    await expect(page.locator('[data-testid="parse-diagnostics-heading"]')).toBeVisible({
      timeout: 12_000
    });

    await fillProgram(page, "N10 O1000\nM30");
    await openLintGroup(page, "controller_grammar");
    await page
      .locator('[data-testid="lint-issues-copy-fix-controller_grammar-0-0"]')
      .click();

    await openAuditTrail(page);
    await page
      .locator('[data-testid="policy-audit-trail-export-format"]')
      .selectOption("ndjson");
    await page.locator('[data-testid="policy-audit-trail-download"]').click();

    const captured = await page.evaluate(
      () =>
        (
          window as Window & {
            __CNC_E2E_DOWNLOAD__?: {
              mime: string;
              size: number;
              filename: string;
              clicks: number;
              revokes: string[];
            };
          }
        ).__CNC_E2E_DOWNLOAD__
    );
    expect(captured).toBeDefined();
    expect(captured!.clicks).toBe(1);
    expect(captured!.mime).toMatch(/application\/x-ndjson/);
    expect(captured!.size).toBeGreaterThan(0);
    expect(captured!.filename).toMatch(
      /^cnc-audit-trail-\d{8}T\d{6}\.ndjson$/
    );
    expect(captured!.revokes.length).toBeGreaterThanOrEqual(1);

    const downloadEntry = page.locator("li", {
      hasText: /policy_audit_trail_downloaded/i
    });
    await expect(downloadEntry.first()).toBeVisible();
    await expect(downloadEntry.first()).toContainText(/severities=format=ndjson/);
  });

  test("audit trail download + SHA-256 sidecar checkbox: two anchor clicks fire (main + .sha256), telemetry records policy_audit_trail_downloaded_with_sidecar", async ({
    page
  }) => {
    await page.addInitScript(() => {
      type CapturedDownload = { mime: string; size: number; filename: string };
      const w = window as Window & {
        __CNC_E2E_DOWNLOADS__?: CapturedDownload[];
        __CNC_E2E_REVOKES__?: string[];
      };
      w.__CNC_E2E_DOWNLOADS__ = [];
      w.__CNC_E2E_REVOKES__ = [];
      let blobSeq = 0;
      const blobByUrl = new Map<string, Blob>();
      URL.createObjectURL = (blob: Blob) => {
        const url = `blob:cnc-e2e-sidecar/${++blobSeq}`;
        blobByUrl.set(url, blob);
        return url;
      };
      URL.revokeObjectURL = (url: string) => {
        w.__CNC_E2E_REVOKES__!.push(url);
      };
      // Stub crypto.subtle.digest deterministically so the test does not rely
      // on the browser's real SHA-256 implementation timing.
      const origCrypto = window.crypto as Crypto & { subtle: SubtleCrypto };
      Object.defineProperty(window, "crypto", {
        configurable: true,
        value: {
          ...origCrypto,
          subtle: {
            ...origCrypto.subtle,
            digest: async (_algo: string, data: BufferSource) => {
              const view =
                data instanceof ArrayBuffer
                  ? new Uint8Array(data)
                  : new Uint8Array(
                      data.buffer,
                      data.byteOffset,
                      data.byteLength
                    );
              const seed = view.length > 0 ? view[0] : 0;
              return new Uint8Array(32).fill(seed).buffer;
            }
          }
        }
      });
      const origCreate = document.createElement.bind(document);
      document.createElement = ((tag: string) => {
        const el = origCreate(tag);
        if (tag === "a") {
          const anchor = el as HTMLAnchorElement;
          anchor.click = () => {
            const blob = blobByUrl.get(anchor.href);
            w.__CNC_E2E_DOWNLOADS__!.push({
              mime: blob ? blob.type : "",
              size: blob ? blob.size : 0,
              filename: anchor.download
            });
          };
        }
        return el;
      }) as typeof document.createElement;
    });
    await installClipboardStub(page);
    await page.goto("/", { waitUntil: "networkidle" });
    await expect(page.locator('[data-testid="parse-diagnostics-heading"]')).toBeVisible({
      timeout: 12_000
    });

    await fillProgram(page, "N10 O1000\nM30");
    await openLintGroup(page, "controller_grammar");
    await page
      .locator('[data-testid="lint-issues-copy-fix-controller_grammar-0-0"]')
      .click();

    await openAuditTrail(page);
    await page
      .locator('[data-testid="policy-audit-trail-export-format"]')
      .selectOption("ndjson");
    await page
      .locator('[data-testid="policy-audit-trail-download-with-sidecar"]')
      .check();
    await page.locator('[data-testid="policy-audit-trail-download"]').click();

    // Wait until both anchor clicks have been captured (the sidecar download
    // is fired after an awaited crypto.subtle.digest, so it lands in a later
    // microtask than the main download).
    await page.waitForFunction(
      () =>
        (
          (window as Window & {
            __CNC_E2E_DOWNLOADS__?: Array<{ filename: string }>;
          }).__CNC_E2E_DOWNLOADS__ ?? []
        ).length >= 2
    );
    const captured = await page.evaluate(
      () =>
        (window as Window & {
          __CNC_E2E_DOWNLOADS__?: Array<{
            mime: string;
            size: number;
            filename: string;
          }>;
        }).__CNC_E2E_DOWNLOADS__ ?? []
    );
    expect(captured).toHaveLength(2);
    expect(captured[0].mime).toMatch(/application\/x-ndjson/);
    expect(captured[0].filename).toMatch(/^cnc-audit-trail-\d{8}T\d{6}\.ndjson$/);
    expect(captured[1].mime).toMatch(/text\/plain/);
    expect(captured[1].filename).toBe(`${captured[0].filename}.sha256`);
    expect(captured[1].size).toBeGreaterThan(0);

    const sidecarEntry = page.locator("li", {
      hasText: /policy_audit_trail_downloaded_with_sidecar/i
    });
    await expect(sidecarEntry.first()).toBeVisible();
    await expect(sidecarEntry.first()).toContainText(/sidecar=sha256/);
  });

  test("audit trail download + HMAC sidecar checkbox + secret: three anchor clicks fire (main + .sha256 + .hmac-sha256), telemetry records policy_audit_trail_downloaded_with_hmac_sidecar", async ({
    page
  }) => {
    await page.addInitScript(() => {
      type CapturedDownload = { mime: string; size: number; filename: string };
      const w = window as Window & {
        __CNC_E2E_DOWNLOADS__?: CapturedDownload[];
        __CNC_E2E_REVOKES__?: string[];
      };
      w.__CNC_E2E_DOWNLOADS__ = [];
      w.__CNC_E2E_REVOKES__ = [];
      let blobSeq = 0;
      const blobByUrl = new Map<string, Blob>();
      URL.createObjectURL = (blob: Blob) => {
        const url = `blob:cnc-e2e-hmac/${++blobSeq}`;
        blobByUrl.set(url, blob);
        return url;
      };
      URL.revokeObjectURL = (url: string) => {
        w.__CNC_E2E_REVOKES__!.push(url);
      };
      // Stub crypto.subtle digest + importKey + sign deterministically. The
      // browser's real implementations would also work but the test would
      // then have to compute HMAC-SHA-256 in the assertion arm; the stub
      // keeps the contract test focused on plumbing (3 anchors fire, the
      // third file ends with .hmac-sha256, telemetry includes hmac=sha256).
      const origCrypto = window.crypto as Crypto & { subtle: SubtleCrypto };
      Object.defineProperty(window, "crypto", {
        configurable: true,
        value: {
          ...origCrypto,
          subtle: {
            ...origCrypto.subtle,
            digest: async (_algo: string, data: BufferSource) => {
              const view =
                data instanceof ArrayBuffer
                  ? new Uint8Array(data)
                  : new Uint8Array(
                      data.buffer,
                      data.byteOffset,
                      data.byteLength
                    );
              const seed = view.length > 0 ? view[0] : 0;
              return new Uint8Array(32).fill(seed).buffer;
            },
            importKey: async () => ({ __cnc_stub_key: true }),
            sign: async () => new Uint8Array(32).fill(0xab).buffer
          } as unknown as SubtleCrypto
        }
      });
      const origCreate = document.createElement.bind(document);
      document.createElement = ((tag: string) => {
        const el = origCreate(tag);
        if (tag === "a") {
          const anchor = el as HTMLAnchorElement;
          anchor.click = () => {
            const blob = blobByUrl.get(anchor.href);
            w.__CNC_E2E_DOWNLOADS__!.push({
              mime: blob ? blob.type : "",
              size: blob ? blob.size : 0,
              filename: anchor.download
            });
          };
        }
        return el;
      }) as typeof document.createElement;
    });
    await installClipboardStub(page);
    await page.goto("/", { waitUntil: "networkidle" });
    await expect(page.locator('[data-testid="parse-diagnostics-heading"]')).toBeVisible({
      timeout: 12_000
    });

    await fillProgram(page, "N10 O1000\nM30");
    await openLintGroup(page, "controller_grammar");
    await page
      .locator('[data-testid="lint-issues-copy-fix-controller_grammar-0-0"]')
      .click();

    await openAuditTrail(page);
    await page
      .locator('[data-testid="policy-audit-trail-export-format"]')
      .selectOption("ndjson");
    await page
      .locator('[data-testid="policy-audit-trail-download-with-sidecar"]')
      .check();
    await page
      .locator('[data-testid="policy-audit-trail-download-with-hmac"]')
      .check();
    await page
      .locator('[data-testid="policy-audit-trail-hmac-secret"]')
      .fill("shop-secret");
    await page.locator('[data-testid="policy-audit-trail-download"]').click();

    await page.waitForFunction(
      () =>
        (
          (window as Window & {
            __CNC_E2E_DOWNLOADS__?: Array<{ filename: string }>;
          }).__CNC_E2E_DOWNLOADS__ ?? []
        ).length >= 3
    );
    const captured = await page.evaluate(
      () =>
        (window as Window & {
          __CNC_E2E_DOWNLOADS__?: Array<{
            mime: string;
            size: number;
            filename: string;
          }>;
        }).__CNC_E2E_DOWNLOADS__ ?? []
    );
    expect(captured).toHaveLength(3);
    expect(captured[0].mime).toMatch(/application\/x-ndjson/);
    expect(captured[0].filename).toMatch(/^cnc-audit-trail-\d{8}T\d{6}\.ndjson$/);
    expect(captured[1].filename).toBe(`${captured[0].filename}.sha256`);
    expect(captured[2].mime).toMatch(/text\/plain/);
    expect(captured[2].filename).toBe(`${captured[0].filename}.hmac-sha256`);
    expect(captured[2].size).toBeGreaterThan(0);

    const hmacEntry = page.locator("li", {
      hasText: /policy_audit_trail_downloaded_with_hmac_sidecar/i
    });
    await expect(hmacEntry.first()).toBeVisible();
    await expect(hmacEntry.first()).toContainText(/hmac=sha256/);
  });

  test("audit trail download + SHA-256 + HMAC + AES-GCM: four anchor clicks fire (main + .sha256 + .hmac-sha256 + .aes-gcm), telemetry records policy_audit_trail_downloaded_with_encryption", async ({
    page
  }) => {
    await page.addInitScript(() => {
      type CapturedDownload = { mime: string; size: number; filename: string };
      const w = window as Window & {
        __CNC_E2E_DOWNLOADS__?: CapturedDownload[];
        __CNC_E2E_REVOKES__?: string[];
      };
      w.__CNC_E2E_DOWNLOADS__ = [];
      w.__CNC_E2E_REVOKES__ = [];
      let blobSeq = 0;
      const blobByUrl = new Map<string, Blob>();
      URL.createObjectURL = (blob: Blob) => {
        const url = `blob:cnc-e2e-aesgcm/${++blobSeq}`;
        blobByUrl.set(url, blob);
        return url;
      };
      URL.revokeObjectURL = (url: string) => {
        w.__CNC_E2E_REVOKES__!.push(url);
      };
      // Stub Web Crypto across all four primitives the download plumbing
      // touches: digest (SHA-256 sidecar), importKey + sign (HMAC), and
      // importKey + deriveKey + encrypt (AES-GCM). We also stub
      // getRandomValues so the salt + iv are deterministic across runs.
      const origCrypto = window.crypto as Crypto & { subtle: SubtleCrypto };
      let randSeed = 0;
      Object.defineProperty(window, "crypto", {
        configurable: true,
        value: {
          ...origCrypto,
          getRandomValues: (buf: Uint8Array) => {
            for (let i = 0; i < buf.length; i += 1) buf[i] = ++randSeed & 0xff;
            return buf;
          },
          subtle: {
            ...origCrypto.subtle,
            digest: async (_algo: string, data: BufferSource) => {
              const view =
                data instanceof ArrayBuffer
                  ? new Uint8Array(data)
                  : new Uint8Array(
                      data.buffer,
                      data.byteOffset,
                      data.byteLength
                    );
              const seed = view.length > 0 ? view[0] : 0;
              return new Uint8Array(32).fill(seed).buffer;
            },
            importKey: async () => ({ __cnc_stub_key: true }),
            sign: async () => new Uint8Array(32).fill(0xab).buffer,
            deriveKey: async () => ({ __cnc_stub_aes_key: true }),
            encrypt: async (_algo: unknown, _key: unknown, data: BufferSource) => {
              const view =
                data instanceof ArrayBuffer
                  ? new Uint8Array(data)
                  : new Uint8Array(
                      data.buffer,
                      data.byteOffset,
                      data.byteLength
                    );
              const ct = new Uint8Array(view.length + 16);
              for (let i = 0; i < view.length; i += 1) ct[i] = view[i] ^ 0x55;
              return ct.buffer;
            }
          } as unknown as SubtleCrypto
        }
      });
      const origCreate = document.createElement.bind(document);
      document.createElement = ((tag: string) => {
        const el = origCreate(tag);
        if (tag === "a") {
          const anchor = el as HTMLAnchorElement;
          anchor.click = () => {
            const blob = blobByUrl.get(anchor.href);
            w.__CNC_E2E_DOWNLOADS__!.push({
              mime: blob ? blob.type : "",
              size: blob ? blob.size : 0,
              filename: anchor.download
            });
          };
        }
        return el;
      }) as typeof document.createElement;
    });
    await installClipboardStub(page);
    await page.goto("/", { waitUntil: "networkidle" });
    await expect(page.locator('[data-testid="parse-diagnostics-heading"]')).toBeVisible({
      timeout: 12_000
    });

    await fillProgram(page, "N10 O1000\nM30");
    await openLintGroup(page, "controller_grammar");
    await page
      .locator('[data-testid="lint-issues-copy-fix-controller_grammar-0-0"]')
      .click();

    await openAuditTrail(page);
    await page
      .locator('[data-testid="policy-audit-trail-export-format"]')
      .selectOption("ndjson");
    await page
      .locator('[data-testid="policy-audit-trail-download-with-sidecar"]')
      .check();
    await page
      .locator('[data-testid="policy-audit-trail-download-with-hmac"]')
      .check();
    await page
      .locator('[data-testid="policy-audit-trail-hmac-secret"]')
      .fill("shop-secret");
    await page
      .locator('[data-testid="policy-audit-trail-download-with-encryption"]')
      .check();
    await page
      .locator('[data-testid="policy-audit-trail-encryption-secret"]')
      .fill("encrypt-secret");
    await page.locator('[data-testid="policy-audit-trail-download"]').click();

    await page.waitForFunction(
      () =>
        (
          (window as Window & {
            __CNC_E2E_DOWNLOADS__?: Array<{ filename: string }>;
          }).__CNC_E2E_DOWNLOADS__ ?? []
        ).length >= 4
    );
    const captured = await page.evaluate(
      () =>
        (window as Window & {
          __CNC_E2E_DOWNLOADS__?: Array<{
            mime: string;
            size: number;
            filename: string;
          }>;
        }).__CNC_E2E_DOWNLOADS__ ?? []
    );
    expect(captured).toHaveLength(4);
    expect(captured[0].mime).toMatch(/application\/x-ndjson/);
    expect(captured[0].filename).toMatch(/^cnc-audit-trail-\d{8}T\d{6}\.ndjson$/);
    expect(captured[1].filename).toBe(`${captured[0].filename}.sha256`);
    expect(captured[2].filename).toBe(`${captured[0].filename}.hmac-sha256`);
    expect(captured[3].mime).toMatch(/application\/octet-stream/);
    expect(captured[3].filename).toBe(`${captured[0].filename}.aes-gcm`);
    expect(captured[3].size).toBeGreaterThan(0);

    const encryptionEntry = page.locator("li", {
      hasText: /policy_audit_trail_downloaded_with_encryption/i
    });
    await expect(encryptionEntry.first()).toBeVisible();
    await expect(encryptionEntry.first()).toContainText(/encryption=aes-gcm/);
  });
});
