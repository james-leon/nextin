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
const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

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
  // v2 : toucher un service ouvre l'étape « Votre nom » (nom demandé ou facultatif), puis « Ticket pris » mène au ticket.
  await page.getByRole("button", { name: service }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Votre nom" })).toBeVisible();
  await page.getByRole("button", { name: "Prendre mon ticket" }).click();
  await page.getByRole("button", { name: "Voir mon ticket" }).click();
  await page.waitForURL(/\/t\/[A-Za-z0-9]{22}$/);
  return page.url().split("/t/")[1]!;
}

test.describe("M4 — parcours client", () => {
  test.skip(({ isMobile }) => !isMobile, "parcours client sur téléphone");

  test("scan → ticket → appel → admission → note, en 3G", async ({ page }) => {
    const { staff, counterId, entryCode } = await setUpBranch();
    await emulate3G(page);

    await page.goto(`/q/${entryCode}`);
    await expect(page.getByRole("heading", { level: 1, name: "Choisissez un service" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Consultation/ })).toBeEnabled();
    await expect(page.getByRole("button", { name: /Consultation/ })).toContainText("Pas d'attente");
    await expectAccessible(page);
    await expectTouchTargets(page);

    // Accès prioritaire : plus demandé par le client ; une ligne d'information renvoie vers l'accueil.
    await expect(page.getByText("Enceinte, âgée ou en situation de handicap ? Signalez-vous à l'accueil.")).toBeVisible();
    await expect(page.getByRole("switch")).toHaveCount(0);
    await page.getByRole("button", { name: /Consultation/ }).click();
    // Nom facultatif dans cette agence : l'étape « Votre nom » se passe sans saisie.
    await expect(page.getByLabel("Votre nom (facultatif)")).toBeVisible();
    await expectAccessible(page);
    await page.getByRole("button", { name: "Prendre mon ticket" }).click();
    // « Ticket pris » : numéro et file, puis ouverture automatique de « Mon ticket ».
    await expect(page.getByRole("heading", { level: 1, name: "Ticket pris" })).toBeVisible();
    await expect(page.getByText("C-001")).toBeVisible();
    await page.waitForURL(/\/t\/[A-Za-z0-9]{22}$/);
    const token = page.url().split("/t/")[1]!;
    const hero = page.locator("section[aria-live]").first();
    await expect(hero).toContainText("C-001");
    // Premier de la file : « Vous êtes le prochain » à la place de « Devant vous : 0 ».
    await expect(hero).toContainText("Vous êtes le prochain");
    await expect(page.getByText("Gardez cette page ouverte")).toBeVisible();
    await expectAccessible(page);
    await expectTouchTargets(page);

    // Priorité accordée par le personnel (motif journalisé) : « Accès prioritaire » apparaît sur le ticket, en direct.
    const { data: mine } = await staff.from("tickets").select("id, priority_reason").eq("public_token", token).single();
    expect(mine!.priority_reason).toBeNull();
    await rpc(staff, "set_ticket_priority", { p_ticket: mine!.id, p_reason: "pregnancy" });
    await expect(page.getByTestId("ticket-priority")).toHaveText("Accès prioritaire");

    // « Alerter le suivant » : la page passe en « C'est votre tour » sans rechargement.
    const called = await rpc<{ id: string }>(staff, "call_next", { p_counter: counterId });
    await expect(page.getByText("C'est votre tour")).toBeVisible();
    // Plein écran vert : où aller, en toutes lettres.
    await expect(page.getByRole("alertdialog")).toContainText("Allez au cabinet 3");
    await expect(page).toHaveTitle(/C'est votre tour · C-001/);
    // Carte « C'est votre tour » : contraste AA vérifié (fond vert profond, texte blanc), une fois la transition de couleur terminée.
    await page.waitForTimeout(700);
    await expectAccessible(page);

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
    // v2 : « 2 personnes devant vous » sous le numéro, avec la file en points.
    const ahead = page.locator("section[aria-live]").first();
    await expect(ahead).toContainText("2 personnes devant vous");
    const first = await rpc<{ id: string }>(staff, "call_next", { p_counter: counterId });
    await expect(ahead).toContainText("1 personne devant vous");
    // À côté de l'attente : le numéro en cours et son cabinet.
    await expect(ahead.locator("dl")).toContainText("C-001");
    await expect(ahead.locator("dl")).toContainText("En cours · Cabinet 3");
    await rpc(staff, "mark_no_show", { p_ticket: first.id });
    await rpc(staff, "call_next", { p_counter: counterId });
    await expect(ahead).toContainText("Vous êtes le prochain");
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
    await expect(page.getByRole("heading", { level: 1, name: "Choisissez un service" })).toBeVisible();

    const token = await takeTicket(page, shortCode);
    // Deuxième demande dans la même agence : le ticket en cours est rendu.
    await page.goto(`/q/${shortCode}`);
    await page.getByRole("button", { name: /Pédiatrie/ }).click();
    await page.getByRole("button", { name: "Prendre mon ticket" }).click();
    await page.waitForURL(new RegExp(`/t/${token}$`));

    // Onglet « Tickets » : le ticket en cours est listé et s'ouvre d'un toucher.
    await page.goto("/t");
    await expect(page.getByRole("heading", { level: 1, name: "Tickets" })).toBeVisible();
    await page.getByRole("link", { name: /C-001/ }).click();
    await page.waitForURL(new RegExp(`/t/${token}$`));

    await page.getByRole("button", { name: "Annuler le ticket" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Annuler le ticket" }).click();
    await expect(page.getByText("Ticket annulé")).toBeVisible();
    // Ticket fini (LOT 5a) : numéro grisé lisible (contraste AA).
    await expectAccessible(page);
    await page.getByRole("link", { name: "Prendre un nouveau ticket" }).click();
    await page.waitForURL(/\/q\/[A-Za-z0-9]{22}$/);
    await expect(page.getByRole("heading", { level: 1, name: "Choisissez un service" })).toBeVisible();

    // Ticket annulé : rangé dans l'historique.
    await page.goto("/t");
    await expect(page.getByRole("link", { name: /C-001/ })).toContainText("Annulé");
  });

  test("code inconnu et lien de ticket invalide", async ({ page }) => {
    await page.goto("/q/ZZZZZZ");
    await expect(page.getByRole("heading", { level: 1, name: "QR code inconnu" })).toBeVisible();
    await page.goto("/t/AAAAAAAAAAAAAAAAAAAAAA");
    await expect(page.getByText("Ticket introuvable.")).toBeVisible();
  });

  test("accueil, scanner, profil : langue et apparence, accessibles en clair et en sombre", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "Bonjour" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Navigation" }).getByRole("link", { name: "Accueil" })).toHaveAttribute("aria-current", "page");
    await expectAccessible(page);
    await expectTouchTargets(page);
    await expect(page.getByRole("link", { name: "Saisir le code" })).toHaveAttribute("href", "/c");
    await page.getByRole("link", { name: "Scanner le QR code" }).click();
    await page.waitForURL(/\/scan$/);
    await expectTouchTargets(page);
    await page.goto("/");

    await page.getByRole("link", { name: "Profil" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Profil" })).toBeVisible();
    await expectAccessible(page);
    await page.getByLabel("Apparence").selectOption("dark");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expectAccessible(page);
    await page.getByLabel("Langue").selectOption("en");
    await expect(page.getByRole("heading", { level: 1, name: "Profile" })).toBeVisible();
    await page.getByRole("link", { name: "Home" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Hello" })).toBeVisible();
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
    for (const path of ["/", "/scan", "/c", "/t", "/profile", `/q/${entryCode}`, `/t/${created.public_token}`]) {
      // Contexte neuf : aucun fichier en cache.
      const context = await browser.newContext();
      const page = await context.newPage();
      const bytes = await firstLoadBytes(page, path);
      console.log(`${path.replace(/\/[A-Za-z0-9]{20,}$/, "/…")} : ${Math.round(bytes / 1024)} Ko`);
      expect(bytes, path).toBeLessThan(200 * 1024);
      await context.close();
    }
    // iPhone (Safari) : la page porte en plus les écrans de démarrage iOS de l'iPhone ; même budget.
    for (const path of ["/", `/q/${entryCode}`, `/t/${created.public_token}`]) {
      const context = await browser.newContext({ userAgent: IPHONE_UA });
      const page = await context.newPage();
      const bytes = await firstLoadBytes(page, path);
      console.log(`iPhone ${path.replace(/\/[A-Za-z0-9]{20,}$/, "/…")} : ${Math.round(bytes / 1024)} Ko`);
      expect(bytes, `iPhone ${path}`).toBeLessThan(200 * 1024);
      await context.close();
    }
  });
});
