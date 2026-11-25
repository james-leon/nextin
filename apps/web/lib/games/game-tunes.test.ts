import { describe, expect, it } from "vitest";
import { GAME_TUNES } from "./game-tunes";

const freqs = (tune: keyof typeof GAME_TUNES) => GAME_TUNES[tune].map((n) => (n.to ? `${n.f}→${n.to}` : String(n.f)));

describe("sons du quiz et des Paires (fréquences exactes des maquettes 10 et 11)", () => {
  it("quiz : choix, bonne et mauvaise réponse, fin de série", () => {
    expect(freqs("pick")).toEqual(["660"]);
    expect(freqs("correct")).toEqual(["784", "1047", "1568"]);
    expect(freqs("wrong")).toEqual(["196→110"]);
    expect(freqs("endGood")).toEqual(["523", "659", "784", "1047", "1319"]);
    expect(freqs("endBad")).toEqual(["523", "494", "440"]);
  });
  it("Paires : carte retournée, paire trouvée, paire ratée, victoire", () => {
    expect(freqs("flip")).toEqual(["520→780"]);
    expect(freqs("match")).toEqual(["784", "1175"]);
    expect(freqs("miss")).toEqual(["220→160"]);
    expect(freqs("win")).toEqual(["523", "659", "784", "1047", "1319", "1568"]);
  });
  it("notes enchaînées dans l'ordre, volumes sous le plafond de 0,9", () => {
    for (const tune of Object.values(GAME_TUNES)) {
      const starts = tune.map((n) => n.at ?? 0);
      expect([...starts].sort((a, b) => a - b)).toEqual(starts);
      for (const n of tune) expect(n.v).toBeLessThanOrEqual(0.9);
    }
  });
});
