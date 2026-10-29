import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { bannerPng } from "../../../scripts/demo-images";
import { pairDisplay, platformAdmin, signedIn, takeTicket, today } from "./ads-helpers";
import { PASSWORD, expectAccessible, expectTouchTargets, signInViaUi, uniqueEmail } from "./helpers";
import { anonClient, rpc, setUpBranch, supabaseOptions } from "./queue-helpers";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, supabaseOptions);

async function login(page: Page, email: string, next?: string) {
  await page.goto(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  await signInViaUi(page, email);
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
}

/** Boîte d'un élément entièrement visible, marge haute ≥ 8 px, et chevauchant verticalement le grand titre. */
async function alignedWithTitle(page: Page, action: import("@playwright/test").Locator) {
  const box = (await action.boundingBox())!;
  const title = (await page.getByRole("heading", { level: 1 }).first().boundingBox())!;
  expect(box.y).toBeGreaterThanOrEqual(8);
  expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  expect(box.y).toBeLessThan(title.y + title.height);
  expect(box.y + box.height).toBeGreaterThan(title.y);
}

test.describe("Backlog — ordinateur : gabarit du personnel", () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== "desktop", "mise en page ordinateur"));

  test("actions alignées avec le titre, barre latérale sur toute la hauteur, pas de retour en double, établissements en grille", async ({ page }) => {
    const b = await setUpBranch("Clinique Gabarit");
    await login(page, b.email);
    await expect(page.getByRole("list", { name: "Mes établissements" })).toBeVisible();
    await expect(page.getByRole("list", { name: "Mes établissements" }).getByRole("link", { name: /Clinique Gabarit/ })).toBeVisible();

    // Tableau de bord, vue mois : « Exporter » aligné avec le titre, puis dans la barre compacte au défilement.
    await page.goto(`/app/o/${b.orgId}`);
    await page.getByRole("radio", { name: "Mois" }).click();
    await alignedWithTitle(page, page.getByRole("button", { name: "Exporter" }));
    await page.mouse.wheel(0, 5000);
    await page.waitForTimeout(400);
    const exportBox = (await page.getByRole("button", { name: "Exporter" }).boundingBox())!;
    expect(exportBox.y).toBeGreaterThanOrEqual(0);
    expect(exportBox.y + exportBox.height).toBeLessThanOrEqual(60);
    const sidebar = await page.evaluate(() => {
      const aside = document.querySelector("aside")!;
      return { height: aside.getBoundingClientRect().height, page: document.documentElement.scrollHeight, innerTop: aside.firstElementChild!.getBoundingClientRect().top };
    });
    expect(sidebar.height).toBeGreaterThanOrEqual(sidebar.page - 1);
    expect(Math.abs(sidebar.innerTop)).toBeLessThan(1);

    // Rubrique de la barre latérale : pas de bouton retour qui la répète.
    await page.goto(`/app/o/${b.orgId}/branches`);
    await expect(page.getByRole("link", { name: "Vue d'ensemble" })).toHaveCount(1);
    await page.goto(`/app/o/${b.orgId}/branches/${b.branchId}/services`);
    await expect(page.getByRole("link", { name: "Akwa" })).toBeVisible();

    // Accueil, rendez-vous : « Nouveau rendez-vous » aligné avec le titre.
    await page.goto(`/desk/reception/${b.branchId}/appointments`);
    await alignedWithTitle(page, page.getByRole("button", { name: "Nouveau rendez-vous" }));
  });
});

test.describe("Backlog — poste du médecin", () => {
  test("ordinateur : deux colonnes et raccourcis clavier (avec aide et confirmation d'absence)", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "raccourcis clavier sur ordinateur");
    const b = await setUpBranch("Clinique Raccourcis");
    for (let i = 0; i < 2; i++) await rpc(b.staff, "reception_create_ticket", { p_service: b.serviceId });
    await login(page, b.email, `/desk/counter/${b.counterId}`);
    await expect(page.getByRole("heading", { level: 1, name: "Cabinet 3" })).toBeVisible();
    const next = (await page.getByText(/À suivre/).boundingBox())!;
    const primary = (await page.getByRole("button", { name: "Alerter le suivant" }).filter({ visible: true }).boundingBox())!;
    expect(next.x).toBeGreaterThan(primary.x + primary.width / 2);
    await expectAccessible(page);

    await page.keyboard.press("?");
    await expect(page.getByRole("dialog", { name: "Raccourcis clavier" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await page.locator("body").click({ position: { x: 5, y: 5 } });
    await page.keyboard.press(" ");
    await expect(page.getByText("Patient alerté")).toBeVisible();
    await expect(page.getByText("C-001").first()).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page.getByText("Client en cours")).toBeVisible();
    await page.keyboard.press(" ");
    await expect(page.getByText("Patient alerté")).toBeVisible();
    await expect(page.getByText("C-002").first()).toBeVisible();
    await page.keyboard.press("a");
    const confirm = page.getByRole("alertdialog", { name: "Marquer C-002 absent ?" });
    await expect(confirm).toBeVisible();
    await confirm.getByRole("button", { name: "Absent" }).click();
    await expect(page.getByText("Personne en attente").first()).toBeVisible();
  });

  test("mode compact mémorisé sur l'appareil", async ({ page }) => {
    const b = await setUpBranch("Clinique Compact");
    await rpc(b.staff, "reception_create_ticket", { p_service: b.serviceId });
    await login(page, b.email, `/desk/counter/${b.counterId}`);
    await page.getByRole("button", { name: "Mode compact" }).click();
    await expect(page.getByRole("button", { name: "Quitter le mode compact" })).toBeVisible();
    await expect(page.getByText("1 en attente")).toBeVisible();
    await page.reload();
    await expect(page.getByRole("button", { name: "Quitter le mode compact" })).toBeVisible();
    await page.getByRole("button", { name: "Alerter le suivant" }).click();
    await expect(page.getByText("C-001")).toBeVisible();
    await expectAccessible(page);
    await expectTouchTargets(page);
    await page.getByRole("button", { name: "Quitter le mode compact" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Cabinet 3" })).toBeVisible();
  });
});

test.describe("Backlog — pages client", () => {
  test("ordinateur : « Mon ticket » en deux colonnes, actions dans la colonne de droite", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "mise en page ordinateur");
    const b = await setUpBranch("Clinique Deux Colonnes");
    const token = await takeTicket(page, b);
    await page.goto(`/t/${token}`);
    const hero = (await page.getByText("C-001").first().boundingBox())!;
    const cancel = page.getByRole("button", { name: "Annuler le ticket" }).filter({ visible: true });
    await expect(cancel).toHaveCount(1);
    expect((await cancel.boundingBox())!.x).toBeGreaterThan(hero.x + hero.width);
    await expectAccessible(page);
  });

  test("À proximité : icône et libellé du secteur de l'établissement", async ({ page }) => {
    await setUpBranch("Clinique Secteur");
    await page.goto("/nearby?q=Clinique%20Secteur");
    const row = page.getByRole("link", { name: /Clinique Secteur/ }).first();
    await expect(row).toBeVisible();
    await expect(row).toContainText("Clinique");
    await expectAccessible(page);
  });

  test("présence : QR code tournant de l'écran TV ; QR imprimé refusé si l'agence le réserve à l'écran", async ({ page, request }, info) => {
    test.skip(info.project.name !== "desktop", "règle serveur");
    const b = await setUpBranch("Clinique Présence");
    await admin.from("branch_settings").update({ remote_tickets_enabled: true, remote_max_distance_km: null }).eq("branch_id", b.branchId);
    const visitor = anonClient();
    const { data: anon } = await visitor.auth.signInAnonymously();
    const take = async () => {
      const { data, error } = await admin.rpc("take_remote_ticket", {
        p_service: b.serviceId,
        p_lat: null,
        p_lng: null,
        p_priority_reason: null,
        p_customer: anon.user!.id,
      });
      expect(error).toBeNull();
      const ticket = data as { ticket_id?: string; id?: string };
      const row = await admin.from("tickets").select("public_token").eq("id", ticket.ticket_id ?? ticket.id!).single();
      return row.data!.public_token as string;
    };
    const first = await take();

    const device = await pairDisplay(request, b.staff, b.branchId, false);
    const session = (await (await request.get("/api/tv/session", { headers: { Authorization: `Bearer ${device}` } })).json()) as {
      session: { presence_url: string; entry_url: string };
    };
    expect(session.session.presence_url).toMatch(new RegExp(`^${session.session.entry_url}\\?p=[0-9A-F]{6}$`));
    const code = new URL(session.session.presence_url).searchParams.get("p")!;
    const confirmed = await visitor.rpc("confirm_presence", { p_token: first, p_entry_code: code });
    expect((confirmed.data as { remote: { presence_confirmed_at: string | null } }).remote.presence_confirmed_at).not.toBeNull();

    // Agence réservée à l'écran : le QR imprimé ne confirme plus la présence (il sert toujours à prendre un ticket).
    await admin.from("branch_settings").update({ remote_presence_tv_only: true }).eq("branch_id", b.branchId);
    await admin.from("tickets").update({ status: "cancelled" }).eq("public_token", first);
    const second = await take();
    const refused = await visitor.rpc("confirm_presence", { p_token: second, p_entry_code: b.entryCode });
    expect(refused.error?.message).toBe("presence_tv_only");

    // Réglage dans le back-office.
    await login(page, b.email, `/app/o/${b.orgId}/branches/${b.branchId}/settings`);
    await expect(page.getByRole("switch", { name: "Présence confirmée seulement par l'écran TV" })).toHaveAttribute("aria-checked", "true");
  });
});

test.describe("Backlog — publicité", () => {
  test("formule plafonnée : choix des agences avant la validation, puis agences affichées avant le paiement", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "parcours sur ordinateur");
    const b = await setUpBranch("Clinique Choisie");
    const email = uniqueEmail("annonceur");
    await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
    const adv = await signedIn(email);
    const advertiserId = await rpc<string>(adv, "create_advertiser", { p_name: "Boutique Choix", p_sector: "retail", p_phone: null, p_city: null });
    const campaignId = await rpc<string>(adv, "save_campaign", {
      p_campaign: null,
      p_advertiser: advertiserId,
      p_organization: null,
      p_fields: { name: "Choix", package_code: "bronze", sector: "retail", starts_on: today(), surfaces: ["tv"], target_cities: [], target_org_types: [], schedules: [] },
    });
    const path = `${advertiserId}/${campaignId}/v.png`;
    await adv.storage.from("ad-creatives").upload(path, bannerPng("#1A6BB5", "#0D2C54"), { contentType: "image/png" });
    await rpc(adv, "save_creative", { p_campaign: campaignId, p_creative: null, p_fields: { storage_path: path, kind: "image", headline: "Offre", duration_seconds: 8 } });

    await login(page, email, `/ads/campaigns/${campaignId}`);
    await expect(page.getByRole("heading", { name: "Agences de diffusion" })).toBeVisible();
    await page.getByRole("button", { name: "Choisir les agences" }).click();
    const sheet = page.getByRole("dialog", { name: "Choisir les agences" });
    await sheet.getByRole("checkbox", { name: /Clinique Choisie/ }).click();
    await expectAccessible(page);
    await sheet.getByRole("button", { name: /Enregistrer · 1 sur 5/ }).click();
    await expect(page.getByText("1 agence choisie")).toBeVisible();

    await page.getByRole("button", { name: "Soumettre à la validation" }).click();
    await expect(page.getByText("En validation").first()).toBeVisible();
    const wintek = await platformAdmin();
    await rpc(wintek.client, "review_campaign", { p_campaign: campaignId, p_approve: true, p_note: "" });
    await page.reload();
    const list = page.locator("section").filter({ has: page.getByRole("heading", { name: "Agences de diffusion" }) });
    await expect(list.getByText("Clinique Choisie")).toBeVisible();
    await expect(list.getByRole("listitem")).toHaveCount(1);
    void b;
  });

  test("caissier : ajouté par le propriétaire, ne voit que « Valider un bon »", async ({ browser, page }, info) => {
    test.skip(info.project.name !== "desktop", "parcours sur ordinateur");
    const owner = uniqueEmail("proprio");
    const cashier = uniqueEmail("caisse");
    for (const email of [owner, cashier]) await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
    const adv = await signedIn(owner);
    await rpc(adv, "create_advertiser", { p_name: "Pharmacie Caisse", p_sector: "retail", p_phone: null, p_city: null });

    await login(page, owner, "/ads/cashiers");
    await expect(page.getByRole("heading", { level: 1, name: "Caissiers" })).toBeVisible();
    await page.getByLabel("Adresse e-mail du caissier").fill("personne@inconnu.test");
    await page.getByRole("button", { name: "Ajouter le caissier" }).click();
    await expect(page.getByText("Aucun compte NextIn avec cette adresse")).toBeVisible();
    await page.getByLabel("Adresse e-mail du caissier").fill(cashier);
    await page.getByRole("button", { name: "Ajouter le caissier" }).click();
    await expect(page.getByText("Caissier ajouté.")).toBeVisible();
    await expect(page.getByText(cashier)).toBeVisible();
    await expectAccessible(page);

    const other = await browser.newContext().then((c) => c.newPage());
    await login(other, cashier, "/ads");
    await other.waitForURL(/\/ads\/redeem$/);
    await expect(other.getByText("Compte caissier : validation des bons seulement.")).toBeVisible();
    await expect(other.getByRole("link", { name: "Campagnes" })).toHaveCount(0);
    await expect(other.getByRole("button", { name: "Scanner le QR code du bon" })).toBeVisible();
    await other.getByRole("button", { name: "Scanner le QR code du bon" }).click();
    await expect(other.getByText(/Caméra indisponible ici|Accès à la caméra refusé/)).toBeVisible();
    await expectAccessible(other);
    await other.context().close();
  });
});
