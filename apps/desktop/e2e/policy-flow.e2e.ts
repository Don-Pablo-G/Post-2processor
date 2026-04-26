import { expect, test } from "@playwright/test";

test("policy flow smoke scaffold", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Safety policy preset")).toBeVisible();
});
