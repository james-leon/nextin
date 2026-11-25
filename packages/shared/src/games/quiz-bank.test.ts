import { describe, expect, it } from "vitest";
import {
  QUIZ_CSV_EXTRA,
  QUIZ_CSV_HEADER,
  QUIZ_ILLUSTRATIONS,
  QUIZ_LIVES,
  endTune,
  isQuizIllustration,
  resultTitleKey,
  ringFraction,
  answerSeries,
  interstitialAfter,
  isRecord,
  newSeries,
  parseQuizCsv,
  parseSeen,
  rememberSeen,
  seriesOver,
  splitCsv,
} from "./quiz-bank";

const HEADER = QUIZ_CSV_HEADER.join(";");

describe("série sans fin", () => {
  it("3 vies, une de moins par erreur, score = bonnes réponses", () => {
    let s = newSeries();
    expect(s.lives).toBe(QUIZ_LIVES);
    s = answerSeries(s, true);
    s = answerSeries(s, false);
    s = answerSeries(s, true);
    expect(s).toEqual({ asked: 3, score: 2, lives: 2 });
    s = answerSeries(answerSeries(s, false), false);
    expect(seriesOver(s)).toBe(true);
    expect(answerSeries(s, false).lives).toBe(0);
  });
  it("interstitielle toutes les 5 questions", () => {
    expect([0, 1, 4, 5, 6, 10].map((n) => interstitialAfter(n))).toEqual([false, false, false, true, false, true]);
    expect(interstitialAfter(3, 3)).toBe(true);
    expect(interstitialAfter(3, 0)).toBe(false);
  });
  it("record : seulement un score strictement meilleur", () => {
    expect(isRecord(0, null)).toBe(false);
    expect(isRecord(3, null)).toBe(true);
    expect(isRecord(3, 3)).toBe(false);
    expect(isRecord(4, 3)).toBe(true);
  });
  it("questions vues : sans doublon, les plus récentes gardées", () => {
    expect(rememberSeen(["a", "b"], ["b", "c"])).toEqual(["a", "b", "c"]);
    expect(rememberSeen(["a", "b", "c"], ["d"], 3)).toEqual(["b", "c", "d"]);
    expect(parseSeen('["a",1,"b"]')).toEqual(["a", "b"]);
    expect(parseSeen("pas du json")).toEqual([]);
    expect(parseSeen(null)).toEqual([]);
  });
});

describe("import CSV", () => {
  it("découpe : point-virgule, guillemets, CRLF, BOM", () => {
    expect(splitCsv('﻿a;"b;c";"d ""e"""\r\n1;2;3\n\n')).toEqual([
      { line: 1, cells: ["a", "b;c", 'd "e"'] },
      { line: 2, cells: ["1", "2", "3"] },
    ]);
  });
  it("lignes valides : réponses 3 et 4 facultatives, bonne réponse en index", () => {
    const csv = [
      HEADER,
      "Q1;Cameroun;1;Capitale politique ?;Political capital?;Douala;Douala;Yaoundé;Yaounde;Garoua;;;;2",
      'Q2;Santé;2;"Lavage des mains ; durée ?";;5 s;5 s;20 s;20 s;;;;;2',
    ].join("\n");
    const { rows, errors } = parseQuizCsv(csv);
    expect(errors).toEqual([]);
    expect(rows).toEqual([
      {
        id: "Q1",
        category: "Cameroun",
        difficulty: 1,
        question: "Capitale politique ?",
        question_en: "Political capital?",
        answers: [
          { text: "Douala", text_en: "Douala" },
          { text: "Yaoundé", text_en: "Yaounde" },
          { text: "Garoua", text_en: null },
        ],
        correct: 1,
      },
      {
        id: "Q2",
        category: "Santé",
        difficulty: 2,
        question: "Lavage des mains ; durée ?",
        question_en: null,
        answers: [
          { text: "5 s", text_en: "5 s" },
          { text: "20 s", text_en: "20 s" },
        ],
        correct: 1,
      },
    ]);
  });
  it("erreurs avec leur ligne, aucune ligne gardée à moitié", () => {
    const csv = [
      HEADER,
      "Q1;Cameroun;4;Question ?;;A;;B;;;;;;1",
      "Q1;Cameroun;1;Question ?;;A;;B;;;;;;3",
      "bad id;Cameroun;1;Question ?;;A;;B;;;;D;;1",
      "Q9;Cameroun;1;Question ?;;A;;B",
      "Q5;;1;Q;;;;B;;;;;;0",
    ].join("\n");
    const { rows, errors } = parseQuizCsv(csv);
    expect(rows).toEqual([]);
    expect(errors.map((e) => e.line)).toEqual([2, 3, 3, 4, 4, 5, 6, 6, 6, 6, 6]);
    expect(errors[0]!.message).toContain("difficulte");
    expect(errors[1]!.message).toContain("en double");
    expect(errors[6]!.message).toContain("categorie");
  });
  it("en-tête différent : refusé", () => {
    expect(parseQuizCsv("id;question\nQ1;x").errors).toEqual([{ line: 1, message: expect.stringContaining("en-tête attendu") }]);
  });
  it("colonnes facultatives : explications et illustration (LOT 5c)", () => {
    const line = (extra: string) => `Q1;Cameroun;1;Plus haut sommet ?;;Mont Oku;;Mont Cameroun;;;;;;2${extra}`;
    const { rows, errors } = parseQuizCsv([`${HEADER};${QUIZ_CSV_EXTRA.join(";")}`, line(";Plus de 4 000 m.;Above 4,000 m.;mont")].join("\n"));
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({ explanation: "Plus de 4 000 m.", explanation_en: "Above 4,000 m.", illustration: "mont" });
    // Colonnes présentes mais vides : null (pas de tiroir, pas d'image).
    const empty = parseQuizCsv([`${HEADER};${QUIZ_CSV_EXTRA.join(";")}`, line(";;;")].join("\n"));
    expect(empty.rows[0]).toMatchObject({ explanation: null, explanation_en: null, illustration: null });
  });
  it("fichier sans les colonnes facultatives : accepté, explications en base non touchées", () => {
    const { rows, errors } = parseQuizCsv([HEADER, "Q1;Cameroun;1;Plus haut sommet ?;;Mont Oku;;Mont Cameroun;;;;;;2"].join("\n"));
    expect(errors).toEqual([]);
    expect(rows[0]).not.toHaveProperty("explanation");
    expect(rows[0]).not.toHaveProperty("illustration");
  });
  it("colonnes facultatives : illustration hors liste, explication trop longue, anglais seul refusés", () => {
    const head = `${HEADER};${QUIZ_CSV_EXTRA.join(";")}`;
    const base = (id: string) => `${id};Cameroun;1;Plus haut sommet ?;;Mont Oku;;Mont Cameroun;;;;;;2`;
    const { rows, errors } = parseQuizCsv(
      [head, `${base("A")};;;photo`, `${base("B")};${"x".repeat(401)};;`, `${base("C")};;English only;`, `${base("D")};ok`].join("\n"),
    );
    expect(rows).toEqual([]);
    expect(errors.map((e) => e.line)).toEqual([2, 3, 4, 5]);
    expect(errors[0]!.message).toContain("illustration");
    expect(errors[1]!.message).toContain("400");
    expect(errors[2]!.message).toContain("explication_en sans explication_fr");
    expect(errors[3]!.message).toContain("colonnes");
  });
  it("illustrations : liste fermée de la maquette", () => {
    expect([...QUIZ_ILLUSTRATIONS]).toEqual(["mont", "eau", "fleuve", "moustique", "mains", "trophee"]);
    expect(isQuizIllustration("mont")).toBe(true);
    expect(isQuizIllustration("photo")).toBe(false);
    expect(isQuizIllustration(null)).toBe(false);
  });
});

describe("fin de série (maquette v2 10)", () => {
  it("anneau rempli selon min(bonnes réponses / 8, 1)", () => {
    expect([0, 2, 4, 8, 12].map((n) => ringFraction(n))).toEqual([0, 0.25, 0.5, 1, 1]);
  });
  it("titre et mélodie de fin", () => {
    expect([0, 3, 4, 7, 8, 20].map(resultTitleKey)).toEqual(["resultKeepGoing", "resultKeepGoing", "resultGood", "resultGood", "resultExcellent", "resultExcellent"]);
    expect([3, 4].map(endTune)).toEqual(["bad", "good"]);
  });
});
