import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { expectAccessible, expectTouchTargets, signInViaUi } from "./helpers";
import { addDoctors, rpc, setUpBranch, supabaseOptions } from "./queue-helpers";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, supabaseOptions);

type Branch = Awaited<ReturnType<typeof setUpBranch>>;

/** Horaires de consultation tous les jours, toute la journée (créneaux de 20 min), pour des tests à toute heure. */
async function openAllDay(b: Branch, practitionerId: string) {
  const { error } = await b.staff.from("practitioner_schedules").insert(
    [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
      organization_id: b.orgId,
      branch_id: b.branchId,
      practitioner_id: practitionerId,
      service_id: b.serviceId,
      weekday,
      starts_at: "00:00",
      ends_at: "23:40",
      slot_minutes: 20,
    })),
  );
  expect(error).toBeNull();
}

/** Contrôle d'accessibilité une fois la barre de navigation revenue à l'état de repos (titre réduit animé au défilement). */
async function checkA11y(page: Page) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
  await expectAccessible(page);
}

async function signIn(page: Page, b: Branch, path: string) {
  await page.goto(`/login?next=${encodeURIComponent(path)}`);
  await signInViaUi(page, b.email);
  await page.waitForURL((u) => u.pathname === path);
}

test.describe("M5b — rendez-vous", () => {
  test("ordinateur : horaires, prise de rendez-vous, arrivée, semaine, reprogrammation et annulation", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "vue ordinateur");
    const b = await setUpBranch("Clinique RDV");
    const docs = await addDoctors(b);

    // Back-office : plage de consultation et congé de Dr Abena.
    await signIn(page, b, `/app/o/${b.orgId}/practitioners/${docs.abena}/schedule`);
    await expect(page.getByRole("heading", { name: "Horaires et congés" })).toBeVisible();
    await page.getByLabel("Jour", { exact: true }).selectOption({ label: "Mardi" });
    await page.getByLabel("De", { exact: true }).fill("08:00");
    await page.getByLabel("À", { exact: true }).fill("12:00");
    await page.getByRole("button", { name: "Ajouter une plage" }).click();
    await page.waitForURL(/schedule\?saved=1$/);
    await expect(page.getByText("08:00 – 12:00", { exact: true })).toBeVisible();
    await page.getByLabel("Jour", { exact: true }).selectOption({ label: "Mardi" });
    await page.getByLabel("De", { exact: true }).fill("11:00");
    await page.getByLabel("À", { exact: true }).fill("13:00");
    await page.getByRole("button", { name: "Ajouter une plage" }).click();
    await expect(page.getByText("Cette plage chevauche une autre plage du même jour.")).toBeVisible();
    await page.getByLabel("Du", { exact: true }).fill("2030-08-01");
    await page.getByLabel("Au", { exact: true }).fill("2030-08-15");
    await page.getByRole("button", { name: "Ajouter un congé" }).click();
    await page.waitForURL(/schedule\?saved=1$/);
    await expect(page.getByText(/Du 1 août 2030 au 15 août 2030/)).toBeVisible();
    await checkA11y(page);
    await page.getByRole("button", { name: /Supprimer la plage Mardi 08:00 – 12:00/ }).click();
    await expect(page.getByText("08:00 – 12:00", { exact: true })).toHaveCount(0);
    await openAllDay(b, docs.abena);

    // Accueil : prise de rendez-vous dans le panneau de droite.
    await page.goto(`/desk/reception/${b.branchId}`);
    await page.getByRole("link", { name: /Rendez-vous/ }).first().click();
    await page.waitForURL(/\/appointments$/);
    // Panneau de détail sans rendez-vous choisi : résumé du jour.
    await expect(page.getByRole("heading", { name: "Résumé de la journée" })).toBeVisible();
    await page.getByRole("button", { name: "Nouveau rendez-vous" }).click();
    const panel = page.getByRole("complementary", { name: "Nouveau rendez-vous" });
    await expect(panel.getByRole("radio", { name: "Dr Abena" })).toHaveAttribute("aria-checked", "true");
    const slots = panel.getByRole("radiogroup", { name: "Créneaux libres" }).getByRole("radio");
    await expect(slots.first()).toBeVisible();
    await slots.first().click();
    await panel.getByLabel("Repère du patient (facultatif)").fill("M.N.");
    await panel.getByLabel("WhatsApp du patient (facultatif)").fill("6 77 12 34 56");
    await panel.getByRole("button", { name: "Confirmer le rendez-vous" }).click();
    await expect(panel.getByText("Cochez l'accord du patient pour enregistrer son numéro WhatsApp.")).toBeVisible();
    await panel.getByRole("switch", { name: "Le patient accepte de recevoir ses alertes sur WhatsApp" }).click();
    await panel.getByRole("button", { name: "Confirmer le rendez-vous" }).click();
    await expect(panel.getByText("Rendez-vous confirmé.")).toBeVisible();
    await expect(panel.getByText("Le patient recevra la confirmation, puis un rappel la veille et 2 heures avant.")).toBeVisible();
    await checkA11y(page);
    await panel.getByRole("button", { name: "Fait" }).click();

    const { data: appt } = await admin.from("appointments").select("id, status, phone_e164").eq("branch_id", b.branchId).single();
    expect(appt).toMatchObject({ status: "confirmed", phone_e164: "+237677123456" });
    await expect
      .poll(async () => (await admin.from("notification_jobs").select("event, status").eq("appointment_id", appt!.id).eq("event", "appointment_confirmed")).data)
      .toEqual([{ event: "appointment_confirmed", status: "sent" }]);

    // Détail à droite : arrivée du patient → ticket prioritaire « RDV » au cabinet du praticien.
    const detail = page.getByRole("complementary", { name: "Détail du rendez-vous" });
    await expect(detail.getByText("M.N.")).toBeVisible();
    await detail.getByRole("button", { name: "Marquer arrivé" }).click();
    await expect(detail.getByText(/^Arrivé : ticket C-001$/)).toBeVisible();
    const { data: ticket } = await admin.from("tickets").select("priority_reason, preferred_counter_id, appointment_id").eq("display_code", "C-001").eq("branch_id", b.branchId).single();
    expect(ticket).toEqual({ priority_reason: "appointment", preferred_counter_id: b.counterId, appointment_id: appt!.id });
    await expect(page.getByRole("button", { name: /M\.N\./ }).getByText("Arrivé")).toBeVisible();

    // Second rendez-vous : reprogrammation puis annulation.
    await page.getByRole("button", { name: "Nouveau rendez-vous" }).click();
    await slots.nth(1).click();
    await panel.getByLabel("Repère du patient (facultatif)").fill("A.T.");
    await panel.getByRole("button", { name: "Confirmer le rendez-vous" }).click();
    await panel.getByRole("button", { name: "Fait" }).click();
    await detail.getByRole("button", { name: "Reprogrammer" }).click();
    const reschedule = page.getByRole("complementary", { name: "Reprogrammer le rendez-vous" });
    // Lendemain : assez de créneaux libres quelle que soit l'heure du test (le soir, la journée est presque finie).
    await reschedule.getByRole("radiogroup", { name: /^Jour · / }).getByRole("radio").nth(1).click();
    await reschedule.getByRole("radiogroup", { name: "Créneaux libres" }).getByRole("radio").nth(2).click();
    await reschedule.getByRole("button", { name: "Reprogrammer" }).click();
    await expect(reschedule.getByText("Rendez-vous reprogrammé.")).toBeVisible();
    await reschedule.getByRole("button", { name: "Fait" }).click();
    // La vue suit le rendez-vous reprogrammé (lendemain), puis revient au jour : l'ancien est « Reprogrammé ».
    await expect(page.getByRole("button", { name: /A\.T\..*Confirmé/ })).toBeVisible();
    await detail.getByRole("button", { name: "Annuler le rendez-vous" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Annuler le rendez-vous" }).click();
    await expect(detail.getByText("Annulé")).toBeVisible();
    await page.getByRole("button", { name: "Aujourd'hui" }).click();
    await expect(page.getByRole("button", { name: /A\.T\..*Reprogrammé/ })).toBeVisible();

    // Semaine : sept colonnes, le jour mène à la vue du jour.
    await page.getByRole("radio", { name: "Semaine" }).click();
    await expect(page.getByRole("heading", { name: /^Semaine du / })).toBeVisible();
    await expect(page.getByRole("region").filter({ has: page.getByText("M.N.") })).toHaveCount(1);
    await checkA11y(page);

    // Poste du praticien : rendez-vous du jour.
    await page.goto(`/desk/counter/${b.counterId}`);
    await page.getByRole("button", { name: /Rendez-vous du jour · \d/ }).click();
    await expect(page.getByRole("dialog").getByText("M.N.")).toBeVisible();
  });

  test("téléphone : prise de rendez-vous en feuille, cibles tactiles, réglage d'équité", async ({ page }, info) => {
    test.skip(info.project.name !== "mobile", "vue téléphone");
    const b = await setUpBranch("Clinique RDV mobile");
    const docs = await addDoctors(b);
    await openAllDay(b, docs.abena);
    await rpc(b.staff, "book_appointment", {
      p_practitioner: docs.abena,
      p_starts_at: (await rpc<{ starts_at: string }[]>(b.staff, "available_slots", { p_practitioner: docs.abena, p_from: new Date().toISOString().slice(0, 10), p_days: 2 }))[0]!.starts_at,
      p_customer_label: "J.K.",
    });

    await signIn(page, b, `/desk/reception/${b.branchId}/appointments`);
    await expect(page.getByRole("button", { name: /J\.K\./ })).toBeVisible({ timeout: 10_000 });
    await expectTouchTargets(page);
    await checkA11y(page);
    await page.getByRole("button", { name: "Nouveau rendez-vous" }).click();
    const sheet = page.getByRole("dialog", { name: "Nouveau rendez-vous" });
    await sheet.getByRole("radiogroup", { name: "Créneaux libres" }).getByRole("radio").first().click();
    await sheet.getByRole("button", { name: "Confirmer le rendez-vous" }).click();
    await expect(sheet.getByText("Rendez-vous confirmé.")).toBeVisible();
    await sheet.getByRole("button", { name: "Fait" }).click();
    await page.getByRole("button", { name: /J\.K\./ }).click();
    await expect(page.getByRole("dialog", { name: "Détail du rendez-vous" }).getByRole("button", { name: "Reprogrammer" })).toBeVisible();
    await page.keyboard.press("Escape");

    // Réglage d'équité de l'agence.
    await page.goto(`/app/o/${b.orgId}/branches/${b.branchId}/settings`);
    await page.getByRole("radio", { name: "À l'heure" }).click();
    await page.getByRole("button", { name: /Augmenter · Tolérance de retard/ }).click();
    await expectTouchTargets(page);
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await page.waitForURL(/\?saved=1$/);
    const { data } = await b.staff.from("branch_settings").select("appointment_mode, appointment_late_grace_minutes").eq("branch_id", b.branchId).single();
    expect(data).toEqual({ appointment_mode: "strict", appointment_late_grace_minutes: 15 });
  });
});
