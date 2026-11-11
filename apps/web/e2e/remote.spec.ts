import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { expectAccessible, expectTouchTargets, signInViaUi } from "./helpers";
import { addDoctors, rpc, setUpBranch, supabaseOptions } from "./queue-helpers";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, supabaseOptions);
type Branch = Awaited<ReturnType<typeof setUpBranch>>;

// Agence à Akwa (Douala) ; client à environ 2 km.
const BRANCH = { lat: 4.05, lng: 9.7 };
const CLIENT = { latitude: 4.068, longitude: 9.7 };

/** Agence visible, ticket à distance (15 km au plus) et demandes de rendez-vous activés. */
async function remoteBranch(name: string) {
  const b = await setUpBranch(name);
  await rpc(b.staff, "set_branch_location", { p_branch: b.branchId, p_lat: BRANCH.lat, p_lng: BRANCH.lng });
  const { error } = await b.staff
    .from("branch_settings")
    .update({ remote_tickets_enabled: true, remote_max_distance_km: 15, appointment_requests_enabled: true })
    .eq("branch_id", b.branchId)
    .select("branch_id");
  expect(error).toBeNull();
  return b;
}

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

/**
 * Actions de « Mon ticket » à la fin du contenu, jamais fixées : aucune barre fixe en bas ; une fois la page
 * défilée jusqu'en bas, « Annuler le ticket » est visible, sous le reste du contenu.
 */
async function expectBottomBarClear(page: Page) {
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(300);
  expect(await page.locator("main .safe-bottom.fixed").count(), "aucune barre fixée en bas").toBe(0);
  const cancel = page.getByRole("button", { name: "Annuler le ticket" }).filter({ visible: true });
  await expect(cancel).toBeInViewport();
  const position = await cancel.evaluate((el) => getComputedStyle(el.parentElement!).position);
  expect(position).toBe("static");
}

async function takeRemote(page: Page, b: Branch) {
  await page.goto(`/b/${b.branchId}`);
  await page.getByRole("radio", { name: /Consultation/ }).click();
  await page.getByRole("button", { name: "Prendre un ticket à distance" }).click();
  await page.waitForURL(/\/t\/[A-Za-z0-9]{22}$/);
  return page.url().split("/t/")[1]!;
}

test.describe("M9 — ticket à distance", () => {
  test.use({ geolocation: CLIENT, permissions: ["geolocation"] });

  test("téléphone : à proximité → agence → ticket à distance → en route → présence confirmée au scan", async ({ page }, info) => {
    test.skip(info.project.name !== "mobile", "parcours client sur téléphone");
    const name = `Distance ${Date.now()}`;
    const b = await remoteBranch(name);

    await page.goto("/nearby");
    // Localisation déjà autorisée : reprise sans invite.
    await expect(page.getByText("Autour de vous")).toBeVisible();
    await page.getByRole("searchbox", { name: "Établissement ou ville" }).fill(name);
    const row = page.getByRole("link", { name: new RegExp(name) });
    // Style A : seul résultat = grande carte (distance sur la photo, tuile « À distance »).
    await expect(row).toContainText("2 km");
    await expect(row).toContainText("À distance");
    await expect(row).toContainText("Possible");
    await expectTouchTargets(page);
    await expectAccessible(page);
    await page.getByRole("button", { name: "Carte" }).click();
    await expect(page.getByRole("region", { name: "Carte des établissements à proximité" })).toBeVisible();
    await expect(page.getByRole("img", { name: "Vous" })).toBeVisible();
    await page.getByRole("button", { name: "Liste" }).click();
    await row.click();

    await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
    await expectTouchTargets(page);
    await expectAccessible(page);
    const token = await takeRemote(page, b);
    await expect(page.getByText("Quand partir")).toBeVisible();
    await expect(page.getByText(/Trajet : ≈ 8 min/)).toBeVisible();
    await expect(page.getByText(/Confirmez votre présence à l'arrivée/)).toBeVisible();
    await expectTouchTargets(page);
    await expectAccessible(page);

    // Trajet saisi par le client.
    await page.getByRole("button", { name: "Modifier" }).click();
    await page.getByRole("radio", { name: "30 min" }).click();
    await expect(page.getByText(/Trajet : ≈ 30 min/)).toBeVisible();

    await expectBottomBarClear(page);
    await page.getByRole("button", { name: "Je suis en route" }).click();
    await expect(page.getByText("En route", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Je suis arrivé · scanner le QR code" })).toBeVisible();
    await expectBottomBarClear(page);
    // Petit téléphone (360 × 640) : même contrôle.
    await page.setViewportSize({ width: 360, height: 640 });
    await expectBottomBarClear(page);

    // Arrivée : le QR code de l'accueil (ouvert par l'appareil photo) confirme la présence et ramène au ticket.
    await page.goto(`/q/${b.entryCode}`);
    await page.waitForURL(new RegExp(`/t/${token}$`));
    await expect(page.getByText("Présence confirmée : vous serez appelé à votre tour.")).toBeVisible();
    const { data } = await admin.from("tickets").select("presence_confirmed_at, remote_travel_seconds").eq("public_token", token).single();
    expect(data!.presence_confirmed_at).not.toBeNull();
    expect(data!.remote_travel_seconds).toBe(1800);
  });

  test("ordinateur : recul puis annulation sans présence confirmée, accueil", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "vue ordinateur");
    const b = await remoteBranch(`Recul ${Date.now()}`);
    const token = await takeRemote(page, b);
    for (let i = 0; i < 4; i++) await rpc(b.staff, "reception_create_ticket", { p_service: b.serviceId });

    // Accueil : ticket à distance signalé, confirmation possible.
    const staffPage = await page.context().newPage();
    await staffPage.goto(`/login?next=${encodeURIComponent(`/desk/reception/${b.branchId}`)}`);
    await signInViaUi(staffPage, b.email);
    await expect(staffPage.getByText("À distance · présence à confirmer")).toBeVisible();

    // Le cabinet appelle : le ticket à distance non confirmé recule de 3 places.
    const first = await rpc<{ display_code: string }>(b.staff, "call_next", { p_counter: b.counterId });
    expect(first.display_code).toBe("C-002");
    await expect(page.getByText("Ticket reculé · 1 sur 2")).toBeVisible({ timeout: 15_000 });
    await expect(staffPage.getByText(/Reculé 1 fois/)).toBeVisible({ timeout: 20_000 });

    // Confirmation par l'accueil (patient arrivé sans scanner).
    await staffPage.getByRole("button", { name: /^C-001/ }).click();
    await staffPage.getByRole("button", { name: "Confirmer la présence" }).click();
    await expect(page.getByText("Présence confirmée : vous serez appelé à votre tour.")).toBeVisible({ timeout: 15_000 });
    await staffPage.close();
    const { data } = await admin.from("tickets").select("status, delay_count").eq("public_token", token).single();
    expect(data).toEqual({ status: "waiting", delay_count: 1 });
  });

  test("budget : à proximité, agence, demande et ticket à distance < 200 Ko", async ({ browser }, info) => {
    test.skip(info.project.name !== "mobile", "pages client");
    const b = await remoteBranch(`Budget ${Date.now()}`);
    for (const path of ["/nearby", `/b/${b.branchId}`, `/b/${b.branchId}/rdv`]) {
      // Téléphone (cible des pages client, 3G) ; contexte neuf : aucun fichier en cache.
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
      const page = await context.newPage();
      const bytes = await firstLoadBytes(page, path);
      console.log(`${path.replace(/[0-9a-f-]{36}/, "…")} : ${Math.round(bytes / 1024)} Ko`);
      expect(bytes, path).toBeLessThan(200 * 1024);
      await context.close();
    }
  });
});

test.describe("M9 — demande de rendez-vous", () => {
  test("patient : demande + code par e-mail ; accueil : confirmation en un clic ; réponse et rappels par e-mail", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "accueil sur ordinateur (le patient utilise la même page responsive)");
    test.setTimeout(60_000);
    const b = await remoteBranch(`Demandes ${Date.now()}`);
    const { abena } = await addDoctors(b);
    const { error } = await b.staff.from("practitioner_schedules").insert(
      [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
        organization_id: b.orgId,
        branch_id: b.branchId,
        practitioner_id: abena,
        service_id: b.serviceId,
        weekday,
        starts_at: "08:00",
        ends_at: "12:00",
        slot_minutes: 30,
      })),
    );
    expect(error).toBeNull();

    // Patient : demain, premier créneau, Dr Abena.
    const email = `patient.${Date.now()}@exemple.cm`;
    const fillRequest = async () => {
      await page.goto(`/b/${b.branchId}`);
      await page.getByRole("link", { name: "Demander un rendez-vous" }).click();
      await page.getByRole("radio", { name: "Dr Abena" }).click();
      await page.getByRole("radiogroup", { name: "Jour" }).getByRole("radio").nth(1).click();
      await page.getByRole("radiogroup", { name: "Créneau" }).getByRole("radio", { name: "08:30" }).click();
      await page.getByLabel("Adresse e-mail").fill(email);
    };
    await fillRequest();
    // E-mail par défaut (WhatsApp désactivé dans la console) : texte clair, téléphone facultatif pour l'accueil.
    await expect(page.getByText("Vous recevrez un code, puis la réponse de l'accueil par e-mail. Pas d'e-mail ? Appelez l'établissement.")).toBeVisible();
    await page.getByLabel("Téléphone (facultatif)").fill(`699${String(Date.now()).slice(-6)}`);
    await page.getByLabel("Votre nom (facultatif)").fill("A.B.");
    await expectAccessible(page);
    await page.getByRole("button", { name: "Envoyer la demande" }).click();
    await page.waitForURL(/\/r\/[A-Za-z0-9]{22}$/);
    const token = page.url().split("/r/")[1]!;
    await expect(page.getByRole("heading", { name: "Vérifiez votre adresse e-mail" })).toBeVisible();
    // Adresse masquée sur la page du patient.
    await expect(page.getByText(`Saisissez le code à 6 chiffres envoyé à ${email[0]}•••@exemple.cm.`)).toBeVisible();
    await expectAccessible(page);

    const { data: request } = await admin.from("appointment_requests").select("id").eq("public_token", token).single();
    const code = async () => {
      const { data } = await admin
        .from("notification_jobs")
        .select("payload")
        .eq("appointment_request_id", request!.id)
        .eq("event", "request_code")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      return String((data!.payload as { code: string }).code);
    };
    await page.getByLabel("Code de vérification").fill("000000");
    await page.getByRole("button", { name: "Valider" }).click();
    await expect(page.getByText(/Code incorrect/)).toBeVisible();
    await page.getByLabel("Code de vérification").fill(await code());
    await page.getByRole("button", { name: "Valider" }).click();
    await expect(page.getByRole("heading", { name: "Demande envoyée" })).toBeVisible();
    // Le code n'est plus lisible dans la file d'envoi une fois vérifié.
    const { data: jobs } = await admin.from("notification_jobs").select("payload").eq("appointment_request_id", request!.id);
    expect(jobs!.every((j) => !("code" in (j.payload as object)))).toBe(true);

    await expect(page.getByText("L'accueil de", { exact: false }).filter({ hasText: "vous répond par e-mail" })).toBeVisible();
    // Même adresse, même créneau : refusé, message clair, aucune nouvelle demande.
    await fillRequest();
    await page.getByRole("button", { name: "Envoyer la demande" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Vous avez déjà une demande en attente pour ce créneau." }).first()).toBeVisible();
    const { count } = await admin
      .from("appointment_requests")
      .select("id", { count: "exact", head: true })
      .eq("branch_id", b.branchId)
      .in("status", ["unverified", "pending"]);
    expect(count).toBe(1);

    // Accueil : la demande arrive, confirmation en un clic.
    const staffPage = await page.context().newPage();
    const path = `/desk/reception/${b.branchId}/appointments`;
    await staffPage.goto(`/login?next=${encodeURIComponent(`${path}?view=requests`)}`);
    await signInViaUi(staffPage, b.email);
    await staffPage.getByRole("region", { name: "Demandes de rendez-vous" }).getByRole("button", { name: /08:30/ }).click();
    await expect(staffPage.getByText("A.B.", { exact: true })).toBeVisible();
    // Accueil : adresse en clair (personnel de l'agence uniquement).
    await expect(staffPage.getByText(email, { exact: true })).toBeVisible();
    await expectAccessible(staffPage);
    await staffPage.getByRole("button", { name: "Confirmer · 08:30 avec Dr Abena" }).click();
    await expect(staffPage.getByText("Aucune demande en attente.")).toBeVisible();
    await staffPage.close();

    await page.goto(`/r/${token}`);
    await expect(page.getByRole("heading", { name: "Rendez-vous confirmé" })).toBeVisible({ timeout: 25_000 });
    await expect(page.getByText(/avec Dr Abena/)).toBeVisible();
    const { data: accepted } = await admin.from("appointment_requests").select("status, appointment_id").eq("id", request!.id).single();
    expect(accepted!.status).toBe("accepted");
    const { data: answer } = await admin
      .from("notification_jobs")
      .select("event, channel, status")
      .eq("appointment_id", accepted!.appointment_id!)
      .in("event", ["request_accepted", "appointment_reminder_2h"]);
    // Réponse de l'accueil par e-mail (envoyée par le faux fournisseur console) ; rappel programmé par e-mail.
    expect(answer!.filter((j) => j.event === "request_accepted").map((j) => j.channel)).toEqual(["email"]);
    expect(answer!.every((j) => j.channel === "email")).toBe(true);
    // Aucun message WhatsApp pour le numéro donné à l'accueil.
    const { count: whatsapp } = await admin
      .from("notification_jobs")
      .select("id", { count: "exact", head: true })
      .or(`appointment_request_id.eq.${request!.id},appointment_id.eq.${accepted!.appointment_id!}`)
      .eq("channel", "whatsapp");
    expect(whatsapp).toBe(0);
  });
});
