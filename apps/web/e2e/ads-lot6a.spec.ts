import { expect, test, type Page } from "@playwright/test";
import { bannerPng } from "../../../scripts/demo-images";
import { activeCampaign, admin, platformAdmin, signedIn, today } from "./ads-helpers";
import { PASSWORD, expectAccessible, expectTouchTargets, signInViaUi, uniqueEmail } from "./helpers";
import { rpc, setUpBranch } from "./queue-helpers";

/**
 * LOT 6a (maquettes v2 24, 14 et 15) : espace annonceur refait (parcours en cinq étapes, récapitulatif, statut en une
 * phrase, bons, caissiers), affiche QR et facture PDF. Les règles (RPC) sont inchangées.
 */

async function advertiser(name: string, sector = "food") {
  const email = uniqueEmail("annonceur6a");
  await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  const client = await signedIn(email);
  const advertiserId = await rpc<string>(client, "create_advertiser", { p_name: name, p_sector: sector, p_phone: null, p_city: "Douala" });
  return { email, client, advertiserId };
}

async function login(page: Page, email: string, path: string) {
  await page.goto(`/login?next=${encodeURIComponent(path)}`);
  await signInViaUi(page, email);
  await page.waitForURL((u) => u.pathname.startsWith(path.split("?")[0]!));
}

async function bothThemes(page: Page) {
  await expectAccessible(page);
  await page.emulateMedia({ colorScheme: "dark" });
  await expectAccessible(page);
  await page.emulateMedia({ colorScheme: "light" });
}

test.describe("LOT 6a — espace annonceur", () => {
  test("nouvelle campagne Bronze : récapitulatif, étapes, pas de jeux, reprise à la première étape incomplète", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "récapitulatif permanent sur ordinateur");
    const a = await advertiser("Pharmacie Récap");
    await login(page, a.email, "/ads/campaigns/new");
    await expect(page.getByTestId("wizard-stepper")).toBeVisible();
    await page.getByRole("radio", { name: /Bronze/ }).click();
    const aside = page.getByTestId("campaign-summary-aside");
    await expect(aside).toContainText("Bronze");
    await expect(aside).toContainText("Tout le pays");
    await expect(aside).toContainText("Tous");
    await expect(aside).toContainText("5 au plus");
    await expect(aside).toContainText(/15\s000\sFCFA/);
    await page.getByLabel("Nom de la campagne").fill("Vaccins de fin d'année");
    await bothThemes(page);
    await expectTouchTargets(page);
    await page.getByRole("button", { name: "Continuer" }).click();
    await page.waitForURL(/edit\?step=2$/);
    const campaignId = /campaigns\/([0-9a-f-]{36})\//.exec(page.url())![1]!;

    // Ciblage : pastilles des types (cochée = bleu nuit), récapitulatif à jour.
    await page.getByRole("checkbox", { name: "Clinique" }).click();
    await expect(page.getByRole("checkbox", { name: "Clinique" })).toHaveAttribute("aria-checked", "true");
    await expect(aside).toContainText("1 type");
    await bothThemes(page);
    await page.getByRole("button", { name: "Continuer" }).click();
    await page.waitForURL(/step=3$/);

    // Visuels : « Continuer » désactivé sans visuel ; campagne quittée → rouvre à « Visuels ».
    await expect(page.getByText("Ajoutez au moins un visuel pour continuer.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Continuer" })).toBeDisabled();
    await bothThemes(page);
    await page.goto(`/ads/campaigns/${campaignId}`);
    await expect(page.getByTestId("campaign-notice")).toContainText("Brouillon");
    await expect(page.getByText("Brouillon").first()).toBeVisible();
    await page.getByRole("link", { name: "Modifier" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Visuels" })).toBeVisible();

    await page.getByRole("button", { name: "Ajouter un visuel" }).click();
    await page.getByLabel("Fichier").setInputFiles({ name: "visuel.png", mimeType: "image/png", buffer: bannerPng("#13798A", "#1A6BB5") });
    await page.getByLabel("Titre").fill("Vaccination");
    await page.getByRole("button", { name: "Enregistrer" }).last().click();
    await expect(page.getByTestId("ad-preview").getByText("Vaccination")).toBeVisible();
    await page.getByRole("link", { name: "Continuer" }).click();

    // Jeux : la formule Bronze n'en comprend pas.
    await expect(page.getByTestId("games-none")).toContainText("La formule Bronze ne comprend pas les jeux.");
    await bothThemes(page);
    await page.getByRole("link", { name: "Continuer" }).click();
    await page.waitForURL(/step=5$/);
    const full = page.getByTestId("campaign-summary-full");
    await expect(full).toContainText("Bronze · 7 jours");
    await expect(full).toContainText("Tout le pays · 1 type");
    await expect(full).toContainText("1 image");
    // Secteur sans visa : pas de bloc visa.
    await expect(page.getByRole("heading", { name: "Visa du ministère de la Santé" })).toHaveCount(0);
    await bothThemes(page);
    await page.getByRole("button", { name: "Soumettre à la validation" }).click();
    await expect(page.getByTestId("campaign-notice")).toContainText("En cours de validation par l'équipe Wintek.");
    await expect(page.getByRole("link", { name: "Modifier" })).toHaveCount(0);
  });

  test("Argent : quiz sponsorisé à l'étape 4, bonne réponse en vert, enregistré", async ({ page }, info) => {
    test.skip(info.project.name !== "mobile", "étapes sur téléphone");
    const a = await advertiser("Boulangerie Quiz");
    const campaignId = await rpc<string>(a.client, "save_campaign", {
      p_campaign: null,
      p_advertiser: a.advertiserId,
      p_organization: null,
      p_fields: { name: "Promo rentrée", package_code: "argent", sector: "food", starts_on: today(), surfaces: ["tv", "app", "game"], target_cities: [], target_org_types: [], schedules: [] },
    });
    await login(page, a.email, `/ads/campaigns/${campaignId}/edit?step=4`);
    await expect(page.getByText("Étape 4 sur 5")).toBeVisible();
    await expect(page.getByRole("link", { name: "Visuels" }).first()).toBeVisible();
    const step = page.getByTestId("quiz-step");
    await step.getByLabel("Récompense (texte du bon)").fill("-10 % sur votre prochain achat");
    const questions = [
      ["Combien de fois par jour faut-il se laver les mains ?", "Une fois", "Avant chaque repas"],
      ["Quelle est la capitale économique du Cameroun ?", "Douala", "Garoua"],
      ["Quel fleuve traverse Douala ?", "Le Wouri", "La Sanaga"],
    ];
    for (const [i, [q, first, second]] of questions.entries()) {
      await step.getByLabel(`Question ${i + 1}`, { exact: true }).fill(q!);
      const group = step.locator("fieldset").nth(i);
      await group.getByLabel("Réponse 1", { exact: true }).fill(first!);
      await group.getByLabel("Réponse 2", { exact: true }).fill(second!);
    }
    await step.locator("fieldset").first().getByRole("radio", { name: /Réponse 2/ }).click();
    await expect(step.locator("fieldset").first().getByRole("radio", { name: /Réponse 2/ })).toHaveAttribute("aria-checked", "true");
    await bothThemes(page);
    await expectTouchTargets(page);
    await page.getByRole("button", { name: "Continuer" }).click();
    await page.waitForURL(/step=5/);
    const { data: quiz } = await admin.from("ad_quizzes").select("reward_text, questions:ad_quiz_questions(id)").eq("campaign_id", campaignId).single();
    expect(quiz?.reward_text).toBe("-10 % sur votre prochain achat");
    expect((quiz as unknown as { questions: unknown[] }).questions).toHaveLength(3);
  });

  test("bon valable puis déjà utilisé (écran rouge) ; caissier limité à « Valider un bon »", async ({ page, browser }, info) => {
    test.skip(info.project.name !== "desktop", "caisse sur ordinateur");
    const c = await activeCampaign(`Bons ${Date.now()}`);
    const code = Array.from({ length: 8 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");
    const qr = Array.from({ length: 22 }, () => "abcdefghijkmnpqrstuvwxyz23456789"[Math.floor(Math.random() * 31)]).join("");
    const inserted = await admin
      .from("ad_coupons")
      .insert({ campaign_id: c.campaignId, code, qr_token: qr, reward_text: "-15 % sur le pain", expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString() })
      .select("id");
    expect(inserted.error).toBeNull();

    // Caissier ajouté par le propriétaire : il ne voit que « Valider un bon ».
    const cashier = uniqueEmail("caissier");
    await admin.auth.admin.createUser({ email: cashier, password: PASSWORD, email_confirm: true });
    await rpc(await signedIn(c.email), "add_advertiser_cashier", { p_advertiser: c.advertiserId, p_email: cashier });
    await login(page, cashier, "/ads/redeem");
    const nav = page.getByRole("navigation", { name: "Espace annonceur" });
    await expect(nav.getByRole("link", { name: "Valider un bon" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Campagnes" })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "Formules" })).toHaveCount(0);
    await page.goto("/ads/campaigns");
    await page.waitForURL(/\/ads\/redeem$/);
    await expect(page.getByTestId("redeem-camera")).toBeVisible();
    await bothThemes(page);

    await page.getByLabel("Code du bon").fill(code);
    await page.getByRole("button", { name: "Vérifier" }).click();
    const result = page.getByTestId("coupon-result");
    await expect(result).toHaveAttribute("data-outcome", "valid");
    await expect(result.getByRole("heading", { name: "Bon valable" })).toBeVisible();
    await expect(result.getByText("-15 % sur le pain")).toBeVisible();
    await expect(result.getByText("Une fois validé, le bon ne peut plus resservir.")).toBeVisible();
    await bothThemes(page);
    await expectTouchTargets(page);
    await page.getByRole("button", { name: "Valider le bon" }).click();
    await expect(result).toHaveAttribute("data-outcome", "redeemed");
    await expect(result.getByText(/^Bon validé le/)).toBeVisible();

    // Même bon une seconde fois : écran rouge avec la date.
    await page.getByRole("button", { name: "Vérifier un autre bon" }).click();
    await page.getByLabel("Code du bon").fill(code);
    await page.getByRole("button", { name: "Vérifier" }).click();
    await expect(result).toHaveAttribute("data-outcome", "used");
    await expect(result.getByRole("heading", { name: "Bon déjà utilisé" })).toBeVisible();
    await expect(result.getByText(/^Déjà utilisé le/)).toBeVisible();
    await bothThemes(page);

    // Le propriétaire voit la campagne, sa phrase de statut, ses chiffres et ses caissiers.
    const owner = await browser.newContext().then((ctx) => ctx.newPage());
    await login(owner, c.email, `/ads/campaigns/${c.campaignId}`);
    await expect(owner.getByTestId("campaign-notice")).toContainText(/^Diffusée du/);
    await expect(owner.getByText("Bons utilisés")).toBeVisible();
    await expect(owner.getByText("Mise à jour chaque heure. Aucune donnée personnelle des clients : seulement des totaux.")).toBeVisible();
    await expect(owner.getByTestId("advertiser-card")).toContainText("Alimentation · Douala");
    await bothThemes(owner);
    await owner.goto("/ads/cashiers");
    await expect(owner.getByTestId("cashier-row")).toContainText("Validation des bons seulement");
    await bothThemes(owner);
    await owner.goto("/ads/packages");
    await expect(owner.locator("[data-package]")).toHaveCount(3);
    await bothThemes(owner);
    await owner.context().close();
  });
});

test.describe("LOT 6a — affiche et facture PDF", () => {
  test("affiche A4 et A5, facture ouverte (lien de paiement) et payée : rendues sans erreur", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "téléchargements");
    const b = await setUpBranch("Clinique Affiche");
    await login(page, b.email, `/app/o/${b.orgId}/branches/${b.branchId}/qr`);
    for (const format of ["a4", "a5"]) {
      const res = await page.request.get(`/app/o/${b.orgId}/branches/${b.branchId}/qr/pdf?format=${format}`);
      expect(res.status()).toBe(200);
      expect((await res.body()).subarray(0, 5).toString()).toBe("%PDF-");
    }

    // Facture de campagne ouverte (validée, pas encore payée) : un lien de paiement est créé au téléchargement.
    const a = await advertiser("Boulangerie Facture");
    const campaignId = await rpc<string>(a.client, "save_campaign", {
      p_campaign: null,
      p_advertiser: a.advertiserId,
      p_organization: null,
      p_fields: { name: "Facture ouverte", package_code: "bronze", sector: "food", starts_on: today(), surfaces: ["tv"], target_cities: [], target_org_types: [], schedules: [] },
    });
    const path = `${a.advertiserId}/${campaignId}/visuel.png`;
    expect((await a.client.storage.from("ad-creatives").upload(path, bannerPng("#1A6BB5", "#0D2C54"), { contentType: "image/png" })).error).toBeNull();
    await rpc(a.client, "save_creative", { p_campaign: campaignId, p_creative: null, p_fields: { storage_path: path, kind: "image", headline: "Pain", duration_seconds: 8 } });
    await rpc(a.client, "submit_campaign", { p_campaign: campaignId });
    const wintek = await platformAdmin();
    await rpc(wintek.client, "review_campaign", { p_campaign: campaignId, p_approve: true, p_note: "" });
    const checkout = await rpc<{ pay_token: string }>(a.client, "campaign_checkout", { p_campaign: campaignId });
    const { data: invoice } = await admin.from("invoices").select("id").eq("campaign_id", campaignId).single();
    const { count: before } = await admin.from("pay_links").select("*", { count: "exact", head: true }).eq("invoice_id", invoice!.id);

    const advertiserPage = await page.context().browser()!.newContext().then((ctx) => ctx.newPage());
    await login(advertiserPage, a.email, `/ads/campaigns/${campaignId}`);
    await expect(advertiserPage.getByRole("button", { name: /^Payer 15\s000\sFCFA$/ })).toBeVisible();
    const open = await advertiserPage.request.get(`/ads/invoices/${invoice!.id}`);
    expect(open.status()).toBe(200);
    expect((await open.body()).subarray(0, 5).toString()).toBe("%PDF-");
    const { count: after } = await admin.from("pay_links").select("*", { count: "exact", head: true }).eq("invoice_id", invoice!.id);
    expect(after).toBe((before ?? 0) + 1);

    // Payée : rendue avec la mention « Payée le … ».
    const started = await rpc<{ external_id: string }>(admin, "start_payment", { p_token: checkout.pay_token, p_provider: "fake", p_channel: "mtn_momo", p_msisdn: "+237677123456" });
    await rpc(admin, "confirm_payment", { p_external_id: started.external_id, p_status: "succeeded", p_provider_ref: "e2e-ref" });
    const paid = await advertiserPage.request.get(`/ads/invoices/${invoice!.id}`);
    expect(paid.status()).toBe(200);
    expect((await paid.body()).subarray(0, 5).toString()).toBe("%PDF-");
    const { count: unchanged } = await admin.from("pay_links").select("*", { count: "exact", head: true }).eq("invoice_id", invoice!.id);
    expect(unchanged).toBe(after);
    await advertiserPage.context().close();
  });
});
