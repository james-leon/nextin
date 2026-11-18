import { expect, test } from "@playwright/test";
import { expectAccessible, expectTouchTargets, signInViaUi } from "./helpers";
import { setUpBranch } from "./queue-helpers";

// LOT 4 (maquettes v2 05 et 19) : « Démarrage » en tête de la barre latérale avec la progression, six étapes ;
// les supports QR téléchargés marquent l'étape « Imprimer le QR code ».
test("démarrage : progression dans la barre latérale, étape QR faite après le téléchargement du PDF", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "barre latérale fixe sur ordinateur");
  const b = await setUpBranch("Clinique Démarrage");
  await page.goto("/login");
  await signInViaUi(page, b.email);
  await page.waitForURL(/\/app$/);
  await page.goto(`/app/o/${b.orgId}/setup`);

  // Agence, services et guichet existent déjà : 3 étapes sur 6.
  const nav = page.getByRole("navigation", { name: "Navigation de l'établissement" });
  await expect(nav.getByRole("link", { name: /Démarrage.*3 étapes sur 6/ })).toHaveAttribute("aria-current", "page");
  await expect(page.getByText("Configuration : 3 étapes sur 6")).toBeVisible();
  await expect(page.getByRole("link", { name: "Commencer · Imprimer le QR code" })).toBeVisible();
  await expectAccessible(page);
  await expectTouchTargets(page);

  const pdf = await page.request.get(`/app/o/${b.orgId}/branches/${b.branchId}/qr/pdf?format=a4`);
  expect(pdf.status()).toBe(200);
  await page.reload();
  await expect(page.getByText("Configuration : 4 étapes sur 6")).toBeVisible();
  await expect(page.getByRole("link", { name: "Commencer · Inviter l'équipe" })).toBeVisible();
  await expect(nav.getByRole("link", { name: /Démarrage.*4 étapes sur 6/ })).toBeVisible();
});
