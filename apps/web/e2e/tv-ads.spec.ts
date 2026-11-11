import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { expectAccessible, expectTouchTargets, signInViaUi } from "./helpers";
import { setUpBranch } from "./queue-helpers";

// T1 — « Publicité sur cet écran » : activée par défaut à l'appairage, désactivable et réactivable depuis la fiche de
// l'écran ; une modification du nom conserve la valeur ; l'écran /tv reçoit (ou non) la publicité.

async function showAds(request: APIRequestContext, tv: Page): Promise<boolean> {
  const token = await tv.evaluate(() => localStorage.getItem("nextin-tv-token"));
  expect(token).toBeTruthy();
  const res = await request.get("/api/tv/session", { headers: { Authorization: `Bearer ${token}` } });
  expect(res.status()).toBe(200);
  return ((await res.json()) as { session: { show_ads: boolean } }).session.show_ads;
}

/** Fiche de l'écran chargée (navigation terminée, action d'enregistrement en place) avant d'y toucher. */
async function openedCard(page: Page) {
  await page.waitForURL(/\/displays\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("button", { name: "Enregistrer" })).toBeVisible();
}

test.describe("T1 — publicité sur les écrans TV", () => {
  test.skip(({ isMobile }) => isMobile, "appairage d'un téléviseur : grand écran");

  test("appairage (activée par défaut) → désactiver → renommer sans la changer → réactiver", async ({ browser, request }) => {
    test.setTimeout(90_000);
    const b = await setUpBranch("Clinique Écran Pub");
    const tvContext = await browser.newContext({ viewport: { width: 1920, height: 1080 }, locale: "fr-FR" });
    const tv = await tvContext.newPage();
    await tv.goto("/tv");
    const codeText = tv.locator("p[aria-live]");
    await expect(codeText).toHaveText(/^\d{3} \d{3}$/);
    const code = (await codeText.innerText()).replace(/\D/g, "");

    const staffContext = await browser.newContext({ locale: "fr-FR" });
    const staff = await staffContext.newPage();
    const displays = `/app/o/${b.orgId}/branches/${b.branchId}/displays`;
    await staff.goto(`/login?next=${encodeURIComponent(displays)}`);
    await signInViaUi(staff, b.email);
    await staff.waitForURL((u) => u.pathname === displays);
    const pairSwitch = staff.getByRole("switch", { name: "Publicité sur cet écran" });
    await expect(pairSwitch).toBeChecked();
    await expect(staff.getByText("Annonces de votre établissement et annonceurs validés par Wintek.")).toBeVisible();
    await expect(staff.getByRole("link", { name: "Ouvrir Publicité" })).toHaveAttribute("href", `/app/o/${b.orgId}/ads`);
    await expectTouchTargets(staff);
    await staff.getByLabel("Code affiché sur l'écran").fill(code);
    await staff.getByLabel("Nom de l'écran").fill("Salle d'attente");
    await staff.getByRole("button", { name: "Appairer" }).click();
    await expect(staff.getByText("Écran appairé.", { exact: false })).toBeVisible();
    // L'écran récupère son jeton puis affiche la file : publicité activée.
    await expect.poll(() => tv.evaluate(() => localStorage.getItem("nextin-tv-token")), { timeout: 20_000 }).toBeTruthy();
    expect(await showAds(request, tv)).toBe(true);

    // Fiche de l'écran : désactiver.
    await staff.getByRole("link", { name: /Salle d'attente/ }).click();
    await openedCard(staff);
    const editSwitch = staff.getByRole("switch", { name: "Publicité sur cet écran" });
    await expect(editSwitch).toBeChecked();
    await expectAccessible(staff);
    await editSwitch.click();
    await expect(editSwitch).not.toBeChecked();
    await staff.getByRole("button", { name: "Enregistrer" }).click();
    await staff.waitForURL((u) => u.pathname === displays);
    expect(await showAds(request, tv)).toBe(false);

    // Renommer : la publicité reste désactivée.
    await staff.getByRole("link", { name: /Salle d'attente/ }).click();
    await openedCard(staff);
    await expect(staff.getByRole("switch", { name: "Publicité sur cet écran" })).not.toBeChecked();
    await staff.getByLabel("Nom de l'écran").fill("Hall d'accueil");
    await staff.getByRole("button", { name: "Enregistrer" }).click();
    await staff.waitForURL((u) => u.pathname === displays);
    expect(await showAds(request, tv)).toBe(false);

    // Réactiver.
    await staff.getByRole("link", { name: /Hall d'accueil/ }).click();
    await openedCard(staff);
    const again = staff.getByRole("switch", { name: "Publicité sur cet écran" });
    await again.click();
    await expect(again).toBeChecked();
    await staff.getByRole("button", { name: "Enregistrer" }).click();
    await staff.waitForURL((u) => u.pathname === displays);
    expect(await showAds(request, tv)).toBe(true);
    await tvContext.close();
    await staffContext.close();
  });
});
