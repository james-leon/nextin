import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { QUIZ_ILLUSTRATIONS } from "@nextin/shared/games/quiz-bank";
import { QUIZ_ART, quizArt } from "./quiz-art";

describe("illustrations du quiz (maquette v2 10)", () => {
  it("un dessin par clé de la liste fermée, rien de plus", () => {
    expect(Object.keys(QUIZ_ART).sort()).toEqual([...QUIZ_ILLUSTRATIONS].sort());
  });
  it("dessins recopiés à l'identique de la maquette", () => {
    const mockup = readFileSync(join(__dirname, "../../../../design/mockups/v2/10-quiz-v2.html"), "utf8");
    for (const key of QUIZ_ILLUSTRATIONS) expect(mockup).toContain(`${key}:'${QUIZ_ART[key]}'`);
  });
  it("SVG seul : ni script, ni image externe, ni gestionnaire d'événement", () => {
    for (const svg of Object.values(QUIZ_ART)) {
      expect(svg.startsWith("<svg") && svg.endsWith("</svg>")).toBe(true);
      expect(svg).not.toMatch(/<script|<image|href=|\son\w+=/i);
    }
  });
  it("clé inconnue ou vide : pas d'image", () => {
    expect(quizArt("mont")).toBe(QUIZ_ART.mont);
    expect(quizArt("photo")).toBeNull();
    expect(quizArt("constructor")).toBeNull();
    expect(quizArt("")).toBeNull();
    expect(quizArt(null)).toBeNull();
  });
});
