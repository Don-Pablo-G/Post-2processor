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

async function fillProgram(page: Page, program: string): Promise<void> {
  await page.locator("textarea").first().fill(program);
}

async function openDiagnosticsGroup(page: Page, code: string): Promise<void> {
  const group = page.locator(`[data-testid="parse-diagnostics-group-${code}"]`);
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

test.describe("parse diagnostics audit trail", () => {
  test("records parse_fix_copied with code/block/fix extras", async ({ page }) => {
    await installClipboardStub(page);
    await page.goto("/", { waitUntil: "networkidle" });
    await expect(page.locator('[data-testid="parse-diagnostics-heading"]')).toBeVisible({
      timeout: 12_000
    });

    await fillProgram(page, "G0 X Y1");
    await openDiagnosticsGroup(page, "ADDRESS_MISSING_VALUE");
    await page
      .locator('[data-testid="parse-diagnostics-copy-fix-ADDRESS_MISSING_VALUE-0-0"]')
      .click();

    await openAuditTrail(page);
    const entry = page.locator("li", {
      hasText: /parse_fix_copied/i
    });
    await expect(entry.first()).toBeVisible();
    await expect(entry.first()).toContainText(/code=ADDRESS_MISSING_VALUE/);
    await expect(entry.first()).toContainText(/block=0/);
    await expect(entry.first()).toContainText(/fix=1/);
  });

  test("records parse_fix_group_copied with aggregate fix count", async ({ page }) => {
    await installClipboardStub(page);
    await page.goto("/", { waitUntil: "networkidle" });
    await expect(page.locator('[data-testid="parse-diagnostics-heading"]')).toBeVisible({
      timeout: 12_000
    });

    await fillProgram(page, "G0 X Y1\nG0 X1 Y\nG0 Z");
    await page
      .locator('[data-testid="parse-diagnostics-copy-all-ADDRESS_MISSING_VALUE"]')
      .click();

    await openAuditTrail(page);
    const entry = page.locator("li", { hasText: /parse_fix_group_copied/i });
    await expect(entry.first()).toBeVisible();
    await expect(entry.first()).toContainText(/code=ADDRESS_MISSING_VALUE/);
    await expect(entry.first()).toContainText(/fix=6/);
  });

  test("records parse_fix_group_expanded after Show all click", async ({ page }) => {
    await installClipboardStub(page);
    await page.goto("/", { waitUntil: "networkidle" });
    await expect(page.locator('[data-testid="parse-diagnostics-heading"]')).toBeVisible({
      timeout: 12_000
    });

    const lines = Array.from({ length: 30 }, () => "X").join("\n");
    await fillProgram(page, lines);
    await openDiagnosticsGroup(page, "ADDRESS_MISSING_VALUE");
    await page
      .locator('[data-testid="parse-diagnostics-show-all-ADDRESS_MISSING_VALUE"]')
      .click();

    await openAuditTrail(page);
    const entry = page.locator("li", { hasText: /parse_fix_group_expanded/i });
    await expect(entry.first()).toBeVisible();
    await expect(entry.first()).toContainText(/code=ADDRESS_MISSING_VALUE/);
    await expect(entry.first()).toContainText(/fix=30/);
  });
});
