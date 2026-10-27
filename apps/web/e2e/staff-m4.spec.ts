import { expect, test } from "@playwright/test";
import { expectAccessible, expectTouchTargets, signInViaUi } from "./helpers";
import { setUpBranch } from "./queue-helpers";

test.describe("M4 — réglages du personnel", () => {
  test("réglages : apparence et langue", async ({ page }) => {
    const { email } = await setUpBranch();
    await page.goto("/login");
    await signInViaUi(page, email);
    await page.waitForURL(/\/app$/);
    await page.getByRole("link", { name: "Réglages" }).first().click();
    await expect(page.getByRole("heading", { level: 1, name: "Réglages" })).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();
    await expectAccessible(page);
    await expectTouchTargets(page);
    await page.getByRole("radio", { name: "Sombre" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expectAccessible(page);
    await page.getByRole("radio", { name: "Auto" }).click();
    await page.getByRole("radio", { name: "English" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
  });
});
