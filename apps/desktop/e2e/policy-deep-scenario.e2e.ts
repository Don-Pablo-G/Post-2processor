import { expect, test } from "@playwright/test";
import { openPolicyPanel } from "./policy-helpers";

test("deep operator policy flow from edit to export confirmation", async ({ page }) => {
  await page.addInitScript(() => {
    (window as Window & { __CNC_E2E_EXPORT_MOCK__?: { exportDirectory: string; artifactCount: number } }).__CNC_E2E_EXPORT_MOCK__ =
      {
        exportDirectory: "C:/deep-scenario-export",
        artifactCount: 5
      };
  });

  await openPolicyPanel(page);

  // Simulate operator editing/importing a new controller-flavored program.
  const programInput = page.locator("textarea").first();
  await programInput.fill("O9010 (FANUC OP FLOW)\nG90\nG0 X0 Y0\nM30");

  const presetSelect = page.locator("label:has-text(/safety policy preset/i) select");
  await presetSelect.selectOption("strict");
  await expect(page.getByText(/Preset source:\s*manual/i)).toBeVisible();

  await page.keyboard.press("Control+Shift+J");
  await expect(page.getByText(/Preset source:\s*saved/i)).toBeVisible();
  await expect(page.getByText(/score=\d+,\s*blockers=\d+,\s*warnings=\d+,\s*blocked=(true|false)/i)).toBeVisible();

  await page.getByRole("button", { name: "Export now" }).click();
  await expect(page.getByText("Export policy context")).toBeVisible();
  await expect(page.getByText("dir=C:/deep-scenario-export")).toBeVisible();
  await expect(page.getByText("artifacts=5")).toBeVisible();
  await expect(page.getByText(/preset=strict/i)).toBeVisible();
  await expect(page.getByText(/source=saved/i)).toBeVisible();
  await expect(page.getByText(/controller=fanuc/i)).toBeVisible();
});
