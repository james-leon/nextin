import type { SupabaseClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { expectAccessible, expectTouchTargets, signInViaUi } from "./helpers";
import { addDoctors, anonClient, rpc, setUpBranch } from "./queue-helpers";

async function login(page: Page, email: string, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await signInViaUi(page, email);
  await page.waitForURL((u) => u.pathname === next);
}

const status = async (token: string) => (await rpc<{ status: string }>(anonClient(), "get_ticket", { p_token: token })).status;
const ticket = (staff: SupabaseClient, serviceId: string, extra: Record<string, unknown> = {}) =>
  rpc<{ id: string; display_code: string; public_token: string }>(staff, "reception_create_ticket", { p_service: serviceId, ...extra });

test.describe("M5 — poste agent", () => {
  test("appel en deux temps : alerter, rappeler, admettre (chrono), terminer et alerter, absent, pause", async ({ page }) => {
    const b = await setUpBranch();
    await rpc(b.staff, "close_counter", { p_counter: b.counterId });
    const first = await ticket(b.staff, b.serviceId);
    const second = await ticket(b.staff, b.serviceId);

    await login(page, b.email, "/desk");
    await page.getByRole("link", { name: /Cabinet 3/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Cabinet 3" })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "Fermé" })).toBeVisible();
    await expectAccessible(page);
    await expectTouchTargets(page);

    await page.getByRole("button", { name: "Ouvrir le poste" }).click();
    await page.getByRole("button", { name: "Alerter le suivant" }).click();
    await expect(page.getByText("Patient alerté")).toBeVisible();
    await expect(page.getByText("C-001", { exact: true })).toBeVisible();
    expect(await status(first.public_token)).toBe("called");

    await page.getByRole("button", { name: "Rappeler" }).click();
    await expect(page.getByText("Rappel n° 1")).toBeVisible();
    await page.getByRole("button", { name: "Admettre" }).click();
    await expect(page.getByText("Client en cours")).toBeVisible();
    expect(await status(first.public_token)).toBe("serving");
    await expectAccessible(page);

    await page.getByRole("button", { name: "Terminer et alerter le suivant" }).click();
    await expect(page.getByText("À suivre · 0 en attente")).toBeVisible();
    await expect(page.getByText("Patient alerté")).toBeVisible();
    expect(await status(first.public_token)).toBe("served");
    expect(await status(second.public_token)).toBe("called");
    await expect(page.getByText("Servis aujourd'hui")).toBeVisible();

    await page.getByRole("button", { name: "Absent" }).click();
    await expect(page.getByRole("button", { name: "Personne en attente" })).toBeDisabled();
    expect(await status(second.public_token)).toBe("no_show");

    await page.getByRole("button", { name: "Pause" }).click();
    await expect(page.getByRole("status").filter({ hasText: "En pause" })).toBeVisible();
    await page.getByRole("button", { name: "Reprendre" }).first().click();
    await expect(page.getByRole("status").filter({ hasText: "Ouvert" })).toBeVisible();
  });

  test("transfert vers un autre service : le lien du patient suit", async ({ page }) => {
    const b = await setUpBranch();
    const t1 = await ticket(b.staff, b.serviceId);
    await login(page, b.email, `/desk/counter/${b.counterId}`);
    await page.getByRole("button", { name: "Alerter le suivant" }).click();
    await page.getByRole("button", { name: "Transférer" }).click();
    await page.getByRole("radio", { name: /Pédiatrie/ }).click();
    await page.getByRole("button", { name: "Transférer", exact: true }).last().click();
    await expect(page.getByText("Patient alerté")).toHaveCount(0);
    const view = await rpc<{ display_code: string; status: string }>(anonClient(), "get_ticket", { p_token: t1.public_token });
    expect(view).toMatchObject({ display_code: "P-001", status: "waiting" });
  });

  test("hors ligne : actions en attente rejouées au retour du réseau, conflit signalé", async ({ page, context }, info) => {
    test.skip(info.project.name !== "desktop", "réseau coupé : un seul appareil suffit");
    const b = await setUpBranch();
    const { cab4 } = await addDoctors(b);
    const t1 = await ticket(b.staff, b.serviceId);
    const t2 = await ticket(b.staff, b.serviceId);
    const t3 = await ticket(b.staff, b.serviceId);
    await login(page, b.email, `/desk/counter/${b.counterId}`);
    await expect(page.getByText("À suivre · 3 en attente")).toBeVisible();

    await context.setOffline(true);
    await page.getByRole("button", { name: "Alerter le suivant" }).click();
    await expect(page.getByText("Hors ligne")).toBeVisible();
    await expect(page.getByText("1 action en attente")).toBeVisible();
    await expect(page.getByText("C-001", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Admettre" }).click();
    await page.getByRole("button", { name: "Terminer et alerter le suivant" }).click();
    await expect(page.getByText("4 actions en attente")).toBeVisible();
    // Pendant la coupure, un collègue alerte C-002, que ce poste avait choisi hors ligne.
    await rpc(b.staff, "call_ticket", { p_counter: cab4, p_ticket: t2.id });

    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect(page.getByText(/actions? en attente/)).toHaveCount(0, { timeout: 15_000 });
    await expect(page.getByText("C-002 avait déjà été pris par un autre poste : C-003 est alerté à la place.")).toBeVisible();
    expect(await status(t1.public_token)).toBe("served");
    expect(await status(t2.public_token)).toBe("called");
    expect(await status(t3.public_token)).toBe("called");
    await expect(page.getByText("C-003", { exact: true })).toBeVisible();
  });
});

test.describe("M5 — accueil", () => {
  test("ticket pour un patient sans smartphone : praticien, WhatsApp avec accord, impression 80 mm", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "poste d'accueil : grand écran");
    const b = await setUpBranch();
    await addDoctors(b);
    await login(page, b.email, `/desk/reception/${b.branchId}`);
    await expect(page.getByRole("heading", { level: 1, name: "Accueil" })).toBeVisible();
    await expectAccessible(page);

    await page.getByRole("button", { name: "Nouveau ticket" }).click();
    await page.getByRole("radio", { name: "Dr Abena" }).click();
    await page.getByLabel("WhatsApp du patient (facultatif)").fill("6 77 12 34 56");
    await page.getByRole("button", { name: "Créer le ticket" }).click();
    await expect(page.getByText("Cochez l'accord du patient pour enregistrer son numéro WhatsApp.")).toBeVisible();
    await page.getByLabel("Le patient accepte de recevoir ses alertes sur WhatsApp").click();
    await page.getByRole("button", { name: "Créer le ticket" }).click();
    await expect(page.getByText("Ticket créé")).toBeVisible();
    await expect(page.getByRole("dialog").getByText("C-001")).toBeVisible();
    const contacts = await b.staff.from("notification_contacts").select("phone_e164, consent_source");
    expect(contacts.data).toEqual([{ phone_e164: "+237677123456", consent_source: "reception_with_consent" }]);

    const href = await page.getByRole("link", { name: "Imprimer le ticket" }).getAttribute("href");
    const print = await page.context().newPage();
    await print.addInitScript(() => (window.print = () => undefined));
    await print.goto(href!);
    const ticketCard = print.getByRole("article", { name: "Ticket C-001" });
    await expect(ticketCard).toContainText("C-001");
    await expect(ticketCard.getByRole("img", { name: /scannez ce code/ })).toBeVisible();
    await print.close();

    await page.getByRole("button", { name: "Fermer" }).click();
    await expect(page.getByRole("button", { name: /C-001/ })).toContainText("Pour Dr Abena");
  });

  test("absence d'un praticien : ses patients passent chez un collègue ; priorité, recul, annulation", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "poste d'accueil : grand écran");
    const b = await setUpBranch();
    const { abena, cab4 } = await addDoctors(b);
    const forAbena = await ticket(b.staff, b.serviceId, { p_practitioner: abena });
    await ticket(b.staff, b.serviceId);
    await ticket(b.staff, b.serviceId);
    await login(page, b.email, `/desk/reception/${b.branchId}`);

    await page.getByRole("button", { name: /^Dr Abena/ }).click();
    await page.getByRole("radio", { name: "Absent" }).click();
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText("1 patient réorienté.")).toBeVisible();
    await expect(page.getByRole("button", { name: /^Dr Abena/ })).toContainText("Absent");
    const moved = await b.staff.from("tickets").select("preferred_counter_id").eq("id", forAbena.id).single();
    expect(moved.data!.preferred_counter_id).toBe(cab4);
    await expect(page.getByRole("button", { name: /C-001/ })).toContainText("Pour Dr Bilong");

    await page.getByRole("button", { name: /C-002/ }).click();
    await page.getByRole("button", { name: "Rendre prioritaire" }).click();
    await page.getByRole("button", { name: "Personne âgée" }).click();
    await expect(page.getByRole("button", { name: /C-002/ })).toContainText("Personne âgée");

    await page.getByRole("button", { name: /C-001/ }).click();
    await page.getByRole("button", { name: "Reculer de 3 places" }).click();
    await page.getByRole("button", { name: /C-003/ }).click();
    await page.getByRole("button", { name: "Annuler le ticket" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Annuler le ticket" }).click();
    await expect(page.getByText("File d'attente · 2")).toBeVisible();
    const queue = page.locator("section", { has: page.getByRole("heading", { name: /File d'attente/ }) });
    const codes = await queue.getByRole("button").allInnerTexts();
    expect(codes.map((c) => c.match(/C-\d{3}/)?.[0])).toEqual(["C-002", "C-001"]);
  });
});

test("M5 — postes accessibles en mode sombre", async ({ browser }, info) => {
  test.skip(info.project.name !== "desktop", "un seul appareil suffit");
  const b = await setUpBranch();
  await addDoctors(b);
  await ticket(b.staff, b.serviceId, { p_priority_reason: "pregnancy" });
  const context = await browser.newContext({ colorScheme: "dark", locale: "fr-FR" });
  const page = await context.newPage();
  await login(page, b.email, `/desk/counter/${b.counterId}`);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Alerter le suivant" }).click();
  await expect(page.getByText("Patient alerté")).toBeVisible();
  await expectAccessible(page);
  await page.goto(`/desk/reception/${b.branchId}`);
  await expect(page.getByRole("heading", { level: 1, name: "Accueil" })).toBeVisible();
  await expectAccessible(page);
  await context.close();
});
