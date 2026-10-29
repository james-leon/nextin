import { mkdir } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { test, type Browser, type Page } from "@playwright/test";
import { fullPageShot, signInViaUi } from "./helpers";
import { supabaseOptions } from "./queue-helpers";

/**
 * Revue responsive (`docs/REVUE-RESPONSIVE.md`) : captures des écrans du personnel dans les cinq tailles.
 * `RESPONSIVE_PHASE=before` → docs/captures/responsive/before/<écran>-<taille>.png (clair) ;
 * `after` (défaut) → docs/captures/responsive/<écran>-<taille>.png et <écran>-<taille>-dark.png.
 * À lancer sur une base propre (`pnpm db:reset` puis `pnpm seed:demo:local`) : seules les données de démo apparaissent.
 */
const PHASE = process.env.RESPONSIVE_PHASE === "before" ? "before" : "after";
const OUT = PHASE === "before" ? "../../docs/captures/responsive/before" : "../../docs/captures/responsive";
const THEMES: ("light" | "dark")[] =
  PHASE === "before" || process.env.RESPONSIVE_THEMES === "light" ? ["light"] : ["light", "dark"];
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
  return { orgId: org!.id, branchId: branch!.id, counterId: counter!.id, serviceId: service!.id, practitionerId: practitioner!.id, ticketId: ticket!.id };
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
        const { context, page } = await open(browser, size, theme);
        await page.goto("/login");
        await signInViaUi(page, email, process.env.SEED_DEMO_PASSWORD!);
        await page.waitForURL((u) => !u.pathname.startsWith("/login"));
        for (const shot of shots) {
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

test("@screenshots responsive : mode compact du poste dans une fenêtre de 400 × 600", async ({ browser }, info) => {
  test.skip(info.project.name !== "desktop", "captures pilotées une seule fois");
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
