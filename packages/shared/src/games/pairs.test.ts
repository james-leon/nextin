import { describe, expect, it } from "vitest";
import {
  PAIRS_MISS_DELAY_MS,
  elapsedSeconds,
  flip,
  formatClock,
  hideMiss,
  isBetterPairs,
  isMiss,
  isWon,
  newPairs,
  pairsBestKey,
  pairsFound,
  pairsGrid,
  pairsStars,
  shuffle,
} from "./pairs";

/** Générateur déterministe (LCG) pour les tests. */
function seeded(seed: number) {
  let x = seed;
  return () => {
    x = (x * 1664525 + 1013904223) % 4294967296;
    return x / 4294967296;
  };
}

/** Indices des deux cartes de chaque dessin. */
function pairsOf(deck: readonly string[]) {
  const map = new Map<string, number[]>();
  deck.forEach((f, i) => map.set(f, [...(map.get(f) ?? []), i]));
  return [...map.values()];
}

describe("Paires", () => {
  it("plateau : chaque dessin deux fois, mélangé", () => {
    const s = newPairs(8, seeded(1));
    expect(s.deck).toHaveLength(16);
    expect(pairsOf(s.deck).every((p) => p.length === 2)).toBe(true);
    expect(new Set(s.deck).size).toBe(8);
    expect(newPairs(10, seeded(2)).deck).not.toEqual(newPairs(10, seeded(3)).deck);
    expect(shuffle([1, 2, 3], () => 0.99)).toHaveLength(3);
  });

  it("paire trouvée : reste visible, un coup", () => {
    let s = newPairs(6, seeded(4));
    const [a, b] = pairsOf(s.deck)[0]!;
    s = flip(s, a!, 1000);
    expect(s.open).toEqual([a]);
    expect(s.startedAt).toBe(1000);
    s = flip(s, b!, 2000);
    expect(s.matched[a!] && s.matched[b!]).toBe(true);
    expect(s.open).toEqual([]);
    expect(s.moves).toBe(1);
    expect(pairsFound(s)).toBe(1);
    expect(flip(s, a!, 3000)).toBe(s);
  });

  it("deux cartes différentes : plateau bloqué jusqu'au retour", () => {
    let s = newPairs(6, seeded(5));
    const [p, q] = pairsOf(s.deck);
    s = flip(flip(s, p![0]!, 0), q![0]!, 500);
    expect(isMiss(s)).toBe(true);
    expect(s.moves).toBe(1);
    expect(flip(s, p![1]!, 600)).toBe(s);
    s = hideMiss(s);
    expect(s.open).toEqual([]);
    expect(hideMiss(s)).toBe(s);
    expect(PAIRS_MISS_DELAY_MS).toBe(1000);
  });

  it("partie gagnée : chrono figé, étoiles, record", () => {
    let s = newPairs(6, seeded(6));
    let t = 10_000;
    for (const [a, b] of pairsOf(s.deck)) s = flip(flip(s, a!, (t += 1000)), b!, (t += 1000));
    expect(isWon(s)).toBe(true);
    expect(s.moves).toBe(6);
    expect(elapsedSeconds(s, t + 60_000)).toBe(11);
    expect(pairsStars(s.moves, 6)).toBe(3);
    expect(pairsStars(13, 6)).toBe(2);
    expect(pairsStars(14, 6)).toBe(1);
    expect(isBetterPairs(6, null)).toBe(true);
    expect(isBetterPairs(6, 6)).toBe(false);
    expect(isBetterPairs(5, 6)).toBe(true);
    expect(flip(s, 0, t)).toBe(s);
    expect(pairsBestKey(8)).toBe("nextin.pairs.best.8");
  });

  it("chrono : zéro avant la première carte, format m:ss", () => {
    expect(elapsedSeconds(newPairs(6, seeded(7)), 5000)).toBe(0);
    expect(formatClock(65)).toBe("1:05");
    expect(formatClock(0)).toBe("0:00");
  });

  it("grille : sans défilement, la plus grande carte possible", () => {
    // Téléphone en portrait : 12 cartes sur 3 colonnes ; 20 cartes sur 4.
    expect(pairsGrid(12, 340, 520, 8)).toMatchObject({ cols: 3, rows: 4 });
    expect(pairsGrid(20, 340, 520, 8)).toMatchObject({ cols: 4, rows: 5 });
    // Écran large et bas : plus de colonnes.
    const wide = pairsGrid(20, 1200, 400, 8);
    expect(wide.cols).toBeGreaterThanOrEqual(5);
    expect(wide.rows * wide.cardHeight + (wide.rows - 1) * 8).toBeLessThanOrEqual(400);
    expect(wide.cols * wide.cardWidth + (wide.cols - 1) * 8).toBeLessThanOrEqual(1200);
  });
});
