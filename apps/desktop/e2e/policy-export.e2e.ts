import { expect, test } from "@playwright/test";
import { openPolicyPanel } from "./policy-helpers";

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

test("setup sheet preview includes policy context block", async ({ page }) => {
  await openPolicyPanel(page);
  const pageBody = page.locator("body");
  await expect(pageBody).toContainText(/Policy Context/i);
  await expect(pageBody).toContainText(/policyPreset:/i);
  await expect(pageBody).toContainText(/policyPresetSource:/i);
  await expect(pageBody).toContainText(/controller:/i);
});
