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

test("high-risk branch: manual override, drift, revert, and export", async ({ page }) => {
  await page.addInitScript(() => {
    (window as Window & { __CNC_E2E_EXPORT_MOCK__?: { exportDirectory: string; artifactCount: number } }).__CNC_E2E_EXPORT_MOCK__ =
      {
        exportDirectory: "C:/deep-scenario-risk-export",
        artifactCount: 6
      };
  });

  await openPolicyPanel(page);
  const programInput = page.locator("textarea").first();
  const presetSelect = page.locator("label:has-text(/safety policy preset/i) select");

  // Start in Haas style, force manual override.
  await programInput.fill("O9100 (HAAS BRANCH)\nG90\nG0 X0. Y0.\nM30");
  await presetSelect.selectOption("permissive");
  await expect(page.getByText(/Preset source:\s*manual/i)).toBeVisible();

  // Drift to Fanuc controller signature while manual preset remains active.
  await programInput.fill("O9101 (FANUC BRANCH)\nG90\nG0 X0 Y0\nM30");
  await expect(page.getByText(/manual preset may be stale after detected controller change/i)).toBeVisible();

  // Revert to controller default and validate source shift before export.
  await page.keyboard.press("Control+Shift+R");
  await expect(page.getByText(/Preset source:\s*bootstrap/i)).toBeVisible();

  await page.getByRole("button", { name: "Export now" }).click();
  await expect(page.getByText("Export policy context")).toBeVisible();
  await expect(page.getByText("dir=C:/deep-scenario-risk-export")).toBeVisible();
  await expect(page.getByText("artifacts=6")).toBeVisible();
  await expect(page.getByText(/source=bootstrap/i)).toBeVisible();
  await expect(page.getByText(/controller=fanuc/i)).toBeVisible();
});
