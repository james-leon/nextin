import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { bannerPng } from "../../../scripts/demo-images";
import { PASSWORD, expectAccessible, expectTouchTargets, signInViaUi, signUpViaUi, uniqueEmail } from "./helpers";
import { anonClient, rpc, setUpBranch, supabaseOptions } from "./queue-helpers";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, supabaseOptions);
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Douala" }).format(new Date());

async function signedIn(email: string): Promise<SupabaseClient> {
  const client = anonClient();
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  expect(error).toBeNull();
  return client;
}

async function platformAdmin() {
  const email = uniqueEmail("wintek");
  const created = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  await admin.from("platform_admins").insert({ user_id: created.data.user!.id });
  return { email, client: await signedIn(email) };
}

const QUIZ = {
  title: "Quiz du Littoral",
  reward_text: "-15 % sur le pain",
  coupon_validity_days: 30,
  max_coupons: null,
  questions: [
    { question: "Couleur du ciel ?", answers: [{ text: "Bleu", correct: true }, { text: "Vert" }] },
    { question: "Capitale économique ?", answers: [{ text: "Douala", correct: true }, { text: "Kribi" }] },
    { question: "Fleuve de Douala ?", answers: [{ text: "Le Wouri", correct: true }, { text: "La Seine" }] },
  ],
};

/**
 * Campagne Or diffusée (TV, application, jeux, quiz) créée par les RPC, comme depuis l'espace annonceur, puis validée
 * et payée (faux fournisseur). Formule sans plafond d'agences : toutes les agences existantes à la validation sont
 * ciblées (la base de test en compte bien plus que les 15 de la formule Argent).
 */
async function activeCampaign(name: string, city: string | null = null) {
  const email = uniqueEmail("annonceur");
  await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  const adv = await signedIn(email);
  const advertiserId = await rpc<string>(adv, "create_advertiser", { p_name: `Boulangerie ${name}`, p_sector: "food", p_phone: null, p_city: "Douala" });
  const campaignId = await rpc<string>(adv, "save_campaign", {
    p_campaign: null,
    p_advertiser: advertiserId,
    p_organization: null,
    p_fields: { name, package_code: "or", sector: "food", starts_on: today(), surfaces: ["tv", "app", "game"], target_cities: city ? [city] : [], target_org_types: [], schedules: [] },
  });
  const path = `${advertiserId}/${campaignId}/visuel.png`;
  const up = await adv.storage.from("ad-creatives").upload(path, bannerPng("#F58B1F", "#B5651A"), { contentType: "image/png" });
  expect(up.error).toBeNull();
  await rpc(adv, "save_creative", {
    p_campaign: campaignId,
    p_creative: null,
    p_fields: { storage_path: path, kind: "image", headline: `Pain chaud ${name}`, offer_text: "-20 %", cta_url: "", duration_seconds: 8 },
  });
  await rpc(adv, "save_quiz", { p_campaign: campaignId, p_fields: QUIZ });
  await rpc(adv, "submit_campaign", { p_campaign: campaignId });
  const wintek = await platformAdmin();
  await rpc(wintek.client, "review_campaign", { p_campaign: campaignId, p_approve: true, p_note: "" });
  const checkout = await rpc<{ pay_token: string }>(adv, "campaign_checkout", { p_campaign: campaignId });
  const started = await rpc<{ external_id: string }>(admin, "start_payment", {
    p_token: checkout.pay_token,
    p_provider: "fake",
    p_channel: "mtn_momo",
    p_msisdn: "+237677123456",
  });
  await rpc(admin, "confirm_payment", { p_external_id: started.external_id, p_status: "succeeded", p_provider_ref: "e2e" });
  return { email, advertiserId, campaignId };
}

/**
 * Agence dans une ville qui lui est propre, et campagne ciblant cette ville : la rotation et le quiz proposés sont
 * ceux du test, même si d'autres campagnes (démo, tests en parallèle) sont diffusées ailleurs.
 */
async function branchWithCampaign(label: string) {
  const b = await setUpBranch(`Clinique ${label}`);
  const city = `Ville ${label} ${Date.now()}`;
  const updated = await b.staff.from("branches").update({ city }).eq("id", b.branchId).select("id");
  expect(updated.data).toHaveLength(1);
  const c = await activeCampaign(`${label} ${Date.now()}`, city);
  return { b, c };
}

/** Ticket pris comme un client (session anonyme, API) : jeton du lien `/t/<jeton>`. */
async function takeTicket(page: Page, b: Awaited<ReturnType<typeof setUpBranch>>) {
  const visitor = anonClient();
  const { data } = await visitor.auth.signInAnonymously();
  const res = await page.request.post("/api/tickets", {
    headers: { Authorization: `Bearer ${data.session!.access_token}` },
    data: { serviceId: b.serviceId, source: "qr", entryCode: b.entryCode },
  });
  expect(res.status()).toBe(201);
  return ((await res.json()) as { ticket: { publicToken: string } }).ticket.publicToken;
}

async function firstLoadBytes(browser: Browser, path: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  let total = 0;
  page.on("requestfinished", async (request) => {
    const sizes = await request.sizes().catch(() => null);
    if (sizes) total += sizes.responseBodySize + sizes.responseHeadersSize;
  });
  await page.goto(path, { waitUntil: "networkidle" });
  await page.waitForTimeout(300);
  await context.close();
  return total;
}

test.describe("M10b — publicité, jeux et bons de réduction", () => {
  test("annonceur → modération (super admin) → paiement → campagne diffusée, facture PDF", async ({ page, browser }, info) => {
    test.skip(info.project.name !== "desktop", "parcours complet sur ordinateur ; écrans client testés sur téléphone");
    await setUpBranch("Clinique Annonces");

    // Ouverture de l'espace annonceur.
    const email = uniqueEmail("annonceur");
    await signUpViaUi(page, { name: "Awa Ngono", email });
    await page.goto("/ads");
    await expect(page.getByRole("heading", { name: "Annoncez dans les salles d'attente" })).toBeVisible();
    await expectAccessible(page);
    await page.getByLabel("Nom de votre entreprise").fill("Boulangerie du Wouri");
    await page.getByLabel("Secteur d'activité").selectOption("food");
    await page.getByLabel("Ville").fill("Douala");
    await page.getByRole("button", { name: "Créer mon espace annonceur" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Campagnes" })).toBeVisible();

    // Nouvelle campagne Argent : TV, application et jeux.
    await page.getByRole("link", { name: "Nouvelle campagne" }).click();
    await page.getByRole("radio", { name: /Argent/ }).click();
    await page.getByLabel("Nom de la campagne").fill("Rentrée gourmande");
    for (const s of ["Application", "Jeux"]) await page.getByRole("checkbox", { name: s }).click();
    await expectAccessible(page);
    await expectTouchTargets(page);
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await page.waitForURL(/\/ads\/campaigns\/[0-9a-f-]{36}\?saved=1$/);
    await expect(page.getByText("Campagne enregistrée.")).toBeVisible();

    // Visuel déposé dans le stockage depuis le navigateur.
    await page.getByRole("button", { name: "Ajouter un visuel" }).click();
    await page.getByLabel("Fichier").setInputFiles({ name: "visuel.png", mimeType: "image/png", buffer: bannerPng("#1A6BB5", "#0D2C54") });
    await expect(page.getByText(/\.png$/)).toBeVisible();
    await page.getByLabel("Titre").fill("Pain tout chaud");
    await page.getByRole("button", { name: "Enregistrer" }).last().click();
    await expect(page.getByText("Pain tout chaud")).toBeVisible();

    await page.getByRole("button", { name: "Soumettre à la validation" }).click();
    await expect(page.getByText("Campagne envoyée : l'équipe Wintek la valide en général sous 24 h.")).toBeVisible();
    await expect(page.getByText("En validation").first()).toBeVisible();
    const campaignUrl = page.url().replace(/\?.*$/, "");

    // Modération par le super admin.
    const wintek = await platformAdmin();
    const console_ = await browser.newContext().then((c) => c.newPage());
    await console_.goto("/login");
    await signInViaUi(console_, wintek.email);
    await console_.waitForURL(/\/app$/);
    await console_.goto("/admin/ads");
    await expect(console_.getByRole("heading", { level: 1, name: "Publicité" })).toBeVisible();
    await expectAccessible(console_);
    await console_.getByRole("link", { name: /Rentrée gourmande/ }).click();
    await expect(console_.getByText("Pain tout chaud")).toBeVisible();
    await expectAccessible(console_);
    await console_.getByRole("button", { name: "Valider la campagne" }).click();
    await expect(console_.getByText("Décision enregistrée et journalisée.")).toBeVisible();
    await console_.context().close();

    // Paiement avec le même agrégateur que les abonnements.
    await page.goto(campaignUrl);
    await expect(page.getByText(/Campagne validée\. Payez pour lancer la diffusion/)).toBeVisible();
    await page.getByRole("button", { name: /^Payer 40\s000\sFCFA$/ }).click();
    await page.waitForURL(/\/pay\/[A-Za-z0-9]{32}$/);
    await expect(page.getByText(/Campagne « Rentrée gourmande » · Boulangerie du Wouri/)).toBeVisible();
    await page.getByLabel("Numéro à débiter").fill("6 77 10 20 30");
    await page.getByRole("button", { name: /^Payer/ }).click();
    await expect(page.getByRole("heading", { name: "Paiement reçu" })).toBeVisible({ timeout: 20_000 });

    await page.goto(campaignUrl);
    await expect(page.getByText("Diffusée").first()).toBeVisible();
    const link = page.getByRole("link", { name: /FAC-\d{4}-\d{6}/ });
    const pdf = await page.request.get((await link.getAttribute("href"))!);
    expect(pdf.status()).toBe(200);
    expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
    await expectAccessible(page);
  });

  test("santé : soumission refusée sans visa ; le justificatif est vu par la modération", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "règle serveur, indépendante de l'appareil");
    const email = uniqueEmail("pharma");
    await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
    const adv = await signedIn(email);
    const advertiserId = await rpc<string>(adv, "create_advertiser", { p_name: "Pharmacie Test", p_sector: "pharmacy", p_phone: null, p_city: null });
    const fields = { name: "Vitamines", package_code: "bronze", sector: "pharmacy", starts_on: today(), surfaces: ["tv"], target_cities: [], target_org_types: [], schedules: [] };
    const campaignId = await rpc<string>(adv, "save_campaign", { p_campaign: null, p_advertiser: advertiserId, p_organization: null, p_fields: fields });
    const path = `${advertiserId}/${campaignId}/visuel.png`;
    expect((await adv.storage.from("ad-creatives").upload(path, bannerPng("#13798A", "#1A6BB5"), { contentType: "image/png" })).error).toBeNull();
    await rpc(adv, "save_creative", { p_campaign: campaignId, p_creative: null, p_fields: { storage_path: path, kind: "image", headline: "Vitamines", duration_seconds: 8 } });
    const refused = await adv.rpc("submit_campaign", { p_campaign: campaignId });
    expect(refused.error?.message).toBe("health_visa_required");

    await page.goto("/login");
    await signInViaUi(page, email);
    await page.waitForURL(/\/app$/);
    await page.goto(`/ads/campaigns/${campaignId}`);
    await expect(page.getByRole("heading", { name: "Visa du ministère de la Santé" })).toBeVisible();
    await page.getByLabel("Numéro de visa").fill("MINSANTE-E2E-1");
    await page.getByLabel("Justificatif (PDF ou photo)").setInputFiles({ name: "visa.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%%EOF\n") });
    await page.waitForTimeout(800);
    await page.locator("form").filter({ has: page.getByLabel("Numéro de visa") }).getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText("Justificatif ajouté")).toBeVisible();
    await expectAccessible(page);
  });

  test("ticket : pub sponsorisée, quiz avec interstitielle à passer, bon à QR code validé en caisse", async ({ page, browser }, info) => {
    test.skip(info.project.name !== "mobile", "parcours client sur téléphone");
    test.setTimeout(120_000);
    const { b, c } = await branchWithCampaign("Quiz");
    const token = await takeTicket(page, b);

    await page.goto(`/t/${token}`);
    const sponsored = page.getByRole("complementary", { name: "Sponsorisé" });
    // Pub sponsorisée montée seulement à l'arrivée à l'écran (hors du premier chargement).
    await expect(page.getByRole("heading", { name: "Jouer en attendant" })).toBeVisible({ timeout: 15_000 });
    await page.mouse.wheel(0, 2000);
    await expect(sponsored).toBeVisible({ timeout: 15_000 });
    await expect(sponsored.getByText(/^Pain chaud Quiz/)).toBeVisible();
    await expectAccessible(page);
    await expectTouchTargets(page);

    // Feuille de jeu : numéro et attente toujours visibles.
    await page.getByRole("button", { name: "Choisir un jeu" }).click();
    const sheet = page.getByRole("dialog");
    await expect(sheet.getByText("C-001")).toBeVisible();
    await expect(sheet.getByText(/Devant vous : 0/)).toBeVisible();
    await sheet.getByRole("button", { name: /^Quiz/ }).click();

    await expect(sheet.getByText(/Question 1 sur 3/)).toBeVisible();
    await expectAccessible(page);
    await sheet.getByRole("radio", { name: "Bleu" }).click();
    await sheet.getByRole("button", { name: "Suivant" }).click();

    // Interstitielle : « Passer » seulement après le délai de la plateforme.
    await expect(sheet.getByText("Publicité", { exact: true })).toBeVisible();
    await expect(sheet.getByRole("button", { name: /Passer dans \d s/ })).toBeDisabled();
    await expectAccessible(page);
    await sheet.getByRole("button", { name: "Passer", exact: true }).click({ timeout: 10_000 });

    await sheet.getByRole("radio", { name: "Douala" }).click();
    await sheet.getByRole("button", { name: "Suivant" }).click();
    await sheet.getByRole("radio", { name: "Le Wouri" }).click();
    await sheet.getByRole("button", { name: "Terminer" }).click();
    await expect(sheet.getByText("3 sur 3")).toBeVisible();
    await expect(sheet.getByText("Votre bon de réduction")).toBeVisible();
    await expect(sheet.getByText(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/)).toBeVisible();
    await expect(sheet.getByRole("img", { name: /Présentez ce QR code/ })).toBeVisible();
    await expectAccessible(page);
    await expectTouchTargets(page);

    // Bon public (lien du QR code), puis validation par le commerçant connecté.
    const { data: coupon } = await admin.from("ad_coupons").select("code, qr_token").eq("campaign_id", c.campaignId).single();
    await page.goto(`/coupon/${coupon!.qr_token}`);
    await expect(page.getByRole("heading", { level: 1, name: "-15 % sur le pain" })).toBeVisible();
    await expectAccessible(page);
    await expectTouchTargets(page);

    const merchant = await browser.newContext().then((ctx) => ctx.newPage());
    await merchant.goto(`/login?next=${encodeURIComponent(`/ads/redeem?code=${coupon!.qr_token}`)}`);
    await signInViaUi(merchant, c.email);
    await merchant.waitForURL(/\/ads\/redeem/);
    await merchant.getByRole("button", { name: "Vérifier" }).click();
    await expect(merchant.getByText("-15 % sur le pain")).toBeVisible();
    await expectAccessible(merchant);
    await merchant.getByRole("button", { name: "Valider le bon" }).click();
    await expect(merchant.getByText(/Bon validé le/)).toBeVisible();
    await merchant.context().close();

    // Deuxième validation : refusée.
    const again = await (await signedIn(c.email)).rpc("redeem_coupon", { p_code: coupon!.code, p_confirm: true });
    expect(again.error?.message).toBe("coupon_redeemed");
  });

  test("Sky Catch : partie figée et « C'est votre tour » à l'appel ; statistiques gardées hors ligne", async ({ page, context }, info) => {
    test.skip(info.project.name !== "mobile", "jeu sur téléphone");
    test.setTimeout(90_000);
    const { b, c } = await branchWithCampaign("Sky");
    const token = await takeTicket(page, b);
    await page.goto(`/t/${token}`);
    await expect(page.getByRole("heading", { name: "Jouer en attendant" })).toBeVisible({ timeout: 15_000 });

    // Hors ligne juste après l'affichage de la pub : l'événement reste dans la file de l'appareil (envoi groupé après
    // 4 s), puis part au retour du réseau.
    await page.mouse.wheel(0, 2000);
    await expect(page.getByRole("complementary", { name: "Sponsorisé" })).toBeVisible({ timeout: 15_000 });
    await context.setOffline(true);
    await page.waitForTimeout(5_000);
    const queued = await page.evaluate(() => localStorage.getItem("nextin.ad-events"));
    expect(queued).toContain("impression");
    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect.poll(() => page.evaluate(() => localStorage.getItem("nextin.ad-events")), { timeout: 15_000 }).toBeNull();
    const creative = await admin.from("ad_creatives").select("id").eq("campaign_id", c.campaignId).single();
    const { count } = await admin.from("ad_events").select("*", { count: "exact", head: true }).eq("creative_id", creative.data!.id).eq("surface", "app");
    expect(count).toBeGreaterThan(0);

    await page.getByRole("button", { name: "Choisir un jeu" }).click();
    const sheet = page.getByRole("dialog");
    await sheet.getByRole("button", { name: /^Sky Catch/ }).click();
    await sheet.getByRole("button", { name: "Commencer" }).click();
    await expect(sheet.locator("canvas")).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Pause" })).toBeEnabled();
    await page.keyboard.down("ArrowLeft");
    await page.waitForTimeout(600);
    await page.keyboard.up("ArrowLeft");

    // Appel : le jeu se fige et l'appel prend toute la place.
    await rpc(b.staff, "call_next", { p_counter: b.counterId });
    const turn = page.getByRole("alertdialog", { name: "C'est votre tour !" });
    await expect(turn).toBeVisible({ timeout: 15_000 });
    await expect(turn.getByText(/Ticket C-001 · présentez-vous : Cabinet 3/)).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Reprendre" }).first()).toBeAttached();
    await expectAccessible(page);
    await turn.getByRole("button", { name: "Revenir à mon ticket" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByText("C'est votre tour").first()).toBeVisible();
  });

  test("budget : « Mon ticket » avec pub et jeux reste sous 200 Ko (jeux chargés à la demande)", async ({ page, browser }, info) => {
    test.skip(info.project.name !== "mobile", "budget mesuré sur téléphone");
    const { b } = await branchWithCampaign("Budget");
    const token = await takeTicket(page, b);
    const bytes = await firstLoadBytes(browser, `/t/${token}`);
    console.log(`/t/… avec publicité : ${Math.round(bytes / 1024)} Ko`);
    expect(bytes).toBeLessThan(200 * 1024);
  });

  test("établissement : secteurs refusés, jeux désactivés et annonce Maison publiée", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "back-office sur ordinateur");
    const b = await setUpBranch("Clinique Maison");
    await page.goto("/login");
    await signInViaUi(page, b.email);
    await page.waitForURL(/\/app$/);
    await page.goto(`/app/o/${b.orgId}/ads`);
    await expect(page.getByRole("heading", { level: 1, name: "Publicité" })).toBeVisible();
    await page.getByRole("switch", { name: "Quiz sponsorisé" }).click();
    await page.getByRole("checkbox", { name: "Paris et jeux d'argent" }).click();
    await expectAccessible(page);
    await expectTouchTargets(page);
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText("Réglages enregistrés.")).toBeVisible();
    await expect(page.getByRole("switch", { name: "Quiz sponsorisé" })).toHaveAttribute("aria-checked", "false");
    await expect(page.getByRole("checkbox", { name: "Paris et jeux d'argent" })).toHaveAttribute("aria-checked", "true");

    // Annonce Maison : gratuite, publiée sans validation.
    await page.getByRole("link", { name: "Nouvelle annonce Maison" }).click();
    await page.getByLabel("Nom de la campagne").fill("Vaccination le samedi");
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await page.waitForURL(/\/ads\/[0-9a-f-]{36}\?saved=1$/);
    await page.getByRole("button", { name: "Ajouter un visuel" }).click();
    await page.getByLabel("Fichier").setInputFiles({ name: "maison.png", mimeType: "image/png", buffer: bannerPng("#0D2C54", "#1A6BB5") });
    await expect(page.getByText(/\.png$/)).toBeVisible();
    await page.getByLabel("Titre").fill("Vaccination sans rendez-vous");
    await page.getByRole("button", { name: "Enregistrer" }).last().click();
    await expect(page.getByText("Vaccination sans rendez-vous")).toBeVisible();
    await page.getByRole("button", { name: "Publier l'annonce" }).click();
    await expect(page.getByText("Diffusée").first()).toBeVisible();
    await expectAccessible(page);

    // Côté client : quiz désactivé par l'établissement, Sky Catch toujours proposé.
    const token = await takeTicket(page, b);
    const games = await rpc<{ quiz: boolean; sky_catch: boolean }>(anonClient(), "games_available", { p_ticket_token: token });
    expect(games).toEqual({ quiz: false, sky_catch: true });
  });
});
