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
  await page.getByRole("button", { name: /^Copy Job Check status$|^Kopiuj status Job Check$/i }).click();
  await expect(page.locator("body")).toContainText(/Copied Job Check status:/i);
  await expect(page.locator("body")).toContainText(
    /(Last copied Job Check status|Ostatnio skopiowany status Job Check):\s*\d{4}-\d{2}-\d{2}T.*\|\s*len=\d+\s*\|\s*checksum=[0-9a-f]{4}/i
  );
  await page.getByRole("button", { name: /Copy Job Check \+ findings summary|Kopiuj status Job Check \+ findingi/i }).click();
  await expect(page.locator("body")).toContainText(
    /Copied Job Check \+ findings summary:.*\|\s*blockers=\d+\s*\|\s*warnings=\d+\s*\|\s*topFindingCodes=/i
  );
  await expect(page.locator("body")).toContainText(
    /(Last copied Job Check \+ findings|Ostatnio: Job Check \+ findingi):\s*\d{4}-\d{2}-\d{2}T.*\|\s*len=\d+\s*\|\s*checksum=[0-9a-f]{4}/i
  );
  await page.getByRole("button", { name: /Copy full operator handoff bundle|Kopiuj pełny pakiet przekazania operatora/i }).click();
  await expect(page.locator("body")).toContainText(
    /Copied operator handoff bundle:.*\|\s*findings:blockers=\d+,warnings=\d+,top=.*\|\s*export:dir=.*,artifacts=\d+\s*\|\s*drift=.*\|\s*parseDiag=total=\d+/i
  );
  await expect(page.locator("body")).toContainText(
    /(Last copied operator handoff|Ostatnio: pakiet przekazania operatora):\s*\d{4}-\d{2}-\d{2}T.*\|\s*len=\d+\s*\|\s*checksum=[0-9a-f]{4}/i
  );
  const handoffPayload = await page.evaluate(
    () => (window as Window & { __CNC_E2E_LAST_COPIED__?: string }).__CNC_E2E_LAST_COPIED__ ?? ""
  );
  expect(handoffPayload).toMatch(/parseDiag=total=\d+/);
  expect(handoffPayload).toMatch(/parseDiagPolicy=(disabled|inactive|active,)/);
  expect(handoffPayload).toMatch(/parseDiagBreaches=(none|[A-Z_:/0-9,]+)/);
  expect(handoffPayload).toMatch(/parseDiagBreachSeverities=(none|blockers=\d+,warnings=\d+)/);
  await page.getByRole("button", { name: /Copy machine-safe startup brief|Kopiuj bezpieczny brief startowy/i }).click();
  await expect(page.locator("body")).toContainText(
    /Copied machine-safe startup brief:\s*ready=\d+\/100 blocked=(true|false)\s*\|\s*blockers=\d+\s+warnings=\d+\s*\|\s*topFindings=/i
  );
  await expect(page.locator("body")).toContainText(
    /(Last copied startup brief|Ostatnio: brief startowy maszyny):\s*\d{4}-\d{2}-\d{2}T.*\|\s*len=\d+\s*\|\s*checksum=[0-9a-f]{4}/i
  );
  const startupBriefPayload = await page.evaluate(
    () => (window as Window & { __CNC_E2E_LAST_COPIED__?: string }).__CNC_E2E_LAST_COPIED__ ?? ""
  );
  expect(startupBriefPayload).toMatch(/parseDiag=total=\d+/);
  expect(startupBriefPayload).toMatch(/parseDiagPolicy=(disabled|inactive|active,)/);
  expect(startupBriefPayload).toMatch(/parseDiagBreaches=(none|[A-Z_:/0-9,]+)/);
  expect(startupBriefPayload).toMatch(/parseDiagBreachSeverities=(none|blockers=\d+,warnings=\d+)/);
  await page.getByRole("button", { name: /Copy first-cut risk brief|Kopiuj brief ryzyka pierwszego cięcia/i }).click();
  await expect(page.locator("body")).toContainText(/Copied first-cut risk brief:/i);
  await expect(page.locator("body")).toContainText(
    /(Last copied risk brief \(plain\)|Ostatnio: brief ryzyka \(podstawowy\)):\s*\d{4}-\d{2}-\d{2}T.*\|\s*len=\d+\s*\|\s*checksum=[0-9a-f]{4}/i
  );
  const riskBriefPlainPayload = await page.evaluate(
    () => (window as Window & { __CNC_E2E_LAST_COPIED__?: string }).__CNC_E2E_LAST_COPIED__ ?? ""
  );
  expect(riskBriefPlainPayload).toMatch(/parseDiag=total=\d+/);
  await page.getByRole("button", { name: /Copy first-cut risk brief \+ policy context|Kopiuj brief ryzyka \+ kontekst polityki/i }).click();
  await expect(page.locator("body")).toContainText(
    /Copied first-cut risk brief \+ policy context:\s*preset=(strict|balanced|permissive)\s+source=(saved|bootstrap|manual)\s+controller=(haas-ngc|haas-legacy|fanuc)/i
  );
  await expect(page.locator("body")).toContainText(
    /(Last copied risk brief \(policy\)|Ostatnio: brief ryzyka \(polityka\)):\s*\d{4}-\d{2}-\d{2}T.*\|\s*len=\d+\s*\|\s*checksum=[0-9a-f]{4}/i
  );
  const riskBriefPolicyPayload = await page.evaluate(
    () => (window as Window & { __CNC_E2E_LAST_COPIED__?: string }).__CNC_E2E_LAST_COPIED__ ?? ""
  );
  expect(riskBriefPolicyPayload).toMatch(/parseDiag=total=\d+/);
  expect(riskBriefPolicyPayload).toMatch(/parseDiagPolicy=(disabled|inactive|active,)/);
  expect(riskBriefPolicyPayload).toMatch(/parseDiagBreaches=(none|[A-Z_:/0-9,]+)/);
  expect(riskBriefPolicyPayload).toMatch(/parseDiagBreachSeverities=(none|blockers=\d+,warnings=\d+)/);
  await page.getByRole("button", { name: /Copy first-cut risk brief \+ Job Check status|Kopiuj brief ryzyka \+ status Job Check/i }).click();
  await expect(page.locator("body")).toContainText(/Copied first-cut risk brief \+ Job Check:/i);
  await expect(page.locator("body")).toContainText(
    /Copied first-cut risk brief \+ Job Check:.*score=\d+,\s*blockers=\d+,\s*warnings=\d+,\s*blocked=(true|false)\s*\|\s*policy=(strict|balanced|permissive)/i
  );
  await expect(page.locator("body")).toContainText(
    /(Last copied risk brief \(Job Check\)|Ostatnio: brief ryzyka \(Job Check\)):\s*\d{4}-\d{2}-\d{2}T.*\|\s*len=\d+\s*\|\s*checksum=[0-9a-f]{4}/i
  );
  const riskBriefJobCheckPayload = await page.evaluate(
    () => (window as Window & { __CNC_E2E_LAST_COPIED__?: string }).__CNC_E2E_LAST_COPIED__ ?? ""
  );
  expect(riskBriefJobCheckPayload).toMatch(/parseDiag=total=\d+/);
  expect(riskBriefJobCheckPayload).toMatch(/parseDiagPolicy=(disabled|inactive|active,)/);
  expect(riskBriefJobCheckPayload).toMatch(/parseDiagBreaches=(none|[A-Z_:/0-9,]+)/);
  expect(riskBriefJobCheckPayload).toMatch(/parseDiagBreachSeverities=(none|blockers=\d+,warnings=\d+)/);
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

test("Reset UI defaults dialog cancellation leaves prefs intact and records ui_defaults_reset_aborted", async ({
  page
}) => {
  await openPolicyPanel(page);

  await page.locator('[data-testid="parse-diagnostics-policy-preset-strict"]').click();
  await expect(page.locator('[data-testid="parse-diagnostics-policy-enabled"]')).toBeChecked();

  page.once("dialog", (dialog) => {
    void dialog.dismiss();
  });
  await page.locator('[data-testid="reset-ui-prefs"]').click();

  await expect(page.locator('[data-testid="parse-diagnostics-policy-enabled"]')).toBeChecked();
  await expect(page.locator('[data-testid="parse-diagnostics-policy-thresholds"]')).toHaveValue(
    "TOTAL=0"
  );
  await expect(page.locator("body")).toContainText(
    /UI defaults reset cancelled|Reset ustawień UI anulowany/i
  );

  const auditSummary = page.locator("summary", {
    hasText: /Policy history \(session\)|Historia polityki \(sesja\)/i
  });
  await auditSummary.click();
  const abortedEntry = page.locator("li", { hasText: /ui_defaults_reset_aborted/i });
  await expect(abortedEntry.first()).toBeVisible();
  await expect(abortedEntry.first()).toContainText(/code=haas-ngc/);
});

test("Reset UI defaults dialog acceptance clears persisted prefs and records ui_defaults_reset_confirmed", async ({
  page
}) => {
  await openPolicyPanel(page);

  await page.locator('[data-testid="parse-diagnostics-policy-preset-strict"]').click();
  await expect(page.locator('[data-testid="parse-diagnostics-policy-enabled"]')).toBeChecked();

  page.once("dialog", (dialog) => {
    void dialog.accept();
  });
  await page.locator('[data-testid="reset-ui-prefs"]').click();

  await expect(page.locator('[data-testid="parse-diagnostics-policy-enabled"]')).not.toBeChecked();
  await expect(page.locator('[data-testid="parse-diagnostics-policy-thresholds"]')).toHaveValue("");
  await expect(page.locator("body")).toContainText(/UI defaults reset for current controller profile/i);

  const auditSummary = page.locator("summary", {
    hasText: /Policy history \(session\)|Historia polityki \(sesja\)/i
  });
  await auditSummary.click();
  const confirmedEntry = page.locator("li", { hasText: /ui_defaults_reset_confirmed/i });
  await expect(confirmedEntry.first()).toBeVisible();
  await expect(confirmedEntry.first()).toContainText(/code=haas-ngc/);
});

test("Reset fixture defaults dialog cancellation records fixture_prefs_reset_aborted", async ({
  page
}) => {
  await openPolicyPanel(page);

  page.once("dialog", (dialog) => {
    void dialog.dismiss();
  });
  await page.locator('[data-testid="reset-fixture-prefs"]').click();

  await expect(page.locator("body")).toContainText(
    /Fixture defaults reset cancelled|Reset ustawień fixturek anulowany/i
  );

  const auditSummary = page.locator("summary", {
    hasText: /Policy history \(session\)|Historia polityki \(sesja\)/i
  });
  await auditSummary.click();
  const abortedEntry = page.locator("li", { hasText: /fixture_prefs_reset_aborted/i });
  await expect(abortedEntry.first()).toBeVisible();
});

test("audit trail clear-with-confirm and filter chips show only matching rows", async ({
  page
}) => {
  await openPolicyPanel(page);

  await page.locator('[data-testid="parse-diagnostics-policy-preset-strict"]').click();
  await page.locator('[data-testid="parse-diagnostics-policy-preset-balanced"]').click();

  page.once("dialog", (dialog) => {
    void dialog.accept();
  });
  await page.locator('[data-testid="reset-ui-prefs"]').click();
  await expect(page.locator("body")).toContainText(/UI defaults reset/i);

  const auditSummary = page.locator("summary", {
    hasText: /Policy history \(session\)|Historia polityki \(sesja\)/i
  });
  await auditSummary.click();

  await expect(page.locator('[data-testid="policy-audit-trail-count-chip"]')).toBeVisible();

  const presetEntry = page.locator("li", { hasText: /parse_diag_policy_preset_applied/i });
  await expect(presetEntry.first()).toBeVisible();
  const resetEntry = page.locator("li", { hasText: /ui_defaults_reset_confirmed/i });
  await expect(resetEntry.first()).toBeVisible();

  page.once("dialog", (dialog) => {
    void dialog.dismiss();
  });
  await page.locator('[data-testid="policy-audit-trail-clear"]').click();
  await expect(presetEntry.first()).toBeVisible();
  await expect(page.locator("li", { hasText: /policy_audit_trail_cleared/i })).toHaveCount(0);

  page.once("dialog", (dialog) => {
    void dialog.accept();
  });
  await page.locator('[data-testid="policy-audit-trail-clear"]').click();
  await expect(page.locator("body")).toContainText(
    /Cleared session policy audit trail|Wyczyszczono historię polityki w sesji/i
  );
  const clearedEntry = page.locator("li", { hasText: /policy_audit_trail_cleared/i });
  await expect(clearedEntry.first()).toBeVisible();
  await expect(clearedEntry.first()).toContainText(/count=/);

  await page.locator('[data-testid="parse-diagnostics-policy-preset-strict"]').click();
  page.once("dialog", (dialog) => {
    void dialog.accept();
  });
  await page.locator('[data-testid="reset-ui-prefs"]').click();
  await expect(page.locator("body")).toContainText(/UI defaults reset/i);

  await expect(
    page.locator("li", { hasText: /parse_diag_policy_preset_applied/i }).first()
  ).toBeVisible();
  await expect(
    page.locator("li", { hasText: /ui_defaults_reset_confirmed/i }).first()
  ).toBeVisible();

  await page.locator('[data-testid="policy-audit-trail-filter-reset"]').click();
  await expect(page.locator('[data-testid="policy-audit-trail-filter-reset"]')).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  await expect(
    page.locator("li", { hasText: /parse_diag_policy_preset_applied/i })
  ).toHaveCount(0);
  await expect(
    page.locator("li", { hasText: /ui_defaults_reset_confirmed/i }).first()
  ).toBeVisible();

  await page.locator('[data-testid="policy-audit-trail-filter-parse_lint"]').click();
  await expect(
    page.locator("li", { hasText: /parse_diag_policy_preset_applied/i }).first()
  ).toBeVisible();
  await expect(
    page.locator("li", { hasText: /ui_defaults_reset_confirmed/i })
  ).toHaveCount(0);

  await page.locator('[data-testid="policy-audit-trail-filter-all"]').click();
  await expect(
    page.locator("li", { hasText: /parse_diag_policy_preset_applied/i }).first()
  ).toBeVisible();
  await expect(
    page.locator("li", { hasText: /ui_defaults_reset_confirmed/i }).first()
  ).toBeVisible();
});

test("manual preset shows drift warning after detected controller changes", async ({ page }) => {
  await openPolicyPanel(page);
  const presetSelect = policyPresetSelect(page);
  await presetSelect.selectOption("strict");
  await expect(page.locator("body")).toContainText(/manual_selection_changed/i);

  const programInput = page.locator("textarea").first();
  await programInput.fill("O9001 (FANUC TEST)\nG90\nM30");
  await expect(page.locator("body")).toContainText(/haas-ngc\s*->\s*fanuc/i);
  await expect(page.locator("body")).toContainText(/First-cut risk brief|Brief ryzyka pierwszego cięcia/i);
  await expect(page.locator("body")).toContainText(/reason:/i);
  await expect(page.locator("body")).toContainText(/action:/i);
});
