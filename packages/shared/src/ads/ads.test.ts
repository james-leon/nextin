import { describe, expect, it } from "vitest";
import { adFileUrl, canSkip, formatCouponCode, interstitialDue, nextAd } from "./rotation";
import {
  advance,
  createGame,
  GEM_POINTS,
  INVULNERABLE_SECONDS,
  levelForScore,
  NO_INPUT,
  placeOnPlane,
  POOL_SIZE,
  sceneOf,
  SCENE_ENEMY,
  spawn,
  spawnDelay,
  speedOf,
  startGame,
  step,
  touches,
  WORLD,
} from "./sky-catch";

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
  const quiet = () => {
    const s = createGame();
    startGame(s);
    s.spawnTimer = 1e9; // aucune apparition aléatoire
    return s;
  };
  const tick = (s: ReturnType<typeof createGame>, n = 1) => {
    for (let i = 0; i < n; i++) step(s, NO_INPUT, () => 0.5);
  };

  it("trois vies, score à zéro, niveau 1 au départ (bandeau du décor affiché)", () => {
    const s = createGame();
    startGame(s);
    expect([s.status, s.lives, s.score, s.level, s.levelsCompleted]).toEqual(["playing", 3, 0, 1, 0]);
    expect(s.banner).toBeGreaterThan(0);
  });

  it("pièce +10, gemme +50", () => {
    const s = quiet();
    placeOnPlane(s, "coin");
    tick(s);
    expect([s.score, s.coins]).toEqual([10, 1]);
    placeOnPlane(s, "gem");
    tick(s);
    expect([s.score, s.gems]).toEqual([10 + GEM_POINTS, 1]);
    expect(s.events.map((e) => e.type)).toEqual(["coin", "gem"]);
  });

  it("obstacle touché : une vie en moins, tremblement, invulnérable ~1 s ; troisième choc = fin de partie", () => {
    const s = quiet();
    placeOnPlane(s, "enemy");
    tick(s);
    expect(s.lives).toBe(2);
    expect(s.shake).toBeGreaterThan(0);
    expect(s.invulnerable).toBeGreaterThan(1);
    // Pendant l'invulnérabilité : aucun choc compté.
    placeOnPlane(s, "enemy");
    tick(s);
    expect(s.lives).toBe(2);
    // L'obstacle traverse l'avion sans effet (il est retiré ici pour la suite du test).
    for (const o of s.objects) o.active = false;
    tick(s, Math.ceil(INVULNERABLE_SECONDS * 60) + 1);
    expect(s.invulnerable).toBe(0);
    placeOnPlane(s, "enemy");
    tick(s, 2);
    expect(s.lives).toBe(1);
    tick(s, Math.ceil(INVULNERABLE_SECONDS * 60) + 1);
    placeOnPlane(s, "enemy");
    tick(s, 2);
    expect([s.lives, s.status]).toEqual([0, "game_over"]);
    expect(s.events.at(-1)?.type).toBe("over");
    // Plus rien ne bouge après la fin.
    const score = s.score;
    placeOnPlane(s, "coin");
    tick(s);
    expect(s.score).toBe(score);
  });

  it("nouveau décor tous les 200 points, puis les décors recommencent, plus vite", () => {
    expect([0, 199, 200, 399, 400, 800].map(levelForScore)).toEqual([1, 1, 2, 2, 3, 5]);
    expect([1, 2, 3, 4, 5, 8].map(sceneOf)).toEqual(["douala", "sunset", "night", "storm", "douala", "storm"]);
    expect(SCENE_ENEMY).toEqual({ douala: "bird", sunset: "vulture", night: "drone", storm: "spark" });
    expect(speedOf(5)).toBeGreaterThan(speedOf(1));
    expect(spawnDelay(5, 0)).toBeLessThan(spawnDelay(1, 0));
    expect(spawnDelay(50, 0)).toBeGreaterThanOrEqual(14 / 60);

    const s = quiet();
    s.score = 190;
    placeOnPlane(s, "coin");
    tick(s);
    expect([s.level, s.levelsCompleted]).toEqual([2, 1]);
    expect(s.events.map((e) => e.type)).toEqual(["coin", "level"]);
    expect(s.banner).toBeGreaterThan(0);
    // Gemme de 50 qui fait franchir un niveau.
    s.score = 360;
    placeOnPlane(s, "gem");
    tick(s);
    expect([s.level, s.levelsCompleted]).toEqual([3, 2]);
  });

  it("obstacles du décor : oiseaux, puis vautours plus gros et plus rapides", () => {
    const s = quiet();
    spawn(s, 0.5, 0.9, 0.5);
    const bird = s.objects.find((o) => o.active)!;
    expect([bird.type, bird.enemy]).toEqual(["enemy", "bird"]);
    s.level = 2;
    spawn(s, 0.5, 0.9, 0.5);
    const vulture = s.objects.filter((o) => o.active)[1]!;
    expect(vulture.enemy).toBe("vulture");
    expect(vulture.r).toBeGreaterThan(bird.r);
    expect(vulture.vy).toBeGreaterThan(bird.vy);
    // Pièces et gemmes : gemmes plus rares (7 % des apparitions contre 55 %).
    spawn(s, 0.5, 0.1, 0.5);
    spawn(s, 0.5, 0.6, 0.5);
    expect(s.objects.filter((o) => o.active).map((o) => o.type)).toEqual(["enemy", "enemy", "coin", "gem"]);
  });

  it("pilotage : flèches dans les quatre directions, doigt rejoint ; l'avion reste dans sa zone", () => {
    const s = quiet();
    const x0 = s.planeX;
    step(s, { target: null, dx: 1, dy: 0 }, () => 0.5);
    expect(s.planeX).toBeCloseTo(x0 + 6, 5);
    for (let i = 0; i < 300; i++) step(s, { target: null, dx: -1, dy: -1 }, () => 0.5);
    expect(s.planeX).toBe(30);
    expect(s.planeY).toBeCloseTo(WORLD.height * 0.42, 5);
    for (let i = 0; i < 300; i++) step(s, { target: { x: 300, y: 560 }, dx: 0, dy: 0 }, () => 0.5);
    expect(s.planeX).toBeCloseTo(300, 0);
    expect(s.planeY).toBeCloseTo(560, 0);
  });

  it("contact : un objet à côté de l'avion ne touche pas", () => {
    expect(touches(100, 500, { x: 100 + 12 + 16 + 2, y: 504, r: 12 })).toBe(false);
    expect(touches(100, 500, { x: 100 + 20, y: 504, r: 12 })).toBe(true);
  });

  it("réserve d'objets : jamais plus de 48 objets, aucune allocation", () => {
    const s = createGame();
    startGame(s);
    const pool = s.objects;
    const r = rng(1);
    for (let i = 0; i < 60 * 30 && s.status === "playing"; i++) {
      step(s, { target: { x: 30 + r() * 300, y: 500 }, dx: 0, dy: 0 }, r);
      s.events.length = 0;
    }
    expect(s.objects).toBe(pool);
    expect(s.objects).toHaveLength(POOL_SIZE);
  });

  it("nouvelle partie : tout est remis à zéro, même réserve", () => {
    const s = quiet();
    s.score = 420;
    s.lives = 1;
    placeOnPlane(s, "coin");
    const pool = s.objects;
    startGame(s);
    expect([s.score, s.lives, s.level, s.status]).toEqual([0, 3, 1, "playing"]);
    expect(s.objects).toBe(pool);
    expect(s.objects.every((o) => !o.active)).toBe(true);
  });

  it("pas fixe : un long arrêt (onglet masqué) ne fait pas sauter le jeu", () => {
    const s = quiet();
    expect(advance(s, NO_INPUT, 10, { t: 0 }, () => 0.5)).toBe(15);
    expect(advance(s, NO_INPUT, 0.004, { t: 0 }, () => 0.5)).toBe(0);
  });
});
