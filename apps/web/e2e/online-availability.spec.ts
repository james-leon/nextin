import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { expectAccessible } from "./helpers";
import { addDoctors, rpc, setUpBranch, supabaseOptions } from "./queue-helpers";

// Établissement en lecture seule (ou suspendu), ou quota de tickets du mois bloquant : la page client le montre dès
// l'ouverture (encadré neutre, services sans temps d'attente, bouton désactivé), sans jamais parler d'abonnement,
// de paiement ni de quota.
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, supabaseOptions);
const MESSAGE_FR = "La prise de ticket en ligne est momentanément indisponible. Adressez-vous à l'accueil.";
const MESSAGE_EN = "Online tickets are temporarily unavailable. Please ask at the front desk.";
const FORBIDDEN = /abonnement|paiement|payer|quota|facture|lecture seule|suspendu|subscription|payment|invoice|read-only|suspended/i;

async function availableBranch() {
  const b = await setUpBranch("Clinique Disponibilité");
  await rpc(b.staff, "set_branch_location", { p_branch: b.branchId, p_lat: 4.05, p_lng: 9.7 });
  const settings = await admin
    .from("branch_settings")
    .update({ remote_tickets_enabled: true, appointment_requests_enabled: true })
    .eq("branch_id", b.branchId)
    .select("branch_id");
  expect(settings.error).toBeNull();
  const { abena } = await addDoctors(b);
  const schedules = await admin.from("practitioner_schedules").insert(
    [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
      organization_id: b.orgId,
      branch_id: b.branchId,
      practitioner_id: abena,
      service_id: b.serviceId,
      weekday,
      starts_at: "08:00",
      ends_at: "18:00",
      slot_minutes: 30,
    })),
  );
  expect(schedules.error).toBeNull();
  await rpc(b.staff, "reception_create_ticket", { p_service: b.serviceId });
  return b;
}

/** Abonnement de l'établissement : `status`, et éventuellement un quota de tickets épuisé depuis la veille. */
async function setSubscription(orgId: string, status: "active" | "read_only" | "suspended", quotaBlocked = false) {
  await admin.from("subscriptions").delete().eq("organization_id", orgId);
  const { data: plan } = await admin.from("plans").select("id").eq("code", "business").single();
  const { error } = await admin.from("subscriptions").insert({
    organization_id: orgId,
    plan_id: plan!.id,
    status,
    current_period_start: new Date(Date.now() - 86_400_000).toISOString(),
    current_period_end: new Date(Date.now() + 29 * 86_400_000).toISOString(),
    limit_overrides: quotaBlocked ? { tickets_per_month: 1 } : {},
  });
  expect(error).toBeNull();
  await admin.from("messaging_usage").delete().eq("organization_id", orgId);
  if (quotaBlocked) {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Douala" }).format(new Date());
    const yesterday = new Date(`${today}T12:00:00Z`);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const { error: usage } = await admin.from("messaging_usage").insert({
      organization_id: orgId,
      month: `${today.slice(0, 7)}-01`,
      tickets_created: 5,
      tickets_reached_on: yesterday.toISOString().slice(0, 10),
    });
    expect(usage).toBeNull();
  }
}

/** Statut de l'établissement (suspension pour impayé : `suspended` + motif `subscription`). */
async function setOrgStatus(orgId: string, status: "active" | "suspended", reason: string | null) {
  const { error } = await admin.from("organizations").update({ status, suspended_reason: reason }).eq("id", orgId).select("id");
  expect(error).toBeNull();
}

async function expectUnavailable(page: Page, button: string) {
  await expect(page.getByTestId("online-unavailable")).toHaveText(MESSAGE_FR);
  await expect(page.getByRole("button", { name: button }).last()).toBeDisabled();
  // Services affichés, sans temps d'attente.
  await expect(page.getByText("Consultation", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/≈ \d+ min|Pas d'attente|Personne en attente/)).toHaveCount(0);
  expect(await page.locator("main").innerText()).not.toMatch(FORBIDDEN);
}

test.describe("Prise en ligne indisponible : connue dès l'ouverture de la page", () => {
  test("lecture seule : /q, /b et demande de rendez-vous — encadré neutre, bouton désactivé, aucune raison", async ({ page }) => {
    const b = await availableBranch();
    await setSubscription(b.orgId, "read_only");

    await page.goto(`/q/${b.entryCode}`);
    await expectUnavailable(page, "Prendre mon ticket");
    await expectAccessible(page);

    await page.goto(`/b/${b.branchId}`);
    await expectUnavailable(page, "Prendre un ticket à distance");

    await page.goto(`/b/${b.branchId}/rdv`);
    await expect(page.getByTestId("online-unavailable")).toHaveText(MESSAGE_FR);
    await expect(page.getByRole("button", { name: "Envoyer la demande" }).last()).toBeDisabled();
    expect(await page.locator("main").innerText()).not.toMatch(FORBIDDEN);

    // Anglais.
    await page.context().addCookies([{ name: "NEXTIN_LOCALE", value: "en", url: new URL(page.url()).origin }]);
    await page.goto(`/q/${b.entryCode}`);
    await expect(page.getByTestId("online-unavailable")).toHaveText(MESSAGE_EN);
  });

  test("suspendu pour impayé, puis quota de tickets du mois bloquant ; abonnement actif : prise normale", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "mêmes écrans que le test précédent ; une taille suffit");
    const b = await availableBranch();

    // Suspendu pour impayé : les pages restent visibles, la prise en ligne est fermée.
    await setSubscription(b.orgId, "suspended");
    await setOrgStatus(b.orgId, "suspended", "subscription");
    await page.goto(`/q/${b.entryCode}`);
    await expectUnavailable(page, "Prendre mon ticket");
    await page.goto(`/b/${b.branchId}`);
    await expectUnavailable(page, "Prendre un ticket à distance");
    await page.goto(`/b/${b.branchId}/rdv`);
    await expect(page.getByTestId("online-unavailable")).toHaveText(MESSAGE_FR);
    await setOrgStatus(b.orgId, "active", null);

    // Quota de tickets épuisé depuis la veille : plus de ticket en ligne, ni de demande de rendez-vous.
    await setSubscription(b.orgId, "active", true);
    await page.goto(`/q/${b.entryCode}`);
    await expectUnavailable(page, "Prendre mon ticket");
    await page.goto(`/b/${b.branchId}/rdv`);
    await expect(page.getByTestId("online-unavailable")).toHaveText(MESSAGE_FR);
    await expect(page.getByRole("button", { name: "Envoyer la demande" }).last()).toBeDisabled();

    // Abonnement actif : temps d'attente affichés, bouton actif, aucun encadré.
    await setSubscription(b.orgId, "active");
    await page.goto(`/q/${b.entryCode}`);
    await expect(page.getByTestId("online-unavailable")).toHaveCount(0);
    await expect(page.getByText(/≈ \d+ min/).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Prendre mon ticket" }).last()).toBeEnabled();
  });
});
