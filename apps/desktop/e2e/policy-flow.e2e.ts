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

test("export shows policy context confirmation card", async ({ page }) => {
  await page.addInitScript(() => {
    (window as Window & { __CNC_E2E_EXPORT_MOCK__?: { exportDirectory: string; artifactCount: number } }).__CNC_E2E_EXPORT_MOCK__ =
      {
        exportDirectory: "C:/mock-export",
        artifactCount: 4
      };
  });
  await page.goto("/");

  await page.getByRole("button", { name: "Export now" }).click();
  await expect(page.getByText("Export policy context")).toBeVisible();
  await expect(page.getByText("dir=C:/mock-export")).toBeVisible();
  await expect(page.getByText("artifacts=4")).toBeVisible();
  await expect(page.getByText(/preset=(strict|balanced|permissive)/i)).toBeVisible();
  await expect(page.getByText(/source=(saved|bootstrap|manual)/i)).toBeVisible();
  await expect(page.getByText(/controller=(haas-ngc|haas-legacy|fanuc)/i)).toBeVisible();
});
