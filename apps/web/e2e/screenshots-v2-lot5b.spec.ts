import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { branchWithCampaign, pairDisplay, takeTicket } from "./ads-helpers";
import { answerWrong, importExampleBank, winPairs } from "./games-helpers";
import { addDoctors, rpc, setUpBranch } from "./queue-helpers";

// Captures de la refonte v2, LOT 5b (écran TV et jeux) → docs/captures/v2-lot5b/ (ou V2_SHOTS_OUT).
// Écran TV : toujours clair, en 1280 × 720, 1920 × 1080 et 3840 × 2160 ; jeux : 360, 768 et 1280 px, clair et sombre.
const OUT = process.env.V2_SHOTS_OUT ?? "../../docs/captures/v2-lot5b";
const ONLY = process.env.V2_SHOTS_ONLY?.split(",");
const wanted = (name: string) => !ONLY || ONLY.some((p) => name.startsWith(p));

const TV_SIZES = [
  { tag: "720p", width: 1280, height: 720 },
  { tag: "1080p", width: 1920, height: 1080 },
  { tag: "4k", width: 3840, height: 2160 },
] as const;

/** Visuel publicitaire d'exemple (aplats, sans texte) servi à la place du stockage. */
const AD_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="#0E7A44"/><circle cx="320" cy="70" r="120" fill="#15A05A"/><rect x="250" y="70" width="90" height="120" rx="14" fill="#fff" opacity=".95"/><path d="M295 100v60M265 130h60" stroke="#15A05A" stroke-width="16" stroke-linecap="round"/></svg>`;

async function tvPage(browser: Browser, token: string | null, size: (typeof TV_SIZES)[number], options: { ads?: boolean } = {}) {
  const context = await browser.newContext({ viewport: { width: size.width, height: size.height }, locale: "fr-FR" });
  await context.addInitScript(() => Object.defineProperty(window, "speechSynthesis", { value: { speak: () => undefined, getVoices: () => [], cancel: () => undefined } }));
  if (token) await context.addInitScript((t) => localStorage.setItem("nextin-tv-token", t), token);
  if (options.ads) {
    await context.route("**/api/tv/session", async (route) => {
      const res = await route.fetch();
      const body = (await res.json()) as { session: Record<string, unknown> };
      body.session.show_ads = true;
      body.session.ads = [
        {
          campaign_id: "00000000-0000-4000-8000-000000000001",
          creative_id: "00000000-0000-4000-8000-000000000002",
          kind: "image",
          path: "exemple/pharmacie.svg",
          headline: "Pharmacie de Makepe",
          offer: "Ouverte 24 h/24 · -10 % avec votre ticket NextIn",
          cta_url: null,
          duration: 60,
          advertiser: "Pharmacie de Makepe",
          weight: 1,
        },
      ];
      await route.fulfill({ response: res, json: body });
    });
    await context.route("**/storage/v1/object/public/ad-creatives/**", (route) => route.fulfill({ body: AD_SVG, contentType: "image/svg+xml" }));
    await context.route("**/api/ads/events", (route) => route.fulfill({ json: { ok: true } }));
  }
  if (!token || token === "jeton-revoque") {
    // Appairage simulé : la création de codes est limitée par adresse IP (20 par tranche de 10 minutes).
    await context.route("**/api/tv/pair", (route) =>
      route.fulfill({ json: { displayId: "00000000-0000-4000-8000-000000000003", code: "482916", pollSecret: "x", expiresAt: new Date(Date.now() + 7 * 60_000).toISOString() } }),
    );
    await context.route("**/api/tv/pair/poll", (route) => route.fulfill({ json: { status: "pending", deviceToken: null } }));
  }
  const page = await context.newPage();
  return { context, page };
}

async function snap(page: Page, name: string) {
  if (!wanted(name)) return;
  await page.screenshot({ path: `${OUT}/${name}.png` });
}

test.describe("@screenshots refonte v2 LOT 5b", () => {
  test.skip(({ isMobile }) => isMobile, "captures faites avec des tailles explicites");

  test("écran TV (maquettes 09 et 23)", async ({ browser, request }) => {
    test.setTimeout(300_000);
    const b = await setUpBranch("DOUALA CLINIC");
    const { cab4 } = await addDoctors(b);
    const token = await pairDisplay(request, b.staff, b.branchId, true);
    let contexts: BrowserContext[] = [];
    const close = async () => {
      await Promise.all(contexts.map((c) => c.close()));
      contexts = [];
    };

    // Aucun appel en cours, appairage et révocation.
    for (const size of TV_SIZES) {
      const tv = await tvPage(browser, token, size);
      contexts.push(tv.context);
      await tv.page.goto("/tv");
      await expect(tv.page.getByText("Les appels s'afficheront ici.")).toBeVisible();
      await tv.page.waitForTimeout(3_600);
      await snap(tv.page, `tv-aucun-appel-${size.tag}`);
      const pairing = await tvPage(browser, null, size);
      contexts.push(pairing.context);
      await pairing.page.goto("/tv");
      await expect(pairing.page.locator("[data-pairing-code]")).toHaveAttribute("data-pairing-code", /^\d{6}$/);
      await pairing.page.waitForTimeout(1_500);
      await snap(pairing.page, `tv-appairage-${size.tag}`);
      const revoked = await tvPage(browser, "jeton-revoque", size);
      contexts.push(revoked.context);
      await revoked.page.goto("/tv");
      await expect(revoked.page.getByText("Cet écran n'est plus appairé.")).toBeVisible();
      await expect(revoked.page.locator("[data-pairing-code]")).toHaveAttribute("data-pairing-code", /^\d{6}$/);
      await revoked.page.waitForTimeout(1_500);
      await snap(revoked.page, `tv-revoque-${size.tag}`);
      await close();
    }

    // Appels en cours : flash d'appel, état normal (avec et sans publicité), hors ligne.
    for (let i = 0; i < 9; i++) await rpc(b.staff, "reception_create_ticket", { p_service: b.serviceId });
    const first = await rpc<{ id: string }>(b.staff, "call_next", { p_counter: b.counterId });
    await rpc(b.staff, "admit_ticket", { p_ticket: first.id });
    const pages = await Promise.all(
      TV_SIZES.map(async (size) => {
        const tv = await tvPage(browser, token, size);
        contexts.push(tv.context);
        await tv.page.goto("/tv");
        await expect(tv.page.getByRole("region", { name: "Ticket appelé" }).getByRole("listitem")).toHaveCount(1);
        return { size, page: tv.page };
      }),
    );
    await rpc(b.staff, "call_next", { p_counter: cab4 });
    for (const { size, page } of pages) {
      await expect(page.getByTestId("tv-flash")).toBeVisible();
      await page.waitForTimeout(1_200);
      await snap(page, `tv-flash-${size.tag}`);
    }
    for (const { size, page } of pages) {
      await expect(page.getByTestId("tv-flash")).toBeHidden({ timeout: 8_000 });
      await page.waitForTimeout(3_200);
      await snap(page, `tv-sans-publicite-${size.tag}`);
      await page.context().setOffline(true);
    }
    for (const { size, page } of pages) {
      await expect(page.getByText("Hors ligne · reconnexion…")).toBeVisible({ timeout: 90_000 });
      await page.waitForTimeout(600);
      await snap(page, `tv-hors-ligne-${size.tag}`);
    }
    await close();

    for (const size of TV_SIZES) {
      const tv = await tvPage(browser, token, size, { ads: true });
      contexts.push(tv.context);
      await tv.page.goto("/tv");
      await expect(tv.page.getByRole("region", { name: "Publicité" })).toBeVisible({ timeout: 30_000 });
      await tv.page.waitForTimeout(600);
      await snap(tv.page, `tv-normal-${size.tag}`);
    }
    await close();

    // Activer le son : navigateur qui exige un geste (audio bloqué).
    for (const size of TV_SIZES) {
      const tv = await tvPage(browser, token, size);
      contexts.push(tv.context);
      await tv.context.addInitScript(() => {
        const Original = window.AudioContext;
        window.AudioContext = class extends Original {
          override get state() {
            return "suspended" as AudioContextState;
          }
          override resume() {
            return Promise.resolve();
          }
        };
      });
      await tv.page.goto("/tv");
      await expect(tv.page.getByRole("button", { name: /Activer le son/ })).toBeVisible();
      await tv.page.locator(":focus").evaluate((el) => (el as HTMLElement).blur());
      await snap(tv.page, `tv-activer-son-${size.tag}`);
    }
    await close();

    // Service indisponible : établissement suspendu (la raison n'est jamais affichée).
    for (const size of TV_SIZES) {
      const tv = await tvPage(browser, token, size);
      contexts.push(tv.context);
      await tv.context.route("**/api/tv/session", async (route) => {
        const res = await route.fetch();
        const body = (await res.json()) as { session: Record<string, unknown> };
        body.session.unavailable = true;
        await route.fulfill({ response: res, json: body });
      });
      await tv.page.goto("/tv");
      await expect(tv.page.getByRole("heading", { name: "Service momentanément indisponible" })).toBeVisible();
      await snap(tv.page, `tv-indisponible-${size.tag}`);
    }
    await close();
  });

  test("jeux (maquettes 01, 10, 11 et 12)", async ({ browser }) => {
    test.setTimeout(600_000);
    await importExampleBank();
    const { b } = await branchWithCampaign("Jeux");
    for (const theme of ["light", "dark"] as const) {
      for (const size of GAME_SIZES) {
        const context = await browser.newContext({ viewport: { width: size.width, height: size.height }, locale: "fr-FR", colorScheme: theme, hasTouch: size.width < 1024 });
        await context.addInitScript((t) => {
          localStorage.setItem("nextin.theme", t);
          localStorage.setItem("nextin.skycatch.best", "1240");
          localStorage.setItem("nextin.pairs.best.6", "9");
          localStorage.setItem("nextin.quiz.best", "7");
        }, theme);
        const page = await context.newPage();
        const token = await takeTicket(page, b);
        await page.goto(`/t/${token}`);
        const open = page.getByRole("button", { name: /^Jouer en attendant/ });
        await open.waitFor({ timeout: 20_000 });
        const suffix = `${size.tag}-${theme}`;
        await open.scrollIntoViewIfNeeded();
        await page.waitForTimeout(400);
        await snap(page, `jeux-carte-ticket-${suffix}`);
        await open.click();
        const sheet = page.getByRole("dialog");
        await sheet.getByRole("button", { name: /^Paires/ }).waitFor();
        await page.waitForTimeout(400);
        await snap(page, `jeux-liste-${suffix}`);

        // Paires : plateau, deux cartes retournées, puis partie gagnée.
        await sheet.getByRole("button", { name: /^Paires/ }).click();
        await sheet.getByRole("group", { name: "Plateau de cartes" }).getByRole("button").first().waitFor();
        await page.waitForTimeout(400);
        await snap(page, `paires-${suffix}`);
        await winPairs(page);
        await expect(sheet.getByText("Toutes les paires !")).toBeVisible();
        await page.waitForTimeout(500);
        await snap(page, `paires-gagne-${suffix}`);
        await sheet.getByRole("button", { name: "Jouer en attendant" }).click();

        // Quiz sans fin : question, réponse vérifiée, fin de partie.
        await sheet.getByRole("button", { name: /^Quiz Questions sans fin/ }).click();
        await sheet.getByRole("radiogroup").waitFor();
        await page.waitForTimeout(300);
        await snap(page, `quiz-question-${suffix}`);
        await sheet.getByRole("radio").first().click();
        await snap(page, `quiz-choix-${suffix}`);
        await sheet.getByRole("button", { name: "Valider" }).click();
        await sheet.getByRole("button", { name: /Question suivante|Voir mon résultat/ }).waitFor();
        await page.waitForTimeout(300);
        await snap(page, `quiz-reponse-${suffix}`);
        for (let i = 0; i < 12; i++) {
          if (await sheet.getByText(/^Résultat$/i).isVisible()) break;
          const next = sheet.getByRole("button", { name: /Question suivante|Voir mon résultat/ });
          if (await next.isVisible()) {
            await next.click();
            await page.waitForTimeout(600);
            continue;
          }
          const skip = sheet.getByRole("button", { name: "Passer", exact: true });
          if (await sheet.getByText("Publicité", { exact: true }).isVisible()) {
            await skip.click({ timeout: 10_000 });
            continue;
          }
          await answerWrong(page);
        }
        await expect(sheet.getByText(/^Résultat$/i)).toBeVisible();
        await page.waitForTimeout(800);
        await snap(page, `quiz-resultat-${suffix}`);
        await sheet.getByRole("button", { name: "Jouer en attendant" }).click();

        // Sky Catch : accueil du jeu, partie en cours, pause.
        await sheet.getByRole("button", { name: /^Sky Catch/ }).click();
        await sheet.getByRole("button", { name: "Jouer", exact: true }).waitFor();
        await page.waitForTimeout(400);
        await snap(page, `sky-accueil-${suffix}`);
        await sheet.getByRole("button", { name: "Jouer", exact: true }).click();
        await page.waitForTimeout(2_500);
        await snap(page, `sky-partie-${suffix}`);
        await sheet.getByRole("button", { name: "Pause", exact: true }).click();
        await page.waitForTimeout(300);
        await snap(page, `sky-pause-${suffix}`);
        await context.close();
      }
    }
  });
});

const GAME_SIZES = [
  { tag: "360", width: 360, height: 780 },
  { tag: "768", width: 768, height: 1024 },
  { tag: "1280", width: 1280, height: 800 },
] as const;
