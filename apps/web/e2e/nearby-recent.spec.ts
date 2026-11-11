import { expect, test } from "@playwright/test";
import { expectAccessible, expectTouchTargets } from "./helpers";
import { rpc, setUpBranch } from "./queue-helpers";

// P3 — « À proximité » : invitation à activer la position (expliquée avant la demande du navigateur) et section
// « Récents » (agences ouvertes sur cet appareil, informations publiques seulement, effaçables).

test.describe("P3 — À proximité : récents et position", () => {
  test("récents après la visite d'une agence, effaçables ; invitation à la position, qui disparaît une fois localisé", async ({ browser }) => {
    test.setTimeout(60_000);
    const orgName = `Clinique Récente ${Date.now().toString(36)}`;
    const b = await setUpBranch(orgName);
    await rpc(b.staff, "set_branch_location", { p_branch: b.branchId, p_lat: 4.05, p_lng: 9.7 });
    const context = await browser.newContext({ locale: "fr-FR" });
    const page = await context.newPage();

    // Première visite : pas de récents, invitation à activer la position.
    await page.goto("/nearby");
    await expect(page.getByRole("heading", { name: "Voir les établissements autour de vous" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Récents" })).toHaveCount(0);

    // Une agence ouverte, puis retour : elle apparaît dans « Récents ».
    await page.goto(`/b/${b.branchId}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.goto("/nearby");
    const recent = page.getByRole("region", { name: "Récents" });
    await expect(recent).toBeVisible();
    await expect(recent.getByRole("link", { name: new RegExp(orgName) })).toHaveAttribute("href", `/b/${b.branchId}`);
    await expectAccessible(page);
    await expectTouchTargets(page);
    // Rien de personnel n'est gardé : nom de l'établissement, de l'agence, secteur, ville.
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("nextin-recent-branches") ?? "[]"));
    expect(Object.keys(stored[0]).sort()).toEqual(["city", "id", "name", "organization", "type", "visitedAt"]);

    // La recherche masque les récents ; « Effacer » les supprime.
    await page.getByLabel("Établissement ou ville").fill("zzz");
    await expect(recent).toHaveCount(0);
    await page.getByLabel("Établissement ou ville").fill("");
    await page.getByRole("button", { name: "Effacer les établissements récents" }).click();
    await expect(page.getByRole("region", { name: "Récents" })).toHaveCount(0);
    await context.close();

    // Position autorisée : plus d'invitation, liste « Autour de vous ».
    const located = await browser.newContext({ locale: "fr-FR", geolocation: { latitude: 4.068, longitude: 9.7 }, permissions: ["geolocation"] });
    const p2 = await located.newPage();
    await p2.goto("/nearby");
    await expect(p2.getByText("Le plus proche")).toBeVisible();
    await expect(p2.getByRole("heading", { name: "Voir les établissements autour de vous" })).toHaveCount(0);
    await located.close();
  });
});
