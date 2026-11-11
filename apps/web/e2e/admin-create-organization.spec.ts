import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { PASSWORD, expectAccessible, expectTouchTargets, signInViaUi, uniqueEmail } from "./helpers";
import { supabaseOptions } from "./queue-helpers";

// P1 — console Wintek : établissement créé pour un client (formule, essai, première agence, services du modèle,
// invitation du responsable par e-mail). Acceptation de l'invitation : pgTAP admin_create_organization.

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, supabaseOptions);

test.describe("P1 — création d'un établissement depuis la console", () => {
  test("formulaire → établissement en essai, services du modèle, invitation envoyée", async ({ page }) => {
    test.setTimeout(90_000);
    const email = uniqueEmail("wintek");
    const created = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
    await admin.from("platform_admins").insert({ user_id: created.data.user!.id });
    const owner = uniqueEmail("responsable");
    const name = `Banque Console ${Date.now().toString(36)}`;

    await page.goto("/login?next=%2Fadmin");
    await signInViaUi(page, email);
    await page.waitForURL(/\/admin$/);
    await page.getByRole("link", { name: "Nouvel établissement" }).click();
    await page.waitForURL(/\/admin\/organizations\/new$/);
    await expect(page.getByRole("heading", { level: 1, name: "Nouvel établissement" })).toBeVisible();

    await page.getByLabel("Nom de l'établissement").fill(name);
    await page.getByLabel("Secteur").selectOption("bank");
    // Le modèle suit le secteur : services de la banque, tous cochés.
    const services = page.getByRole("group", { name: "Services de départ" }).getByRole("checkbox");
    await expect(services).toHaveCount(4);
    await expect(page.getByRole("checkbox", { name: /Dépôt et retrait/ })).toBeChecked();
    await page.getByRole("checkbox", { name: /Transferts/ }).click();
    await expect(page.getByRole("checkbox", { name: /Transferts/ })).not.toBeChecked();
    await page.getByLabel("Durée de l'essai (jours)").fill("45");
    await page.getByLabel("Adresse e-mail du responsable").fill(owner);
    await page.getByLabel("Nom de l'agence").fill("Akwa");
    await page.getByLabel("Ville (facultatif)").fill("Douala");
    await expectAccessible(page);
    await expectTouchTargets(page);

    // Motif oublié : erreur sur le champ, rien n'est créé.
    await page.getByRole("button", { name: "Créer et inviter" }).click();
    await expect(page.getByText("Indiquez un motif (3 caractères au moins).")).toBeVisible();
    await page.getByLabel("Motif (journalisé)").fill("Contrat signé (test e2e)");
    await page.getByRole("button", { name: "Créer et inviter" }).click();
    await expect(page.getByRole("heading", { name: `${name} est créé` })).toBeVisible();
    await expect(page.getByText(`Invitation envoyée à ${owner}.`)).toBeVisible();
    await expectAccessible(page);

    const { data: org } = await admin.from("organizations").select("id, type, status").eq("name", name).single();
    expect(org).toMatchObject({ type: "bank", status: "active" });
    const { data: sub } = await admin.from("subscriptions").select("status, trial_ends_at, billing_email").eq("organization_id", org!.id).single();
    expect(sub!.status).toBe("trialing");
    expect(sub!.billing_email).toBe(owner);
    const days = Math.round((new Date(sub!.trial_ends_at!).getTime() - Date.now()) / 86_400_000);
    expect(days).toBe(45);
    const { data: svc } = await admin.from("services").select("prefix").eq("organization_id", org!.id).order("sort_order");
    expect(svc!.map((s) => s.prefix)).toEqual(["D", "O", "C"]);
    const { data: inv } = await admin.from("invitations").select("role, email, accepted_at").eq("organization_id", org!.id);
    expect(inv).toEqual([{ role: "org_admin", email: owner, accepted_at: null }]);
    const { count } = await admin.from("memberships").select("*", { count: "exact", head: true }).eq("organization_id", org!.id);
    expect(count).toBe(0);
  });
});
