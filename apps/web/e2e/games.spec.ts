import { expect, test, type Page } from "@playwright/test";
import { admin, branchWithCampaign, takeTicket } from "./ads-helpers";
import { importExampleBank, winPairs } from "./games-helpers";
import { expectAccessible } from "./helpers";
import { rpc } from "./queue-helpers";

/** Cibles tactiles de la feuille de jeu (portail hors de `main`) : 44 px au moins. */
async function expectSheetTargets(page: Page) {
  const small = await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>("[role=dialog] button"))
      .filter((el) => el.offsetParent !== null)
      .map((el) => {
        const r = el.getBoundingClientRect();
        // Zone tactile étendue par ::before (contrôle segmenté), comme `expectTouchTargets`.
        const before = getComputedStyle(el, "::before");
        const h = Math.max(r.height, before.content !== "none" ? parseFloat(before.height) || 0 : 0);
        return { label: el.getAttribute("aria-label") ?? el.textContent?.trim().slice(0, 30), w: r.width, h };
      })
      .filter((r) => r.h < 44 || r.w < 44),
  );
  expect(small).toEqual([]);
}

test.describe("LOT 5b — jeux pendant l'attente", () => {
  test.skip(({ isMobile }) => !isMobile, "jeux sur téléphone");

  test("quiz sans fin : réponses vérifiées par la base, 3 vies, interstitielle toutes les 5 questions, record sur l'appareil", async ({ page }) => {
    test.setTimeout(120_000);
    await importExampleBank();
    const { b } = await branchWithCampaign("Série");
    const token = await takeTicket(page, b);
    await page.goto(`/t/${token}`);
    await page.getByRole("button", { name: /^Jouer en attendant/ }).click();
    const sheet = page.getByRole("dialog");
    await expect(sheet.getByText("C-001")).toBeVisible();
    await expect(sheet.getByRole("button", { name: /^Paires/ })).toBeVisible();
    await expectAccessible(page);
    await expectSheetTargets(page);

    await sheet.getByRole("button", { name: /^Quiz Questions sans fin/ }).click();
    const asked = new Set<string>();
    const askedText = new Set<string>();
    // Question affichée (nouvelle) : identifiant et bonne réponse lus avec le service role.
    const correctOf = async () => {
      await expect.poll(async () => askedText.has(await sheet.locator("#quiz-question").innerText())).toBe(false);
      const q = await sheet.locator("#quiz-question").innerText();
      askedText.add(q);
      const { data } = await admin.from("quiz_bank_questions").select("id, correct").eq("question", q).single();
      return data!;
    };
    // Cinq bonnes réponses, puis l'interstitielle.
    for (let i = 0; i < 5; i++) {
      const { id, correct } = await correctOf();
      expect(asked.has(id), "aucune question répétée").toBe(false);
      asked.add(id);
      await sheet.getByRole("radio").nth(correct).click();
      await sheet.getByRole("button", { name: "Valider" }).click();
      await expect(sheet.getByText(`Question ${i + 1}`, { exact: false }).first()).toBeVisible();
      await expect(sheet.getByRole("radio").nth(correct)).toHaveClass(/bg-called/);
      if (i === 0) await expectAccessible(page);
      await sheet.getByRole("button", { name: "Question suivante" }).click();
    }
    await expect(sheet.getByText("Publicité", { exact: true })).toBeVisible();
    await sheet.getByRole("button", { name: "Passer", exact: true }).click({ timeout: 10_000 });

    // Trois erreurs : fin de partie, nouveau record gardé sur l'appareil.
    for (let i = 0; i < 3; i++) {
      const { id, correct } = await correctOf();
      expect(asked.has(id)).toBe(false);
      asked.add(id);
      await sheet.getByRole("radio").nth(correct === 0 ? 1 : 0).click();
      await sheet.getByRole("button", { name: "Valider" }).click();
      await sheet.getByRole("button", { name: i < 2 ? "Question suivante" : "Voir mon résultat" }).click();
    }
    await expect(sheet.getByText("Nouveau record sur ce téléphone !")).toBeVisible();
    await expect(sheet.getByRole("heading", { name: "Bien joué !" })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem("nextin.quiz.best"))).toBe("5");
    await expectAccessible(page);
    await expectSheetTargets(page);

    // La réponse n'est jamais envoyée avec la question.
    const draw = await page.request.post(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/quiz_bank_draw`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, "Content-Type": "application/json" },
      data: { p_ticket_token: token, p_exclude: [], p_count: 10 },
    });
    expect(await draw.text()).not.toContain("correct");

    // Record affiché sur la carte du jeu.
    await sheet.getByRole("button", { name: "Jouer en attendant" }).click();
    await expect(sheet.getByRole("button", { name: /^Quiz Questions sans fin/ })).toContainText("Record : 5 bonnes réponses");
  });

  test("Paires : plateau sans défilement, partie gagnée, record par niveau, figé à l'appel", async ({ page }) => {
    test.setTimeout(120_000);
    const { b } = await branchWithCampaign("Paires");
    const token = await takeTicket(page, b);
    await page.goto(`/t/${token}`);
    await page.getByRole("button", { name: /^Jouer en attendant/ }).click();
    const sheet = page.getByRole("dialog");
    await sheet.getByRole("button", { name: /^Paires/ }).click();
    const cards = sheet.getByRole("group", { name: "Plateau de cartes" }).getByRole("button");
    await expect(cards).toHaveCount(12);
    // Toutes les cartes dans l'écran, sans défilement.
    const bottom = await cards.last().evaluate((el) => el.getBoundingClientRect().bottom);
    expect(bottom).toBeLessThanOrEqual(page.viewportSize()!.height);
    await expectAccessible(page);
    await expectSheetTargets(page);

    await winPairs(page);
    await expect(sheet.getByText("Toutes les paires !")).toBeVisible();
    await expect(sheet.getByText("Nouveau record sur ce téléphone !")).toBeVisible();
    const best = await page.evaluate(() => localStorage.getItem("nextin.pairs.best.6"));
    expect(Number(best)).toBeGreaterThanOrEqual(6);
    await expectAccessible(page);

    // Niveau suivant : 8 paires.
    await sheet.getByRole("button", { name: "Niveau suivant" }).click();
    await expect(cards).toHaveCount(16);
    await cards.first().click();
    await expect(cards.first()).not.toHaveAttribute("aria-label", /^Carte cachée/);

    // Appel : la partie se fige et « C'est votre tour » prend la place.
    await rpc(b.staff, "call_next", { p_counter: b.counterId });
    await expect(page.getByRole("alertdialog", { name: "C'est votre tour !" })).toBeVisible({ timeout: 15_000 });
    await expect(cards.nth(1)).toHaveAttribute("aria-disabled", "true");
  });
});
