import { writeFile } from "node:fs/promises";
import { test, type Browser, type Page } from "@playwright/test";
import { signInViaUi, signUpViaUi, uniqueEmail, verifyPhoneViaUi } from "./helpers";


// Captures M10a (abonnements) avec les données de démo (`pnpm seed:demo:local`) en téléphone, tablette (portrait et
// paysage) et ordinateur → docs/captures/m10a/, plus un exemple de facture PDF.
const OUT = "../../docs/captures/m10a";
const SIZES = {
  mobile: { width: 390, height: 844, isMobile: true },
  "tablet-portrait": { width: 820, height: 1180, isMobile: true },
  "tablet-landscape": { width: 1180, height: 820, isMobile: true },
  desktop: { width: 1440, height: 900, isMobile: false },
} as const;
type Size = keyof typeof SIZES;

async function shot(page: Page, name: string) {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
}

async function open(browser: Browser, size: Size, theme: "light" | "dark") {
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
  await page.waitForURL(/\/app$/);
}

async function orgId(page: Page, name: RegExp) {
  await page.goto("/app");
  await page.getByRole("link", { name }).first().click();
  await page.waitForURL(/\/app\/o\/[0-9a-f-]{36}/);
  return /\/app\/o\/([0-9a-f-]{36})/.exec(page.url())![1]!;
}

for (const size of Object.keys(SIZES) as Size[]) {
  test(`@screenshots abonnements M10a ${size}`, async ({ browser }, info) => {
    test.skip(info.project.name !== "desktop", "captures pilotées une seule fois");
    test.skip(!process.env.SEED_DEMO_PASSWORD, "données de démo requises (SEED_DEMO_PASSWORD)");
    test.setTimeout(240_000);
    for (const theme of size === "mobile" || size === "desktop" ? (["light", "dark"] as const) : (["light"] as const)) {
      // Abonnement payé (DOUALA CLINIC) : formules, utilisation, factures.
      const { context, page } = await open(browser, size, theme);
      await login(page, "directeur@doualaclinic.demo");
      const clinic = await orgId(page, /DOUALA CLINIC/);
      await page.goto(`/app/o/${clinic}/billing`);
      await page.getByRole("heading", { level: 1, name: "Abonnement" }).waitFor();
      await shot(page, `01-billing-active-${size}-${theme}`);
      await context.close();

      // Essai qui se termine (Eneo) : bandeau, puis lien de paiement.
      const eneo = await open(browser, size, theme);
      await login(eneo.page, "chef.agence@eneo.demo");
      const eneoId = await orgId(eneo.page, /Eneo/);
      await eneo.page.goto(`/app/o/${eneoId}/billing`);
      await eneo.page.getByRole("heading", { level: 1, name: "Abonnement" }).waitFor();
      await shot(eneo.page, `02-billing-trial-${size}-${theme}`);
      await eneo.context.close();

      // Console Wintek.
      const wintek = await open(browser, size, theme);
      await login(wintek.page, "superadmin@nextin.demo");
      await wintek.page.goto("/admin");
      await wintek.page.getByRole("heading", { level: 1, name: "Console Wintek" }).waitFor();
      await shot(wintek.page, `06-console-${size}-${theme}`);
      await wintek.page.getByRole("link", { name: /DOUALA CLINIC/ }).first().click();
      await wintek.page.waitForURL(/\/admin\/subscriptions\//);
      await shot(wintek.page, `07-console-subscription-${size}-${theme}`);
      if (size === "desktop" || size === "mobile") {
        await wintek.page.goto("/admin/plans");
        await wintek.page.getByRole("link", { name: /Pro/ }).first().click();
        await wintek.page.waitForURL(/\/admin\/plans\//);
        await shot(wintek.page, `08-console-plan-${size}-${theme}`);
        await wintek.page.goto("/admin/settings");
        await shot(wintek.page, `09-console-settings-${size}-${theme}`);
      }
      await wintek.context.close();

      // Inscription d'un nouvel établissement : téléphone, code, établissement, bienvenue.
      if ((size === "mobile" || size === "desktop") && theme === "light") {
        const signup = await open(browser, size, theme);
        await signUpViaUi(signup.page, { name: "Dr Essomba", email: uniqueEmail("capture-m10a") });
        await signup.page.goto("/app/new");
        await shot(signup.page, `10-signup-phone-${size}-${theme}`);
        await signup.page.getByLabel("Numéro de téléphone").fill("677554433");
        await signup.page.getByRole("button", { name: "Recevoir le code" }).click();
        await signup.page.getByRole("heading", { name: "Code de vérification" }).waitFor();
        await shot(signup.page, `11-signup-code-${size}-${theme}`);
        await signup.page.getByRole("button", { name: "Modifier le numéro" }).click();
        await verifyPhoneViaUi(signup.page);
        await signup.page.getByLabel("Nom de l'établissement").fill("Clinique Bonamoussadi");
        await signup.page.getByRole("radio", { name: "Clinique", exact: true }).click();
        await shot(signup.page, `12-signup-org-${size}-${theme}`);
        await signup.page.getByRole("button", { name: "Créer l'établissement" }).click();
        await signup.page.waitForURL(/welcome=1/);
        await shot(signup.page, `13-setup-welcome-${size}-${theme}`);
        // Paiement d'un essai tout neuf (faux fournisseur) : formulaire, validation sur le téléphone, réussite.
        await signup.page.goto(signup.page.url().replace(/\/setup.*$/, "/billing"));
        await signup.page.getByRole("button", { name: /^Payer/ }).click();
        await signup.page.waitForURL(/\/pay\//);
        await shot(signup.page, `03-pay-${size}-${theme}`);
        await signup.page.getByLabel("Numéro à débiter").fill("6 99 00 02 02");
        await signup.page.getByRole("button", { name: /^Payer/ }).click();
        await signup.page.getByRole("heading", { name: "Validez sur votre téléphone" }).waitFor();
        await signup.page.screenshot({ path: `${OUT}/04-pay-waiting-${size}-${theme}.png`, fullPage: true });
        await signup.page.getByRole("heading", { name: "Paiement reçu" }).waitFor({ timeout: 30_000 });
        await shot(signup.page, `05-pay-success-${size}-${theme}`);
        await signup.context.close();
      }
    }
  });
}

test("@screenshots exemple de facture PDF", async ({ browser }, info) => {
  test.skip(info.project.name !== "desktop", "une seule fois");
  test.skip(!process.env.SEED_DEMO_PASSWORD, "données de démo requises (SEED_DEMO_PASSWORD)");
  const { context, page } = await open(browser, "desktop", "light");
  await login(page, "directeur@doualaclinic.demo");
  const clinic = await orgId(page, /DOUALA CLINIC/);
  await page.goto(`/app/o/${clinic}/billing`);
  const href = await page.getByRole("link", { name: /FAC-\d{4}-\d{6}/ }).first().getAttribute("href");
  const pdf = await page.request.get(href!);
  await writeFile(`${OUT}/facture-exemple.pdf`, await pdf.body());
  await context.close();
});
