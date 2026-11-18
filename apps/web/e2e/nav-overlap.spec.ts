import { expect, test, type Page } from "@playwright/test";
import { rpc, setUpBranch } from "./queue-helpers";

// Barre de navigation iOS sur les pages client (maquette v2 02) : le bouton retour a sa propre ligne, puis le
// sur-titre, puis le grand titre. Vérifié en viewport iPhone (390 × 844, Safari), en sombre, au texte normal et à 200 %.
const IPHONE = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  colorScheme: "dark" as const,
  locale: "fr-FR",
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
};

type Box = { top: number; bottom: number; left: number; right: number };

/** Boîtes du retour, du sur-titre et du grand titre (null si absent), en coordonnées de la page. */
async function headerBoxes(page: Page) {
  return page.evaluate(() => {
    const box = (el: Element | null): Box | null => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return r.width && r.height ? { top: r.top + scrollY, bottom: r.bottom + scrollY, left: r.left, right: r.right } : null;
    };
    const back = document.querySelector("[data-nav-leading] a, [data-nav-leading] button");
    // Texte du retour et chevron : la zone tactile seule pourrait déborder sans que rien ne se voie.
    return {
      back: box(back),
      eyebrow: box(document.querySelector("[data-nav-eyebrow]")),
      title: box(document.querySelector("main h1:not(.sr-only), h1:not(.sr-only)")),
    };
  });
}

async function expectStacked(page: Page, label: string) {
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(250);
  const { back, eyebrow, title } = await headerBoxes(page);
  expect(back, `${label} : bouton retour`).not.toBeNull();
  expect(title, `${label} : grand titre`).not.toBeNull();
  if (eyebrow) {
    // Le sur-titre commence sous la ligne du retour : aucun chevauchement, même partiel.
    expect(eyebrow.top, `${label} : sur-titre sous le retour`).toBeGreaterThanOrEqual(back!.bottom - 0.5);
    expect(title!.top, `${label} : grand titre sous le sur-titre`).toBeGreaterThanOrEqual(eyebrow.bottom - 0.5);
  } else {
    expect(title!.top, `${label} : grand titre sous le retour`).toBeGreaterThanOrEqual(back!.bottom - 0.5);
  }
  // Rien ne sort de l'écran en largeur.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${label} : largeur`).toBe(true);
  await expectCoveredWhenScrolled(page, label);
}

/**
 * Petit défilement (rebond iOS, position restaurée par Safari) : le sur-titre passe sous la ligne du retour. La barre
 * doit alors être en matière presque opaque, jamais transparente (sinon le texte se superpose au bouton retour).
 */
async function expectCoveredWhenScrolled(page: Page, label: string) {
  const scrollable = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  if (scrollable < 24) return;
  await page.evaluate((y) => scrollTo(0, y), Math.min(24, scrollable));
  await expect(page.locator("[data-nav-bar]").first(), `${label} : barre opaque au défilement`).toHaveAttribute("data-under", "");
  // Fin de la transition de couleur (200 ms).
  await page.waitForTimeout(300);
  const alpha = await page.locator("[data-nav-bar]").first().evaluate((el) => {
    const m = getComputedStyle(el).backgroundColor.match(/rgba?\(([^)]+)\)/);
    const parts = m ? m[1]!.split(/[ ,/]+/).filter(Boolean) : [];
    return parts.length === 4 ? Number(parts[3]) : parts.length === 3 ? 1 : 0;
  });
  expect(alpha, `${label} : fond de la barre`).toBeGreaterThanOrEqual(0.9);
  await page.evaluate(() => scrollTo(0, 0));
}

test.describe("Pages client : retour, sur-titre et titre sans chevauchement (iPhone)", () => {
  test.skip(({ isMobile }) => !isMobile, "viewport iPhone : une seule passe suffit");

  test("choix du service, nom, code, agence, aide — texte normal et 200 %", async ({ browser }) => {
    const b = await setUpBranch("DOUALA CLINIC");
    const { public_token: ticket } = await rpc<{ public_token: string }>(b.staff, "reception_create_ticket", { p_service: b.serviceId });
    await b.staff
      .from("branch_settings")
      .update({ remote_tickets_enabled: true, appointment_requests_enabled: true })
      .eq("branch_id", b.branchId)
      .select("branch_id");

    for (const scale of ["100%", "200%"]) {
      const context = await browser.newContext(IPHONE);
      const page = await context.newPage();
      // Taille de texte de l'utilisateur (réglage du téléphone) : l'échelle en rem suit la racine.
      if (scale !== "100%") await page.addInitScript((s) => document.addEventListener("DOMContentLoaded", () => (document.documentElement.style.fontSize = s)), scale);

      await page.goto(`/q/${b.entryCode}`);
      await expect(page.getByRole("heading", { level: 1, name: "Choisissez un service" })).toBeVisible();
      await expectStacked(page, `choix du service ${scale}`);
      await page.getByRole("button", { name: /Consultation/ }).click();
      await expect(page.getByRole("heading", { level: 1, name: "Votre nom" })).toBeVisible();
      await expectStacked(page, `votre nom ${scale}`);

      await page.goto("/c");
      await expectStacked(page, `code ${scale}`);
      await page.goto(`/b/${b.branchId}`);
      await expect(page.getByRole("heading", { level: 1, name: "DOUALA CLINIC" })).toBeVisible();
      await expectStacked(page, `agence ${scale}`);
      await page.goto(`/b/${b.branchId}/rdv`);
      await expectStacked(page, `demande de rendez-vous ${scale}`);
      await page.goto(`/help?t=${ticket}`);
      await expectStacked(page, `aide ${scale}`);

      // « Mon ticket » : retour et « établissement · agence » sur une même ligne (maquette 01), sans se toucher.
      await page.goto(`/t/${ticket}`);
      const row = await page.evaluate(() => {
        const back = document.querySelector('a[href="/t"]')!.getBoundingClientRect();
        const place = [...document.querySelectorAll("p")].find((p) => /DOUALA CLINIC/i.test(p.textContent ?? ""))!.getBoundingClientRect();
        return { backRight: back.right, placeLeft: place.left, backTop: back.top, top: place.top };
      });
      expect(row.placeLeft, `mon ticket ${scale} : texte à droite du retour`).toBeGreaterThanOrEqual(row.backRight - 0.5);
      await context.close();
    }
  });
});
