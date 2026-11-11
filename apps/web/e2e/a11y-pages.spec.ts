import { expect, test } from "@playwright/test";
import { expectAccessible } from "./helpers";

// U1 — contrastes AA et rôles (axe) sur les pages principales hors gabarits déjà couverts par `responsive.spec.ts`
// (écrans du personnel et pages client) : connexion, inscription, pages légales, aide, code, écran TV, paiement,
// invitation et page introuvable — en clair et en sombre. Titres sans césure (U1).

const PAGES = [
  { path: "/login", heading: "Bon retour" },
  { path: "/signup" },
  { path: "/cgu" },
  { path: "/confidentialite" },
  { path: "/help", heading: "Aide" },
  { path: "/c" },
  { path: "/tv" },
  { path: "/pay/AbCdEfGhIjKlMnOpQrStUvWxYz012345" },
  { path: "/invite/JetonInconnuJetonInconnu" },
  { path: "/page-qui-n-existe-pas" },
];

for (const scheme of ["light", "dark"] as const) {
  test(`pages principales accessibles (${scheme === "light" ? "clair" : "sombre"})`, async ({ browser }, info) => {
    test.skip(info.project.name !== "mobile", "une passe suffit : téléphone");
    test.setTimeout(120_000);
    const context = await browser.newContext({ colorScheme: scheme, locale: "fr-FR", viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    for (const p of PAGES) {
      await page.goto(p.path);
      if (p.heading) await expect(page.getByRole("heading", { level: 1, name: p.heading })).toBeVisible();
      await expectAccessible(page);
      // Titres : jamais de césure (« com-mencer »), lignes équilibrées.
      const hyphens = await page.evaluate(() =>
        Array.from(document.querySelectorAll("h1, h2")).map((h) => getComputedStyle(h).hyphens).filter((v) => v !== "none"),
      );
      expect(hyphens, `${p.path} : titres avec césure`).toEqual([]);
    }
    await context.close();
  });
}
