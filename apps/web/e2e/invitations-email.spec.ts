import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { PASSWORD, expectAccessible, expectTouchTargets, signInViaUi, uniqueEmail } from "./helpers";
import { setUpBranch, supabaseOptions } from "./queue-helpers";

// P2 — invitations du personnel envoyées par e-mail, et « Renvoyer » (nouveau lien de 7 jours, l'ancien ne fonctionne
// plus) depuis l'équipe de l'établissement comme depuis la console (responsable invité par Wintek).

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, supabaseOptions);

test.describe("P2 — invitations par e-mail", () => {
  test("équipe : invitation envoyée, puis renvoyée ; l'ancien lien ne fonctionne plus", async ({ page, browser }) => {
    test.setTimeout(90_000);
    const b = await setUpBranch("Clinique Invitations");
    const staff = `/app/o/${b.orgId}/staff`;
    await page.goto(`/login?next=${encodeURIComponent(`${staff}/invite`)}`);
    await signInViaUi(page, b.email);
    await page.waitForURL((u) => u.pathname === `${staff}/invite`);
    const memberEmail = uniqueEmail("agent");
    await page.getByLabel("E-mail du membre").fill(memberEmail);
    await page.getByRole("radio", { name: "Agent / praticien" }).click();
    await page.getByRole("button", { name: "Créer l'invitation" }).click();
    await expect(page.getByRole("heading", { name: "Invitation envoyée" })).toBeVisible();
    await expect(page.getByText(`Un e-mail vient de partir vers ${memberEmail}.`, { exact: false })).toBeVisible();
    const oldLink = (await page.locator("p[title]").getAttribute("title"))!;
    await expectAccessible(page);

    await page.getByRole("link", { name: "Terminé" }).click();
    await page.waitForURL((u) => u.pathname === staff);
    const resend = page.getByRole("button", { name: `Renvoyer l'invitation à ${memberEmail}` }).filter({ visible: true });
    await expect(resend).toBeVisible();
    await expectTouchTargets(page);
    await resend.click();
    await expect(page.getByText(`Invitation renvoyée à ${memberEmail}.`)).toBeVisible();

    // L'ancien lien ne fonctionne plus.
    const ctx = await browser.newContext({ locale: "fr-FR" });
    const visitor = await ctx.newPage();
    await visitor.goto(new URL(oldLink).pathname);
    await expect(visitor.getByRole("heading", { name: "Invitation introuvable" })).toBeVisible();
    await ctx.close();
  });

  test("console : renvoi de l'invitation du responsable d'un établissement créé par Wintek", async ({ page }) => {
    test.setTimeout(90_000);
    const email = uniqueEmail("wintek");
    const created = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
    await admin.from("platform_admins").insert({ user_id: created.data.user!.id });
    const owner = uniqueEmail("responsable");
    const name = `Clinique Renvoi ${Date.now().toString(36)}`;

    await page.goto("/login?next=%2Fadmin%2Forganizations%2Fnew");
    await signInViaUi(page, email);
    await page.waitForURL(/\/admin\/organizations\/new$/);
    await page.getByLabel("Nom de l'établissement").fill(name);
    await page.getByLabel("Adresse e-mail du responsable").fill(owner);
    await page.getByLabel("Nom de l'agence").fill("Bonapriso");
    await page.getByLabel("Motif (journalisé)").fill("Contrat signé (test e2e)");
    await page.getByRole("button", { name: "Créer et inviter" }).click();
    await expect(page.getByRole("heading", { name: `${name} est créé` })).toBeVisible();

    const { data: org } = await admin.from("organizations").select("id").eq("name", name).single();
    const { data: sub } = await admin.from("subscriptions").select("id").eq("organization_id", org!.id).single();
    await page.goto(`/admin/subscriptions/${sub!.id}`);
    await expect(page.getByRole("heading", { name: "Invitation du responsable" })).toBeVisible();
    await expect(page.getByText(owner)).toBeVisible();
    await page.getByRole("button", { name: `Renvoyer l'invitation à ${owner}` }).click();
    await expect(page.getByText(`Invitation renvoyée à ${owner}.`)).toBeVisible();
    await expectAccessible(page);
  });
});
