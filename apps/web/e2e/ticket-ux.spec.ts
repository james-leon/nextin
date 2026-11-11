import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { takeTicket } from "./ads-helpers";
import { expectAccessible } from "./helpers";
import { rpc, setUpBranch, supabaseOptions } from "./queue-helpers";

// « Mon ticket » (/t) : cartes d'attente sans débordement (320 et 375 px, FR et EN), barre presque pleine quand
// personne n'est devant, « Vous êtes le prochain », agence fermée ou aucun poste ouvert sans « D'un instant à
// l'autre », annulation en lien discret à la fin du contenu avec confirmation, rien de fixe sur le contenu.
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, supabaseOptions);

/** Aucune valeur des cartes « Devant vous » / « Attente estimée » ne sort de sa carte, ni la page en largeur. */
async function expectNoOverflow(page: Page) {
  const issues = await page.locator("section[aria-live] dl > div").evaluateAll((cards) =>
    cards.flatMap((card) => {
      const box = card.getBoundingClientRect();
      return [...card.querySelectorAll("dt, dd")]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return el.scrollWidth > el.clientWidth + 1 || r.left < box.left - 0.5 || r.right > box.right + 0.5;
        })
        .map((el) => el.textContent);
    }),
  );
  expect(issues).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

/** Rien de fixe ou collant ne recouvre le bas de l'écran (ni le haut du contenu sous la barre de titre). */
async function expectNothingFixedAtBottom(page: Page) {
  const fixed = await page.evaluate(() =>
    [...document.querySelectorAll("body *")]
      .filter((el) => {
        const style = getComputedStyle(el);
        if (style.position !== "fixed" && style.position !== "sticky") return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && style.visibility !== "hidden" && r.bottom > window.innerHeight - 160;
      })
      .map((el) => el.outerHTML.slice(0, 80)),
  );
  expect(fixed).toEqual([]);
}

test.describe("Mon ticket — corrections UX", () => {
  test("320 et 375 px, FR et EN : attente sans débordement, prochain, barre presque pleine", async ({ page }, info) => {
    test.skip(info.project.name !== "mobile", "largeurs de téléphone");
    const b = await setUpBranch("Clinique Ticket UX");
    const token = await takeTicket(page, b);
    await page.goto(`/t/${token}`);

    for (const locale of ["fr", "en"] as const) {
      await page.context().addCookies([{ name: "NEXTIN_LOCALE", value: locale, url: new URL(page.url()).origin }]);
      for (const width of [320, 375]) {
        await page.setViewportSize({ width, height: 740 });
        await page.goto(`/t/${token}`);
        const hero = page.locator("section[aria-live]").first();
        if (locale === "fr") {
          await expect(hero).toContainText("Vous êtes le prochain");
          await expect(hero).toContainText("D'un instant à l'autre");
          await expect(hero).not.toContainText(/Devant vous\s*0/);
        } else {
          await expect(hero).toContainText("You're next");
          await expect(hero).toContainText("Any moment now");
        }
        // Premier de la file dès la prise : presque pleine (plus 50 %).
        expect(Number(await page.getByRole("progressbar").getAttribute("aria-valuenow"))).toBeGreaterThanOrEqual(90);
        await expectNoOverflow(page);
        await expectNothingFixedAtBottom(page);
      }
    }
    await page.context().clearCookies({ name: "NEXTIN_LOCALE" });

    // Aucun poste ouvert pour le service : jamais « D'un instant à l'autre ».
    await rpc(b.staff, "close_counter", { p_counter: b.counterId });
    for (const width of [320, 375]) {
      await page.setViewportSize({ width, height: 740 });
      await page.goto(`/t/${token}`);
      const hero = page.locator("section[aria-live]").first();
      await expect(hero).toContainText("Aucun cabinet ouvert pour l'instant");
      await expect(hero).not.toContainText("D'un instant à l'autre");
      await expect(hero).toContainText("Vous êtes le prochain");
      await expectNoOverflow(page);
    }
    await expectAccessible(page);

    // Agence fermée aujourd'hui (fermeture exceptionnelle) : prochaine ouverture, demain à 00:00 ici.
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Douala" }).format(new Date());
    const closure = await admin
      .from("branch_closures")
      .insert({ organization_id: b.orgId, branch_id: b.branchId, date: today, reason: "Test" })
      .select("id");
    expect(closure.error).toBeNull();
    for (const locale of ["fr", "en"] as const) {
      await page.context().addCookies([{ name: "NEXTIN_LOCALE", value: locale, url: new URL(page.url()).origin }]);
      for (const width of [320, 375]) {
        await page.setViewportSize({ width, height: 740 });
        await page.goto(`/t/${token}`);
        const hero = page.locator("section[aria-live]").first();
        await expect(hero).toContainText(locale === "fr" ? "Ouverture demain à 00:00" : "Opens tomorrow at 00:00");
        await expect(hero).not.toContainText(locale === "fr" ? "D'un instant à l'autre" : "Any moment now");
        await expectNoOverflow(page);
      }
    }
    // Le reste de la page s'affiche normalement.
    await expect(page.getByRole("button", { name: "Cancel ticket" })).toBeVisible();
  });

  test("annuler : lien discret en bas du contenu, confirmation avec le numéro", async ({ page }) => {
    const b = await setUpBranch("Clinique Annulation");
    const token = await takeTicket(page, b);
    await page.goto(`/t/${token}`);
    const cancel = page.getByRole("button", { name: "Annuler le ticket" });
    await expect(cancel).toHaveCount(1);
    await expectNothingFixedAtBottom(page);

    // Lien discret : ni fond rouge, ni texte rouge, souligné ; sous la carte du ticket.
    const style = await cancel.evaluate((el) => {
      const s = getComputedStyle(el);
      return { bg: s.backgroundColor, decoration: s.textDecorationLine, position: s.position };
    });
    expect(style.bg).toBe("rgba(0, 0, 0, 0)");
    expect(style.decoration).toContain("underline");
    const hero = (await page.locator("section[aria-live]").first().boundingBox())!;
    expect((await cancel.boundingBox())!.y).toBeGreaterThan(hero.y);

    // Confirmation : « Garder mon ticket » ne change rien.
    await cancel.click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText("Annuler votre ticket C-001 ?");
    await expect(dialog).toContainText("Vous perdrez votre place.");
    await dialog.getByRole("button", { name: "Garder mon ticket" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText("Ticket annulé")).toHaveCount(0);

    await cancel.click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Annuler le ticket" }).click();
    await expect(page.getByText("Ticket annulé")).toBeVisible();
  });
});
