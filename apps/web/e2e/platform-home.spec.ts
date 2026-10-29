import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { PASSWORD, expectAccessible, expectTouchTargets, signInViaUi, uniqueEmail } from "./helpers";
import { setUpBranch, supabaseOptions } from "./queue-helpers";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, supabaseOptions);

async function createPlatformAdmin() {
  const email = uniqueEmail("wintek");
  const created = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  await admin.from("platform_admins").insert({ user_id: created.data.user!.id });
  return { email, userId: created.data.user!.id };
}

test.describe("Super admin : page d'accueil", () => {
  test("sans établissement : arrive sur la console après la connexion et en ouvrant /app, jamais invité à créer", async ({ page }) => {
    const { email } = await createPlatformAdmin();
    await page.goto("/login");
    await signInViaUi(page, email);
    await page.waitForURL(/\/admin$/);
    await expect(page.getByRole("heading", { level: 1, name: "Console Wintek" })).toBeVisible();

    await page.goto("/app");
    await page.waitForURL(/\/admin$/);
    await expect(page.getByText("Aucun établissement pour l'instant")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Créer un établissement" })).toHaveCount(0);
    // Pas de retour vers « Mes établissements » (il n'en a pas), mais les réglages et la déconnexion restent accessibles.
    await expect(page.getByRole("link", { name: "Mes établissements" })).toHaveCount(0);
    await page.getByRole("link", { name: "Mon compte" }).first().click();
    await page.waitForURL(/\/app\/settings\?from=%2Fadmin$/);
    await expect(page.getByRole("button", { name: "Se déconnecter" })).toBeVisible();
    await expectAccessible(page);
  });

  test("avec un établissement : « Console Wintek » en tête de liste, sans invitation à créer", async ({ page }) => {
    const { email, userId } = await createPlatformAdmin();
    const b = await setUpBranch("Clinique du Super Admin");
    await admin.from("memberships").insert({ organization_id: b.orgId, user_id: userId, role: "org_admin" });

    await page.goto("/login");
    await signInViaUi(page, email);
    await page.waitForURL(/\/app$/);
    const links = page.getByRole("main").getByRole("link");
    await expect(links.filter({ hasText: /Console Wintek|Clinique du Super Admin/ }).first()).toHaveText(/Console Wintek/);
    await expect(page.getByRole("link", { name: /Clinique du Super Admin/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "Créer un établissement" })).toHaveCount(0);
    await expectAccessible(page);
    await expectTouchTargets(page);

    // La console garde alors son lien de retour vers les établissements.
    await page.getByRole("link", { name: /Console Wintek/ }).click();
    await page.waitForURL(/\/admin$/);
    await expect(page.getByRole("heading", { level: 1, name: "Console Wintek" })).toBeVisible();
  });
});
