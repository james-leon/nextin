import { describe, expect, it } from "vitest";
import {
  QUIZ_CSV_HEADER,
  QUIZ_LIVES,
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
});
