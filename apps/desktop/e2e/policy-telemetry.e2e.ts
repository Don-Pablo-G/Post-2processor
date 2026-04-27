import { expect, test } from "@playwright/test";
import { openPolicyPanel, policyPresetSelect } from "./policy-helpers";

test("policy audit trail records transitions with timestamp and source", async ({ page }) => {
  await openPolicyPanel(page);
  const presetSelect = policyPresetSelect(page);

  await presetSelect.selectOption("strict");
  await expect(page.locator("body")).toContainText(/manual_selection_changed/i);
  await page.keyboard.press("Control+Shift+J");
  await expect(page.locator("body")).toContainText(/saved_to_template/i);
  await page.locator("summary", { hasText: /Policy history \(session\)|Historia polityki \(sesja\)/i }).click();

  const historyItems = page.locator("li", {
    hasText: /\d{4}-\d{2}-\d{2}T.*\|.*\|\s*(strict|balanced|permissive)\/(saved|bootstrap|manual)\s*\|\s*(haas-ngc|haas-legacy|fanuc)/i
  });
  await expect(historyItems.first()).toBeVisible();
  await expect(page.getByText(/saved_to_template/i)).toBeVisible();
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

  const beforeCount = await page.evaluate(() => {
    return ((window as Window & { __CNC_E2E_POLICY_EVENTS__?: unknown[] }).__CNC_E2E_POLICY_EVENTS__ ?? []).length;
  });
  await page.getByRole("checkbox", { name: /Enable local policy UI events|Włącz lokalne eventy UI polityki/i }).uncheck();
  const presetSelect = policyPresetSelect(page);
  await presetSelect.selectOption("permissive");

  const afterCount = await page.evaluate(() => {
    return ((window as Window & { __CNC_E2E_POLICY_EVENTS__?: unknown[] }).__CNC_E2E_POLICY_EVENTS__ ?? []).length;
  });
  expect(afterCount).toBe(beforeCount);
});
