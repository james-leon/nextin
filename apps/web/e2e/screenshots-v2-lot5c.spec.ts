import { expect, test, type Page } from "@playwright/test";
import { admin, branchWithCampaign, takeTicket } from "./ads-helpers";
import { answerWrong, importExampleBank } from "./games-helpers";
import { rpc } from "./queue-helpers";

// Captures du LOT 5c (quiz sans fin et Paires, maquettes v2 10 et 11) → docs/captures/v2-lot5c/ (ou V2_SHOTS_OUT) :
// 360, 768 et 1280 px, clair et sombre.
const OUT = process.env.V2_SHOTS_OUT ?? "../../docs/captures/v2-lot5c";
const ONLY = process.env.V2_SHOTS_ONLY?.split(",");
const wanted = (name: string) => !ONLY || ONLY.some((p) => name.startsWith(p));
const SIZES = [
  { tag: "360", width: 360, height: 780 },
  { tag: "768", width: 768, height: 1024 },
  { tag: "1280", width: 1280, height: 800 },
] as const;

async function snap(page: Page, name: string) {
  if (!wanted(name)) return;
  await page.waitForTimeout(450);
  await page.screenshot({ path: `${OUT}/${name}.png` });
}

/** Après « Question suivante » : passe l'interstitielle si elle s'affiche, puis attend la question. */
async function settle(page: Page) {
  const sheet = page.getByRole("dialog");
  const ad = sheet.getByText("Publicité", { exact: true });
  await expect(sheet.locator("#quiz-question").or(ad).first()).toBeVisible();
  if (await ad.isVisible()) {
    await sheet.getByRole("button", { name: "Passer", exact: true }).click({ timeout: 15_000 });
    await expect(sheet.locator("#quiz-question")).toBeVisible();
  }
}

/** Passe aux questions suivantes jusqu'à une question illustrée (bonne réponse lue avec le service role). */
async function untilIllustrated(page: Page) {
  const sheet = page.getByRole("dialog");
  for (let i = 0; i < 10; i++) {
    const text = await sheet.locator("#quiz-question").innerText();
    const { data } = await admin.from("quiz_bank_questions").select("correct, illustration").eq("question", text).single();
    if (data!.illustration) return data!;
    await sheet.getByRole("radio").nth(data!.correct).click();
    await sheet.getByRole("button", { name: "Valider" }).click();
    await sheet.getByRole("button", { name: "Question suivante" }).click();
    await settle(page);
  }
  throw new Error("aucune question illustrée");
}

for (const theme of ["light", "dark"] as const) {
  test(`@screenshots refonte v2 LOT 5c jeux ${theme}`, async ({ browser }, info) => {
    test.skip(info.project.name !== "desktop", "une passe suffit : les tailles sont fixées ici");
    test.setTimeout(900_000);
    await importExampleBank();
    for (const size of SIZES) {
      const suffix = `${size.tag}-${theme}`;
      for (const game of ["quiz", "pairs"] as const) {
        const context = await browser.newContext({
          colorScheme: theme,
          viewport: { width: size.width, height: size.height },
          deviceScaleFactor: 1,
          isMobile: size.tag !== "1280",
          hasTouch: size.tag !== "1280",
          locale: "fr-FR",
        });
        const page = await context.newPage();
        page.setDefaultTimeout(20_000);
        const { b } = await branchWithCampaign(`Captures ${game} ${suffix}`);
        const token = await takeTicket(page, b);
        await page.goto(`/t/${token}`);
        await page.getByRole("button", { name: /^Jouer en attendant/ }).click();
        const sheet = page.getByRole("dialog");

        if (game === "quiz") {
          await sheet.getByRole("button", { name: /^Quiz Questions sans fin/ }).click();
          const q = await untilIllustrated(page);
          await sheet.getByRole("radio").nth(q.correct === 0 ? 1 : 0).click();
          await snap(page, `01-quiz-question-${suffix}`);
          await sheet.getByRole("button", { name: "Valider" }).click();
          await expect(sheet.getByTestId("quiz-explanation")).toBeVisible();
          await snap(page, `02-quiz-explication-${suffix}`);
          await sheet.getByRole("button", { name: /Question suivante|Voir mon résultat/ }).click();
          await settle(page);
          // Quatre bonnes réponses (anneau à moitié rempli : objectif de 8), puis deux autres erreurs.
          for (let i = 0; i < 4; i++) {
            const text = await sheet.locator("#quiz-question").innerText();
            const { data } = await admin.from("quiz_bank_questions").select("correct").eq("question", text).single();
            await sheet.getByRole("radio").nth(data!.correct).click();
            await sheet.getByRole("button", { name: "Valider" }).click();
            await sheet.getByRole("button", { name: "Question suivante" }).click();
            await settle(page);
          }
          for (let i = 0; i < 2; i++) {
            await answerWrong(page);
            if (i === 0) {
              await sheet.getByRole("button", { name: "Question suivante" }).click();
              await settle(page);
            }
          }
          await sheet.getByRole("button", { name: "Voir mon résultat" }).click();
          await expect(sheet.getByText(/RÉSULTAT/i).first()).toBeVisible();
          await page.waitForTimeout(900);
          await snap(page, `03-quiz-resultat-${suffix}`);
          await sheet.getByRole("button", { name: "Rejouer" }).click();
          await expect(sheet.locator("#quiz-question")).toBeVisible();
          await rpc(b.staff, "call_next", { p_counter: b.counterId });
          await sheet.getByRole("alertdialog").waitFor({ timeout: 15_000 });
          await snap(page, `04-quiz-appel-${suffix}`);
        } else {
          await sheet.getByRole("button", { name: /^Paires/ }).click();
          const cards = sheet.getByRole("group", { name: "Plateau de cartes" }).getByRole("button");
          await expect(cards).toHaveCount(12);
          await snap(page, `05-paires-plateau-${suffix}`);
          // Paire ratée : bordure rouge (capture pendant la seconde où elle reste visible).
          for (let tries = 0; tries < 6; tries++) {
            const hidden = sheet.locator('[aria-label^="Carte cachée"]');
            await hidden.nth(0).click();
            await hidden.nth(0).click();
            const labels = await cards.evaluateAll((els) => els.map((el) => el.getAttribute("aria-label") ?? ""));
            const up = labels.filter((l) => !l.startsWith("Carte cachée") && !l.endsWith("paire trouvée"));
            if (up.length === 2 && up[0] !== up[1]) break;
            await page.waitForTimeout(400);
          }
          await expect(sheet.locator(".pairs-miss").first()).toBeVisible();
          // Capture immédiate : les cartes ratées se retournent 1 s après la seconde carte.
          if (wanted("06-paires-ratee")) await page.screenshot({ path: `${OUT}/06-paires-ratee-${suffix}.png` });
          await page.waitForTimeout(1_200);
          await rpc(b.staff, "call_next", { p_counter: b.counterId });
          await sheet.getByRole("alertdialog").waitFor({ timeout: 15_000 });
          await snap(page, `07-paires-appel-${suffix}`);
        }
        await context.close();
      }
    }
  });
}
