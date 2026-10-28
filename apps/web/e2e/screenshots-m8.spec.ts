import { test, type Page } from "@playwright/test";
import { signInViaUi } from "./helpers";

// Captures M8 (tableau de bord) avec les données de démo (`pnpm seed:demo:local`, compte directeur de DOUALA CLINIC)
// en téléphone, tablette (portrait et paysage) et ordinateur → docs/captures/m8/.
const OUT = "../../docs/captures/m8";
const SIZES = {
  mobile: { width: 390, height: 844, isMobile: true },
  "tablet-portrait": { width: 820, height: 1180, isMobile: true },
  "tablet-landscape": { width: 1180, height: 820, isMobile: true },
  desktop: { width: 1440, height: 900, isMobile: false },
} as const;
type Size = keyof typeof SIZES;

async function shot(page: Page, name: string) {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
}

for (const size of Object.keys(SIZES) as Size[]) {
  test(`@screenshots tableau de bord M8 ${size}`, async ({ browser }, info) => {
    test.skip(info.project.name !== "desktop", "captures pilotées une seule fois");
    test.skip(!process.env.SEED_DEMO_PASSWORD, "données de démo requises (SEED_DEMO_PASSWORD)");
    test.setTimeout(120_000);
    for (const theme of size === "mobile" || size === "desktop" ? (["light", "dark"] as const) : (["light"] as const)) {
      const s = SIZES[size];
      const context = await browser.newContext({
        colorScheme: theme,
        viewport: { width: s.width, height: s.height },
        deviceScaleFactor: 2,
        isMobile: s.isMobile,
        hasTouch: s.isMobile,
        locale: "fr-FR",
      });
      const page = await context.newPage();
      await page.goto("/login?next=%2Fapp");
      await signInViaUi(page, "directeur@doualaclinic.demo", process.env.SEED_DEMO_PASSWORD);
      await page.waitForURL(/\/app/);
      await page.getByRole("link", { name: /DOUALA CLINIC/ }).first().click();
      await page.getByRole("heading", { name: "Aujourd'hui" }).waitFor();
      await shot(page, `01-today-${size}-${theme}`);
      // Veille : journée complète (historique de démo).
      await page.getByRole("button", { name: "Période précédente" }).click();
      await page.getByRole("button", { name: "Revenir à aujourd'hui" }).waitFor();
      await shot(page, `02-yesterday-${size}-${theme}`);
      if (theme === "light") {
        await page.getByRole("button", { name: "Revenir à aujourd'hui" }).click();
        await page.getByRole("radio", { name: "Semaine" }).click();
        await page.getByRole("heading", { name: "Cette semaine" }).waitFor();
        await page.getByRole("radio", { name: "Semaine" }).click();
        await page.getByRole("button", { name: "Période précédente" }).click();
        await page.getByRole("heading", { name: /^Semaine du / }).waitFor();
        await shot(page, `03-week-${size}-${theme}`);
        await page.getByRole("radio", { name: "Mois" }).click();
        await page.getByRole("heading", { name: "Ce mois-ci" }).waitFor();
        await shot(page, `04-month-${size}-${theme}`);
      }
      await context.close();
    }
  });
}
