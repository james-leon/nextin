import { describe, expect, it } from "vitest";
import { adFileUrl, canSkip, formatCouponCode, interstitialDue, nextAd } from "./rotation";
import { advance, createGame, hitsPlane, levelConfig, PLANE, POOL_SIZE, startLevel, step, WORLD, type GameInput } from "./sky-catch";

/** Générateur déterministe (mulberry32). */
function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("rotation pondérée (même règle que public.ad_weighted_draw)", () => {
  const ads = [
    { creative_id: "or", weight: 50 },
    { creative_id: "argent", weight: 30 },
    { creative_id: "bronze", weight: 20 },
  ];
  it("distribution 50 / 30 / 20 sur 20 000 tirages indépendants", () => {
    const r = rng(42);
    const counts: Record<string, number> = { or: 0, argent: 0, bronze: 0 };
    for (let i = 0; i < 20000; i++) counts[nextAd(ads, null, r())!.creative_id]! += 1;
    expect(Math.abs(counts.or! / 200 - 50)).toBeLessThan(2);
    expect(Math.abs(counts.argent! / 200 - 30)).toBeLessThan(2);
    expect(Math.abs(counts.bronze! / 200 - 20)).toBeLessThan(2);
  });
  it("jamais la même pub deux fois de suite quand il y a une alternative", () => {
    const r = rng(7);
    let last: string | null = null;
    for (let i = 0; i < 500; i++) {
      const next: string = nextAd(ads, last, r())!.creative_id;
      expect(next).not.toBe(last);
      last = next;
    }
  });
  it("une seule pub : répétée ; aucune : null ; poids nul ignoré", () => {
    expect(nextAd([ads[0]!], "or", 0.5)?.creative_id).toBe("or");
    expect(nextAd([], null, 0.5)).toBeNull();
    expect(nextAd([{ creative_id: "x", weight: 0 }], null, 0.5)).toBeNull();
  });
  it("URL publique, code lisible, « Passer » et espacement", () => {
    expect(adFileUrl("https://x.supabase.co/", "a/b/c d.png")).toBe("https://x.supabase.co/storage/v1/object/public/ad-creatives/a/b/c%20d.png");
    expect(formatCouponCode("K7M2PQ4X")).toBe("K7M2-PQ4X");
    expect(canSkip(4999, 5)).toBe(false);
    expect(canSkip(5000, 5)).toBe(true);
    expect(interstitialDue(100_000, null, 60, true)).toBe(true);
    expect(interstitialDue(100_000, 50_000, 60, true)).toBe(false);
    expect(interstitialDue(200_000, 50_000, 60, true)).toBe(true);
    expect(interstitialDue(200_000, null, 60, false)).toBe(false);
  });
});

describe("Sky Catch", () => {
  const idle: GameInput = { targetX: null, direction: 0 };
  it("niveaux de 30 à 45 s, de plus en plus difficiles", () => {
    expect([1, 2, 3, 4, 5, 9].map((l) => levelConfig(l).duration)).toEqual([30, 35, 40, 45, 45, 45]);
    expect(levelConfig(3).fallSpeed).toBeGreaterThan(levelConfig(1).fallSpeed);
    expect(levelConfig(3).stormEvery).toBeLessThan(levelConfig(1).stormEvery);
    expect(levelConfig(50).stormEvery).toBeGreaterThanOrEqual(0.42);
  });
  it("l'avion suit le doigt à vitesse bornée et reste dans l'écran", () => {
    const s = createGame();
    startLevel(s);
    step(s, { targetX: WORLD.width, direction: 0 }, () => 0.5);
    expect(s.planeX).toBeCloseTo(WORLD.width / 2 + 7, 0);
    for (let i = 0; i < 200; i++) step(s, { targetX: 9999, direction: 0 }, () => 0.5);
    expect(s.planeX).toBeLessThanOrEqual(WORLD.width - PLANE.halfWidth);
    for (let i = 0; i < 200; i++) step(s, { targetX: null, direction: -1 }, () => 0.5);
    expect(s.planeX).toBeGreaterThanOrEqual(PLANE.halfWidth);
  });
  it("pièce attrapée : points ; orage : partie terminée", () => {
    const s = createGame();
    startLevel(s);
    s.coinTimer = 99;
    s.stormTimer = 99;
    Object.assign(s.objects[0]!, { active: true, kind: "coin", x: s.planeX, y: PLANE.y - 5, r: 13 });
    step(s, idle, () => 0.5);
    expect([s.coins, s.score]).toEqual([1, 10]);
    Object.assign(s.objects[1]!, { active: true, kind: "storm", x: s.planeX, y: PLANE.y - 5, r: 20 });
    step(s, idle, () => 0.5);
    expect(s.status).toBe("game_over");
  });
  it("collision : un orage à côté de l'avion ne touche pas", () => {
    expect(hitsPlane(100, { x: 100 + 22 + 25, y: PLANE.y, r: 20 })).toBe(false);
    expect(hitsPlane(100, { x: 100 + 22 + 10, y: PLANE.y, r: 20 })).toBe(true);
  });
  it("niveau terminé à la fin du temps, puis niveau suivant plus rapide", () => {
    const s = createGame();
    startLevel(s);
    s.stormTimer = 1e9;
    const acc = { t: 0 };
    for (let i = 0; i < 31 * 4; i++) advance(s, idle, 0.25, acc, () => 0.5);
    expect(s.status).toBe("level_complete");
    expect(s.levelsCompleted).toBe(1);
    expect(s.score).toBeGreaterThanOrEqual(50);
    startLevel(s);
    expect([s.level, s.timeLeft, s.status]).toEqual([2, 35, "playing"]);
    expect(s.objects.every((o) => !o.active)).toBe(true);
  });
  it("réserve d'objets : jamais plus de 48 objets, aucune allocation", () => {
    const s = createGame();
    startLevel(s);
    const pool = s.objects;
    const r = rng(1);
    for (let i = 0; i < 60 * 20 && s.status === "playing"; i++) step(s, { targetX: 0, direction: 0 }, r);
    expect(s.objects).toBe(pool);
    expect(s.objects).toHaveLength(POOL_SIZE);
  });
  it("pas fixe : un long arrêt (onglet masqué) ne fait pas sauter le jeu", () => {
    const s = createGame();
    startLevel(s);
    s.stormTimer = 1e9;
    expect(advance(s, idle, 10, { t: 0 }, () => 0.5)).toBe(15);
    expect(advance(s, idle, 0.004, { t: 0 }, () => 0.5)).toBe(0);
  });
});
