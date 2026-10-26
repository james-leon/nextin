import { test, type Page } from "@playwright/test";

// Captures M2 (back-office) à partir des données de démo (pnpm seed:demo:local) → docs/captures/m2/.
const OUT = "../../docs/captures/m2";

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill("directeur@doualaclinic.demo");
  await page.getByLabel("Mot de passe", { exact: true }).fill(process.env.SEED_DEMO_PASSWORD!);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.waitForURL(/\/app$/);
  await page.getByRole("link", { name: /DOUALA CLINIC/ }).click();
  await page.waitForURL(/\/app\/o\/[0-9a-f-]+$/);
  return new URL(page.url()).pathname;
}

for (const theme of ["light", "dark"] as const) {
  test(`@screenshots back-office M2 ${theme}`, async ({ browser }, info) => {
    test.skip(!process.env.SEED_DEMO_PASSWORD, "données de démo requises");
    const mobile = info.project.name === "mobile";
    const context = await browser.newContext({
      colorScheme: theme,
      viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 860 },
      deviceScaleFactor: 2,
      locale: "fr-FR",
    });
    const page = await context.newPage();
    const root = await login(page);
    const device = mobile ? "mobile" : "desktop";
    const shot = async (name: string) => {
      await page.waitForLoadState("networkidle");
      await page.screenshot({ path: `${OUT}/${name}-${device}-${theme}.png`, fullPage: mobile });
    };
    await shot("overview");
    await page.goto(`${root}/branches`);
    await page.getByRole("main").getByRole("link", { name: /Akwa/ }).click();
    await page.waitForURL(/branches\/[0-9a-f-]+$/);
    const branch = new URL(page.url()).pathname;
    await shot("branch");
    await page.goto(`${branch}/services`);
    await shot("services");
    await page.getByRole("main").getByRole("link", { name: /Pédiatrie/ }).click();
    await shot("service-edit");
    await page.goto(`${branch}/counters`);
    await shot("counters");
    await page.goto(`${branch}/qr`);
    await shot("qr");
    await page.goto(`${root}/practitioners`);
    await shot("practitioners");
    await page.goto(`${root}/staff`);
    await shot("staff");
    await context.close();
  });
}
