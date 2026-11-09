import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { PASSWORD, createBranchViaUi, createOrgViaUi, expectAccessible, expectTouchTargets, signUpViaUi, uniqueEmail } from "./helpers";

test.describe("M2 — structure de l'établissement", () => {
  test("agence → services → guichet → horaires → réglages → QR et PDF", async ({ page }) => {
    const root = await createOrgViaUi(page, { orgName: "Clinique M2", email: uniqueEmail("m2") });
    await page.goto(root);
    await expect(page.getByRole("heading", { level: 1, name: "Vue d'ensemble" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Créer une agence/ })).toContainText("À faire");

    const branch = await createBranchViaUi(page, root, "Akwa");
    await expect(page.getByRole("heading", { level: 1, name: "Akwa" })).toBeVisible();
    await expect(page.getByText("Lun–Ven 07:30–17:00 · Sam 08:00–12:00")).toBeVisible();
    // Titre du document diffusé après la redirection : l'attendre avant axe.
    await expect(page).toHaveTitle(/Akwa/);
    await expectAccessible(page);

    // Service : préfixe proposé depuis le nom.
    await page.goto(`${branch}/services/new`);
    await page.getByLabel("Nom du service", { exact: true }).fill("Consultation générale");
    await expect(page.getByLabel("Lettre du ticket")).toHaveValue("C");
    await expect(page.getByText("Tickets C-001.", { exact: false })).toBeVisible();
    await page.getByRole("radio", { name: "15 min" }).click();
    await expectAccessible(page);
    await expectTouchTargets(page);
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await page.waitForURL(/\/services\?saved=1$/);
    await expect(page.getByText("Consultation générale")).toBeVisible();
    await expect(page.getByText("C-001 · 15 min")).toBeVisible();

    // Deuxième service : collision de préfixe refusée, puis corrigée.
    await page.goto(`${branch}/services/new`);
    await page.getByLabel("Nom du service", { exact: true }).fill("Caisse");
    await expect(page.getByLabel("Lettre du ticket")).toHaveValue("A");
    await page.getByLabel("Lettre du ticket").fill("C");
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText("Cette lettre est déjà utilisée par un autre service de l'agence.")).toBeVisible();
    await page.getByLabel("Lettre du ticket").fill("K");
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await page.waitForURL(/\/services\?saved=1$/);
    await expect(page.getByText("K-001 · 10 min")).toBeVisible();

    // Guichet / cabinet relié à un service.
    await page.goto(`${branch}/counters/new`);
    await page.getByRole("radio", { name: "Cabinet" }).click();
    await expect(page.getByLabel("Numéro")).toHaveValue("1");
    await page.getByRole("checkbox", { name: /Consultation générale/ }).click();
    await expect(page.getByRole("checkbox", { name: /Consultation générale/ })).toHaveAttribute("aria-checked", "true");
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await page.waitForURL(/\/counters\?saved=1$/);
    await expect(page.getByRole("link", { name: /Cabinet 1/ })).toContainText("C");

    // Numéro en double refusé.
    await page.goto(`${branch}/counters/new`);
    await page.getByRole("radio", { name: "Cabinet" }).click();
    await page.getByLabel("Numéro").fill("1");
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText("Ce numéro existe déjà pour ce type dans l'agence.")).toBeVisible();

    // Horaires : fermeture avant ouverture refusée ; dimanche ouvert le matin.
    await page.goto(`${branch}/hours`);
    await page.getByLabel("Lundi — Fermeture").fill("06:00");
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText("La fermeture doit suivre l'ouverture.")).toBeVisible();
    await page.getByLabel("Lundi — Fermeture").fill("17:00");
    await page.getByRole("switch", { name: "Ouvert le Dimanche" }).click();
    await page.getByLabel("Dimanche — Ouverture").fill("09:00");
    await page.getByLabel("Dimanche — Fermeture").fill("12:00");
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await page.waitForURL(/\?saved=1$/);
    await expect(page.getByText("Lun–Ven 07:30–17:00 · Sam 08:00–12:00 · Dim 09:00–12:00")).toBeVisible();

    // Réglages : ticket à distance désactivé par défaut, activable.
    await page.goto(`${branch}/settings`);
    const remote = page.getByRole("switch", { name: "Autoriser le ticket à distance" });
    await expect(remote).toHaveAttribute("aria-checked", "false");
    await remote.click();
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await page.waitForURL(/\?saved=1$/);
    await page.goto(`${branch}/settings`);
    await expect(page.getByRole("switch", { name: "Autoriser le ticket à distance" })).toHaveAttribute("aria-checked", "true");

    // QR code : code court, PDF A5 et A4, régénération.
    await page.goto(`${branch}/qr`);
    const code = page.locator("p.tracking-\\[0\\.25em\\]");
    const before = (await code.textContent())!.trim();
    expect(before).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
    await expect(page.getByRole("img", { name: "QR code de Akwa" })).toBeVisible();
    await expectAccessible(page);
    for (const [label, format] of [[/Chevalet de table/, "a5"], [/Affiche murale/, "a4"]] as const) {
      const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: label }).click()]);
      expect(download.suggestedFilename()).toMatch(new RegExp(`^nextin-clinique-m2-akwa-.*${format}\\.pdf$`));
      const path = await download.path();
      const { readFileSync } = await import("node:fs");
      const bytes = readFileSync(path);
      expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
      expect(bytes.length).toBeGreaterThan(10_000);
    }
    await page.getByRole("button", { name: "Régénérer le QR code" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Régénérer le QR code" }).click();
    await page.waitForURL(/\?regenerated=1$/);
    await expect(page.getByText("Nouveau QR code créé.", { exact: false })).toBeVisible();
    await expect(code).not.toHaveText(before);
  });

  test("spécialités et praticiens", async ({ page }) => {
    const root = await createOrgViaUi(page, { orgName: "Clinique Praticiens", email: uniqueEmail("prat") });
    await createBranchViaUi(page, root, "Bonapriso");
    await page.goto(`${root}/practitioners`);
    await page.getByLabel("Nom de la spécialité").fill("Pédiatrie");
    await page.getByRole("button", { name: "Ajouter" }).click();
    await page.waitForURL(/\?saved=1$/);
    await page.getByLabel("Nom de la spécialité").fill("pédiatrie");
    await page.getByRole("button", { name: "Ajouter" }).click();
    await expect(page.getByText("Ce nom existe déjà.")).toBeVisible();

    await page.goto(`${root}/practitioners/new`);
    await page.getByLabel("Titre").fill("Dr");
    await page.getByLabel("Nom", { exact: true }).fill("Aline Ngo");
    // La liste des praticiens (et son formulaire de spécialité) reste à côté du détail : libellé exact.
    await page.getByLabel("Spécialité", { exact: true }).selectOption({ label: "Pédiatrie" });
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await page.waitForURL(/\/practitioners\?saved=1$/);
    await expect(page.getByRole("link", { name: /Dr Aline Ngo/ })).toContainText("Pédiatrie · Bonapriso");
    await expectAccessible(page);
  });

  test("invitation d'un membre, adhésion, accès en lecture seule et gestion des droits", async ({ page, browser }, info) => {
    const adminEmail = uniqueEmail("dir");
    const root = await createOrgViaUi(page, { orgName: "Clinique Équipe", email: adminEmail });
    const branch = await createBranchViaUi(page, root, "Deïdo");
    await page.goto(`${branch}/services/new`);
    await page.getByLabel("Nom du service", { exact: true }).fill("Consultation");
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await page.waitForURL(/\/services\?saved=1$/);

    await page.goto(`${root}/staff/invite`);
    const memberEmail = uniqueEmail("recep");
    await page.getByLabel("E-mail du membre").fill(memberEmail);
    await page.getByRole("radio", { name: "Réceptionniste" }).click();
    await page.getByLabel("Agence").selectOption({ label: "Deïdo" });
    await expectAccessible(page);
    await page.getByRole("button", { name: "Créer l'invitation" }).click();
    await expect(page.getByRole("heading", { name: "Invitation prête" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Envoyer par WhatsApp" })).toHaveAttribute("href", /^https:\/\/wa\.me\/\?text=/);
    const link = (await page.locator("p[title]").getAttribute("title"))!;
    expect(link).toMatch(/\/invite\/[A-Za-z0-9_-]+$/);
    await page.getByRole("link", { name: "Terminé" }).click();
    await expect(page.getByText(memberEmail)).toBeVisible();

    // Le membre rejoint l'équipe.
    const ctx = await browser.newContext();
    const member = await ctx.newPage();
    const invitePath = new URL(link).pathname;
    await signUpViaUi(member, { name: "Mireille Accueil", email: memberEmail, next: invitePath });
    await member.getByRole("button", { name: "Rejoindre l'équipe" }).click();
    await member.waitForURL(/\/app\?joined=/);

    // Réceptionniste : consultation seule, pas de création d'agence.
    await member.goto(`${root}/branches`);
    await expect(member.getByRole("link", { name: /Deïdo/ })).toBeVisible();
    await expect(member.getByRole("link", { name: "Nouvelle agence" })).toHaveCount(0);
    await member.goto(`${branch}/services`);
    await expect(member.getByRole("link", { name: "Nouveau service" })).toHaveCount(0);
    await member.getByRole("main").getByRole("link", { name: /Consultation/ }).click();
    await expect(member.getByText("Consultation seule", { exact: false })).toBeVisible();
    await expect(member.getByRole("button", { name: "Enregistrer" })).toHaveCount(0);
    const res = await member.goto(`${root}/branches/new`);
    expect(res?.status()).toBe(404);
    await ctx.close();

    // L'administratrice change le rôle puis désactive l'accès.
    await page.goto(`${root}/staff`);
    await page.getByRole("link", { name: /Mireille Accueil/ }).click();
    await page.getByRole("radio", { name: "Agent / praticien" }).click();
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await page.waitForURL(/\/staff\?saved=1$/);
    // Ordinateur : tableau (rôle et agence en colonnes) ; téléphone : liste.
    const memberRow = info.project.name === "desktop" ? page.getByRole("row", { name: /Mireille Accueil/ }) : page.getByRole("link", { name: /Mireille Accueil/ });
    await expect(memberRow).toContainText(info.project.name === "desktop" ? /Agent \/ praticien.*Deïdo/ : /Agent \/ praticien · Deïdo/);
    await page.getByRole("link", { name: /Mireille Accueil/ }).click();
    await page.getByRole("button", { name: "Désactiver l'accès" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Désactiver l'accès" }).click();
    await page.waitForURL(/\/staff\?saved=1$/);
    await expect(
      (info.project.name === "desktop" ? page.getByRole("row") : page.getByRole("listitem")).filter({ hasText: "Mireille Accueil" }),
    ).toContainText("Accès désactivé");
  });

  test("PDF protégés : connexion exigée et isolation entre établissements", async ({ page, browser, request }) => {
    const root = await createOrgViaUi(page, { orgName: "Clinique PDF", email: uniqueEmail("pdf") });
    const branch = await createBranchViaUi(page, root, "Akwa PDF");
    const anon = await request.get(`${branch}/qr/pdf?format=a5`, { maxRedirects: 0 });
    expect([302, 307, 401]).toContain(anon.status());

    const ctx = await browser.newContext();
    const other = await ctx.newPage();
    await createOrgViaUi(other, { orgName: "Autre Clinique", email: uniqueEmail("autre") });
    const res = await other.request.get(`${branch}/qr/pdf?format=a5`);
    expect(res.status()).toBe(404);
    const page404 = await other.goto(branch);
    expect(page404?.status()).toBe(404);
    await ctx.close();
  });

  test("RLS côté API : un autre établissement ne peut rien modifier", async ({ page }) => {
    const root = await createOrgViaUi(page, { orgName: "Clinique API", email: uniqueEmail("api") });
    const branch = await createBranchViaUi(page, root, "Akwa API");
    const branchId = branch.split("/").pop()!;
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
    const attacker = uniqueEmail("attaquant");
    await supabase.auth.signUp({ email: attacker, password: PASSWORD });
    const { data, error } = await supabase.from("branches").update({ name: "Piratée" }).eq("id", branchId).select("id");
    expect(error).toBeNull();
    expect(data).toEqual([]);
    const { error: qrError } = await supabase.rpc("regenerate_qr_code", { p_branch: branchId });
    expect(qrError?.code).toBe("42501");
  });
});
