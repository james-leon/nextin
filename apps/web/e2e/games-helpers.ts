import { readFileSync } from "node:fs";
import { expect, type Page } from "@playwright/test";
import { parseQuizCsv } from "@nextin/shared/games/quiz-bank";
import { admin } from "./ads-helpers";

/** Banque d'exemple (supabase/seed/quiz-bank.example.csv) importée dans la base locale. */
export async function importExampleBank() {
  const { rows, errors } = parseQuizCsv(readFileSync("../../supabase/seed/quiz-bank.example.csv", "utf8"));
  expect(errors).toEqual([]);
  const { error } = await admin.from("quiz_bank_questions").upsert(rows.map((r) => ({ ...r, active: true })), { onConflict: "id" });
  expect(error).toBeNull();
}

/** Réponse fausse (la bonne est lue avec le service role). */
export async function answerWrong(page: Page) {
  const sheet = page.getByRole("dialog");
  const question = await sheet.locator("#quiz-question").innerText();
  const { data } = await admin.from("quiz_bank_questions").select("correct").eq("question", question).maybeSingle();
  const wrong = data ? (data.correct === 0 ? 1 : 0) : 0;
  await sheet.getByRole("radio").nth(wrong).click();
  await sheet.getByRole("button", { name: "Valider" }).click();
  await sheet.getByRole("button", { name: /Question suivante|Voir mon résultat/ }).waitFor();
}

/** Gagne une partie de Paires en mémorisant les cartes déjà vues. */
export async function winPairs(page: Page) {
  const cards = page.getByRole("group", { name: "Plateau de cartes" }).getByRole("button");
  const count = await cards.count();
  const seen = new Map<number, string>();
  const found = new Set<number>();
  const reveal = async (i: number) => {
    await cards.nth(i).click();
    await expect(cards.nth(i)).not.toHaveAttribute("aria-label", /^Carte cachée/);
    const face = ((await cards.nth(i).getAttribute("aria-label")) ?? "").replace(/, paire trouvée$/, "");
    seen.set(i, face);
    return face;
  };
  const twinOf = (i: number, face: string) => [...seen.entries()].find(([k, f]) => k !== i && f === face && !found.has(k))?.[0];
  const hidden = () => cards.nth(0).page().waitForTimeout(1_100);
  while (found.size < count) {
    const a = [...Array(count).keys()].find((k) => !found.has(k))!;
    const faceA = await reveal(a);
    const twin = twinOf(a, faceA);
    if (twin !== undefined) {
      await reveal(twin);
      found.add(a).add(twin);
      continue;
    }
    const b = [...Array(count).keys()].find((k) => !found.has(k) && k !== a && !seen.has(k))!;
    const faceB = await reveal(b);
    if (faceB === faceA) {
      found.add(a).add(b);
      continue;
    }
    await hidden();
    const twinB = twinOf(b, faceB);
    if (twinB !== undefined) {
      await reveal(twinB);
      await reveal(b);
      found.add(twinB).add(b);
    }
  }
}
