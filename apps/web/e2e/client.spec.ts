import { expect, test, type Page } from "@playwright/test";
import { expectAccessible, expectTouchTargets } from "./helpers";
import { rpc, setUpBranch } from "./queue-helpers";

/** Réseau 3G (≈ 1,6 Mbit/s, 150 ms) : le parcours doit rester utilisable sur un téléphone d'entrée de gamme. */
async function emulate3G(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
  });
}

/** Octets transférés (compressés) pendant le premier chargement d'une page. */
async function firstLoadBytes(page: Page, path: string) {
  let total = 0;
  const onDone = async (request: import("@playwright/test").Request) => {
    const sizes = await request.sizes().catch(() => null);
    if (sizes) total += sizes.responseBodySize + sizes.responseHeadersSize;
  };
  page.on("requestfinished", onDone);
  await page.goto(path, { waitUntil: "networkidle" });
  await page.waitForTimeout(300);
  page.off("requestfinished", onDone);
  return total;
}

async function takeTicket(page: Page, entry: string, service = /Consultation/) {
  await page.goto(`/q/${entry}`);
  await page.getByRole("radio", { name: service }).click();
  await page.getByRole("button", { name: "Prendre mon ticket" }).click();
  await page.waitForURL(/\/t\/[A-Za-z0-9]{22}$/);
  return page.url().split("/t/")[1]!;
}

test.describe("M4 — parcours client", () => {
  test.skip(({ isMobile }) => !isMobile, "parcours client sur téléphone");

  test("scan → ticket → appel → admission → note, en 3G", async ({ page }) => {
    const { staff, counterId, entryCode } = await setUpBranch();
    await emulate3G(page);

    await page.goto(`/q/${entryCode}`);
    await expect(page.getByRole("heading", { level: 1, name: "Choisir un service" })).toBeVisible();
    await expect(page.getByText("QR code reconnu")).toBeVisible();
    await expect(page.getByRole("radio", { name: /Consultation/ })).toHaveAttribute("aria-checked", "true");
    await expect(page.getByRole("radio", { name: /Consultation/ })).toContainText("Pas d'attente");
    await expectAccessible(page);
    await expectTouchTargets(page);

    // Accès prioritaire : motif obligatoire, choisi dans une liste.
    await page.getByLabel("Accès prioritaire").click();
    await page.getByRole("radio", { name: "Grossesse" }).click();
    await page.getByRole("button", { name: "Prendre mon ticket" }).click();
    await page.waitForURL(/\/t\/[A-Za-z0-9]{22}$/);
    const hero = page.locator("section[aria-live]").first();
    await expect(hero).toContainText("C-001");
    await expect(hero).toContainText("Devant vous");
    await expect(page.getByText("Gardez cette page ouverte")).toBeVisible();
    await expectAccessible(page);
    await expectTouchTargets(page);

    // « Alerter le suivant » : la page passe en « C'est votre tour » sans rechargement.
    const called = await rpc<{ id: string }>(staff, "call_next", { p_counter: counterId });
    await expect(page.getByText("C'est votre tour")).toBeVisible();
    await expect(page.getByText("Présentez-vous · Cabinet 3")).toBeVisible();
    await expect(page).toHaveTitle(/C'est votre tour · C-001/);

    await rpc(staff, "admit_ticket", { p_ticket: called.id });
    await expect(page.getByText("Vous êtes reçu")).toBeVisible();
    await expect(page.getByRole("button", { name: "Annuler le ticket" })).toHaveCount(0);

    await rpc(staff, "finish_ticket", { p_ticket: called.id });
    await expect(page.getByText("Merci de votre visite")).toBeVisible();
    await expectAccessible(page);
    await page.getByRole("radio", { name: "5 étoiles" }).click();
    await page.getByLabel("Un commentaire ? (facultatif)").fill("Accueil rapide");
    await page.getByRole("button", { name: "Envoyer" }).click();
    await expect(page.getByText("Merci pour votre avis.")).toBeVisible();
  });

  test("position et attente se mettent à jour quand la file avance", async ({ page }) => {
    const { staff, serviceId, counterId, entryCode } = await setUpBranch();
    await rpc(staff, "reception_create_ticket", { p_service: serviceId });
    await rpc(staff, "reception_create_ticket", { p_service: serviceId });
    await takeTicket(page, entryCode);
    const ahead = page.locator("dl > div").first();
    await expect(ahead).toContainText("2");
    const first = await rpc<{ id: string }>(staff, "call_next", { p_counter: counterId });
    await expect(ahead).toContainText("1");
    await expect(page.getByText("En cours : C-001 · Cabinet 3")).toBeVisible();
    await rpc(staff, "mark_no_show", { p_ticket: first.id });
    await rpc(staff, "call_next", { p_counter: counterId });
    await expect(ahead).toContainText("0");
  });

  test("code court, ticket déjà actif, annulation", async ({ page }) => {
    const { shortCode } = await setUpBranch();
    await page.goto("/c");
    await page.getByLabel("Code").fill("AB1");
    await page.getByRole("button", { name: "Continuer" }).click();
    await expect(page.getByText("6 lettres ou chiffres.")).toBeVisible();
    await page.getByLabel("Code").fill(` ${shortCode.toLowerCase()} `);
    await page.getByRole("button", { name: "Continuer" }).click();
    await page.waitForURL(new RegExp(`/q/${shortCode}$`));
    await expect(page.getByText("Code reconnu")).toBeVisible();

    const token = await takeTicket(page, shortCode);
    // Deuxième demande dans la même agence : le ticket en cours est rendu.
    await page.goto(`/q/${shortCode}`);
    await page.getByRole("radio", { name: /Pédiatrie/ }).click();
    await page.getByRole("button", { name: "Prendre mon ticket" }).click();
    await page.waitForURL(new RegExp(`/t/${token}$`));

    // Onglet « Mon ticket » : retrouve le ticket en cours.
    await page.goto("/t");
    await page.waitForURL(new RegExp(`/t/${token}$`));

    await page.getByRole("button", { name: "Annuler le ticket" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Annuler le ticket" }).click();
    await expect(page.getByText("Ticket annulé")).toBeVisible();
    await page.getByRole("link", { name: "Prendre un nouveau ticket" }).click();
    await page.waitForURL(new RegExp(`/q/${shortCode}$`));

    await page.goto("/t");
    await expect(page.getByText("Aucun ticket en cours")).toBeVisible();
  });

  test("code inconnu et lien de ticket invalide", async ({ page }) => {
    await page.goto("/q/ZZZZZZ");
    await expect(page.getByRole("heading", { level: 1, name: "QR code inconnu" })).toBeVisible();
    await page.goto("/t/AAAAAAAAAAAAAAAAAAAAAA");
    await expect(page.getByText("Ticket introuvable.")).toBeVisible();
  });

  test("scanner, profil : langue et apparence, accessibles en clair et en sombre", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "Scannez pour commencer" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Navigation" }).getByRole("link", { name: "Scanner" })).toHaveAttribute("aria-current", "page");
    await expectAccessible(page);
    await expectTouchTargets(page);

    await page.getByRole("link", { name: "Profil" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Profil" })).toBeVisible();
    await expectAccessible(page);
    await page.getByRole("radio", { name: "Sombre" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expectAccessible(page);
    await page.getByRole("radio", { name: "English" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Profile" })).toBeVisible();
    await page.getByRole("link", { name: "Scan" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Scan to get started" })).toBeVisible();
  });

  test("pages client sombres accessibles", async ({ browser }) => {
    const { staff, serviceId, entryCode } = await setUpBranch();
    await rpc(staff, "reception_create_ticket", { p_service: serviceId });
    const context = await browser.newContext({ colorScheme: "dark", isMobile: true, viewport: { width: 412, height: 915 } });
    const page = await context.newPage();
    await page.goto(`/q/${entryCode}`);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expectAccessible(page);
    await takeTicket(page, entryCode);
    await expect(page.locator("section[aria-live]").first()).toContainText("C-002");
    await expectAccessible(page);
    await context.close();
  });

  test("budget : chaque page client pèse moins de 200 Ko au premier chargement", async ({ browser }) => {
    const { entryCode, staff, serviceId } = await setUpBranch();
    const created = await rpc<{ public_token: string }>(staff, "reception_create_ticket", { p_service: serviceId });
    for (const path of ["/", `/q/${entryCode}`, `/t/${created.public_token}`]) {
      // Contexte neuf : aucun fichier en cache.
      const context = await browser.newContext();
      const page = await context.newPage();
      const bytes = await firstLoadBytes(page, path);
      console.log(`${path.replace(/\/[A-Za-z0-9]{20,}$/, "/…")} : ${Math.round(bytes / 1024)} Ko`);
      expect(bytes, path).toBeLessThan(200 * 1024);
      await context.close();
    }
  });
});
