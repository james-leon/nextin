import { mkdirSync } from "node:fs";
import { test, type Page } from "@playwright/test";
import { admin, pairDisplay } from "./ads-helpers";
import { signInViaUi } from "./helpers";
import { setUpBranch } from "./queue-helpers";

// Captures « avant / après » des correctifs de navigation (docs/captures/ux-navigation/, UX_PHASE=before|after) :
// 700 ms après le toucher d'un lien, réseau ralenti de 2 s ; pied de l'écran TV d'une agence sans ticket à distance.
const PHASE = process.env.UX_PHASE ?? "after";
const OUT = `../../docs/captures/ux-navigation`;
const SIZES = [
  { tag: "390", width: 390, height: 844, mobile: true },
  { tag: "1440", width: 1440, height: 900, mobile: false },
] as const;

async function slowDown(page: Page, pattern: RegExp) {
  await page.route(pattern, async (route) => {
    await new Promise((r) => setTimeout(r, 2_000));
    await route.continue();
  });
}

test("@screenshots navigation et écran TV", async ({ browser }, info) => {
  test.skip(info.project.name !== "desktop", "une passe suffit : les tailles sont fixées ici");
  test.setTimeout(300_000);
  mkdirSync(OUT, { recursive: true });
  const b = await setUpBranch(`Clinique Navigation ${Date.now()}`);
  const { data: org } = await admin.from("organizations").select("name").eq("id", b.orgId).single();
  for (const size of SIZES) {
    for (const theme of ["light", "dark"] as const) {
      const context = await browser.newContext({
        viewport: { width: size.width, height: size.height },
        isMobile: size.mobile,
        hasTouch: size.mobile,
        colorScheme: theme,
        locale: "fr-FR",
      });
      const page = await context.newPage();
      await page.goto(`/login?next=${encodeURIComponent("/app")}`);
      await signInViaUi(page, b.email);
      await page.waitForURL(/\/app$/);
      await slowDown(page, new RegExp(`/app/o/${b.orgId}`));
      await page.getByRole("link", { name: new RegExp(org!.name) }).first().click();
      await page.waitForTimeout(700);
      await page.screenshot({ path: `${OUT}/${PHASE}-01-etablissements-${size.tag}-${theme}.png` });
      await page.unrouteAll({ behavior: "ignoreErrors" });

      await page.goto("/");
      await slowDown(page, /\/nearby/);
      await page.getByRole("link", { name: "À proximité" }).filter({ visible: true }).first().click();
      await page.waitForTimeout(700);
      await page.screenshot({ path: `${OUT}/${PHASE}-02-onglet-client-${size.tag}-${theme}.png` });
      await context.close();
    }
  }

  const tv = await browser.newContext({ viewport: { width: 1920, height: 1080 }, locale: "fr-FR" });
  const page = await tv.newPage();
  const device = await pairDisplay(page.request, b.staff, b.branchId, false);
  await page.addInitScript((t) => localStorage.setItem("nextin-tv-token", t), device);
  await page.goto("/tv");
  await page.getByText("Scannez le QR code", { exact: false }).waitFor({ timeout: 15_000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/${PHASE}-03-ecran-tv-sans-distance.png` });
  await tv.close();
});
