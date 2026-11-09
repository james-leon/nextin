import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { expectAccessible, expectTouchTargets, signInViaUi } from "./helpers";
import { anonClient, rpc, setUpBranch, supabaseOptions } from "./queue-helpers";

// Absent automatique après l'appel : la vraie tâche pg_cron (toutes les 30 s) fait le travail ; le test ne fait que
// vieillir l'heure d'appel (service role) pour ne pas attendre 3 minutes.
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, supabaseOptions);

async function login(page: Page, email: string, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await signInViaUi(page, email);
  await page.waitForURL((u) => u.pathname === next);
}

const ticket = (staff: SupabaseClient, serviceId: string) =>
  rpc<{ id: string; display_code: string; public_token: string }>(staff, "reception_create_ticket", { p_service: serviceId });
const view = (token: string) => rpc<{ status: string; missed_calls: number }>(anonClient(), "get_ticket", { p_token: token });

/** Fait comme si l'appel datait de 10 minutes : la tâche le traite à son prochain passage. */
async function ageCall(ticketId: string) {
  const { error } = await admin
    .from("tickets")
    .update({ called_at: new Date(Date.now() - 600_000).toISOString() })
    .eq("id", ticketId);
  expect(error).toBeNull();
}

test.describe("Absent automatique après l'appel", () => {
  test("réglages de la file : activé par défaut, délai et recul modifiables", async ({ page }) => {
    const b = await setUpBranch("Clinique Absences");
    const path = `/app/o/${b.orgId}/branches/${b.branchId}/settings`;
    await login(page, b.email, path);
    await expect(page.getByRole("switch", { name: /Absent automatique/ })).toBeChecked();
    await expect(page.getByText("3 min", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Diminuer · Délai après l'appel" }).click();
    await expect(page.getByText("2 min 30 s", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Augmenter · Recul au premier appel manqué" }).click();
    await expect(page.getByText("4 places", { exact: true }).first()).toBeVisible();
    await expectAccessible(page);
    await expectTouchTargets(page);
    await page.locator("button[type=submit]:visible").filter({ hasText: "Enregistrer" }).first().click();
    await expect(page).toHaveURL(/saved=1/);
    const { data } = await b.staff
      .from("branch_settings")
      .select("auto_no_show_enabled, no_show_grace_seconds, no_show_move_back_places")
      .eq("branch_id", b.branchId)
      .single();
    expect(data).toEqual({ auto_no_show_enabled: true, no_show_grace_seconds: 150, no_show_move_back_places: 4 });
  });

  test("appel manqué : replacé de 3 places et suivant appelé, puis annulé au deuxième", async ({ page, browser }, info) => {
    test.skip(info.project.name === "mobile", "parcours poste + client, une seule taille suffit");
    test.setTimeout(240_000);
    const b = await setUpBranch("Clinique Appels manqués");
    await rpc(b.staff, "close_counter", { p_counter: b.counterId });
    const first = await ticket(b.staff, b.serviceId);
    for (let i = 0; i < 4; i++) await ticket(b.staff, b.serviceId);

    // Rien avant l'appel : un ticket en attente n'est jamais reculé.
    const { error } = await admin.from("tickets").update({ created_at: new Date(Date.now() - 3_600_000).toISOString() }).eq("id", first.id);
    expect(error).toBeNull();

    await login(page, b.email, "/desk");
    await page.getByRole("link", { name: /Cabinet 3/ }).click();
    await page.getByRole("button", { name: "Ouvrir le poste" }).click();
    await page.getByRole("button", { name: "Alerter le suivant" }).click();
    await expect(page.getByText("Patient alerté")).toBeVisible();
    await expect(page.getByText("C-001", { exact: true })).toBeVisible();

    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const client = await context.newPage();
    await client.goto(`/t/${first.public_token}`);
    await expect(client.getByText("C-001").first()).toBeVisible();

    // Premier appel manqué.
    await ageCall(first.id);
    await expect.poll(async () => (await view(first.public_token)).status, { timeout: 75_000, intervals: [2_000] }).toBe("waiting");
    expect((await view(first.public_token)).missed_calls).toBe(1);
    // Le poste a appelé le suivant tout seul.
    await expect(page.getByText("C-002", { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Patient alerté")).toBeVisible();
    // Le client est prévenu sur sa page.
    await expect(client.getByTestId("missed-call")).toContainText("Vous avez été appelé", { timeout: 15_000 });
    // La carte du ticket passe de « appelé » à « en attente » avec une transition : contrastes mesurés une fois finie.
    await client.evaluate(() => Promise.all(document.getAnimations().filter((a) => a instanceof CSSTransition).map((a) => a.finished.catch(() => null))));
    await client.waitForTimeout(500);
    await expectAccessible(client);

    // Deuxième appel du même ticket, puis deuxième absence → annulé.
    await rpc(b.staff, "admit_ticket", { p_ticket: (await calledOn(b.counterId))! });
    await rpc(b.staff, "call_ticket", { p_counter: b.counterId, p_ticket: first.id, p_finish_current: true });
    await expect(client.getByText("C'est votre tour").first()).toBeVisible({ timeout: 15_000 });
    await ageCall(first.id);
    await expect.poll(async () => (await view(first.public_token)).status, { timeout: 75_000, intervals: [2_000] }).toBe("no_show");
    expect((await view(first.public_token)).missed_calls).toBe(2);
    await expect(client.getByText("Vous ne vous êtes pas présenté après deux appels")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("C-003", { exact: true })).toBeVisible({ timeout: 15_000 });
    await context.close();
  });
});

async function calledOn(counterId: string): Promise<string | null> {
  const { data } = await admin.from("tickets").select("id").eq("counter_id", counterId).in("status", ["called", "serving"]).maybeSingle();
  return data?.id ?? null;
}
