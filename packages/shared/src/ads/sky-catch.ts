/**
 * Sky Catch (M10b, §12.7 ; maquette v2 12) : logique pure du jeu, sans canvas ni DOM (testée). L'avion se pilote au
 * doigt (il rejoint le point touché) ou au clavier (flèches, dans les quatre directions), attrape des pièces (+10) et
 * des gemmes (+50, plus rares) et évite les obstacles. Trois vies : un obstacle touché en retire une, l'avion devient
 * invulnérable un court instant. Quatre décors qui changent tous les 200 points, puis recommencent plus vite.
 * Pas de temps fixe (1/60 s), réserve d'objets (aucune allocation d'objet de jeu pendant la partie).
 */

/** Monde logique (portrait 9:16) ; le rendu le met à l'échelle de l'écran. */
export const WORLD = { width: 360, height: 640 } as const;
export const STEP = 1 / 60;
export const POOL_SIZE = 48;
export const LIVES = 3;
export const COIN_POINTS = 10;
export const GEM_POINTS = 50;
/** Points par niveau : un nouveau décor tous les 200 points. */
export const LEVEL_POINTS = 200;
/** Invulnérabilité après un choc (l'avion clignote), en secondes. */
export const INVULNERABLE_SECONDS = 1.5;
export const SHAKE_SECONDS = 0.25;
/** Bandeau « Niveau 2 · Coucher de soleil », en secondes. */
export const BANNER_SECONDS = 2;
/** Rayon de contact de l'avion (cercle centré un peu sous le nez). */
export const PLANE_RADIUS = 16;
const PLANE_MARGIN_X = 30;
const PLANE_MIN_Y = WORLD.height * 0.42;
const PLANE_MAX_Y = WORLD.height - 50;
/** Vitesse au clavier (points du monde par seconde) et rattrapage du doigt (part de l'écart comblée par pas). */
const KEY_SPEED = 360;
const FOLLOW = 0.18;

/** Les quatre décors, dans l'ordre ; le cinquième niveau reprend le premier, plus vite. */
export const SCENES = ["douala", "sunset", "night", "storm"] as const;
export type Scene = (typeof SCENES)[number];
/** Obstacle propre à chaque décor : oiseaux, vautours plus rapides, drones à feux clignotants, boules d'éclair. */
export const SCENE_ENEMY = { douala: "bird", sunset: "vulture", night: "drone", storm: "spark" } as const satisfies Record<Scene, string>;
export type EnemyKind = (typeof SCENE_ENEMY)[Scene];

export function sceneOf(level: number): Scene {
  return SCENES[(Math.max(1, Math.floor(level)) - 1) % SCENES.length]!;
}

/** Niveau atteint pour un score (1 de 0 à 199 points, 2 de 200 à 399…). */
export function levelForScore(score: number): number {
  return Math.floor(Math.max(0, score) / LEVEL_POINTS) + 1;
}

/** Multiplicateur de vitesse : +22 % par niveau, donc le tour suivant des décors est plus rapide. */
export function speedOf(level: number): number {
  return 1 + (Math.max(1, Math.floor(level)) - 1) * 0.22;
}

/** Délai entre deux apparitions (secondes) : plus court à chaque niveau, jamais sous 14/60 s. `r` dans [0, 1[. */
export function spawnDelay(level: number, r: number): number {
  return (Math.max(14, 34 - Math.max(1, Math.floor(level)) * 3) + r * 16) / 60;
}

export type ObjectType = "coin" | "gem" | "enemy";
export type GameObject = {
  active: boolean;
  type: ObjectType;
  enemy: EnemyKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  /** Phase d'animation (rotation de la pièce, battement d'ailes, feux du drone). */
  phase: number;
};

/** Événements d'un pas, pour les sons et les effets du rendu (vidés par celui qui les lit). */
export type GameEventType = "coin" | "gem" | "hit" | "level" | "over";
export type GameEvent = { type: GameEventType; x: number; y: number };

export type GameStatus = "ready" | "playing" | "game_over";

export type GameState = {
  status: GameStatus;
  score: number;
  lives: number;
  level: number;
  /** Niveaux franchis depuis le début de la partie (bon de l'annonceur après `min_levels`). */
  levelsCompleted: number;
  coins: number;
  gems: number;
  planeX: number;
  planeY: number;
  /** Vitesse horizontale récente (roulis de l'avion au rendu). */
  planeVx: number;
  /** Secondes d'invulnérabilité restantes (clignotement). */
  invulnerable: number;
  /** Secondes de tremblement restantes. */
  shake: number;
  /** Secondes du bandeau de niveau restantes. */
  banner: number;
  spawnTimer: number;
  objects: GameObject[];
  events: GameEvent[];
};

/** Commandes : point touché (coordonnées du monde, déjà décalé au-dessus du doigt) et/ou flèches (-1, 0, 1). */
export type GameInput = { target: { x: number; y: number } | null; dx: -1 | 0 | 1; dy: -1 | 0 | 1 };

export const NO_INPUT: GameInput = { target: null, dx: 0, dy: 0 };

function blankObject(): GameObject {
  return { active: false, type: "coin", enemy: "bird", x: 0, y: 0, vx: 0, vy: 0, r: 0, phase: 0 };
}

export function createGame(): GameState {
  return {
    status: "ready",
    score: 0,
    lives: LIVES,
    level: 1,
    levelsCompleted: 0,
    coins: 0,
    gems: 0,
    planeX: WORLD.width / 2,
    planeY: WORLD.height - 130,
    planeVx: 0,
    invulnerable: 0,
    shake: 0,
    banner: 0,
    spawnTimer: 0,
    objects: Array.from({ length: POOL_SIZE }, blankObject),
    events: [],
  };
}

/** Nouvelle partie (réutilise la réserve d'objets). */
export function startGame(s: GameState): void {
  const fresh = createGame();
  const { objects, events } = s;
  Object.assign(s, fresh, { objects, events });
  for (const o of objects) o.active = false;
  events.length = 0;
  s.status = "playing";
  s.banner = BANNER_SECONDS;
}

function free(s: GameState): GameObject | null {
  for (const o of s.objects) if (!o.active) return o;
  return null;
}

/** Fait apparaître un objet en haut de l'écran. `r1`, `r2`, `r3` : tirages [0, 1[ (position, type, vitesse). */
export function spawn(s: GameState, r1: number, r2: number, r3: number): void {
  const o = free(s);
  if (!o) return;
  const sp = speedOf(s.level);
  o.active = true;
  o.x = 24 + r1 * (WORLD.width - 48);
  o.y = -20;
  o.phase = r3 * 6;
  o.vx = 0;
  if (r2 < 0.55) {
    o.type = "coin";
    o.r = 12;
    o.vy = 2.4 * 60 * sp;
  } else if (r2 < 0.62) {
    o.type = "gem";
    o.r = 13;
    o.vy = 2.8 * 60 * sp;
  } else {
    const enemy = SCENE_ENEMY[sceneOf(s.level)];
    o.type = "enemy";
    o.enemy = enemy;
    o.r = enemy === "vulture" ? 16 : 12;
    o.vy = (2.6 + r3 * 1.4) * 60 * sp * (enemy === "vulture" ? 1.15 : 1);
    // Oiseaux et vautours dérivent en biais, les drones louvoient, les boules d'éclair tombent droit.
    o.vx = enemy === "bird" || enemy === "vulture" ? (r1 - 0.5) * 1.6 * 60 : enemy === "drone" ? Math.sin(r3 * 6) * 1.2 * 60 : 0;
  }
}

/** Contact entre l'avion et un objet (cercles). */
export function touches(planeX: number, planeY: number, o: Pick<GameObject, "x" | "y" | "r">): boolean {
  const dx = o.x - planeX;
  const dy = o.y - (planeY + 4);
  const reach = o.r + PLANE_RADIUS;
  return dx * dx + dy * dy < reach * reach;
}

function emit(s: GameState, type: GameEventType, x: number, y: number): void {
  s.events.push({ type, x, y });
}

/** Avance d'un pas fixe (`STEP`). `rand` : générateur [0, 1[ (déterministe dans les tests). */
export function step(s: GameState, input: GameInput, rand: () => number): void {
  if (s.status !== "playing") return;
  const dt = STEP;

  // Pilotage : flèches d'abord, sinon le doigt (l'avion comble une part de l'écart à chaque pas), sinon il plane.
  if (input.dx || input.dy) {
    s.planeX += input.dx * KEY_SPEED * dt;
    s.planeY += input.dy * KEY_SPEED * dt;
    s.planeVx = input.dx * 4;
  } else if (input.target) {
    const dx = input.target.x - s.planeX;
    s.planeVx = dx * FOLLOW;
    s.planeX += dx * FOLLOW;
    s.planeY += (input.target.y - s.planeY) * FOLLOW;
  } else {
    s.planeVx *= 0.9;
  }
  s.planeX = Math.min(Math.max(s.planeX, PLANE_MARGIN_X), WORLD.width - PLANE_MARGIN_X);
  s.planeY = Math.min(Math.max(s.planeY, PLANE_MIN_Y), PLANE_MAX_Y);

  s.spawnTimer -= dt;
  if (s.spawnTimer <= 0) {
    spawn(s, rand(), rand(), rand());
    s.spawnTimer = spawnDelay(s.level, rand());
  }

  for (const o of s.objects) {
    if (!o.active) continue;
    o.y += o.vy * dt;
    o.x += o.vx * dt;
    if (o.x < 12 || o.x > WORLD.width - 12) o.vx = -o.vx;
    if (o.y > WORLD.height + 30) {
      o.active = false;
      continue;
    }
    if (!touches(s.planeX, s.planeY, o)) continue;
    if (o.type === "coin") {
      o.active = false;
      s.coins += 1;
      s.score += COIN_POINTS;
      emit(s, "coin", o.x, o.y);
    } else if (o.type === "gem") {
      o.active = false;
      s.gems += 1;
      s.score += GEM_POINTS;
      emit(s, "gem", o.x, o.y);
    } else if (s.invulnerable <= 0) {
      o.active = false;
      s.lives -= 1;
      s.invulnerable = INVULNERABLE_SECONDS;
      s.shake = SHAKE_SECONDS;
      emit(s, "hit", o.x, o.y);
      if (s.lives <= 0) {
        s.lives = 0;
        s.status = "game_over";
        emit(s, "over", s.planeX, s.planeY);
        return;
      }
    }
    const level = levelForScore(s.score);
    if (level > s.level) {
      s.level = level;
      s.levelsCompleted = level - 1;
      s.banner = BANNER_SECONDS;
      emit(s, "level", s.planeX, s.planeY);
    }
  }

  if (s.invulnerable > 0) s.invulnerable = Math.max(0, s.invulnerable - dt);
  if (s.shake > 0) s.shake = Math.max(0, s.shake - dt);
  if (s.banner > 0) s.banner = Math.max(0, s.banner - dt);
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

/**
 * Place un objet juste devant l'avion (il le touche au pas suivant) : tests automatisés de la perte de vie, du
 * changement de niveau et de la fin de partie.
 */
export function placeOnPlane(s: GameState, type: ObjectType): void {
  const o = free(s);
  if (!o) return;
  Object.assign(o, { active: true, type, enemy: SCENE_ENEMY[sceneOf(s.level)], x: s.planeX, y: s.planeY + 4, vx: 0, vy: 0, r: 12, phase: 0 });
}

/** Meilleur score local : jamais envoyé avec un identifiant (§12.7). */
export const BEST_SCORE_KEY = "nextin.skycatch.best";
/** Préférences de son sur l'appareil (musique et effets séparés). */
export const SOUND_PREFS_KEY = "nextin.skycatch.sound";
