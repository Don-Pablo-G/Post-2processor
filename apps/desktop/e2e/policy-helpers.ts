import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

export async function openPolicyPanel(page: Page): Promise<void> {
  await page.goto("/");
  await expect(policyPresetSelect(page)).toBeVisible();
}

export function policyPresetSelect(page: Page) {
  return page.locator("select:has(option[value='strict']):has(option[value='balanced']):has(option[value='permissive'])").first();
}
