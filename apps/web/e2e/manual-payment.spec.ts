import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { PASSWORD, expectAccessible, expectTouchTargets, signInViaUi, uniqueEmail } from "./helpers";
import { setUpBranch, supabaseOptions } from "./queue-helpers";

// C1 — paiement manuel dans la console : facture ouverte encaissée (virement), abonnement actif comme après un
// paiement en ligne ; annulation avec motif (facture de nouveau à payer, abonnement rétabli).

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, supabaseOptions);

test.describe("C1 — paiement manuel", () => {
  test("console : encaisser une facture par virement, puis annuler avec motif", async ({ page }) => {
    test.setTimeout(90_000);
    const b = await setUpBranch(`Clinique Virement ${Date.now().toString(36)}`);
    // Établissement en essai (setUpBranch en fait un pilote, sans abonnement).
    const { data: plan } = await admin.from("plans").select("id").eq("trial_eligible", true).limit(1).single();
    const { data: sub, error: subError } = await admin
      .from("subscriptions")
      .insert({ organization_id: b.orgId, plan_id: plan!.id, status: "trialing", trial_ends_at: new Date(Date.now() + 14 * 86_400_000).toISOString(), locale: "fr" })
      .select("id, status")
      .single();
    expect(subError).toBeNull();
    const { data: invoice, error } = await admin.rpc("issue_invoice", { p_subscription: sub!.id });
    expect(error).toBeNull();
    const inv = invoice as { id: string; number: string; total_xaf: number };

    const email = uniqueEmail("wintek");
    const created = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
    await admin.from("platform_admins").insert({ user_id: created.data.user!.id });
    await page.goto(`/login?next=${encodeURIComponent(`/admin/subscriptions/${sub!.id}`)}`);
    await signInViaUi(page, email);
    await page.waitForURL(/\/admin\/subscriptions\//);
    await page.getByRole("link", { name: `Encaisser la facture ${inv.number}` }).click();
    await page.waitForURL(new RegExp(`/admin/invoices/${inv.id}/payment$`));
    await expect(page.getByRole("heading", { level: 1, name: "Paiement manuel" })).toBeVisible();
    await expectAccessible(page);
    await expectTouchTargets(page);

    // Virement sans référence : refusé dans le navigateur, la saisie reste en place.
    await page.getByRole("radio", { name: "Virement" }).click();
    await page.getByRole("button", { name: "Enregistrer le paiement" }).click();
    await expect(page.getByText("Indiquez la référence (numéro de virement, de chèque ou de transaction).")).toBeVisible();
    await expect(page.getByRole("radio", { name: "Virement" })).toBeChecked();
    await page.getByLabel("Référence").fill("VIR-E2E-0001");
    await page.getByRole("button", { name: "Enregistrer le paiement" }).click();
    await expect(page.getByText("Paiement enregistré : la facture est payée.")).toBeVisible();
    await expect(page.getByText(/· Virement/)).toBeVisible();

    const after = await admin.from("subscriptions").select("status").eq("id", sub!.id).single();
    expect(after.data!.status).toBe("active");
    const paid = await admin.from("invoices").select("status").eq("id", inv.id).single();
    expect(paid.data!.status).toBe("paid");

    // Annulation : motif obligatoire.
    await page.getByRole("button", { name: "Annuler le paiement" }).click();
    await expect(page.getByText("Indiquez un motif (3 caractères au moins).")).toBeVisible();
    await page.getByLabel("Motif (journalisé)").fill("Virement rejeté par la banque");
    await page.getByRole("button", { name: "Annuler le paiement" }).click();
    await expect(page.getByText("Paiement annulé : la facture est de nouveau à payer.")).toBeVisible();
    await expect.poll(async () => (await admin.from("invoices").select("status").eq("id", inv.id).single()).data!.status).toBe("open");
    const back = await admin.from("subscriptions").select("status").eq("id", sub!.id).single();
    expect(back.data!.status).toBe("trialing");
    await page.reload();
    await expect(page.getByRole("button", { name: "Enregistrer le paiement" })).toBeVisible();
  });
});
