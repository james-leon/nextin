/**
 * Sky Catch (M10b, §12.7) : logique pure du jeu, sans canvas ni DOM (testée). L'avion se déplace horizontalement
 * vers la cible du doigt (ou au clavier), attrape des pièces et évite les orages. Niveaux de 30 à 45 s, difficulté
 * croissante. Pas de temps fixe, réserve d'objets (aucune allocation pendant la partie).
 */

/** Monde logique (portrait) ; le rendu le met à l'échelle de l'écran. */
export const WORLD = { width: 360, height: 640 } as const;
export const STEP = 1 / 60;
export const POOL_SIZE = 48;
const PLANE_Y = WORLD.height * 0.82;
const PLANE_HALF_WIDTH = 22;
const PLANE_HALF_HEIGHT = 14;
const PLANE_SPEED = 420;
const COIN_RADIUS = 13;
const STORM_RADIUS = 20;
export const COIN_POINTS = 10;
export const LEVEL_BONUS = 50;

export type LevelConfig = { duration: number; fallSpeed: number; coinEvery: number; stormEvery: number };

/** Niveau 1 : 30 s, lent ; puis +5 s jusqu'à 45 s, chute plus rapide et orages plus fréquents. */
export function levelConfig(level: number): LevelConfig {
  const n = Math.max(1, Math.floor(level)) - 1;
  return {
    duration: 30 + Math.min(n, 3) * 5,
    fallSpeed: 150 + n * 28,
    coinEvery: Math.max(0.45, 0.8 - n * 0.05),
    stormEvery: Math.max(0.42, 1.5 - n * 0.16),
  };
}

export type FallingKind = "coin" | "storm";
export type Falling = { active: boolean; kind: FallingKind; x: number; y: number; r: number; spin: number };
export type GameStatus = "ready" | "playing" | "level_complete" | "game_over";

export type GameState = {
  status: GameStatus;
  level: number;
  /** Niveaux terminés depuis le début de la partie. */
  levelsCompleted: number;
  timeLeft: number;
  score: number;
  coins: number;
  planeX: number;
  /** Inclinaison visuelle de l'avion (-1 à 1). */
  tilt: number;
  coinTimer: number;
  stormTimer: number;
  objects: Falling[];
};

/** Commandes : cible du doigt (coordonnée x du monde) et/ou direction clavier (-1, 0, 1). */
export type GameInput = { targetX: number | null; direction: -1 | 0 | 1 };

export function createGame(): GameState {
  return {
    status: "ready",
    level: 1,
    levelsCompleted: 0,
    timeLeft: levelConfig(1).duration,
    score: 0,
    coins: 0,
    planeX: WORLD.width / 2,
    tilt: 0,
    coinTimer: 0,
    stormTimer: 0.8,
    objects: Array.from({ length: POOL_SIZE }, () => ({ active: false, kind: "coin" as FallingKind, x: 0, y: 0, r: 0, spin: 0 })),
  };
}

/** Démarre (ou reprend après un niveau réussi) le niveau courant. */
export function startLevel(s: GameState): void {
  if (s.status === "level_complete") s.level += 1;
  const cfg = levelConfig(s.level);
  s.timeLeft = cfg.duration;
  s.coinTimer = 0;
  s.stormTimer = 0.8;
  for (const o of s.objects) o.active = false;
  s.status = "playing";
}

function spawn(s: GameState, kind: FallingKind, x: number): void {
  const o = s.objects.find((p) => !p.active);
  if (!o) return;
  o.active = true;
  o.kind = kind;
  o.r = kind === "coin" ? COIN_RADIUS : STORM_RADIUS;
  o.x = Math.min(Math.max(x, o.r), WORLD.width - o.r);
  o.y = -o.r;
  o.spin = 0;
}

/** Contact cercle / rectangle de l'avion. */
export function hitsPlane(planeX: number, o: Pick<Falling, "x" | "y" | "r">): boolean {
  const dx = Math.max(Math.abs(o.x - planeX) - PLANE_HALF_WIDTH, 0);
  const dy = Math.max(Math.abs(o.y - PLANE_Y) - PLANE_HALF_HEIGHT, 0);
  return dx * dx + dy * dy < o.r * o.r * 0.8;
}

/** Avance d'un pas fixe (`STEP`). `rand` : générateur [0, 1[ (déterministe dans les tests). */
export function step(s: GameState, input: GameInput, rand: () => number): void {
  if (s.status !== "playing") return;
  const cfg = levelConfig(s.level);
  const dt = STEP;

  // Avion : vers la cible du doigt, sinon au clavier ; vitesse bornée, légère inclinaison.
  let dx = 0;
  if (input.targetX !== null) dx = Math.max(-PLANE_SPEED * dt, Math.min(PLANE_SPEED * dt, input.targetX - s.planeX));
  else dx = input.direction * PLANE_SPEED * dt;
  s.planeX = Math.min(Math.max(s.planeX + dx, PLANE_HALF_WIDTH), WORLD.width - PLANE_HALF_WIDTH);
  s.tilt += ((dx / (PLANE_SPEED * dt) || 0) - s.tilt) * 0.2;

  s.coinTimer -= dt;
  s.stormTimer -= dt;
  if (s.coinTimer <= 0) {
    spawn(s, "coin", 20 + rand() * (WORLD.width - 40));
    s.coinTimer = cfg.coinEvery;
  }
  if (s.stormTimer <= 0) {
    spawn(s, "storm", 20 + rand() * (WORLD.width - 40));
    s.stormTimer = cfg.stormEvery;
  }

  for (const o of s.objects) {
    if (!o.active) continue;
    o.y += cfg.fallSpeed * (o.kind === "storm" ? 1.1 : 1) * dt;
    o.spin += dt * 4;
    if (o.y - o.r > WORLD.height) {
      o.active = false;
      continue;
    }
    if (hitsPlane(s.planeX, o)) {
      o.active = false;
      if (o.kind === "coin") {
        s.coins += 1;
        s.score += COIN_POINTS;
      } else {
        s.status = "game_over";
        return;
      }
    }
  }

  s.timeLeft -= dt;
  if (s.timeLeft <= 0) {
    s.timeLeft = 0;
    s.levelsCompleted += 1;
    s.score += LEVEL_BONUS * s.level;
    s.status = "level_complete";
  }
}

/**
 * Accumulateur de pas fixe : consomme le temps écoulé (borné pour qu'un onglet en arrière-plan ne fasse pas un
 * saut). Renvoie le nombre de pas joués.
 */
export function advance(s: GameState, input: GameInput, elapsed: number, acc: { t: number }, rand: () => number): number {
  acc.t += Math.min(Math.max(elapsed, 0), 0.25);
  let steps = 0;
  while (acc.t >= STEP && s.status === "playing") {
    step(s, input, rand);
    acc.t -= STEP;
    steps += 1;
  }
  if (s.status !== "playing") acc.t = 0;
  return steps;
}

/** Ordonnée de l'avion (rendu). */
export const PLANE = { y: PLANE_Y, halfWidth: PLANE_HALF_WIDTH, halfHeight: PLANE_HALF_HEIGHT } as const;

/** Meilleur score local : jamais envoyé avec un identifiant (§12.7). */
export const BEST_SCORE_KEY = "nextin.skycatch.best";
