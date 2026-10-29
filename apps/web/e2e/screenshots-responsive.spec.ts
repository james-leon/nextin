import { mkdir } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { test, type Browser, type Page } from "@playwright/test";
import { fullPageShot, signInViaUi } from "./helpers";
import { supabaseOptions } from "./queue-helpers";

/**
 * Revue responsive (`docs/REVUE-RESPONSIVE.md`) : captures des écrans du personnel, des pages client et de l'écran TV.
 * `RESPONSIVE_PHASE=before` (P1) ou `before-p2` → docs/captures/responsive/<phase>/<écran>-<taille>.png (clair) ;
 * `after` (défaut) → docs/captures/responsive/<écran>-<taille>.png et <écran>-<taille>-dark.png.
 * `RESPONSIVE_ONLY=01-home,30-` : seulement les écrans dont le nom commence par l'un de ces préfixes.
 * À lancer sur une base propre (`pnpm db:reset` puis `pnpm seed:demo:local`) : seules les données de démo apparaissent.
 */
const PHASE = process.env.RESPONSIVE_PHASE?.startsWith("before") ? process.env.RESPONSIVE_PHASE : "after";
const OUT = PHASE === "after" ? "../../docs/captures/responsive" : `../../docs/captures/responsive/${PHASE}`;
const THEMES: ("light" | "dark")[] =
  PHASE !== "after" || process.env.RESPONSIVE_THEMES === "light" ? ["light"] : ["light", "dark"];
const ONLY = process.env.RESPONSIVE_ONLY?.split(",").filter(Boolean) ?? [];
const wanted = (name: string) => !ONLY.length || ONLY.some((prefix) => name.startsWith(prefix));
const SIZES = {
  "390": { width: 390, height: 844, mobile: true, scale: 2 },
  "820": { width: 820, height: 1180, mobile: true, scale: 1 },
  "1180": { width: 1180, height: 820, mobile: true, scale: 1 },
  "1440": { width: 1440, height: 900, mobile: false, scale: 1 },
  "1920": { width: 1920, height: 1080, mobile: false, scale: 1 },
} as const;
type Size = keyof typeof SIZES;
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, supabaseOptions);

async function demoIds() {
  const { data: org } = await admin.from("organizations").select("id").eq("slug", "douala-clinic").single();
  const { data: branch } = await admin.from("branches").select("id").eq("organization_id", org!.id).eq("name", "Akwa").single();
  const { data: counter } = await admin.from("counters").select("id").eq("branch_id", branch!.id).eq("kind", "cabinet").eq("number", 1).single();
  const { data: service } = await admin.from("services").select("id").eq("branch_id", branch!.id).order("sort_order").limit(1).single();
  const { data: practitioner } = await admin.from("practitioners").select("id").eq("organization_id", org!.id).order("display_name").limit(1).single();
  const { data: ticket } = await admin.from("tickets").select("id").eq("branch_id", branch!.id).order("created_at", { ascending: false }).limit(1).single();
  const { data: qr } = await admin.from("qr_codes").select("token").eq("branch_id", branch!.id).is("service_id", null).eq("active", true).single();
  return {
    orgId: org!.id,
    branchId: branch!.id,
    counterId: counter!.id,
    serviceId: service!.id,
    practitionerId: practitioner!.id,
    ticketId: ticket!.id,
    entryCode: qr!.token as string,
  };
}

type Shot = { name: string; path: string; full?: boolean; prepare?: (page: Page) => Promise<void> };

function screens(ids: Awaited<ReturnType<typeof demoIds>>): Record<string, Shot[]> {
  const root = `/app/o/${ids.orgId}`;
  const b = `${root}/branches/${ids.branchId}`;
  return {
    "directeur@doualaclinic.demo": [
      { name: "01-home", path: "/app" },
      {
        name: "02-dashboard",
        path: root,
        prepare: async (page) => {
          const month = page.getByRole("radio", { name: "Mois" });
          if (await month.count()) await month.first().click();
        },
      },
      { name: "03-branches", path: `${root}/branches` },
      { name: "04-branch", path: b },
      { name: "05-services", path: `${b}/services` },
      { name: "06-service", path: `${b}/services/${ids.serviceId}` },
      { name: "07-counters", path: `${b}/counters` },
      { name: "08-practitioners", path: `${root}/practitioners` },
      { name: "09-practitioner", path: `${root}/practitioners/${ids.practitionerId}` },
      { name: "10-staff", path: `${root}/staff` },
      { name: "11-displays", path: `${b}/displays` },
      { name: "12-branch-settings", path: `${b}/settings` },
      { name: "13-org-ads", path: `${root}/ads` },
      { name: "14-billing", path: `${root}/billing` },
      { name: "15-settings", path: "/app/settings" },
    ],
    "accueil@doualaclinic.demo": [
      { name: "16-desk-choice", path: "/desk" },
      { name: "17-reception", path: `/desk/reception/${ids.branchId}`, full: false },
      { name: "18-appointments", path: `/desk/reception/${ids.branchId}/appointments`, full: false },
      {
        name: "19-appointments-week",
        path: `/desk/reception/${ids.branchId}/appointments`,
        full: false,
        prepare: async (page) => {
          await page.getByRole("radio", { name: "Semaine" }).click();
        },
      },
      { name: "20-print", path: `/desk/print/${ids.ticketId}` },
    ],
    "dr.mbarga@doualaclinic.demo": [{ name: "21-desk-counter", path: `/desk/counter/${ids.counterId}`, full: false }],
    "marketing@saveurs-littoral.demo": [
      { name: "22-ads-new", path: "/ads/campaigns/new" },
      { name: "23-ads-redeem", path: "/ads/redeem" },
    ],
    "superadmin@nextin.demo": [{ name: "24-admin", path: "/admin" }],
  };
}

async function open(browser: Browser, size: Size, theme: "light" | "dark") {
  const s = SIZES[size];
  const context = await browser.newContext({
    colorScheme: theme,
    viewport: { width: s.width, height: s.height },
    deviceScaleFactor: s.scale,
    isMobile: s.mobile,
    hasTouch: s.mobile,
    locale: "fr-FR",
  });
  return { context, page: await context.newPage() };
}

for (const size of Object.keys(SIZES) as Size[]) {
  test(`@screenshots responsive ${size}`, async ({ browser }, info) => {
    test.skip(info.project.name !== "desktop", "captures pilotées une seule fois");
    test.skip(!process.env.SEED_DEMO_PASSWORD, "données de démo requises (SEED_DEMO_PASSWORD)");
    test.setTimeout(900_000);
    await mkdir(OUT, { recursive: true });
    const ids = await demoIds();
    for (const theme of THEMES) {
      for (const [email, shots] of Object.entries(screens(ids))) {
        if (!shots.some((x) => wanted(x.name))) continue;
        const { context, page } = await open(browser, size, theme);
        await page.goto("/login");
        await signInViaUi(page, email, process.env.SEED_DEMO_PASSWORD!);
        await page.waitForURL((u) => !u.pathname.startsWith("/login"));
        for (const shot of shots.filter((x) => wanted(x.name))) {
          await page.goto(shot.path);
          await page.waitForLoadState("networkidle");
          if (shot.prepare) await shot.prepare(page);
          await page.waitForTimeout(700);
          const file = `${OUT}/${shot.name}-${size}${theme === "dark" ? "-dark" : ""}.png`;
          if (shot.full === false) await page.screenshot({ path: file });
          else await fullPageShot(page, file);
        }
        await context.close();
      }
    }
  });
}

/** Pages client (visiteur anonyme), avec un vrai ticket pris dans l'agence de démo. */
for (const size of Object.keys(SIZES) as Size[]) {
  test(`@screenshots responsive client ${size}`, async ({ browser }, info) => {
    test.skip(info.project.name !== "desktop", "captures pilotées une seule fois");
    test.skip(!process.env.SEED_DEMO_PASSWORD, "données de démo requises (SEED_DEMO_PASSWORD)");
    test.setTimeout(600_000);
    await mkdir(OUT, { recursive: true });
    const ids = await demoIds();
    for (const theme of THEMES) {
      const { context, page } = await open(browser, size, theme);
      // Ticket en attente des données de démo (l'agence peut être fermée à l'heure des captures).
      const { data: waiting } = await admin
        .from("tickets")
        .select("public_token")
        .eq("branch_id", ids.branchId)
        .eq("status", "waiting")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      const token = waiting!.public_token as string;
      const shots: Shot[] = [
        { name: "30-scanner", path: "/", full: false },
        { name: "31-code", path: "/c" },
        { name: "32-service-choice", path: `/q/${ids.entryCode}` },
        { name: "33-ticket", path: `/t/${token}`, full: false },
        { name: "34-nearby", path: "/nearby", full: false },
        { name: "35-branch", path: `/b/${ids.branchId}` },
        { name: "36-profile", path: "/profile" },
      ];
      for (const shot of shots.filter((x) => wanted(x.name))) {
        await page.goto(shot.path);
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(shot.name === "33-ticket" ? 4_000 : 700);
        const file = `${OUT}/${shot.name}-${size}${theme === "dark" ? "-dark" : ""}.png`;
        if (shot.full === false) await page.screenshot({ path: file });
        else await fullPageShot(page, file);
      }
      await context.close();
    }
  });
}

/** Écran TV de la salle d'attente (appairé pour l'occasion) en 1280 × 720 et 3840 × 2160. */
test("@screenshots responsive : écran TV en 720p et 4K", async ({ browser, request }, info) => {
  test.skip(info.project.name !== "desktop", "captures pilotées une seule fois");
  test.skip(!process.env.SEED_DEMO_PASSWORD, "données de démo requises (SEED_DEMO_PASSWORD)");
  test.skip(!wanted("26-tv"), "écran non demandé");
  test.setTimeout(300_000);
  await mkdir(OUT, { recursive: true });
  const ids = await demoIds();
  const staff = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, supabaseOptions);
  await staff.auth.signInWithPassword({ email: "directeur@doualaclinic.demo", password: process.env.SEED_DEMO_PASSWORD! });
  const pairing = (await (await request.post("/api/tv/pair")).json()) as { displayId: string; code: string; pollSecret: string };
  await staff.rpc("pair_display", { p_code: pairing.code, p_branch: ids.branchId, p_name: "Salle d'attente (captures)", p_service_ids: null, p_show_ads: false });
  const { deviceToken } = (await (await request.post("/api/tv/pair/poll", { data: { displayId: pairing.displayId, pollSecret: pairing.pollSecret } })).json()) as {
    deviceToken: string;
  };
  for (const [w, h] of [
    [1280, 720],
    [3840, 2160],
  ] as const) {
    const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, locale: "fr-FR" });
    await context.addInitScript((token) => localStorage.setItem("nextin-tv-token", token), deviceToken);
    const page = await context.newPage();
    await page.goto("/tv");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2_000);
    await page.screenshot({ path: `${OUT}/26-tv-${w}x${h}.png` });
    await context.close();
  }
  await staff.rpc("revoke_display", { p_display: pairing.displayId }).then(() => undefined, () => undefined);
});

test("@screenshots responsive : mode compact du poste dans une fenêtre de 400 × 600", async ({ browser }, info) => {
  test.skip(info.project.name !== "desktop", "captures pilotées une seule fois");
  test.skip(!wanted("25-desk-compact"), "écran non demandé");
  test.skip(!process.env.SEED_DEMO_PASSWORD, "données de démo requises (SEED_DEMO_PASSWORD)");
  await mkdir(OUT, { recursive: true });
  const ids = await demoIds();
  for (const theme of THEMES) {
    const context = await browser.newContext({ colorScheme: theme, viewport: { width: 400, height: 600 }, locale: "fr-FR" });
    await context.addInitScript(() => {
      try {
        localStorage.setItem("nextin.desk.compact", "1");
      } catch {}
    });
    const page = await context.newPage();
    await page.goto("/login");
    await signInViaUi(page, "dr.mbarga@doualaclinic.demo", process.env.SEED_DEMO_PASSWORD!);
    await page.waitForURL((u) => !u.pathname.startsWith("/login"));
    await page.goto(`/desk/counter/${ids.counterId}`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${OUT}/25-desk-compact-400x600${theme === "dark" ? "-dark" : ""}.png` });
    await context.close();
  }
});
