import { expect, test, type Page } from "@playwright/test";
import { admin, branchWithCampaign, takeTicket } from "./ads-helpers";
import { importExampleBank } from "./games-helpers";
import { expectAccessible } from "./helpers";
import { rpc } from "./queue-helpers";

// LOT 5c (maquettes v2 10 et 11) : explication après « Valider », illustrations dessinées, bouton « Sons », Paires
// ratées (bordure rouge et secousse), partie gardée à l'appel avec le bon texte.

/** Cibles tactiles de la feuille de jeu : 44 px au moins (zone étendue par ::before comprise). */
async function expectSheetTargets(page: Page) {
  const small = await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>("[role=dialog] button"))
      .filter((el) => el.offsetParent !== null)
      .map((el) => {
        const r = el.getBoundingClientRect();
        const before = getComputedStyle(el, "::before");
        const h = Math.max(r.height, before.content !== "none" ? parseFloat(before.height) || 0 : 0);
        return { label: el.getAttribute("aria-label") ?? el.textContent?.trim().slice(0, 30), w: r.width, h };
      })
      .filter((r) => r.h < 44 || r.w < 44),
  );
  expect(small).toEqual([]);
}

async function openSheet(page: Page, label: string) {
  const { b } = await branchWithCampaign(label);
  const token = await takeTicket(page, b);
  await page.goto(`/t/${token}`);
  await page.getByRole("button", { name: /^Jouer en attendant/ }).click();
  return { b, sheet: page.getByRole("dialog") };
}

test.describe("LOT 5c — quiz sans fin et Paires (maquettes v2 10 et 11)", () => {
  test.skip(({ isMobile }) => !isMobile, "jeux sur téléphone");

  test("quiz : explication après Valider, illustration, bouton Sons, partie gardée à l'appel", async ({ page }) => {
    test.setTimeout(150_000);
    await importExampleBank();
    const { b, sheet } = await openSheet(page, "Explications");
    await sheet.getByRole("button", { name: /^Quiz Questions sans fin/ }).click();

    // Bouton « Sons » : réglage gardé sur l'appareil.
    const sounds = sheet.getByRole("button", { name: "Sons" });
    await expect(sounds).toHaveAttribute("aria-pressed", "true");
    await sounds.click();
    await expect(sounds).toHaveAttribute("aria-pressed", "false");
    expect(await page.evaluate(() => localStorage.getItem("nextin.games.sound"))).toBe("off");
    await sounds.click();
    await expect(sounds).toHaveAttribute("aria-pressed", "true");

    // Questions jusqu'à en trouver une illustrée (6 sur 10 dans la banque d'exemple).
    let illustrated = false;
    for (let i = 0; i < 6 && !illustrated; i++) {
      const text = await sheet.locator("#quiz-question").innerText();
      const { data } = await admin.from("quiz_bank_questions").select("correct, explanation, illustration").eq("question", text).single();
      const art = sheet.getByTestId("quiz-illustration");
      if (data!.illustration) {
        await expect(art).toBeVisible();
        await expect(art).toHaveAttribute("role", "img");
        await expect(art).toHaveAttribute("aria-label", /^Dessin d/);
        illustrated = true;
      } else await expect(art).toHaveCount(0);

      // Avant « Valider » : aucune explication.
      await expect(sheet.getByTestId("quiz-explanation")).toHaveCount(0);
      await sheet.getByRole("radio").nth(data!.correct).click();
      await sheet.getByRole("button", { name: "Valider" }).click();
      const drawer = sheet.getByTestId("quiz-explanation");
      await expect(drawer).toBeVisible();
      await expect(drawer).toContainText("Explication");
      await expect(drawer).toContainText(data!.explanation!);
      if (i === 0 || illustrated) {
        await expectAccessible(page);
        await page.emulateMedia({ colorScheme: "dark" });
        await expectAccessible(page);
        await page.emulateMedia({ colorScheme: "light" });
        await expectSheetTargets(page);
      }
      await sheet.getByRole("button", { name: "Question suivante" }).click();
      const skip = sheet.getByRole("button", { name: "Passer", exact: true });
      if (await sheet.getByText("Publicité", { exact: true }).isVisible().catch(() => false)) await skip.click({ timeout: 10_000 });
    }
    expect(illustrated, "une question illustrée rencontrée").toBe(true);

    // Appel pendant une question : plus aucune réponse, « Votre quiz est gardé ».
    await expect(sheet.locator("#quiz-question")).toBeVisible();
    await rpc(b.staff, "call_next", { p_counter: b.counterId });
    const turn = sheet.getByRole("alertdialog", { name: "C'est votre tour !" });
    await expect(turn).toBeVisible({ timeout: 15_000 });
    await expect(turn.getByTestId("game-kept")).toHaveText("Votre quiz est gardé : vous pourrez le finir plus tard.");
    await expect(sheet.getByRole("radio").first()).toHaveAttribute("aria-disabled", "true");
    await expect(sheet.getByRole("button", { name: "Valider" })).toBeDisabled();
    // Un seul écran vert : celui de la feuille de jeu (pas celui de « Mon ticket » par-dessus).
    await expect(page.getByRole("alertdialog")).toHaveCount(1);
    await expectAccessible(page);
    await page.emulateMedia({ colorScheme: "dark" });
    await expectAccessible(page);
    // « J'arrive » : la feuille se ferme, l'appel est lu (aucun second écran vert).
    await turn.getByRole("button", { name: "J'arrive" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
  });

  test("Paires : bouton Sons, paire ratée (bordure rouge et secousse), partie gardée à l'appel", async ({ page }) => {
    test.setTimeout(120_000);
    const { b, sheet } = await openSheet(page, "Paires ratées");
    await sheet.getByRole("button", { name: /^Paires/ }).click();
    await expect(sheet.getByRole("button", { name: "Sons" })).toHaveAttribute("aria-pressed", "true");
    await expectSheetTargets(page);
    const cards = sheet.getByRole("group", { name: "Plateau de cartes" }).getByRole("button");

    // Retourne les deux premières cartes cachées jusqu'à rater une paire (une paire trouvée par hasard reste visible).
    const missOnce = async () => {
      for (let tries = 0; tries < 6; tries++) {
        const hidden = sheet.locator('[aria-label^="Carte cachée"]');
        await hidden.nth(0).click();
        await hidden.nth(0).click();
        const labels = await cards.evaluateAll((els) => els.map((el) => el.getAttribute("aria-label") ?? ""));
        const up = labels.filter((l) => !l.startsWith("Carte cachée") && !l.endsWith("paire trouvée"));
        if (up.length === 2 && up[0] !== up[1]) return;
        await page.waitForTimeout(400);
      }
      throw new Error("aucune paire ratée");
    };

    // Deux cartes différentes : bordure rouge et secousse, puis retournées après 1 s.
    await missOnce();
    const missed = sheet.locator(".pairs-miss");
    await expect(missed).toHaveCount(2);
    await expect(missed.first()).toHaveCSS("animation-name", "pairs-shake");
    await expect(missed.first()).toHaveClass(/border-red/);
    await expect(missed).toHaveCount(0, { timeout: 3_000 });

    // Animations réduites : bordure rouge sans secousse.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await missOnce();
    await expect(missed).toHaveCount(2);
    await expect(missed.first()).toHaveCSS("animation-name", "none");
    await expect(missed).toHaveCount(0, { timeout: 3_000 });
    await page.emulateMedia({ reducedMotion: "no-preference" });

    // Appel : partie gardée.
    await rpc(b.staff, "call_next", { p_counter: b.counterId });
    const turn = sheet.getByRole("alertdialog", { name: "C'est votre tour !" });
    await expect(turn).toBeVisible({ timeout: 15_000 });
    await expect(turn.getByTestId("game-kept")).toHaveText("Votre partie est gardée : reprenez-la plus tard si vous voulez.");
    await expect(page.getByRole("alertdialog")).toHaveCount(1);
    await expectAccessible(page);
    await page.emulateMedia({ colorScheme: "dark" });
    await expectAccessible(page);
  });
});
