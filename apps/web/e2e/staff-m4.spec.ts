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
    await expect(page.getByRole("heading", { level: 1, name: "Mon compte" })).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();
    await expectAccessible(page);
    await expectTouchTargets(page);
    // Langue et apparence en lignes de Réglages (maquette v2 07) : sélecteur natif posé sur la ligne.
    await page.getByLabel("Apparence").selectOption("dark");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expectAccessible(page);
    await page.getByLabel("Apparence").selectOption("auto");
    await page.getByLabel("Langue").selectOption("en");
    await expect(page.getByRole("heading", { level: 1, name: "My account" })).toBeVisible();
  });
});
