import { test, type Browser, type Page } from "@playwright/test";
import { admin, branchWithCampaign, pairDisplay, takeTicket } from "./ads-helpers";
import { fullPageShot, signInViaUi } from "./helpers";
import { rpc } from "./queue-helpers";

// Captures M10b (publicité, jeux, bons) → docs/captures/m10b/. Espace annonceur, console et back-office avec les
// données de démo (`pnpm seed:demo:local`) ; pages client et écran TV sur une agence de test avec une campagne Or.
const OUT = "../../docs/captures/m10b";
const SIZES = {
  mobile: { width: 390, height: 844, isMobile: true },
  "tablet-portrait": { width: 820, height: 1180, isMobile: true },
  "tablet-landscape": { width: 1180, height: 820, isMobile: true },
  desktop: { width: 1440, height: 900, isMobile: false },
} as const;
type Size = keyof typeof SIZES;

async function shot(page: Page, name: string, full = true) {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(700);
  if (full) await fullPageShot(page, `${OUT}/${name}.png`);
  else await page.screenshot({ path: `${OUT}/${name}.png` });
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

const themes = (size: Size) => (size === "mobile" || size === "desktop" ? (["light", "dark"] as const) : (["light"] as const));

for (const size of Object.keys(SIZES) as Size[]) {
  test(`@screenshots publicité M10b ${size}`, async ({ browser }, info) => {
    test.skip(info.project.name !== "desktop", "captures pilotées une seule fois");
    test.skip(!process.env.SEED_DEMO_PASSWORD, "données de démo requises (SEED_DEMO_PASSWORD)");
    test.setTimeout(300_000);
    for (const theme of themes(size)) {
      // Espace annonceur (Saveurs du Littoral, formule Or diffusée).
      const adv = await open(browser, size, theme);
      await login(adv.page, "marketing@saveurs-littoral.demo");
      await adv.page.goto("/ads");
      await adv.page.getByRole("heading", { level: 1, name: "Campagnes" }).waitFor();
      await shot(adv.page, `01-campaigns-${size}-${theme}`);
      await adv.page.getByRole("link", { name: /Petit-déjeuner du Littoral/ }).first().click();
      await adv.page.waitForURL(/\/ads\/campaigns\/[0-9a-f-]{36}$/);
      await shot(adv.page, `02-campaign-active-${size}-${theme}`);
      await adv.page.goto("/ads/campaigns/new");
      await adv.page.getByRole("radio", { name: /Argent/ }).waitFor();
      await shot(adv.page, `03-campaign-new-${size}-${theme}`);
      await adv.page.goto("/ads/redeem");
      await shot(adv.page, `04-redeem-${size}-${theme}`);
      await adv.context.close();

      // Console Wintek : modération (pharmacie en attente, visa santé), formules et secteurs.
      const wintek = await open(browser, size, theme);
      await login(wintek.page, "superadmin@nextin.demo");
      await wintek.page.goto("/admin/ads");
      await wintek.page.getByRole("heading", { level: 1, name: "Publicité" }).waitFor();
      await shot(wintek.page, `05-moderation-${size}-${theme}`);
      await wintek.page.getByRole("link", { name: /Semaine de la vitamine C/ }).first().click();
      await wintek.page.waitForURL(/\/admin\/ads\/[0-9a-f-]{36}$/);
      await shot(wintek.page, `06-review-${size}-${theme}`);
      await wintek.page.goto("/admin/ads/packages");
      await shot(wintek.page, `07-packages-${size}-${theme}`);
      await wintek.context.close();

      // Établissement : préférences et annonces Maison.
      const clinic = await open(browser, size, theme);
      await login(clinic.page, "directeur@doualaclinic.demo");
      await clinic.page.getByRole("link", { name: /DOUALA CLINIC/ }).first().click();
      await clinic.page.waitForURL(/\/app\/o\/[0-9a-f-]{36}/);
      const orgId = /\/app\/o\/([0-9a-f-]{36})/.exec(clinic.page.url())![1]!;
      await clinic.page.goto(`/app/o/${orgId}/ads`);
      await clinic.page.getByRole("heading", { level: 1, name: "Publicité" }).waitFor();
      await shot(clinic.page, `08-org-ads-${size}-${theme}`);
      await clinic.context.close();
    }
  });
}

for (const size of ["mobile", "tablet-portrait", "desktop"] as const) {
  test(`@screenshots jeux et bons M10b ${size}`, async ({ browser }, info) => {
    test.skip(info.project.name !== "desktop", "captures pilotées une seule fois");
    test.setTimeout(240_000);
    for (const theme of themes(size)) {
      const { b } = await branchWithCampaign(`Captures ${size} ${theme}`);
      const { context, page } = await open(browser, size, theme);
      const token = await takeTicket(page, b);
      await page.goto(`/t/${token}`);
      await page.getByRole("button", { name: "Choisir un jeu" }).waitFor({ timeout: 15_000 });
      await page.mouse.wheel(0, 2000);
      await page.getByRole("complementary", { name: "Sponsorisé" }).waitFor({ timeout: 15_000 });
      await page.evaluate(() => window.scrollTo(0, 0));
      await shot(page, `09-ticket-ads-${size}-${theme}`);

      await page.getByRole("button", { name: "Choisir un jeu" }).click();
      const sheet = page.getByRole("dialog");
      await sheet.getByRole("button", { name: /^Quiz/ }).waitFor();
      await shot(page, `10-games-${size}-${theme}`, false);
      await sheet.getByRole("button", { name: /^Quiz/ }).click();
      await sheet.getByRole("radio", { name: "Bleu" }).click();
      await shot(page, `11-quiz-${size}-${theme}`, false);
      await sheet.getByRole("button", { name: "Suivant" }).click();
      await sheet.getByText("Publicité", { exact: true }).waitFor();
      await shot(page, `12-interstitial-${size}-${theme}`, false);
      await sheet.getByRole("button", { name: "Passer", exact: true }).click({ timeout: 10_000 });
      await sheet.getByRole("radio", { name: "Douala" }).click();
      await sheet.getByRole("button", { name: "Suivant" }).click();
      await sheet.getByRole("radio", { name: "Le Wouri" }).click();
      await sheet.getByRole("button", { name: "Terminer" }).click();
      await sheet.getByText("Votre bon de réduction").waitFor();
      await shot(page, `13-coupon-${size}-${theme}`, false);

      // Sky Catch : écran d'accueil, partie en cours, puis appel pendant le jeu.
      await sheet.getByRole("button", { name: "Jouer en attendant" }).click();
      await sheet.getByRole("button", { name: /^Sky Catch/ }).click();
      await sheet.getByRole("button", { name: "Commencer" }).waitFor();
      await shot(page, `14-skycatch-ready-${size}-${theme}`, false);
      await sheet.getByRole("button", { name: "Commencer" }).click();
      await page.waitForTimeout(2_500);
      await page.screenshot({ path: `${OUT}/15-skycatch-playing-${size}-${theme}.png` });
      await rpc(b.staff, "call_next", { p_counter: b.counterId });
      await page.getByRole("alertdialog", { name: "C'est votre tour !" }).waitFor({ timeout: 15_000 });
      await page.waitForTimeout(3_000);
      await page.screenshot({ path: `${OUT}/16-your-turn-${size}-${theme}.png` });
      await context.close();
    }
  });
}

test("@screenshots bon de réduction et écran TV M10b", async ({ browser, request }, info) => {
  test.skip(info.project.name !== "desktop", "captures pilotées une seule fois");
  test.setTimeout(120_000);
  const { b, c } = await branchWithCampaign("Captures TV");
  const phone = await open(browser, "mobile", "light");
  const ticket = await takeTicket(phone.page, b);
  const { data: quiz } = await admin.from("ad_quizzes").select("id").eq("campaign_id", c.campaignId).single();
  const start = await rpc<{ play_id: string }>(b.staff, "start_quiz", { p_ticket_token: ticket, p_quiz: quiz!.id });
  {
    const won = await rpc<{ coupon: { qr_token: string } }>(b.staff, "finish_quiz", { p_ticket_token: ticket, p_play: start.play_id, p_answers: [0, 0, 0] });
    await phone.page.goto(`/coupon/${won.coupon.qr_token}`);
    await shot(phone.page, "17-coupon-page-mobile-light");
  }
  await phone.context.close();

  const token = await pairDisplay(request, b.staff, b.branchId, true);
  const tvContext = await browser.newContext({ viewport: { width: 1920, height: 1080 }, locale: "fr-FR" });
  const tv = await tvContext.newPage();
  await tv.addInitScript((t) => {
    localStorage.setItem("nextin-tv-token", t);
    Object.defineProperty(window, "speechSynthesis", { value: { speak: () => undefined, getVoices: () => [], cancel: () => undefined } });
  }, token);
  await tv.goto("/tv");
  await tv.getByRole("region", { name: "Publicité" }).waitFor({ timeout: 30_000 });
  await tv.waitForTimeout(800);
  await tv.screenshot({ path: `${OUT}/18-tv-ad.png` });
  await tvContext.close();
});
