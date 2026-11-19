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

test.describe("Filet de la première peinture", () => {
  test.skip(({ isMobile }) => !isMobile, "une passe sur téléphone suffit");

  test("feuille de style absente : fond de l'app et logo NextIn centré ; feuille présente : logo jamais chargé", async ({ browser }) => {
    for (const colorScheme of ["light", "dark"] as const) {
      const context = await browser.newContext({ colorScheme, serviceWorkers: "block" });
      const page = await context.newPage();
      await page.route(/\/_next\/static\/.+\.css$/, (route) => route.abort());
      await page.goto("/c");
      await expect
        .poll(() => page.evaluate(() => getComputedStyle(document.body, "::before").backgroundImage), { timeout: 4000 })
        .toContain("/icons/icon-192.png");
      expect(await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor)).toBe(
        colorScheme === "dark" ? "rgb(0, 0, 0)" : "rgb(242, 242, 247)",
      );
      await context.close();
    }

    // Cas normal : la feuille de style masque le logo avant qu'il ne soit demandé (aucun octet de plus).
    const context = await browser.newContext({ serviceWorkers: "block" });
    const page = await context.newPage();
    const icons: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("/icons/icon-192.png")) icons.push(r.url());
    });
    await page.goto("/c", { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    expect(await page.evaluate(() => getComputedStyle(document.body, "::before").content)).toBe("none");
    expect(icons).toEqual([]);
    await context.close();
  });
});
