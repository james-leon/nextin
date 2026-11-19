import { createClient } from "@supabase/supabase-js";
import { test, type Page } from "@playwright/test";
import { signInViaUi } from "./helpers";
import { addDoctors, rpc, setUpBranch, supabaseOptions } from "./queue-helpers";

// Captures de la refonte v2, LOT 5a (postes, patient, compte) → docs/captures/v2-lot5a/ (ou V2_SHOTS_OUT) :
// téléphone (390), tablette (768) et ordinateur (1280), clair et sombre. Données créées pour l'occasion.
const OUT = process.env.V2_SHOTS_OUT ?? "../../docs/captures/v2-lot5a";
const ONLY = process.env.V2_SHOTS_ONLY?.split(",");
const SIZES = [
  { tag: "390", width: 390, height: 844, mobile: true },
  { tag: "768", width: 768, height: 1024, mobile: true },
  { tag: "1280", width: 1280, height: 800, mobile: false },
] as const;
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, supabaseOptions);

const wanted = (name: string) => !ONLY || ONLY.some((p) => name.startsWith(p));

async function snap(page: Page, name: string, suffix: string, full = true) {
  if (!wanted(name)) return;
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/${name}-${suffix}.png`, fullPage: full });
}

async function shoot(page: Page, name: string, path: string, suffix: string, full = true) {
  if (!wanted(name)) return;
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  await snap(page, name, suffix, full);
}

/** Jour de Douala (AAAA-MM-JJ) et instant « aujourd'hui à HH:MM » à Douala (UTC+1). */
const doualaDay = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Douala" }).format(new Date());
const at = (hhmm: string, plusMinutes = 0) => new Date(new Date(`${doualaDay()}T${hhmm}:00+01:00`).getTime() + plusMinutes * 60_000).toISOString();
const token = () => Array.from({ length: 22 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"[Math.floor(Math.random() * 56)]).join("");

/** Agence de démonstration des postes : file, demande d'aide, rendez-vous du jour, demande en ligne, praticien en congé. */
async function deskData() {
  const b = await setUpBranch("DOUALA CLINIC");
  const docs = await addDoctors(b);
  const third = await b.staff
    .from("practitioners")
    .insert({ organization_id: b.orgId, branch_id: b.branchId, title: "Dr", display_name: "Nkeng" })
    .select("id")
    .single();
  const tickets: { id: string; display_code: string }[] = [];
  for (let i = 0; i < 4; i++) tickets.push(await rpc(b.staff, "reception_create_ticket", { p_service: b.serviceId }));
  await rpc(b.staff, "set_ticket_priority", { p_ticket: tickets[1]!.id, p_reason: "pregnancy" });
  await admin.from("ticket_help_requests").insert({ organization_id: b.orgId, branch_id: b.branchId, ticket_id: tickets[0]!.id });
  const appt = (practitioner: string, hhmm: string, minutes: number, extra: Record<string, unknown> = {}) => ({
    organization_id: b.orgId,
    branch_id: b.branchId,
    practitioner_id: practitioner,
    service_id: b.serviceId,
    starts_at: at(hhmm),
    ends_at: at(hhmm, minutes),
    // Insertion groupée : toutes les lignes portent les mêmes colonnes (sinon PostgREST met null).
    status: "confirmed",
    checked_in_at: null,
    customer_label: null,
    ...extra,
  });
  const inserted = await admin.from("appointments").insert([
    appt(docs.abena, "08:00", 30, { status: "completed", checked_in_at: at("07:55") }),
    appt(docs.abena, "09:00", 30, { status: "completed", checked_in_at: at("08:57") }),
    appt(docs.abena, "10:00", 30, { status: "no_show" }),
    appt(docs.abena, "10:30", 30, { customer_label: "Mme Eyenga" }),
    appt(docs.abena, "11:30", 30, { customer_label: "M. Tchoua" }),
    appt(docs.bilong, "08:30", 30, { status: "completed", checked_in_at: at("08:25") }),
    appt(docs.bilong, "09:30", 30, { status: "completed", checked_in_at: at("09:28") }),
    appt(docs.bilong, "11:00", 60, { customer_label: "Bébé Fouda" }),
  ]);
  if (inserted.error) throw new Error(`rendez-vous : ${inserted.error.message}`);
  await admin.from("practitioner_leaves").insert({
    organization_id: b.orgId,
    branch_id: b.branchId,
    practitioner_id: third.data!.id,
    starts_on: doualaDay(),
    ends_on: doualaDay(),
  });
  await admin.from("appointment_requests").insert({
    organization_id: b.orgId,
    branch_id: b.branchId,
    service_id: b.serviceId,
    practitioner_id: docs.abena,
    preferred_starts_at: at("14:00"),
    customer_label: "Leonel Lontsi",
    phone_e164: "+237677123416",
    public_token: token(),
    status: "pending",
    verified_at: new Date().toISOString(),
  });
  return { b, docs, tickets };
}

for (const theme of ["light", "dark"] as const) {
  test(`@screenshots refonte v2 LOT 5a postes ${theme}`, async ({ browser }, info) => {
    test.skip(info.project.name !== "desktop", "une passe suffit : les tailles sont fixées ici");
    test.setTimeout(900_000);
    const { b, tickets } = await deskData();

    for (const size of SIZES) {
      const suffix = `${size.tag}-${theme}`;
      const context = await browser.newContext({
        colorScheme: theme,
        viewport: { width: size.width, height: size.height },
        deviceScaleFactor: 1,
        isMobile: size.mobile,
        hasTouch: size.mobile,
        locale: "fr-FR",
      });
      const page = await context.newPage();
      page.setDefaultTimeout(20_000);
      await page.goto("/login");
      await signInViaUi(page, b.email);
      await page.waitForURL((url) => url.pathname.startsWith("/app"));
      const reception = `/desk/reception/${b.branchId}`;

      await shoot(page, "01-desk-choice", "/desk", suffix);
      await shoot(page, "02-reception", reception, suffix);
      if (wanted("03-ticket-actions")) {
        await page.getByRole("button", { name: new RegExp(`^${tickets[2]!.display_code}`) }).click();
        await page.getByRole("dialog").waitFor();
        await snap(page, "03-ticket-actions", suffix, false);
        await page.keyboard.press("Escape");
      }
      if (wanted("04-priority")) {
        await page.goto(reception);
        await page.getByRole("button", { name: new RegExp(`^${tickets[3]!.display_code}`) }).click();
        await page.getByRole("button", { name: "Rendre prioritaire" }).click();
        await page.getByRole("radio", { name: "Grossesse" }).click();
        await snap(page, "04-priority", suffix, false);
      }
      if (wanted("05-transfer")) {
        await page.goto(reception);
        await page.getByRole("button", { name: new RegExp(`^${tickets[3]!.display_code}`) }).click();
        await page.getByRole("button", { name: "Réorienter vers un autre service" }).click();
        await page.getByRole("radio", { name: /Pédiatrie/ }).click();
        await snap(page, "05-transfer", suffix, false);
      }
      if (wanted("06-name")) {
        await page.goto(reception);
        await page.getByRole("button", { name: new RegExp(`^${tickets[3]!.display_code}`) }).click();
        await page.getByRole("button", { name: "Saisir le nom" }).click();
        await page.getByLabel("Nom du client").fill("Odile Manga");
        await snap(page, "06-name", suffix, false);
      }
      if (wanted("07-absence")) {
        await page.goto(reception);
        await page.getByRole("button", { name: /^Dr Abena/ }).click();
        await page.getByRole("dialog").waitFor();
        await snap(page, "07-absence", suffix, false);
      }
      if (wanted("08-new-ticket")) {
        await page.goto(reception);
        await page.getByRole("button", { name: "Nouveau ticket" }).click();
        await page.getByRole("dialog").waitFor();
        await snap(page, "08-new-ticket", suffix, false);
        if (wanted("09-ticket-created")) {
          await page.getByRole("button", { name: "Créer le ticket" }).click();
          await page.getByRole("button", { name: "Nouveau ticket" }).last().waitFor();
          await snap(page, "09-ticket-created", suffix, false);
        }
      }
      if (wanted("10-appointments")) {
        await page.goto(`${reception}/appointments`);
        await page.waitForLoadState("networkidle");
        await page.getByRole("button", { name: /Mme Eyenga/ }).first().click();
        await snap(page, "10-appointments", suffix);
      }
      await shoot(page, "11-requests", `${reception}/appointments?view=requests`, suffix);
      if (wanted("11b-request")) {
        await page.getByRole("button", { name: /14:00/ }).first().click();
        await page.getByRole("button", { name: "Autre jour" }).first().waitFor();
        await snap(page, "11b-request", suffix, size.tag === "1280");
      }

      const counter = `/desk/counter/${b.counterId}`;
      if (wanted("20-counter")) {
        await page.goto(counter);
        await page.waitForLoadState("networkidle");
        // L'état du poste suit d'une taille à l'autre : ouvrir, alerter puis admettre seulement si besoin.
        if (!(await page.getByText("Client en cours").first().isVisible())) {
          const open = page.getByRole("button", { name: "Ouvrir le poste" });
          if (await open.isVisible()) await open.click();
          if (!(await page.getByText("Patient alerté").first().isVisible())) await page.getByRole("button", { name: /Alerter le suivant/ }).first().click();
          await page.getByRole("button", { name: "Admettre" }).first().click();
        }
        await page.getByText("Client en cours").first().waitFor();
        await snap(page, "20-counter", suffix);
      }
      if (wanted("21-counter-offline")) {
        await page.goto(counter);
        await page.getByText("Client en cours").first().waitFor();
        await context.setOffline(true);
        await page.getByRole("button", { name: /Terminer et alerter|Terminer/ }).first().click();
        await page.getByRole("button", { name: "Admettre" }).first().click();
        await page.getByText(/actions? en attente/).first().waitFor();
        await snap(page, "21-counter-offline", suffix);
        await context.setOffline(false);
        await page.evaluate(() => window.dispatchEvent(new Event("online")));
        await page.getByText(/actions? en attente/).first().waitFor({ state: "detached", timeout: 15_000 }).catch(() => undefined);
      }
      if (wanted("22-absent-confirm")) {
        await page.goto(counter);
        await page.getByRole("button", { name: "Absent" }).first().click();
        await page.getByRole("alertdialog").waitFor();
        await snap(page, "22-absent-confirm", suffix, false);
        await page.keyboard.press("Escape");
      }
      if (wanted("23-shortcuts") && size.tag === "1280") {
        await page.goto(counter);
        await page.keyboard.press("?");
        await page.getByRole("dialog").waitFor();
        await snap(page, "23-shortcuts", suffix, false);
      }
      if (wanted("24-compact")) {
        await page.goto(counter);
        await page.getByRole("button", { name: "Mode compact" }).click();
        await page.getByRole("button", { name: "Quitter le mode compact" }).waitFor();
        await page.setViewportSize({ width: 360, height: 420 });
        await snap(page, "24-compact", suffix, false);
        await page.getByRole("button", { name: "Quitter le mode compact" }).click();
        await page.setViewportSize({ width: size.width, height: size.height });
      }
      await shoot(page, "25-print-80", `/desk/print/${tickets[2]!.id}`, suffix);
      await shoot(page, "26-print-58", `/desk/print/${tickets[2]!.id}?w=58`, suffix);
      await context.close();
    }
  });
}
