import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

export async function openPolicyPanel(page: Page): Promise<void> {
  await page.goto("/");
  await expect(page.getByText(/safety policy preset/i)).toBeVisible();
}
