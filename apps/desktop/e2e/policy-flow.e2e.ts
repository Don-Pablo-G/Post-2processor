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

test("policy audit trail records transitions with timestamp and source", async ({ page }) => {
  await openPolicyPanel(page);
  const presetSelect = page.locator("label:has-text(/safety policy preset/i) select");

  await presetSelect.selectOption("strict");
  await expect(page.getByText(/Preset source:\s*manual/i)).toBeVisible();
  await page.getByRole("button", { name: "Save this preset as default" }).click();

  await page.getByRole("button", { name: "Policy history (session)" }).click();
  const historyItems = page.locator("li", {
    hasText: /\d{4}-\d{2}-\d{2}T.*\|.*\|\s*(strict|balanced|permissive)\/(saved|bootstrap|manual)\s*\|\s*(haas-ngc|haas-legacy|fanuc)/i
  });
  await expect(historyItems.first()).toBeVisible();
  await expect(page.getByText(/saved_to_template/i)).toBeVisible();
});

test("copy context actions write expected policy and export payloads", async ({ page }) => {
  await page.addInitScript(() => {
    let copied = "";
    const nav = navigator as Navigator & { clipboard: { writeText: (value: string) => Promise<void> } };
    Object.defineProperty(nav, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          copied = value;
          (window as Window & { __CNC_E2E_LAST_COPIED__?: string }).__CNC_E2E_LAST_COPIED__ = value;
        }
      }
    });
    (window as Window & { __CNC_E2E_LAST_COPIED__?: string }).__CNC_E2E_LAST_COPIED__ = copied;
  });
  await openPolicyPanel(page);

  await page.getByRole("button", { name: "Copy policy context" }).click();
  const copiedPolicy = page.locator("body");
  await expect(copiedPolicy).toContainText(/Copied policy context:\s*POLICY PRESET:/i);

  await page.getByRole("button", { name: "Copy full export context" }).click();
  await expect(copiedPolicy).toContainText(/Copied full export context:\s*EXPORT CONTEXT/i);
});

test("lock mode prevents keyboard shortcuts from mutating preset state", async ({ page }) => {
  await openPolicyPanel(page);

  const presetSelect = page.locator("label:has-text(/safety policy preset/i) select");
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

  const presetSelect = page.locator("label:has-text(/safety policy preset/i) select");
  await presetSelect.selectOption("strict");
  await expect(page.getByText(/Preset source:\s*manual/i)).toBeVisible();

  const programInput = page.locator("textarea").first();
  await programInput.fill("O9001 (FANUC TEST)\nG90\nM30");

  await expect(page.getByText(/manual preset may be stale after detected controller change/i)).toBeVisible();
});

test("policy events toggle off prevents local ui event emission", async ({ page }) => {
  await page.addInitScript(() => {
    (window as Window & { __CNC_E2E_POLICY_EVENTS__?: unknown[] }).__CNC_E2E_POLICY_EVENTS__ = [];
    window.addEventListener("cnc:policy-preset-ui", (evt) => {
      const customEvt = evt as CustomEvent;
      (window as Window & { __CNC_E2E_POLICY_EVENTS__?: unknown[] }).__CNC_E2E_POLICY_EVENTS__?.push(customEvt.detail);
    });
  });
  await openPolicyPanel(page);

  await page.getByRole("checkbox", { name: "Enable local policy UI events" }).uncheck();
  const presetSelect = page.locator("label:has-text(/safety policy preset/i) select");
  await presetSelect.selectOption("permissive");

  const eventCount = await page.evaluate(() => {
    return ((window as Window & { __CNC_E2E_POLICY_EVENTS__?: unknown[] }).__CNC_E2E_POLICY_EVENTS__ ?? []).length;
  });
  expect(eventCount).toBe(0);
});

test("setup sheet preview includes policy context block", async ({ page }) => {
  await openPolicyPanel(page);
  const pageBody = page.locator("body");
  await expect(pageBody).toContainText(/Policy Context/i);
  await expect(pageBody).toContainText(/policyPreset:/i);
  await expect(pageBody).toContainText(/policyPresetSource:/i);
  await expect(pageBody).toContainText(/controller:/i);
});
