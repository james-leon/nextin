import { mkdir } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { test, type Browser, type Page } from "@playwright/test";
import { fullPageShot, signInViaUi } from "./helpers";
import { anonClient, rpc, setUpBranch, supabaseOptions } from "./queue-helpers";

// Captures du backlog avant et après correction (`BACKLOG_PHASE=before|after`) → docs/captures/backlog/<phase>/.
// Écrans du personnel (données de démo) et pages client touchées, en 390, 820 et 1440 px.
const PHASE = process.env.BACKLOG_PHASE === "after" ? "after" : "before";
const OUT = `../../docs/captures/backlog/${PHASE}`;
const SIZES = {
  mobile: { width: 390, height: 844, isMobile: true },
  tablet: { width: 820, height: 1180, isMobile: true },
  desktop: { width: 1440, height: 900, isMobile: false },
} as const;
type Size = keyof typeof SIZES;
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, supabaseOptions);

async function open(browser: Browser, size: Size, theme: "light" | "dark" = "light") {
  const s = SIZES[size];
  const context = await browser.newContext({
    colorScheme: theme,
    viewport: { width: s.width, height: s.height },
    deviceScaleFactor: 2,
    isMobile: s.isMobile,
    hasTouch: s.isMobile,
    locale: "fr-FR",
  });
  return { context, page: await context.newPage() };
}

async function login(page: Page, email: string) {
  await page.goto("/login");
  await signInViaUi(page, email, process.env.SEED_DEMO_PASSWORD!);
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
}

async function shot(page: Page, name: string, size: Size, full = true) {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(600);
  const path = `${OUT}/${name}-${size}.png`;
  if (full) await fullPageShot(page, path);
  else await page.screenshot({ path });
}

async function demoIds() {
  const { data: org } = await admin.from("organizations").select("id").eq("slug", "douala-clinic").single();
  const { data: branch } = await admin.from("branches").select("id").eq("organization_id", org!.id).eq("name", "Akwa").single();
  const { data: counter } = await admin
    .from("counters")
    .select("id")
    .eq("branch_id", branch!.id)
    .eq("kind", "cabinet")
    .eq("number", 1)
    .single();
  const { data: ticket } = await admin.from("tickets").select("id").eq("branch_id", branch!.id).order("created_at", { ascending: false }).limit(1).single();
  return { orgId: org!.id, branchId: branch!.id, counterId: counter!.id, ticketId: ticket!.id };
}

for (const size of Object.keys(SIZES) as Size[]) {
  test(`@screenshots backlog personnel ${size}`, async ({ browser }, info) => {
    test.skip(info.project.name !== "desktop", "captures pilotées une seule fois");
    test.skip(!process.env.SEED_DEMO_PASSWORD, "données de démo requises (SEED_DEMO_PASSWORD)");
    test.setTimeout(600_000);
    await mkdir(OUT, { recursive: true });
    const ids = await demoIds();
    const root = `/app/o/${ids.orgId}`;
    const b = `${root}/branches/${ids.branchId}`;

    // Directeur : accueil, tableau de bord (vue mois), back-office.
    const director = await open(browser, size);
    await login(director.page, "directeur@doualaclinic.demo");
    await director.page.goto("/app");
    await shot(director.page, "01-app-home", size);
    await director.page.goto(root);
    const month = director.page.getByRole("radio", { name: "Mois" });
    if (await month.count()) await month.first().click();
    await shot(director.page, "02-dashboard-month", size);
    const pages: [string, string][] = [
      ["03-branches", `${root}/branches`],
      ["04-branch", b],
      ["05-services", `${b}/services`],
      ["06-counters", `${b}/counters`],
      ["07-practitioners", `${root}/practitioners`],
      ["08-staff", `${root}/staff`],
      ["09-displays", `${b}/displays`],
      ["10-branch-settings", `${b}/settings`],
      ["11-org-ads", `${root}/ads`],
      ["12-billing", `${root}/billing`],
      ["13-settings", "/app/settings"],
    ];
    for (const [name, path] of pages) {
      await director.page.goto(path);
      await shot(director.page, name, size);
    }
    await director.context.close();

    // Accueil : postes, accueil, rendez-vous, ticket imprimé.
    const reception = await open(browser, size);
    await login(reception.page, "accueil@doualaclinic.demo");
    await reception.page.goto("/desk");
    await shot(reception.page, "14-desk-choice", size);
    await reception.page.goto(`/desk/reception/${ids.branchId}`);
    await shot(reception.page, "15-reception", size, false);
    await reception.page.goto(`/desk/reception/${ids.branchId}/appointments`);
    await shot(reception.page, "16-appointments", size, false);
    await reception.page.goto(`/desk/print/${ids.ticketId}`);
    await shot(reception.page, "17-print", size);
    await reception.context.close();

    // Médecin : poste du cabinet 1.
    const doctor = await open(browser, size);
    await login(doctor.page, "dr.mbarga@doualaclinic.demo");
    await doctor.page.goto(`/desk/counter/${ids.counterId}`);
    await shot(doctor.page, "18-desk-counter", size, false);
    await doctor.context.close();

    // Annonceur : validation des bons ; console : modération.
    const adv = await open(browser, size);
    await login(adv.page, "marketing@saveurs-littoral.demo");
    await adv.page.goto("/ads/redeem");
    await shot(adv.page, "19-ads-redeem", size);
    await adv.page.goto("/ads/campaigns/new");
    await shot(adv.page, "20-ads-new", size);
    await adv.context.close();
  });

  test(`@screenshots backlog client ${size}`, async ({ browser }, info) => {
    test.skip(info.project.name !== "desktop", "captures pilotées une seule fois");
    test.setTimeout(180_000);
    await mkdir(OUT, { recursive: true });
    const branch = await setUpBranch(`Clinique Backlog ${size}`);
    const visitor = anonClient();
    const { data } = await visitor.auth.signInAnonymously();
    const { context, page } = await open(browser, size);
    const res = await page.request.post("/api/tickets", {
      headers: { Authorization: `Bearer ${data.session!.access_token}` },
      data: { serviceId: branch.serviceId, source: "qr", entryCode: branch.entryCode },
    });
    const token = ((await res.json()) as { ticket: { publicToken: string } }).ticket.publicToken;
    await page.goto(`/t/${token}`);
    await page.waitForTimeout(4_500);
    await shot(page, "30-ticket-waiting", size, false);
    await rpc(branch.staff, "call_next", { p_counter: branch.counterId });
    await page.getByText("C'est votre tour").first().waitFor();
    await shot(page, "31-ticket-called", size, false);
    await page.goto("/nearby");
    await shot(page, "32-nearby", size, false);
    await context.close();
  });
}
