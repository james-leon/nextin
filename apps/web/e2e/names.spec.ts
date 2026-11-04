import { expect, test, type Page } from "@playwright/test";
import { pairDisplay } from "./ads-helpers";
import { expectAccessible, expectTouchTargets, signInViaUi } from "./helpers";
import { rpc, setUpBranch } from "./queue-helpers";

async function login(page: Page, email: string, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await signInViaUi(page, email);
  await page.waitForURL((u) => u.pathname === next);
}

const NAME = "Zorobabel Nkou";

test.describe("Nom du client", () => {
  test.skip(({ isMobile }) => isMobile, "parcours poste et écran TV : grand écran");

  test("demandé à la prise de ticket, visible au poste (masquable), jamais sur l'écran TV", async ({ browser, page, request }) => {
    const b = await setUpBranch("Clinique Noms", { nameMode: "required", nameExtra: "age" });

    // Client : nom obligatoire avant « Prendre mon ticket », gardé sur l'appareil pour la fois suivante.
    const clientContext = await browser.newContext({ locale: "fr-FR" });
    const client = await clientContext.newPage();
    await client.goto(`/q/${b.entryCode}`);
    await client.getByRole("button", { name: "Prendre mon ticket" }).click();
    await expect(client.getByText("Indiquez votre nom.")).toBeVisible();
    await expect(client.getByLabel("Votre nom")).toBeFocused();
    await client.getByLabel("Votre nom").fill(NAME);
    await client.getByLabel("Votre âge (facultatif)").fill("42");
    await expectAccessible(client);
    await client.getByRole("button", { name: "Prendre mon ticket" }).click();
    await client.waitForURL(/\/t\/[A-Za-z0-9]{22}$/);
    await expect(client.getByText(NAME)).toHaveCount(0);
    await client.goto(`/q/${b.entryCode}`);
    await expect(client.getByLabel("Votre nom")).toHaveValue(NAME);

    // Poste : nom sous le numéro dans « À suivre », puis sous le patient en cours.
    await login(page, b.email, `/desk/counter/${b.counterId}`);
    await expect(page.getByText(`${NAME} · 42 ans`)).toBeVisible();
    await page.getByRole("button", { name: "Alerter le suivant" }).click();
    await expect(page.locator("section").filter({ hasText: "C-001" }).getByText(`${NAME} · 42 ans`).first()).toBeVisible();
    await expectAccessible(page);
    await expectTouchTargets(page);

    // Écran TV : le numéro appelé, jamais le nom (ni dans la page, ni dans la session de l'écran).
    const token = await pairDisplay(request, b.staff, b.branchId, false);
    const session = await (await request.get("/api/tv/session", { headers: { Authorization: `Bearer ${token}` } })).text();
    expect(session).not.toContain("Zorobabel");
    const tvContext = await browser.newContext({ viewport: { width: 1920, height: 1080 }, locale: "fr-FR" });
    const tv = await tvContext.newPage();
    await tv.addInitScript((t) => localStorage.setItem("nextin-tv-token", t), token);
    await tv.goto("/tv");
    await expect(tv.getByRole("region", { name: "Ticket appelé" })).toContainText("C-001", { timeout: 15_000 });
    expect(await tv.locator("body").innerText()).not.toContain("Zorobabel");

    // « Masquer le nom » d'un geste, puis « Afficher le nom ».
    await page.getByRole("button", { name: "Masquer le nom" }).click();
    await expect(page.getByText(NAME)).toHaveCount(0);
    await expect(page.getByText("Nom masqué").first()).toBeVisible();
    await page.getByRole("button", { name: "Afficher le nom" }).click();
    await expect(page.getByText(`${NAME} · 42 ans`).first()).toBeVisible();

    await Promise.all([clientContext.close(), tvContext.close()]);
  });

  test("masqué automatiquement après 2 minutes sans activité", async ({ page }) => {
    const b = await setUpBranch("Clinique Masque", { nameMode: "required" });
    await rpc(b.staff, "reception_create_ticket", { p_service: b.serviceId, p_customer_name: "Bathilde Essomba" });
    await page.clock.install();
    await login(page, b.email, `/desk/counter/${b.counterId}`);
    await expect(page.getByText("Bathilde Essomba")).toBeVisible();
    await page.clock.fastForward("01:50");
    await expect(page.getByText("Bathilde Essomba")).toBeVisible();
    await page.clock.fastForward("00:15");
    await expect(page.getByText("Bathilde Essomba")).toHaveCount(0);
    await expect(page.getByText("Nom masqué")).toBeVisible();
  });

  test("accueil : priorité et nom depuis le ticket sélectionné, jamais sur chaque ligne", async ({ page }) => {
    const b = await setUpBranch("Clinique Accueil", { nameMode: "required", nameExtra: "file_number" });
    await rpc(b.staff, "reception_create_ticket", { p_service: b.serviceId });
    await login(page, b.email, `/desk/reception/${b.branchId}`);
    const row = page.getByRole("button", { name: /^C-001/ });
    await expect(row).toBeVisible();
    await expect(page.getByRole("button", { name: "Prioritaire", exact: true })).toHaveCount(0);

    await row.click();
    await page.getByRole("dialog", { name: "Ticket C-001" }).getByRole("button", { name: "Saisir le nom" }).click();
    const sheet = page.getByRole("dialog", { name: "Nom · C-001" });
    await sheet.getByLabel("Nom du client").fill("Hermine Kemajou");
    await sheet.getByLabel("Numéro de dossier").fill("D-1234");
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText("Nom enregistré")).toBeVisible();
    await expect(row).toContainText("Hermine Kemajou · Dossier D-1234");

    await row.click();
    await page.getByRole("dialog", { name: "Ticket C-001" }).getByRole("button", { name: "Rendre prioritaire" }).click();
    await page.getByRole("dialog", { name: /Motif de priorité · C-001/ }).getByRole("button", { name: "Handicap" }).click();
    await expect(row).toContainText("Handicap");
    await expectAccessible(page);
  });
});
