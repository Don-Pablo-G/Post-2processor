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
  return (await page.evaluate(() => {
    return (window as Window & { __CNC_E2E_LAST_COPIED__?: string }).__CNC_E2E_LAST_COPIED__ ?? "";
  })) as string;
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

test.describe("parse diagnostics panel", () => {
  test("renders diagnostic groups for malformed input", async ({ page }) => {
    await installClipboardStub(page);
    await page.goto("/", { waitUntil: "networkidle" });
    await expect(page.locator('[data-testid="parse-diagnostics-heading"]')).toBeVisible({
      timeout: 12_000
    });

    await fillProgram(page, "G0 X1 (NO CLOSE\nG0 X Y1\nG1 @@@ X1\nX[#100+]");

    await expect(page.locator('[data-testid="parse-diagnostics-list"]')).toBeVisible();
    await expect(
      page.locator('[data-testid="parse-diagnostics-group-UNMATCHED_OPEN_PAREN"]')
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="parse-diagnostics-group-ADDRESS_MISSING_VALUE"]')
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="parse-diagnostics-group-UNKNOWN_TOKEN"]')
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="parse-diagnostics-group-BRACKET_EXPRESSION_INVALID"]')
    ).toBeVisible();
  });

  test("Copy fix text writes the canonical PARSE FIX line for a single suggestion", async ({ page }) => {
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

    await expect(page.locator("body")).toContainText(
      /Copied parse fix|Skopiowano poprawkę parsera/i
    );
    const copied = await readLastCopied(page);
    expect(copied).toBe(
      "PARSE FIX | code=ADDRESS_MISSING_VALUE block=0 | Add numeric value after X -> X0"
    );
  });

  test("Copy all fixes in group produces newline-joined payload covering all items", async ({ page }) => {
    await installClipboardStub(page);
    await page.goto("/", { waitUntil: "networkidle" });
    await expect(page.locator('[data-testid="parse-diagnostics-heading"]')).toBeVisible({
      timeout: 12_000
    });

    await fillProgram(page, "G0 X Y1\nG0 X1 Y\nG0 Z");

    await page
      .locator('[data-testid="parse-diagnostics-copy-all-ADDRESS_MISSING_VALUE"]')
      .click();

    await expect(page.locator("body")).toContainText(
      /Copied parse fixes for|Skopiowano poprawki parsera dla/i
    );
    const copied = await readLastCopied(page);
    const lines = copied.split("\n");
    expect(lines.length).toBeGreaterThanOrEqual(3);
    expect(lines.every((line) => line.startsWith("PARSE FIX | code=ADDRESS_MISSING_VALUE"))).toBe(true);
    expect(lines.some((line) => line.includes("Add numeric value after X -> X0"))).toBe(true);
    expect(lines.some((line) => line.includes("Add numeric value after Y -> Y0"))).toBe(true);
    expect(lines.some((line) => line.includes("Add numeric value after Z -> Z0"))).toBe(true);
  });

  test("Show all reveals capped-over diagnostics", async ({ page }) => {
    await installClipboardStub(page);
    await page.goto("/", { waitUntil: "networkidle" });
    await expect(page.locator('[data-testid="parse-diagnostics-heading"]')).toBeVisible({
      timeout: 12_000
    });

    const lines = Array.from({ length: 30 }, () => "X").join("\n");
    await fillProgram(page, lines);

    await openDiagnosticsGroup(page, "ADDRESS_MISSING_VALUE");

    const capRow = page.locator('[data-testid="parse-diagnostics-cap-ADDRESS_MISSING_VALUE"]');
    await expect(capRow).toBeVisible();
    await expect(capRow).toContainText(/(hidden|ukrytych)/i);

    await page
      .locator('[data-testid="parse-diagnostics-show-all-ADDRESS_MISSING_VALUE"]')
      .click();

    await expect(capRow).toHaveCount(0);
    const items = page.locator(
      '[data-testid^="parse-diagnostics-item-ADDRESS_MISSING_VALUE-"]'
    );
    await expect(items).toHaveCount(30);
  });

  test("Jump to block focuses the program textarea", async ({ page }) => {
    await installClipboardStub(page);
    await page.goto("/", { waitUntil: "networkidle" });
    await expect(page.locator('[data-testid="parse-diagnostics-heading"]')).toBeVisible({
      timeout: 12_000
    });

    await fillProgram(page, "G0 X1\nG0 X Y1\nG1 X1");

    await openDiagnosticsGroup(page, "ADDRESS_MISSING_VALUE");
    await page
      .locator('[data-testid="parse-diagnostics-jump-ADDRESS_MISSING_VALUE-0"]')
      .click();

    await expect(page.locator("textarea").first()).toBeFocused();
  });
});
