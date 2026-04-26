import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

async function openPolicyPanel(page: Page): Promise<void> {
  await page.goto("/");
  await expect(page.getByText(/safety policy preset/i)).toBeVisible();
}

test("manual preset change marks source as manual", async ({ page }) => {
  await openPolicyPanel(page);

  const presetSelect = page.locator("label:has-text(/safety policy preset/i) select");
  await presetSelect.selectOption("permissive");

  await expect(page.getByText(/Preset source:\s*manual/i)).toBeVisible();
});

test("save-and-run and shortcut revert update source state", async ({ page }) => {
  await openPolicyPanel(page);

  const presetSelect = page.locator("label:has-text(/safety policy preset/i) select");
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
  await openPolicyPanel(page);

  await page.getByRole("button", { name: "Export now" }).click();
  await expect(page.getByText("Export policy context")).toBeVisible();
  await expect(page.getByText("dir=C:/mock-export")).toBeVisible();
  await expect(page.getByText("artifacts=4")).toBeVisible();
  await expect(page.getByText(/preset=(strict|balanced|permissive)/i)).toBeVisible();
  await expect(page.getByText(/source=(saved|bootstrap|manual)/i)).toBeVisible();
  await expect(page.getByText(/controller=(haas-ngc|haas-legacy|fanuc)/i)).toBeVisible();
});

test("operator lock mode disables manual preset and revert controls", async ({ page }) => {
  await openPolicyPanel(page);

  const presetSelect = page.locator("label:has-text(/safety policy preset/i) select");
  const revertButton = page.getByRole("button", { name: "Revert to controller default preset" });
  const lockToggle = page.getByRole("checkbox", { name: "Lock manual preset changes" });

  await expect(presetSelect).toBeEnabled();
  await expect(revertButton).toBeEnabled();

  await lockToggle.check();
  await expect(presetSelect).toBeDisabled();
  await expect(revertButton).toBeDisabled();

  await lockToggle.uncheck();
  await expect(presetSelect).toBeEnabled();
  await expect(revertButton).toBeEnabled();
});

test("Ctrl+Shift+J saves preset and runs check", async ({ page }) => {
  await openPolicyPanel(page);

  const presetSelect = page.locator("label:has-text(/safety policy preset/i) select");
  await presetSelect.selectOption("strict");
  await expect(page.getByText(/Preset source:\s*manual/i)).toBeVisible();

  await page.keyboard.press("Control+Shift+J");
  await expect(page.getByText(/Preset source:\s*saved/i)).toBeVisible();
  await expect(page.getByText(/score=\d+,\s*blockers=\d+,\s*warnings=\d+,\s*blocked=(true|false)/i)).toBeVisible();
});
