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

export function policyRevertButton(page: Page) {
  return page.locator("xpath=(//label[.//select[.//option[@value='strict']]][1]//button)[1]");
}

export function policyLockToggle(page: Page) {
  // Stable data-testid; an earlier index-based xpath turned out to be
  // ambiguous as soon as a sibling control added another <input type=checkbox>
  // earlier in document order (e.g. the audit-trail SHA-256 sidecar checkbox).
  return page.locator("[data-testid='policy-lock-manual-changes']");
}
