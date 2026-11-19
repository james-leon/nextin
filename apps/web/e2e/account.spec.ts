import { expect, test } from "@playwright/test";
import { expectAccessible, signInViaUi } from "./helpers";
import { setUpBranch } from "./queue-helpers";

// LOT 5a (C) — écrans de compte (maquette v2 22) : nouveau mot de passe aux règles cochées en direct, invitation
// introuvable avec retour à la connexion.
test.describe("compte — maquette v2 22", () => {
  test("nouveau mot de passe : règles cochées pendant la saisie, bouton grisé tant qu'elles ne sont pas remplies", async ({ page }) => {
    const b = await setUpBranch("Clinique Mot de passe");
    await page.goto("/login?next=%2Freset-password");
    await signInViaUi(page, b.email);
    await page.waitForURL(/\/reset-password/);
    const save = page.getByRole("button", { name: "Enregistrer le mot de passe" });
    const rules = page.getByRole("list", { name: "Règles du mot de passe" });
    await expect(save).toBeDisabled();
    await expect(rules.getByText("Au moins 10 caractères · à remplir")).toHaveCount(1);
    await page.getByLabel("Nouveau mot de passe").fill("douala");
    await expect(save).toBeDisabled();
    await page.getByLabel("Nouveau mot de passe").fill("Douala2027neuf");
    await expect(rules.getByText("Au moins 10 caractères · respectée")).toHaveCount(1);
    await expect(rules.getByText("Des lettres et des chiffres · respectée")).toHaveCount(1);
    await expect(save).toBeDisabled();
    await page.getByLabel("Confirmer le mot de passe").fill("Douala2027neuf");
    await expect(rules.getByText("Les deux mots de passe sont identiques · respectée")).toHaveCount(1);
    await expect(save).toBeEnabled();
    await expectAccessible(page);
    await page.emulateMedia({ colorScheme: "dark" });
    await expectAccessible(page);
    await save.click();
    await page.waitForURL((url) => !url.pathname.startsWith("/reset-password"));
  });

  test("invitation introuvable : explication et retour à la connexion", async ({ page }) => {
    await page.goto("/invite/AAAAAAAAAAAAAAAAAAAAAAAA");
    await expect(page.getByRole("heading", { name: "Invitation introuvable" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Retour à la connexion" })).toHaveAttribute("href", "/login");
    await expectAccessible(page);
  });
});
