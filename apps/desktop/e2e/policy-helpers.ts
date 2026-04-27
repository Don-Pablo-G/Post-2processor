import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

export async function openPolicyPanel(page: Page): Promise<void> {
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(policyPresetSelect(page)).toBeVisible({ timeout: 12_000 });
  await expect(policyPresetSelect(page)).toBeEnabled({ timeout: 12_000 });
}

export function policyPresetSelect(page: Page) {
  return page.locator("select:has(option[value='strict']):has(option[value='balanced']):has(option[value='permissive'])").first();
}
