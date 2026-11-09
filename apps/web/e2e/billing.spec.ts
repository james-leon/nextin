import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { PASSWORD, createOrgViaUi, expectAccessible, expectTouchTargets, signInViaUi, uniqueEmail } from "./helpers";
import { anonClient, rpc, setUpBranch, supabaseOptions } from "./queue-helpers";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, supabaseOptions);

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

/** Espace entre le bas des cartes des formules (et de la note) et le bouton de la barre du bas, page tout en bas. */
/** Établissement en essai (inscription par l'interface) et page Abonnement ouverte. */
async function trialOrg(page: Page, name: string) {
  const root = await createOrgViaUi(page, { orgName: name, email: uniqueEmail("billing") });
  await page.goto(`${root}/billing`);
  await expect(page.getByRole("heading", { level: 1, name: "Abonnement" })).toBeVisible();
  return root;
}

test.describe("M10a — abonnements et paiements", () => {
  test("essai → choix de la formule → paiement MTN MoMo (faux fournisseur) → abonnement actif et facture PDF", async ({ page }) => {
    const root = await trialOrg(page, "Clinique Paiement");
    await expect(page.getByText("Essai", { exact: true })).toBeVisible();
    await expect(page.getByText(/jours d'essai restants/)).toBeVisible();
    await expectAccessible(page);
    await expectTouchTargets(page);

    // Grille v2 — Starter, mensuel : 29 900 FCFA. Enterprise : sur devis (pas de paiement en ligne).
    await expect(
      page.getByText("Sur devis", { exact: true }).or(page.getByRole("radio", { name: "Enterprise" })).filter({ visible: true }).first(),
    ).toBeVisible();
    await page.getByRole("radio", { name: /Starter/ }).first().click();
    // Téléphone : sélecteur de formule en haut et carte de la formule ; ordinateur : cartes seules.
    await expect(page.getByRole("radio", { name: /Starter/ }).first()).toHaveAttribute("aria-checked", "true");
    await page.getByRole("button", { name: /^Payer 29\s900\sFCFA$/ }).click();
    await page.waitForURL(/\/pay\/[A-Za-z0-9]{32}$/);

    // Page de paiement publique : montant en héros, opérateur deviné depuis le numéro.
    await expect(page.getByText(/^29\s900\sFCFA$/).first()).toBeVisible();
    await expectAccessible(page);
    await expectTouchTargets(page);
    await page.getByLabel("Numéro à débiter").fill("6 77 10 20 30");
    await expect(page.getByRole("radio", { name: "MTN Mobile Money" })).toHaveAttribute("aria-checked", "true");
    await page.getByRole("button", { name: /^Payer/ }).click();
    await expect(page.getByRole("heading", { name: "Validez sur votre téléphone" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Paiement reçu" })).toBeVisible({ timeout: 20_000 });
    await expectAccessible(page);

    // Abonnement actif, facture payée et téléchargeable.
    await page.goto(`${root}/billing`);
    await expect(page.getByText("Actif", { exact: true })).toBeVisible();
    await expect(page.getByText("Payée")).toBeVisible();
    const link = page.getByRole("link", { name: /FAC-\d{4}-\d{6}/ });
    const pdf = await page.request.get((await link.getAttribute("href"))!);
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()["content-type"]).toBe("application/pdf");
    expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
  });

  test("ordinateur : « Payer » dans la barre de titre, jamais par-dessus les formules", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "mise en page ordinateur");
    await trialOrg(page, "Clinique Marge");
    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 1280, height: 800 },
      { width: 1024, height: 768 },
    ]) {
      await page.setViewportSize(viewport);
      await page.evaluate(() => window.scrollTo(0, 0));
      // Bouton principal de la page (les extensions de quota ont leurs propres boutons « Acheter »).
      const pay = page.locator("button[type=submit]").filter({ hasText: /^Payer/ }).filter({ visible: true });
      await expect(pay, `${viewport.width}×${viewport.height}`).toHaveCount(1);
      // La barre de titre se réorganise au changement de taille : attendre que le bouton ait sa place.
      await expect.poll(async () => (await pay.boundingBox())?.y ?? -1).toBeGreaterThanOrEqual(0);
      const top = (await pay.boundingBox())!;
      expect(top.y + top.height, `${viewport.width}×${viewport.height} : à côté du titre`).toBeLessThan(200);
      // Aucune barre en bas de l'écran : rien ne recouvre les formules.
      await expect(page.locator(".safe-bottom").filter({ visible: true })).toHaveCount(0);
      // Au défilement, l'action reste dans la barre compacte.
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await page.waitForTimeout(400);
      await expect.poll(async () => (await pay.boundingBox())?.y ?? -1).toBeGreaterThanOrEqual(0);
      const scrolled = (await pay.boundingBox())!;
      expect(scrolled.y, `${viewport.width}×${viewport.height} : barre compacte`).toBeGreaterThanOrEqual(0);
      expect(scrolled.y + scrolled.height).toBeLessThanOrEqual(60);
    }
  });

  test("paiement refusé (numéro en 99999) : message clair, nouvel essai possible", async ({ page }) => {
    await trialOrg(page, "Clinique Refus");
    await page.getByRole("radio", { name: /^Business\b/ }).first().click();
    await page.getByRole("button", { name: /^Payer/ }).click();
    await page.waitForURL(/\/pay\//);
    await page.getByRole("radio", { name: "Orange Money" }).click();
    await page.getByLabel("Numéro à débiter").fill("699999999");
    await page.getByRole("button", { name: /^Payer/ }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Le paiement n'a pas abouti" })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: "Réessayer" })).toBeVisible();
  });

  test("lien de paiement inconnu : page neutre", async ({ page }) => {
    await page.goto("/pay/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
    await expect(page.getByRole("heading", { name: "Lien introuvable" })).toBeVisible();
    await expectAccessible(page);
  });

  test("budget : la page de paiement pèse moins de 200 Ko", async ({ browser, page }, info) => {
    test.skip(info.project.name !== "mobile", "budget mesuré sur téléphone");
    await trialOrg(page, "Clinique Budget");
    await page.getByRole("button", { name: /^Payer/ }).click();
    await page.waitForURL(/\/pay\//);
    const path = new URL(page.url()).pathname;
    const context = await browser.newContext();
    const fresh = await context.newPage();
    const bytes = await firstLoadBytes(fresh, path);
    console.log(`/pay/… : ${Math.round(bytes / 1024)} Ko`);
    expect(bytes).toBeLessThan(200 * 1024);
    await context.close();
  });

  test("lecture seule : bandeau pour le personnel, aucun ticket émis", async ({ page, request }, info) => {
    test.skip(info.project.name !== "desktop", "règle serveur, indépendante de l'appareil");
    const b = await setUpBranch("Clinique Lecture seule");
    const { data: plan } = await admin.from("plans").select("id").eq("code", "starter").single();
    await admin.from("subscriptions").insert({ organization_id: b.orgId, plan_id: plan!.id, status: "read_only", read_only_since: new Date().toISOString() });

    const visitor = anonClient();
    const { data: anon } = await visitor.auth.signInAnonymously();
    const res = await request.post("/api/tickets", {
      headers: { Authorization: `Bearer ${anon.session!.access_token}` },
      data: { serviceId: b.serviceId, source: "qr", entryCode: b.entryCode },
    });
    expect(await res.json()).toMatchObject({ ok: false, error: "subscription_read_only" });

    await page.goto("/login");
    await signInViaUi(page, b.email, PASSWORD);
    await page.waitForURL(/\/app$/);
    await page.goto(`/app/o/${b.orgId}`);
    await expect(page.getByRole("status").filter({ hasText: "Lecture seule : aucun nouveau ticket" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Payer" })).toBeVisible();
    await expectAccessible(page);
  });

  test("limites de la formule vérifiées par la base (Starter : 3 guichets)", async ({}, info) => {
    test.skip(info.project.name !== "desktop", "règle serveur");
    const b = await setUpBranch("Clinique Limites");
    const { data: plan } = await admin.from("plans").select("id").eq("code", "starter").single();
    await admin.from("subscriptions").insert({
      organization_id: b.orgId,
      plan_id: plan!.id,
      status: "active",
      current_period_start: new Date().toISOString(),
      current_period_end: new Date(Date.now() + 30 * 86_400_000).toISOString(),
    });
    // L'agence a déjà un cabinet : deux de plus passent, le quatrième est refusé.
    for (const number of [4, 5]) {
      const ok = await b.staff.from("counters").insert({ organization_id: b.orgId, branch_id: b.branchId, kind: "cabinet", number });
      expect(ok.error).toBeNull();
    }
    const refused = await b.staff.from("counters").insert({ organization_id: b.orgId, branch_id: b.branchId, kind: "cabinet", number: 6 });
    expect(refused.error?.message).toBe("plan_limit");
    const feature = await rpc<{ features: { remote_tickets: boolean } }>(b.staff, "staff_entitlements", { p_org: b.orgId });
    expect(feature.features.remote_tickets).toBe(false);
  });

  test("quota de tickets : alerte à 80 %, file jamais bloquée le jour même, blocage le lendemain, extension", async ({ page, request }, info) => {
    test.skip(info.project.name !== "desktop", "règle serveur et bandeau");
    const b = await setUpBranch("Clinique Quota");
    const { data: plan } = await admin.from("plans").select("id").eq("code", "starter").single();
    await admin.from("subscriptions").insert({
      organization_id: b.orgId,
      plan_id: plan!.id,
      status: "active",
      current_period_start: new Date().toISOString(),
      current_period_end: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      limit_overrides: { tickets_per_month: 5 },
    });
    // Mois et jour à Douala (UTC+1).
    const douala = new Date(Date.now() + 3_600_000).toISOString().slice(0, 10);
    const month = `${douala.slice(0, 7)}-01`;
    const yesterday = new Date(Date.now() + 3_600_000 - 86_400_000).toISOString().slice(0, 10);
    const usage = (fields: Record<string, unknown>) =>
      admin.from("messaging_usage").upsert({ organization_id: b.orgId, month, ...fields }, { onConflict: "organization_id,month" });
    const takeTicket = async () => {
      const visitor = anonClient();
      const { data: anon } = await visitor.auth.signInAnonymously();
      const res = await request.post("/api/tickets", {
        headers: { Authorization: `Bearer ${anon.session!.access_token}` },
        data: { serviceId: b.serviceId, source: "qr", entryCode: b.entryCode },
      });
      return (await res.json()) as { ok: boolean; error?: string };
    };

    await usage({ tickets_created: 4 });
    await page.goto("/login");
    await signInViaUi(page, b.email, PASSWORD);
    await page.waitForURL(/\/app$/);
    await page.goto(`/app/o/${b.orgId}`);
    const banner = page.locator("[data-quota]");
    await expect(banner).toContainText("Tickets : 4 sur 5 utilisés ce mois-ci.");
    await expect(banner.getByRole("link", { name: "Changer de formule" })).toBeVisible();
    await expect(banner.getByRole("link", { name: "Acheter une extension" })).toBeVisible();
    await expectAccessible(page);

    // Limite atteinte aujourd'hui : la file continue jusqu'au soir.
    await usage({ tickets_created: 5, tickets_reached_on: douala });
    expect(await takeTicket()).toMatchObject({ ok: true });
    await page.reload();
    await expect(banner).toContainText("vos files continuent jusqu'à ce soir");

    // Le lendemain : prise de ticket suspendue, message clair.
    await usage({ tickets_reached_on: yesterday });
    expect(await takeTicket()).toMatchObject({ ok: false, error: "monthly_quota_reached" });
    await page.reload();
    await expect(banner).toContainText("Prise de ticket suspendue");

    // Extension : achat depuis la page Abonnement, paiement (faux fournisseur), tickets à nouveau émis.
    await banner.getByRole("link", { name: "Acheter une extension" }).click();
    await expect(page.getByText(/Limite atteinte le/)).toBeVisible();
    await expectAccessible(page);
    await page.getByRole("button", { name: /Acheter Pack 1\s000 tickets/ }).click();
    await page.waitForURL(/\/pay\/[A-Za-z0-9]{32}$/);
    await expect(page.getByText("Pack 1 000 tickets", { exact: false }).first()).toBeVisible();
    await page.getByLabel("Numéro à débiter").fill("6 77 10 20 31");
    await page.getByRole("button", { name: /^Payer/ }).click();
    await expect(page.getByRole("heading", { name: "Paiement reçu" })).toBeVisible({ timeout: 20_000 });
    expect(await takeTicket()).toMatchObject({ ok: true });
    await page.goto(`/app/o/${b.orgId}/billing`);
    await expect(page.getByText(/dont 1\s000 en extension/)).toBeVisible();
  });

  test("console Wintek : abonnements, revenus, jours offerts (journalisés)", async ({ page }) => {
    const email = uniqueEmail("wintek");
    const created = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
    await admin.from("platform_admins").insert({ user_id: created.data.user!.id });
    const b = await setUpBranch("Clinique Console");
    const { data: plan } = await admin.from("plans").select("id").eq("code", "business").single();
    const { data: sub } = await admin
      .from("subscriptions")
      .insert({ organization_id: b.orgId, plan_id: plan!.id, status: "trialing", trial_ends_at: new Date(Date.now() + 3 * 86_400_000).toISOString() })
      .select("id")
      .single();

    await page.goto("/login");
    await signInViaUi(page, email);
    await page.waitForURL(/\/app$/);
    await page.goto("/admin");
    await expect(page.getByRole("heading", { level: 1, name: "Console Wintek" })).toBeVisible();
    await expect(page.getByText("Revenu mensuel récurrent")).toBeVisible();
    await expectAccessible(page);
    await expectTouchTargets(page);

    await page.goto(`/admin/subscriptions/${sub!.id}`);
    await expect(page.getByRole("heading", { level: 1, name: "Clinique Console" })).toBeVisible();
    const grant = page.locator("form").filter({ has: page.getByRole("heading", { name: "Offrir des jours" }) });
    await grant.getByLabel("Jours").fill("10");
    await grant.getByLabel("Motif").fill("Geste commercial");
    await grant.getByRole("button", { name: "Offrir" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Action enregistrée et journalisée." })).toBeVisible();
    await expect(page.getByText("Jours offerts")).toBeVisible();

    // Limites sur mesure (client sur devis) : journalisées, appliquées par la base.
    const limits = page.locator("form").filter({ has: page.getByRole("heading", { name: "Limites sur mesure" }) });
    await limits.getByLabel("Tickets par mois").fill("20000");
    await limits.getByLabel("Utilisateurs").fill("illimité");
    await limits.getByLabel("Motif").fill("Client sur devis");
    await limits.getByRole("button", { name: "Enregistrer les limites" }).click();
    await expect(page.getByText("Limites sur mesure modifiées")).toBeVisible();
    const ent = await rpc<{ tickets_per_month: number; max_users: number | null }>(b.staff, "staff_entitlements", { p_org: b.orgId });
    expect(ent.tickets_per_month).toBe(20000);
    expect(ent.max_users).toBeNull();
    await expectAccessible(page);

    // Un établissement n'a pas accès à la console.
    const staffPage = await page.context().browser()!.newContext().then((c) => c.newPage());
    await staffPage.goto("/login");
    await signInViaUi(staffPage, b.email);
    await staffPage.waitForURL(/\/app$/);
    const res = await staffPage.goto("/admin");
    expect(res?.status()).toBe(404);
    await staffPage.context().close();
  });
});
