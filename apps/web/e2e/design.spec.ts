import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const SECTIONS = [
  "Marque",
  "Typographie",
  "Couleurs",
  "Boutons",
  "Listes groupées",
  "Cartes",
  "Interrupteurs",
  "Segmented control",
  "Champs",
  "Navigation",
  "Barre d'onglets",
  "Feuille modale",
  "Alertes",
  "Badges et états",
  "Ticket",
  "Écrans de la maquette",
];

async function openDesign(page: Page) {
  await page.goto("/design");
  await expect(page.getByRole("heading", { level: 1, name: "Design system" })).toBeVisible();
}

test.describe("/design — vitrine du design system", () => {
  test("affiche toutes les sections en français par défaut", async ({ page }) => {
    await openDesign(page);
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
    for (const name of SECTIONS) {
      await expect(page.getByRole("heading", { level: 2, name, exact: true })).toBeVisible();
    }
  });

  test("bascule clair / sombre, persistée après rechargement", async ({ page }) => {
    await openDesign(page);
    await page.getByRole("radio", { name: "Sombre" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.locator("body")).toHaveCSS("background-color", "rgb(0, 0, 0)");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.getByRole("radio", { name: "Clair" }).click();
    await expect(page.locator("body")).toHaveCSS("background-color", "rgb(242, 242, 247)");
  });

  test("le mode Auto suit le réglage du système", async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: "dark" });
    const page = await context.newPage();
    await openDesign(page);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await context.close();
  });

  test("bascule FR / EN sans changer d'URL", async ({ page, context }) => {
    await openDesign(page);
    await page.getByRole("radio", { name: "English" }).click();
    await expect(page.getByText("NextIn components following Apple's Human Interface Guidelines")).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    expect(new URL(page.url()).pathname).toBe("/design");
    const cookies = await context.cookies();
    expect(cookies.find((c) => c.name === "NEXTIN_LOCALE")?.value).toBe("en");
  });

  test("l'anglais est choisi automatiquement si le navigateur le préfère", async ({ browser }) => {
    const context = await browser.newContext({ locale: "en-US" });
    const page = await context.newPage();
    await page.goto("/design");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await context.close();
  });

  test("interrupteur, segmented control et liste de choix", async ({ page }) => {
    await openDesign(page);
    const remote = page.getByRole("switch", { name: "Autoriser le ticket à distance" });
    await expect(remote).toHaveAttribute("aria-checked", "false");
    await remote.click();
    await expect(remote).toHaveAttribute("aria-checked", "true");
    await expect(page.getByRole("switch", { name: "Option verrouillée" })).toBeDisabled();

    const week = page.getByRole("radio", { name: "Semaine" });
    await week.click();
    await expect(week).toHaveAttribute("aria-checked", "true");

    const pediatrics = page.locator("#lists").getByRole("radio", { name: /Pédiatrie/ });
    await pediatrics.click();
    await expect(pediatrics).toHaveAttribute("aria-checked", "true");
  });

  test("validation du numéro WhatsApp camerounais", async ({ page }) => {
    await openDesign(page);
    const phone = page.getByLabel("Numéro WhatsApp");
    await expect(page.getByText("Numéro camerounais invalide")).toBeVisible();
    await expect(phone).toHaveAttribute("aria-invalid", "true");
    await phone.fill("6 77 12 34 56");
    await expect(page.getByText("Numéro camerounais invalide")).toBeHidden();
  });

  test("feuille modale : choix de la priorité", async ({ page }) => {
    await openDesign(page);
    await page.getByRole("button", { name: "Choisir la priorité" }).click();
    const sheet = page.getByRole("dialog", { name: "Passage prioritaire" });
    await expect(sheet).toBeVisible();
    await sheet.getByRole("radio", { name: "Grossesse" }).click();
    await sheet.getByRole("button", { name: "Confirmer" }).click();
    await expect(sheet).toBeHidden();
    await expect(page.getByText("Passage prioritaire : Grossesse")).toBeVisible();
  });

  test("alerte et notification", async ({ page }) => {
    await openDesign(page);
    await page.getByRole("button", { name: "Afficher une alerte" }).click();
    const alert = page.getByRole("alertdialog", { name: "Annuler votre ticket ?" });
    await expect(alert).toBeVisible();
    await alert.getByRole("button", { name: "Garder mon ticket" }).click();
    await expect(alert).toBeHidden();

    await page.getByRole("button", { name: "Afficher une notification" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Ticket C047 appelé" })).toBeVisible();
  });

  test("ticket : numéro et attente en héros, état « c'est votre tour »", async ({ page }) => {
    await openDesign(page);
    const ticket = page.locator("#ticket");
    await expect(ticket.getByText("C-047")).toBeVisible();
    await expect(ticket.getByText("≈ 12 min")).toBeVisible();
    await expect(ticket.getByRole("progressbar", { name: "Progression dans la file" })).toHaveAttribute("aria-valuenow", "64");
    await ticket.getByRole("radio", { name: "C'est votre tour" }).click();
    await expect(ticket.getByText("Présentez-vous au cabinet 3")).toBeVisible();
  });

  test("écrans de la maquette reconstruits avec les composants", async ({ page }) => {
    await openDesign(page);
    const mockups = page.locator("#mockups");
    await expect(mockups.locator("figure")).toHaveCount(4);
    await expect(mockups.getByText("Scannez pour commencer").first()).toBeVisible();
    await expect(mockups.getByRole("button", { name: "Prendre mon ticket" })).toBeVisible();
    await expect(mockups.getByText("QR code reconnu")).toBeVisible();
    await expect(mockups.getByRole("heading", { level: 1, name: "Mon ticket" })).toBeVisible();
    await expect(mockups.getByRole("button", { name: "Terminer et appeler le suivant" })).toBeVisible();
    await expect(mockups.getByText("04:12")).toBeVisible();
    // Choix exclusif dans la maquette 02
    const lab = mockups.getByRole("radio", { name: /Laboratoire/ });
    await lab.click();
    await expect(lab).toHaveAttribute("aria-checked", "true");
  });

  for (const theme of ["light", "dark"] as const) {
    test(`listes groupées : séparateurs inset entre les lignes (${theme})`, async ({ browser }) => {
      const context = await browser.newContext({ colorScheme: theme });
      const page = await context.newPage();
      await openDesign(page);
      const list = page.locator("#lists").getByRole("radiogroup", { name: "Services" });
      const rows = list.getByRole("radio");
      await expect(rows).toHaveCount(4);
      const separators = await rows.evaluateAll((els) =>
        els.map((row) => {
          const holder = row.querySelector<HTMLElement>(".list-separator")!;
          const after = getComputedStyle(holder, "::after");
          const title = holder.querySelector<HTMLElement>("span > span")!;
          return {
            display: after.display,
            height: parseFloat(after.height),
            color: after.backgroundColor,
            holderLeft: holder.getBoundingClientRect().left,
            titleLeft: title.getBoundingClientRect().left,
            tileRight: row.querySelector("[aria-hidden]")!.getBoundingClientRect().right,
          };
        }),
      );
      // Un séparateur entre chaque ligne, aucun sous la dernière.
      expect(separators.map((s) => s.display)).toEqual(["block", "block", "block", "none"]);
      for (const s of separators.slice(0, 3)) {
        expect(s.height).toBeGreaterThan(0);
        expect(s.height).toBeLessThanOrEqual(1);
        expect(s.color).not.toBe("rgba(0, 0, 0, 0)");
        // Décalé : commence après la pastille, aligné sur le texte.
        expect(s.holderLeft).toBeGreaterThan(s.tileRight);
        expect(Math.abs(s.holderLeft - s.titleLeft)).toBeLessThanOrEqual(1);
      }
      await context.close();
    });
  }

  test("Mon ticket : WhatsApp sous la carte, actions du bas visibles sans défilement", async ({ page }) => {
    await openDesign(page);
    const frame = page.locator("#mockups figure").filter({ hasText: "03 · Mon ticket" });
    await frame.scrollIntoViewIfNeeded();
    const phone = frame.locator("> div").first();

    // Le bouton WhatsApp suit immédiatement la carte du ticket.
    const whatsapp = frame.getByRole("button", { name: "Recevoir mes alertes sur WhatsApp" });
    await expect(whatsapp).toBeVisible();
    const nextToHero = await frame.locator("section[aria-live]").evaluate(
      (hero) => hero.nextElementSibling?.textContent ?? "",
    );
    expect(nextToHero).toContain("Recevoir mes alertes sur WhatsApp");

    // Ticket pris sur place : pas de « Je suis en route ».
    await expect(frame.getByRole("button", { name: "Je suis en route" })).toHaveCount(0);
    const cancel = frame.getByRole("button", { name: "Annuler le ticket" });
    const phoneBox = (await phone.boundingBox())!;
    const inside = async (name: string) => {
      const box = (await frame.getByRole("button", { name }).boundingBox())!;
      expect(box.y).toBeGreaterThanOrEqual(phoneBox.y);
      expect(box.y + box.height).toBeLessThanOrEqual(phoneBox.y + phoneBox.height);
    };
    await expect(cancel).toBeVisible();
    await inside("Annuler le ticket");

    // Ticket à distance : « Je suis en route » apparaît, les deux actions restent entières.
    await frame.getByRole("radio", { name: "Pris à distance" }).click();
    await expect(frame.getByRole("button", { name: "Je suis en route" })).toBeVisible();
    await inside("Je suis en route");
    await inside("Annuler le ticket");
  });

  test("le grand titre se réduit dans la barre au défilement", async ({ page }) => {
    await openDesign(page);
    const frame = page.locator("#navigation .overflow-y-auto");
    const smallTitle = frame.locator("p[aria-hidden]").filter({ hasText: "Mes tickets" });
    await expect(smallTitle).toHaveAttribute("aria-hidden", "true");
    await frame.evaluate((el) => el.scrollTo({ top: 400 }));
    await expect(smallTitle).toHaveAttribute("aria-hidden", "false");
  });

  for (const theme of ["light", "dark"] as const) {
    test(`accessibilité (axe, WCAG AA) en mode ${theme}`, async ({ browser }) => {
      const context = await browser.newContext({ colorScheme: theme });
      const page = await context.newPage();
      await openDesign(page);
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
      const blocking = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(blocking.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
      await context.close();
    });
  }

  test("toutes les cibles tactiles mesurent au moins 44 px", async ({ page }) => {
    await openDesign(page);
    const tooSmall = await page.evaluate(() => {
      const els = Array.from(
        document.querySelectorAll<HTMLElement>("main button, main a[href], main [role=switch], main input"),
      );
      return els
        .filter((el) => el.offsetParent !== null && !el.closest("[aria-hidden=true]"))
        .map((el) => {
          const r = el.getBoundingClientRect();
          const before = getComputedStyle(el, "::before");
          const hitHeight = Math.max(r.height, before.content !== "none" ? parseFloat(before.height) || 0 : 0);
          const isInput = el.tagName === "INPUT";
          return { label: el.getAttribute("aria-label") ?? el.textContent?.trim().slice(0, 30), w: r.width, h: hitHeight, isInput };
        })
        .filter((t) => t.h < 44 || (!t.isInput && t.w < 44));
    });
    expect(tooSmall).toEqual([]);
  });
});

test.describe("PWA", () => {
  test("manifest installable et service worker servis", async ({ request }) => {
    const manifest = await request.get("/manifest.webmanifest");
    expect(manifest.ok()).toBe(true);
    const json = await manifest.json();
    expect(json).toMatchObject({ short_name: "NextIn", display: "standalone", start_url: "/" });
    expect(json.icons.some((i: { purpose: string }) => i.purpose === "maskable")).toBe(true);

    const sw = await request.get("/sw.js");
    expect(sw.ok()).toBe(true);
    expect(sw.headers()["content-type"]).toContain("javascript");
    expect(sw.headers()["cache-control"]).toContain("no-cache");

    for (const icon of ["/icons/icon-192.png", "/icons/icon-512.png", "/icons/icon-maskable-512.png"]) {
      expect((await request.get(icon)).ok()).toBe(true);
    }
  });

  test("page hors ligne servie par le service worker", async ({ page, context }) => {
    await openDesign(page);
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await page.reload();
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    await context.setOffline(true);
    await page.goto("/jamais-visitee").catch(() => {});
    await expect(page.getByRole("heading", { name: "Vous êtes hors ligne" })).toBeVisible();
    await context.setOffline(false);
  });
});
