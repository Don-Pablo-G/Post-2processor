import { expect, test } from "@playwright/test";
import { openPolicyPanel, policyPresetSelect } from "./policy-helpers";

test("manual preset change marks source as manual", async ({ page }) => {
  await openPolicyPanel(page);
  const presetSelect = policyPresetSelect(page);
  await presetSelect.selectOption("permissive");
  await expect(page.getByText(/Preset source:\s*manual/i)).toBeVisible();
});

test("save-and-run and shortcut revert update source state", async ({ page }) => {
  await openPolicyPanel(page);
  const presetSelect = policyPresetSelect(page);
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

test("operator lock mode disables manual preset and revert controls", async ({ page }) => {
  await openPolicyPanel(page);
  const presetSelect = policyPresetSelect(page);
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
  const presetSelect = policyPresetSelect(page);
  await presetSelect.selectOption("strict");
  await expect(page.getByText(/Preset source:\s*manual/i)).toBeVisible();

  await page.keyboard.press("Control+Shift+J");
  await expect(page.getByText(/Preset source:\s*saved/i)).toBeVisible();
  await expect(page.getByText(/score=\d+,\s*blockers=\d+,\s*warnings=\d+,\s*blocked=(true|false)/i)).toBeVisible();
});

test("lock mode prevents keyboard shortcuts from mutating preset state", async ({ page }) => {
  await openPolicyPanel(page);
  const presetSelect = policyPresetSelect(page);
  const lockToggle = page.getByRole("checkbox", { name: "Lock manual preset changes" });
  await presetSelect.selectOption("strict");
  await expect(page.getByText(/Preset source:\s*manual/i)).toBeVisible();

  await lockToggle.check();
  await page.keyboard.press("Control+Shift+R");
  await page.keyboard.press("Control+Shift+J");

  await expect(page.getByText(/Preset source:\s*manual/i)).toBeVisible();
  await expect(page.getByText(/Preset source:\s*bootstrap/i)).toHaveCount(0);
  await expect(page.getByText(/Preset source:\s*saved/i)).toHaveCount(0);
});

test("manual preset shows drift warning after detected controller changes", async ({ page }) => {
  await openPolicyPanel(page);
  const presetSelect = policyPresetSelect(page);
  await presetSelect.selectOption("strict");
  await expect(page.getByText(/Preset source:\s*manual/i)).toBeVisible();

  const programInput = page.locator("textarea").first();
  await programInput.fill("O9001 (FANUC TEST)\nG90\nM30");
  await expect(page.getByText(/manual preset may be stale after detected controller change/i)).toBeVisible();
});
