import { expect, test } from "@playwright/test";

test("manual preset change marks source as manual", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Safety policy preset")).toBeVisible();

  const presetSelect = page.locator("label:has-text('Safety policy preset') select");
  await presetSelect.selectOption("permissive");

  await expect(page.getByText(/Preset source:\s*manual/i)).toBeVisible();
});
