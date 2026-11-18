import { expect, test } from "@playwright/test";
import { expectAccessible, expectTouchTargets, signInViaUi } from "./helpers";
import { setUpBranch } from "./queue-helpers";

// U1 — contrastes AA et rôles (axe) sur les pages principales hors gabarits déjà couverts par `responsive.spec.ts`
// (écrans du personnel et pages client) : connexion, inscription, pages légales, aide, code, écran TV, paiement,
// invitation et page introuvable — en clair et en sombre. Titres sans césure (U1).

const PAGES = [
  { path: "/login", heading: "Connexion" },
  { path: "/signup" },
  { path: "/cgu" },
  { path: "/confidentialite" },
  { path: "/help", heading: "Aide" },
  { path: "/c" },
  { path: "/scan" },
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

// Refonte v2, LOT 4 : écrans de l'espace directeur (maquettes 05 à 07 et 16 à 19), connecté, en clair et en sombre.
for (const scheme of ["light", "dark"] as const) {
  test(`espace directeur accessible (${scheme === "light" ? "clair" : "sombre"})`, async ({ browser }, info) => {
    test.skip(info.project.name !== "mobile", "une passe suffit : téléphone");
    test.setTimeout(180_000);
    const b = await setUpBranch("Clinique Accessible");
    const context = await browser.newContext({ colorScheme: scheme, locale: "fr-FR", viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await page.goto("/login");
    await signInViaUi(page, b.email);
    await page.waitForURL(/\/app$/);
    const root = `/app/o/${b.orgId}`;
    const base = `${root}/branches/${b.branchId}`;
    for (const path of [
      "/app",
      root,
      `${root}/setup`,
      `${root}/branches`,
      base,
      `${base}/edit`,
      `${base}/services/${b.serviceId}`,
      `${base}/counters/${b.counterId}`,
      `${base}/hours`,
      `${base}/qr`,
      `${base}/displays`,
      `${base}/displays/announcements`,
      `${root}/staff`,
      `${root}/staff/invite`,
      `${root}/practitioners`,
      `${root}/practitioners/specialties`,
      `${root}/billing`,
    ]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await expectAccessible(page);
      await expectTouchTargets(page);
    }
    await context.close();
  });
}
