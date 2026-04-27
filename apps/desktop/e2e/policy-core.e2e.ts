import { expect, test } from "@playwright/test";
import { openPolicyPanel, policyLockToggle, policyPresetSelect, policyRevertButton } from "./policy-helpers";

test("manual preset change marks source as manual", async ({ page }) => {
  await openPolicyPanel(page);
  const presetSelect = policyPresetSelect(page);
  await presetSelect.selectOption("permissive");
  await expect(page.locator("body")).toContainText(/manual_selection_changed/i);
});

test("save-and-run and shortcut revert update source state", async ({ page }) => {
  await openPolicyPanel(page);
  const presetSelect = policyPresetSelect(page);
  await presetSelect.selectOption("strict");
  await expect(page.locator("body")).toContainText(/manual_selection_changed/i);

  await page.keyboard.press("Control+Shift+J");
  await expect(page.locator("body")).toContainText(/save_and_run_invoked/i);

  await presetSelect.selectOption("permissive");
  await expect(page.locator("body")).toContainText(/manual_selection_changed/i);
  await page.keyboard.press("Control+Shift+R");
  await expect(page.locator("body")).toContainText(/reverted_to_controller_default_shortcut/i);
  await expect(page.getByText(/reverted to controller default/i)).toBeVisible();
});

test("operator lock mode disables manual preset and revert controls", async ({ page }) => {
  await openPolicyPanel(page);
  const presetSelect = policyPresetSelect(page);
  const revertButton = policyRevertButton(page);
  const lockToggle = policyLockToggle(page);

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
  await openPolicyPanel(page);
  const presetSelect = policyPresetSelect(page);
  await presetSelect.selectOption("strict");
  await expect(page.locator("body")).toContainText(/manual_selection_changed/i);

  await page.keyboard.press("Control+Shift+J");
  await expect(page.locator("body")).toContainText(/save_and_run_invoked/i);
  await expect(page.locator("body")).toContainText(
    /score=\d+,\s*blockers=\d+,\s*warnings=\d+,\s*blocked=(true|false)\s*\|\s*policy=(strict|balanced|permissive),\s*source=(saved|bootstrap|manual),\s*controller=(haas-ngc|haas-legacy|fanuc)/i
  );
  await page.getByRole("button", { name: /Copy Job Check status|Kopiuj status Job Check/i }).click();
  await expect(page.locator("body")).toContainText(/Copied Job Check status:/i);
});

test("lock mode prevents keyboard shortcuts from mutating preset state", async ({ page }) => {
  await openPolicyPanel(page);
  const presetSelect = policyPresetSelect(page);
  const lockToggle = policyLockToggle(page);
  await presetSelect.selectOption("strict");
  await expect(page.locator("body")).toContainText(/manual_selection_changed/i);

  await lockToggle.check();
  await page.keyboard.press("Control+Shift+R");
  await page.keyboard.press("Control+Shift+J");

  await expect(page.locator("body")).toContainText(/manual_selection_changed/i);
  await expect(page.locator("body")).not.toContainText(/reverted_to_controller_default_shortcut/i);
  await expect(page.locator("body")).not.toContainText(/save_and_run_invoked/i);
});

test("manual preset shows drift warning after detected controller changes", async ({ page }) => {
  await openPolicyPanel(page);
  const presetSelect = policyPresetSelect(page);
  await presetSelect.selectOption("strict");
  await expect(page.locator("body")).toContainText(/manual_selection_changed/i);

  const programInput = page.locator("textarea").first();
  await programInput.fill("O9001 (FANUC TEST)\nG90\nM30");
  await expect(page.locator("body")).toContainText(/haas-ngc\s*->\s*fanuc/i);
});
