import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

async function installClipboardStub(page: Page): Promise<void> {
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
}

async function readLastCopied(page: Page): Promise<string> {
  return await page.evaluate(
    () => (window as Window & { __CNC_E2E_LAST_COPIED__?: string }).__CNC_E2E_LAST_COPIED__ ?? ""
  );
}

async function fillProgram(page: Page, program: string): Promise<void> {
  await page.locator("textarea").first().fill(program);
}

const CANONICAL_THRESHOLDS_INPUT = "TOTAL=10, ADDRESS_MISSING_VALUE=3";
const CANONICAL_POLICY_LINE =
  "parseDiagPolicy=enabled,severity=blocker,blockExport=true,thresholds=ADDRESS_MISSING_VALUE=3,TOTAL=10";

test.describe("parse diagnostics policy persistence", () => {
  test("save preset writes parseDiagnosticsPolicy into templateJson and copy emits canonical line", async ({
    page
  }) => {
    await installClipboardStub(page);
    await page.goto("/", { waitUntil: "networkidle" });
    await expect(page.locator('[data-testid="parse-diagnostics-policy-row"]')).toBeVisible({
      timeout: 12_000
    });

    await page.locator('[data-testid="parse-diagnostics-policy-enabled"]').check();
    await page
      .locator('[data-testid="parse-diagnostics-policy-severity"]')
      .selectOption("blocker");
    await page.locator('[data-testid="parse-diagnostics-policy-block-export"]').check();
    await page
      .locator('[data-testid="parse-diagnostics-policy-thresholds"]')
      .fill(CANONICAL_THRESHOLDS_INPUT);

    await expect(page.locator('[data-testid="parse-diagnostics-policy-summary"]')).toHaveText(
      CANONICAL_POLICY_LINE
    );

    await page.locator('[data-testid="save-parameter-prefs"]').click();

    const templateJsonValue = await page
      .locator('[data-testid="template-json"]')
      .inputValue();
    const templateJsonParsed = JSON.parse(templateJsonValue) as {
      settings?: {
        uiDefaults?: Record<
          string,
          {
            parseDiagnosticsPolicy?: {
              enabled?: boolean;
              severity?: string;
              blockExport?: boolean;
              thresholdsText?: string;
            };
          }
        >;
      };
    };
    expect(templateJsonParsed.settings?.uiDefaults?.["haas-ngc"]?.parseDiagnosticsPolicy).toEqual({
      enabled: true,
      severity: "blocker",
      blockExport: true,
      thresholdsText: CANONICAL_THRESHOLDS_INPUT
    });

    await page.locator('[data-testid="parse-diagnostics-policy-copy"]').click();
    const copied = await readLastCopied(page);
    expect(copied).toBe(`${CANONICAL_POLICY_LINE} | controller=haas-ngc`);

    expect(templateJsonValue).toContain('"auditTrailRecent"');
    const settingsBlock = templateJsonParsed as unknown as {
      settings?: { auditTrailRecent?: ReadonlyArray<{ event: string }> };
    };
    expect(settingsBlock.settings?.auditTrailRecent).toBeDefined();
    expect((settingsBlock.settings?.auditTrailRecent ?? []).length).toBeLessThanOrEqual(10);
    expect(
      (settingsBlock.settings?.auditTrailRecent ?? []).some((e) => e.event === "saved_to_template")
    ).toBe(true);

    const auditSummary = page.locator("summary", {
      hasText: /Policy history \(session\)|Historia polityki \(sesja\)/i
    });
    await auditSummary.click();
    await expect(
      page.locator("li", { hasText: /policy_audit_trail_persisted/i }).first()
    ).toBeVisible();
  });

  test("auditTrailRecent injected via templateJson hydrates with (hydrated) marker", async ({
    page
  }) => {
    await installClipboardStub(page);
    await page.goto("/", { waitUntil: "networkidle" });
    await expect(page.locator('[data-testid="parse-diagnostics-policy-row"]')).toBeVisible({
      timeout: 12_000
    });

    const injected = JSON.stringify(
      {
        templates: [],
        settings: {
          auditTrailRecent: [
            {
              timestampIso: "2026-05-01T18:00:00.000Z",
              event: "parse_diag_policy_preset_applied",
              preset: "strict",
              source: "manual",
              controller: "haas-ngc",
              code: "preset:strict"
            }
          ]
        }
      },
      null,
      2
    );

    await page.locator('[data-testid="template-json"]').fill(injected);

    const auditSummary = page.locator("summary", {
      hasText: /Policy history \(session\)|Historia polityki \(sesja\)/i
    });
    await auditSummary.click();
    const hydratedEntry = page.locator('[data-testid="policy-audit-trail-entry-hydrated"]');
    await expect(hydratedEntry.first()).toBeVisible();
    await expect(hydratedEntry.first()).toContainText(/parse_diag_policy_preset_applied/);
    await expect(hydratedEntry.first()).toContainText(/\(hydrated\)/);
  });

  test("bootstrap restore applies parseDiagnosticsPolicy from injected templateJson", async ({
    page
  }) => {
    await installClipboardStub(page);
    await page.goto("/", { waitUntil: "networkidle" });
    await expect(page.locator('[data-testid="parse-diagnostics-policy-row"]')).toBeVisible({
      timeout: 12_000
    });

    const injected = JSON.stringify(
      {
        templates: [],
        settings: {
          uiDefaults: {
            "haas-ngc": {
              parseDiagnosticsPolicy: {
                enabled: true,
                severity: "blocker",
                blockExport: true,
                thresholdsText: CANONICAL_THRESHOLDS_INPUT
              }
            }
          }
        }
      },
      null,
      2
    );

    await page.locator('[data-testid="template-json"]').fill(injected);

    await expect(page.locator('[data-testid="parse-diagnostics-policy-enabled"]')).toBeChecked();
    await expect(page.locator('[data-testid="parse-diagnostics-policy-severity"]')).toHaveValue(
      "blocker"
    );
    await expect(
      page.locator('[data-testid="parse-diagnostics-policy-block-export"]')
    ).toBeChecked();
    await expect(page.locator('[data-testid="parse-diagnostics-policy-thresholds"]')).toHaveValue(
      CANONICAL_THRESHOLDS_INPUT
    );
    await expect(page.locator('[data-testid="parse-diagnostics-policy-summary"]')).toHaveText(
      CANONICAL_POLICY_LINE
    );

    await page.locator('[data-testid="parse-diagnostics-policy-copy"]').click();
    const copied = await readLastCopied(page);
    expect(copied).toBe(`${CANONICAL_POLICY_LINE} | controller=haas-ngc`);
  });

  test("threshold breach surfaces inline row with Jump-to-block + copy context in Job Check card", async ({
    page
  }) => {
    await installClipboardStub(page);
    await page.goto("/", { waitUntil: "networkidle" });
    await expect(page.locator('[data-testid="parse-diagnostics-policy-row"]')).toBeVisible({
      timeout: 12_000
    });

    await fillProgram(page, "G0 X1\nG0 X Y1\nG1 X1");
    await page.locator('[data-testid="parse-diagnostics-policy-enabled"]').check();
    await page
      .locator('[data-testid="parse-diagnostics-policy-severity"]')
      .selectOption("blocker");
    await page.locator('[data-testid="parse-diagnostics-policy-block-export"]').check();
    await page
      .locator('[data-testid="parse-diagnostics-policy-thresholds"]')
      .fill("TOTAL=0, ADDRESS_MISSING_VALUE=0");

    await page.locator('[data-testid="run-job-check"]').click();

    const breachTotalRow = page.locator('[data-testid="job-check-parse-diag-breach-TOTAL"]');
    await expect(breachTotalRow).toBeVisible({ timeout: 8_000 });

    const breachSummary = page.locator(
      '[data-testid="job-check-parse-diag-breach-summary"]'
    );
    await expect(breachSummary).toBeVisible();
    await expect(breachSummary).toContainText(
      "breaches: total=2 | blockers=2 | warnings=0"
    );

    const lintSummaryChip = page.locator('[data-testid="job-check-lint-summary-chip"]');
    await expect(lintSummaryChip).toBeVisible();
    await expect(lintSummaryChip).toContainText(
      /lintIssues: total=\d+ \| severities=blocker:\d+,warning:\d+ \| top=/
    );

    const drilldown = page.locator('[data-testid="job-check-lint-summary-drilldown"]');
    await expect(drilldown).toBeVisible();
    await drilldown.evaluate((el) => {
      (el as HTMLDetailsElement).open = true;
    });
    const drilldownRows = page.locator('[data-testid^="job-check-lint-summary-source-"]');
    await expect(drilldownRows.first()).toBeVisible();
    await expect(drilldownRows.first()).toContainText(/^[a-z_]+: \d+ \(blocker:\d+, warning:\d+\)/);

    const breachCodeRow = page.locator(
      '[data-testid="job-check-parse-diag-breach-ADDRESS_MISSING_VALUE"]'
    );
    await expect(breachCodeRow).toBeVisible();

    await breachCodeRow
      .locator('button[data-testid="job-check-parse-diag-breach-jump-ADDRESS_MISSING_VALUE"]')
      .click();
    await expect(page.locator("textarea").first()).toBeFocused();

    await page.locator('[data-testid="job-check-parse-diag-breach-copy"]').click();
    const copied = await readLastCopied(page);
    expect(copied.split("\n")).toEqual([
      "parseDiagBreach: ADDRESS_MISSING_VALUE=1>0 (blocker) firstBlock=1",
      "parseDiagBreach: TOTAL=1>0 (blocker)",
      "controller=haas-ngc"
    ]);

    const auditSummary = page.locator("summary", {
      hasText: /Policy history \(session\)|Historia polityki \(sesja\)/i
    });
    await auditSummary.click();
    const auditEntry = page.locator("li", { hasText: /parse_breach_copied/i });
    await expect(auditEntry.first()).toBeVisible();
    await expect(auditEntry.first()).toContainText(/count=2/);
    await expect(auditEntry.first()).toContainText(/severities=blocker:2/);
  });

  test("operator-review-mode renders breach rows read-only without Jump or Copy buttons", async ({
    page
  }) => {
    await installClipboardStub(page);
    await page.goto("/", { waitUntil: "networkidle" });
    await expect(page.locator('[data-testid="parse-diagnostics-policy-row"]')).toBeVisible({
      timeout: 12_000
    });

    await page
      .getByLabel(/Operator Review Mode|Tryb przeglądu operatora/i)
      .check();

    await fillProgram(page, "G0 X1\nG0 X Y1\nG1 X1");
    await page.locator('[data-testid="parse-diagnostics-policy-enabled"]').check();
    await page
      .locator('[data-testid="parse-diagnostics-policy-severity"]')
      .selectOption("blocker");
    await page
      .locator('[data-testid="parse-diagnostics-policy-thresholds"]')
      .fill("TOTAL=0, ADDRESS_MISSING_VALUE=0");

    await page.locator('[data-testid="run-job-check"]').click();

    const readonlySpan = page.locator(
      '[data-testid="job-check-parse-diag-breach-readonly-ADDRESS_MISSING_VALUE"]'
    );
    await expect(readonlySpan).toBeVisible({ timeout: 8_000 });
    await expect(readonlySpan).toContainText(/ADDRESS_MISSING_VALUE=1\s*>\s*0/);

    const summary = page.locator('[data-testid="job-check-parse-diag-breach-summary"]');
    await expect(summary).toBeVisible();
    await expect(summary).toContainText(
      "breaches: total=2 | blockers=2 | warnings=0"
    );

    await expect(
      page.locator('[data-testid="job-check-parse-diag-breach-jump-ADDRESS_MISSING_VALUE"]')
    ).toHaveCount(0);
    await expect(page.locator('[data-testid="job-check-parse-diag-breach-copy"]')).toHaveCount(0);
  });

  test("preset chips apply canonical strict shape and record parse_diag_policy_preset_applied audit row", async ({
    page
  }) => {
    await installClipboardStub(page);
    await page.goto("/", { waitUntil: "networkidle" });
    await expect(page.locator('[data-testid="parse-diagnostics-policy-presets"]')).toBeVisible({
      timeout: 12_000
    });

    await page.locator('[data-testid="parse-diagnostics-policy-preset-strict"]').click();

    await expect(page.locator('[data-testid="parse-diagnostics-policy-enabled"]')).toBeChecked();
    await expect(page.locator('[data-testid="parse-diagnostics-policy-severity"]')).toHaveValue(
      "blocker"
    );
    await expect(
      page.locator('[data-testid="parse-diagnostics-policy-block-export"]')
    ).toBeChecked();
    await expect(page.locator('[data-testid="parse-diagnostics-policy-thresholds"]')).toHaveValue(
      "TOTAL=0"
    );
    await expect(page.locator('[data-testid="parse-diagnostics-policy-summary"]')).toHaveText(
      "parseDiagPolicy=enabled,severity=blocker,blockExport=true,thresholds=TOTAL=0"
    );

    await page.locator('[data-testid="parse-diagnostics-policy-preset-balanced"]').click();
    await expect(page.locator('[data-testid="parse-diagnostics-policy-severity"]')).toHaveValue(
      "warning"
    );
    await expect(page.locator('[data-testid="parse-diagnostics-policy-thresholds"]')).toHaveValue(
      "TOTAL=10"
    );

    await page.locator('[data-testid="parse-diagnostics-policy-preset-permissive"]').click();
    await expect(page.locator('[data-testid="parse-diagnostics-policy-enabled"]')).not.toBeChecked();
    await expect(page.locator('[data-testid="parse-diagnostics-policy-thresholds"]')).toHaveValue(
      ""
    );

    const auditSummary = page.locator("summary", {
      hasText: /Policy history \(session\)|Historia polityki \(sesja\)/i
    });
    await auditSummary.click();
    const auditEntry = page.locator("li", { hasText: /parse_diag_policy_preset_applied/i });
    await expect(auditEntry.first()).toBeVisible();
    await expect(auditEntry.first()).toContainText(/code=preset:permissive/);
  });

  test("lint-demo controller override loads the Fanuc demo program even on Haas detection", async ({
    page
  }) => {
    await installClipboardStub(page);
    await page.goto("/", { waitUntil: "networkidle" });
    await expect(page.locator('[data-testid="parse-diagnostics-heading"]')).toBeVisible({
      timeout: 12_000
    });

    await page
      .locator('[data-testid="lint-demo-controller-override"]')
      .selectOption("fanuc");
    await page.locator('[data-testid="lint-issues-load-demo"]').click();

    const programValue = await page.locator("textarea").first().inputValue();
    expect(programValue.startsWith("%")).toBe(true);
    expect(programValue.endsWith("%")).toBe(true);
    expect(programValue).toContain("(FANUC DEMO PROGRAM");
    expect((programValue.match(/^O1000$/gm) ?? []).length).toBeGreaterThanOrEqual(2);

    const auditSummary = page.locator("summary", {
      hasText: /Policy history \(session\)|Historia polityki \(sesja\)/i
    });
    await auditSummary.click();
    const auditEntry = page.locator("li", { hasText: /lint_demo_loaded/i });
    await expect(auditEntry.first()).toBeVisible();
    await expect(auditEntry.first()).toContainText(/code=override=fanuc/);
  });

  test("lint-demo controller override loads the Haas-legacy demo with legacy idioms", async ({
    page
  }) => {
    await installClipboardStub(page);
    await page.goto("/", { waitUntil: "networkidle" });
    await expect(page.locator('[data-testid="parse-diagnostics-heading"]')).toBeVisible({
      timeout: 12_000
    });

    await page
      .locator('[data-testid="lint-demo-controller-override"]')
      .selectOption("haas-legacy");
    await page.locator('[data-testid="lint-issues-load-demo"]').click();

    const programValue = await page.locator("textarea").first().inputValue();
    expect(programValue.startsWith("%")).toBe(true);
    expect(programValue.endsWith("%")).toBe(true);
    expect(programValue).toContain("(HAAS LEGACY DEMO PROGRAM");
    expect(programValue).toContain("M97 P10");
    expect(programValue).toContain("G187 P3 E0.0005");
    expect(programValue).toContain("M88");
    expect(programValue).toContain("M89");

    const auditSummary = page.locator("summary", {
      hasText: /Policy history \(session\)|Historia polityki \(sesja\)/i
    });
    await auditSummary.click();
    const auditEntry = page.locator("li", { hasText: /lint_demo_loaded/i });
    await expect(auditEntry.first()).toBeVisible();
    await expect(auditEntry.first()).toContainText(/code=override=haas-legacy/);
  });

  test("preset chip active-match indicator highlights the matching chip and flips to custom on edit", async ({
    page
  }) => {
    await installClipboardStub(page);
    await page.goto("/", { waitUntil: "networkidle" });
    await expect(page.locator('[data-testid="parse-diagnostics-policy-presets"]')).toBeVisible({
      timeout: 12_000
    });

    const strictChip = page.locator('[data-testid="parse-diagnostics-policy-preset-strict"]');
    const balancedChip = page.locator('[data-testid="parse-diagnostics-policy-preset-balanced"]');
    const permissiveChip = page.locator(
      '[data-testid="parse-diagnostics-policy-preset-permissive"]'
    );
    const activeBadge = page.locator('[data-testid="parse-diagnostics-policy-preset-active"]');

    await strictChip.click();
    await expect(strictChip).toHaveAttribute("aria-pressed", "true");
    await expect(balancedChip).toHaveAttribute("aria-pressed", "false");
    await expect(permissiveChip).toHaveAttribute("aria-pressed", "false");
    await expect(activeBadge).toContainText(/Strict|Rygorystyczny/);

    await balancedChip.click();
    await expect(balancedChip).toHaveAttribute("aria-pressed", "true");
    await expect(strictChip).toHaveAttribute("aria-pressed", "false");
    await expect(activeBadge).toContainText(/Balanced|Zrównoważony/);

    await page
      .locator('[data-testid="parse-diagnostics-policy-thresholds"]')
      .fill("TOTAL=7");
    await expect(strictChip).toHaveAttribute("aria-pressed", "false");
    await expect(balancedChip).toHaveAttribute("aria-pressed", "false");
    await expect(permissiveChip).toHaveAttribute("aria-pressed", "false");
    await expect(activeBadge).toContainText(/custom|własne/i);

    await permissiveChip.click();
    await expect(permissiveChip).toHaveAttribute("aria-pressed", "true");
    await expect(activeBadge).toContainText(/Permissive|Pobłażliwy/);
  });
});
