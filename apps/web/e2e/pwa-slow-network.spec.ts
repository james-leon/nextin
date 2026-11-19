import { expect, test } from "@playwright/test";

// Requêtes faites par le service worker visibles de `context.route` (Chromium) : nécessaire pour ralentir la page que
// le service worker va chercher. Lu au lancement du navigateur du processus de test (ce fichier tourne à part).
process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS = "1";

// PWA en réseau lent (4G faible) : à la 2e ouverture, le service worker n'attend le réseau que 3 s au plus, puis sert
// la dernière version de la page en cache ; le réseau la met à jour en arrière-plan. Jamais d'écran blanc.
const SLOW_MS = 8000;

test.describe("PWA : réseau lent avec service worker", () => {
  test.skip(({ isMobile }) => !isMobile, "une passe sur téléphone suffit");

  test("2e ouverture : contenu affiché en moins de 4 s, page mise à jour en arrière-plan", async ({ browser }) => {
    const context = await browser.newContext({ serviceWorkers: "allow", locale: "fr-FR" });
    const page = await context.newPage();

    // 1re ouverture : le service worker s'installe et prend la main, puis la page et ses fichiers sont mis en cache.
    await page.goto("/c");
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await page.reload();
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    await page.reload();
    await expect
      .poll(() => page.evaluate(async () => !!(await caches.match("/c", { cacheName: "nextin-v3-pages" }))), { timeout: 10_000 })
      .toBe(true);

    // Réseau lent : le serveur met 8 s à répondre à la page (requête faite par le service worker).
    let slowed = 0;
    await context.route(/\/c$/, async (route) => {
      slowed += 1;
      await new Promise((resolve) => setTimeout(resolve, SLOW_MS));
      await route.continue().catch(() => {});
    });

    // 2e ouverture : la page en cache s'affiche avant 4 s.
    const start = Date.now();
    await page.goto("/c", { waitUntil: "commit" });
    await expect(page.getByRole("heading", { level: 1, name: "Saisir le code" })).toBeVisible({ timeout: 4000 });
    expect(Date.now() - start).toBeLessThan(4000);
    // La requête réseau a bien été ralentie (sinon le test ne prouverait rien).
    expect(slowed).toBeGreaterThan(0);

    // Page en cache dont un fichier /_next/static manque (nouvelle version déployée, cache vidé) : jamais servie
    // (elle serait blanche) ; la page « Connexion lente ou absente » s'affiche à la place, avant 4 s.
    await page.evaluate(async () => {
      const statics = await caches.open("nextin-v3-static");
      const keys = await statics.keys();
      const css = keys.find((k) => /\/_next\/static\/.+\.css$/.test(k.url));
      if (!css) throw new Error("feuille de style absente du cache");
      await statics.delete(css);
    });
    const again = Date.now();
    await page.goto("/c", { waitUntil: "commit" });
    await expect(page.getByRole("heading", { level: 1, name: "Connexion lente ou absente" })).toBeVisible({ timeout: 4000 });
    expect(Date.now() - again).toBeLessThan(4000);
    await context.close();
  });
});

// LOT 5a (D) — filet de la première peinture = écran de démarrage (`lib/pwa/splash.ts`, identique aux images iOS) :
// icône, « NextIn » en 28 pt, slogan traduit et trois points, sur le fond de l'application (aucun flash blanc) ; masqué
// dès que la feuille de style est appliquée, son icône n'étant alors jamais téléchargée.
test.describe("Filet de la première peinture", () => {
  test.skip(({ isMobile }) => !isMobile, "une passe sur téléphone suffit");

  test("feuille de style absente : écran de démarrage sur le fond de l'app ; feuille présente : masqué, icône jamais chargée", async ({ browser }) => {
    for (const colorScheme of ["light", "dark"] as const) {
      const context = await browser.newContext({ colorScheme, serviceWorkers: "block", locale: "fr-FR" });
      const page = await context.newPage();
      await page.route(/\/_next\/static\/.+\.css$/, (route) => route.abort());
      await page.goto("/c");
      const splash = page.locator("#nx-s");
      await expect(splash).toBeVisible();
      await expect(splash.locator("b")).toHaveText("NextIn");
      await expect(splash.locator("p")).toHaveText("Votre tour, sans attendre.");
      await expect(splash.locator("i")).toHaveCount(3);
      expect(await splash.locator("b").evaluate((b) => getComputedStyle(b).fontSize)).toBe("28px");
      await expect
        .poll(() => page.evaluate(() => getComputedStyle(document.querySelector("#nx-s")!, "::before").backgroundImage), { timeout: 4000 })
        .toContain("/brand/nextin-icon.svg");
      expect(await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor)).toBe(
        colorScheme === "dark" ? "rgb(0, 0, 0)" : "rgb(242, 242, 247)",
      );
      await context.close();
    }

    // En anglais : slogan traduit.
    const english = await browser.newContext({ serviceWorkers: "block" });
    await english.addCookies([{ name: "NEXTIN_LOCALE", value: "en", url: test.info().project.use.baseURL ?? "http://localhost:3000" }]);
    const en = await english.newPage();
    await en.route(/\/_next\/static\/.+\.css$/, (route) => route.abort());
    await en.goto("/c");
    await expect(en.locator("#nx-s p")).toHaveText("Your turn, without the wait.");
    await english.close();

    // Cas normal : la feuille de style masque l'écran avant que l'icône ne soit demandée (aucun octet de plus).
    const context = await browser.newContext({ serviceWorkers: "block" });
    const page = await context.newPage();
    const icons: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("/brand/nextin-icon.svg")) icons.push(r.url());
    });
    await page.goto("/c", { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    await expect(page.locator("#nx-s")).toBeHidden();
    expect(icons).toEqual([]);
    await context.close();
  });
});
