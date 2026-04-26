import { expect, test } from "@playwright/test";

test("manual preset change marks source as manual", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Safety policy preset")).toBeVisible();

  const presetSelect = page.locator("label:has-text('Safety policy preset') select");
  await presetSelect.selectOption("permissive");

  await expect(page.getByText(/Preset source:\s*manual/i)).toBeVisible();
});

test("save-and-run and shortcut revert update source state", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Safety policy preset")).toBeVisible();

  const presetSelect = page.locator("label:has-text('Safety policy preset') select");
  await presetSelect.selectOption("strict");
  await expect(page.getByText(/Preset source:\s*manual/i)).toBeVisible();

  await page.getByRole("button", { name: "Save preset and run Job Check" }).click();
  await expect(page.getByText(/Preset source:\s*saved/i)).toBeVisible();

  await presetSelect.selectOption("permissive");
  await expect(page.getByText(/Preset source:\s*manual/i)).toBeVisible();
  await page.keyboard.press("Control+Shift+R");
  await expect(page.getByText(/Preset source:\s*bootstrap/i)).toBeVisible();
  await expect(page.getByText(/reverted to controller default/i)).toBeVisible();
});
