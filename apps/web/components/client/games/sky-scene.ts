import { WORLD, sceneOf, speedOf, type GameObject, type GameState, type Scene } from "@nextin/shared/ads/sky-catch";

/**
 * Rendu canvas de Sky Catch (maquette v2 12), sans bibliothèque : quatre décors dessinés en code (ville de Douala,
 * coucher de soleil derrière le mont Cameroun, nuit étoilée, orage), avion animé (hélice, roulis, traînée), pièces,
 * gemmes et obstacles. Couleurs : jetons `--game-*` (déclarés sur le conteneur du jeu, `SKY_TOKENS`), lus une fois.
 */

/** Jetons de couleur du jeu (scènes toujours colorées, identiques en clair et en sombre). */
export const SKY_TOKENS = {
  "--game-douala-top": "#4fa6ec",
  "--game-douala-bottom": "#bfe6ff",
  "--game-sunset-top": "#e9563f",
  "--game-sunset-bottom": "#fdb565",
  "--game-night-top": "#08122a",
  "--game-night-bottom": "#1c2f63",
  "--game-storm-top": "#232a35",
  "--game-storm-bottom": "#566273",
  "--game-city": "#0d2c54",
  "--game-mountain": "#7a2e3b",
  "--game-mountain-near": "#4e1d2b",
  "--game-sun": "#ffd27a",
  "--game-moon": "#f4f1d6",
  "--game-light": "#ffffff",
  "--game-rain": "#c8dcff",
  "--game-coin": "#ffc23d",
  "--game-coin-edge": "#e8a317",
  "--game-gem": "#8fe3ff",
  "--game-bird": "#22324a",
  "--game-vulture": "#3b1a22",
  "--game-drone": "#3a4660",
  "--game-drone-arm": "#8a97a8",
  "--game-danger": "#ff5a5a",
  "--game-danger-dim": "#5a1a1a",
  "--game-spark": "#ffe66b",
  "--game-plane-body": "#ffffff",
  "--game-plane-shade": "#c9d5e6",
  "--game-plane-wing": "#f58b1f",
  "--game-plane-wing-edge": "#d9701a",
  "--game-plane-cockpit": "#0d2c54",
  "--game-plane-glass": "#8cc8ff",
  "--game-plane-stripe": "#1a6bb5",
  "--game-banner": "#081d38",
  "--game-banner-eyebrow": "#ffb467",
  "--game-overlay": "rgb(8 29 56 / 0.82)",
  "--game-button": "#ffffff",
  "--game-button-text": "#0d2c54",
  "--game-text-soft": "rgb(255 255 255 / 0.86)",
  "--game-hud": "rgb(8 29 56 / 0.72)",
  "--game-heart": "#ff8a8a",
  "--game-heart-empty": "rgb(255 255 255 / 0.45)",
} as const;

type TokenName = keyof typeof SKY_TOKENS;
export type Palette = Record<TokenName, string>;

/** Couleurs lues sur le conteneur ; l'habillage d'annonceur remplace celles de l'avion. */
export function readPalette(el: Element, skin: { plane_primary?: string | null; plane_secondary?: string | null } | null): Palette {
  const css = getComputedStyle(el);
  const p = {} as Palette;
  for (const name of Object.keys(SKY_TOKENS) as TokenName[]) p[name] = css.getPropertyValue(name).trim() || SKY_TOKENS[name];
  if (skin?.plane_primary) {
    p["--game-plane-stripe"] = skin.plane_primary;
    p["--game-plane-cockpit"] = skin.plane_primary;
  }
  if (skin?.plane_secondary) {
    p["--game-plane-wing"] = skin.plane_secondary;
    p["--game-plane-wing-edge"] = skin.plane_secondary;
  }
  return p;
}

const { width: W, height: H } = WORLD;
const TAU = Math.PI * 2;

type Cloud = { x: number; y: number; s: number; v: number };
type Star = { x: number; y: number; r: number; p: number };
type Drop = { x: number; y: number; v: number };
type Building = { x: number; w: number; h: number };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; color: string; text: string | null };

/** Éléments du décor (aléatoires, purement visuels) et effets (étincelles, « +10 »). */
export type Scenery = {
  clouds: Cloud[];
  stars: Star[];
  rain: Drop[];
  skyline: Building[];
  flash: number;
  particles: Particle[];
};

export function createScenery(rand: () => number = Math.random): Scenery {
  const skyline: Building[] = [];
  for (let x = 0; x < W + 40; ) {
    const w = 18 + rand() * 30;
    skyline.push({ x, w, h: 30 + rand() * 70 });
    x += w + 2;
  }
  return {
    clouds: Array.from({ length: 6 }, () => ({ x: rand() * W, y: rand() * H, s: 0.6 + rand() * 0.9, v: 0.25 + rand() * 0.35 })),
    stars: Array.from({ length: 70 }, () => ({ x: rand() * W, y: rand() * H, r: rand() * 1.4 + 0.3, p: rand() * 6 })),
    rain: Array.from({ length: 90 }, () => ({ x: rand() * W, y: rand() * H, v: 8 + rand() * 6 })),
    skyline,
    flash: 0,
    particles: [],
  };
}

/** Étincelles et texte flottant d'un objet attrapé ou d'un choc. */
export function burst(sc: Scenery, x: number, y: number, color: string, count: number, text: string | null = null): void {
  if (sc.particles.length > 120) return;
  for (let i = 0; i < count; i++) {
    const a = Math.random() * TAU;
    const v = 1 + Math.random() * 3;
    sc.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 30, color, text: null });
  }
  if (text) sc.particles.push({ x, y, vx: 0, vy: -1, life: 40, color, text });
}

function cloud(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, alpha: number, color: string) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, 18 * s, 0, TAU);
  ctx.arc(x + 20 * s, y - 8 * s, 22 * s, 0, TAU);
  ctx.arc(x + 44 * s, y, 17 * s, 0, TAU);
  ctx.arc(x + 22 * s, y + 6 * s, 18 * s, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;
}

/**
 * Décor du niveau. `frames` : temps écoulé en 1/60 s (0 = décor fixe : animations réduites ou jeu en pause).
 * `still` : animations réduites (ni scintillement, ni éclair).
 */
function background(ctx: CanvasRenderingContext2D, p: Palette, sc: Scenery, scene: Scene, level: number, t: number, frames: number, still: boolean) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, p[`--game-${scene}-top`]);
  g.addColorStop(1, p[`--game-${scene}-bottom`]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const sp = speedOf(level);

  if (scene === "sunset") {
    // Soleil couchant derrière le mont Cameroun.
    const sun = ctx.createRadialGradient(250, 470, 10, 250, 470, 120);
    sun.addColorStop(0, p["--game-sun"]);
    sun.addColorStop(1, "rgb(255 160 80 / 0)");
    ctx.fillStyle = sun;
    ctx.fillRect(0, 300, W, 340);
    ctx.fillStyle = p["--game-mountain"];
    ctx.beginPath();
    ctx.moveTo(0, 640);
    for (const [x, y] of [[0, 560], [90, 500], [150, 450], [185, 470], [230, 520], [300, 540], [360, 520], [360, 640]] as const) ctx.lineTo(x, y);
    ctx.fill();
    ctx.fillStyle = p["--game-mountain-near"];
    ctx.beginPath();
    ctx.moveTo(0, 640);
    for (const [x, y] of [[0, 600], [120, 575], [260, 590], [360, 570], [360, 640]] as const) ctx.lineTo(x, y);
    ctx.fill();
  }
  if (scene === "night") {
    ctx.fillStyle = p["--game-light"];
    for (const s of sc.stars) {
      ctx.globalAlpha = still ? 0.8 : 0.5 + 0.5 * Math.sin(t / 600 + s.p);
      ctx.fillRect(s.x, still ? s.y : (s.y + t * 0.01) % H, s.r, s.r);
    }
    ctx.globalAlpha = 1;
    // Croissant de lune.
    ctx.fillStyle = p["--game-moon"];
    ctx.beginPath();
    ctx.arc(285, 95, 26, 0, TAU);
    ctx.fill();
    ctx.fillStyle = p["--game-night-top"];
    ctx.beginPath();
    ctx.arc(297, 88, 24, 0, TAU);
    ctx.fill();
  }
  for (const c of sc.clouds) {
    c.y += c.v * sp * frames;
    if (c.y > H + 40) {
      c.y = -40;
      c.x = Math.random() * W;
    }
    cloud(ctx, c.x, c.y, c.s, scene === "night" ? 0.08 : scene === "storm" ? 0.18 : 0.55, p["--game-light"]);
  }
  if (scene === "douala") {
    // Silhouette de la ville.
    ctx.fillStyle = p["--game-city"];
    ctx.globalAlpha = 0.25;
    for (const b of sc.skyline) ctx.fillRect(b.x, H - b.h, b.w, b.h);
    ctx.globalAlpha = 0.4;
    ctx.fillRect(0, H - 14, W, 14);
    ctx.globalAlpha = 1;
  }
  if (scene === "storm") {
    ctx.strokeStyle = p["--game-rain"];
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (const r of sc.rain) {
      r.y += r.v * frames;
      r.x -= 1.5 * frames;
      if (r.y > H) {
        r.y = -10;
        r.x = Math.random() * W + 40;
      }
      ctx.moveTo(r.x, r.y);
      ctx.lineTo(r.x - 3, r.y + 12);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
    // Éclairs : jamais si les animations sont réduites.
    if (!still && frames > 0 && Math.random() < 0.004 * frames) sc.flash = 1;
    if (sc.flash > 0) {
      ctx.fillStyle = p["--game-light"];
      ctx.globalAlpha = sc.flash * 0.55;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
      sc.flash -= 0.06 * frames;
    }
  }
}

/** Avion vu de dessus : traînée, ailes (raccourcies dans le roulis), fuselage, cockpit, hélice qui tourne. */
function plane(ctx: CanvasRenderingContext2D, p: Palette, x: number, y: number, t: number, tilt: number, still: boolean) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt * 0.25);
  ctx.fillStyle = p["--game-light"];
  ctx.globalAlpha = 0.35;
  for (let i = 1; i <= 4; i++) {
    ctx.beginPath();
    ctx.arc(-9, 26 + i * 9, 4 - i * 0.7, 0, TAU);
    ctx.arc(9, 26 + i * 9, 4 - i * 0.7, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  const sq = 1 - Math.abs(tilt) * 0.18;
  ctx.fillStyle = p["--game-plane-wing"];
  ctx.beginPath();
  ctx.moveTo(0, -2);
  ctx.lineTo(-34 * sq, 10);
  ctx.lineTo(-34 * sq, 17);
  ctx.lineTo(0, 12);
  ctx.lineTo(34 * sq, 17);
  ctx.lineTo(34 * sq, 10);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = p["--game-plane-wing-edge"];
  ctx.fillRect(-34 * sq, 14, 68 * sq, 3);
  ctx.fillStyle = p["--game-plane-wing"];
  ctx.beginPath();
  ctx.moveTo(0, 22);
  ctx.lineTo(-13, 32);
  ctx.lineTo(13, 32);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = p["--game-plane-body"];
  ctx.beginPath();
  ctx.ellipse(0, 8, 8, 26, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = p["--game-plane-shade"];
  ctx.beginPath();
  ctx.ellipse(3, 8, 4, 24, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = p["--game-plane-cockpit"];
  ctx.beginPath();
  ctx.ellipse(0, -2, 4.5, 7, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = p["--game-plane-glass"];
  ctx.beginPath();
  ctx.ellipse(-1.2, -4, 1.6, 3, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = p["--game-plane-stripe"];
  ctx.fillRect(-8, 10, 16, 3);
  ctx.fillStyle = p["--game-plane-cockpit"];
  ctx.beginPath();
  ctx.arc(0, -18, 3.5, 0, TAU);
  ctx.fill();
  const a = still ? 0.6 : (t / 16) % Math.PI;
  ctx.strokeStyle = p["--game-light"];
  ctx.globalAlpha = 0.85;
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-15 * Math.cos(a), -18);
  ctx.lineTo(15 * Math.cos(a), -18);
  ctx.stroke();
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = p["--game-light"];
  ctx.beginPath();
  ctx.ellipse(0, -18, 16, 3, 0, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();
}

function coin(ctx: CanvasRenderingContext2D, p: Palette, o: GameObject, t: number, logo: HTMLImageElement | null, still: boolean) {
  const squash = still ? 1 : Math.abs(Math.cos(t / 220 + o.phase));
  ctx.save();
  ctx.translate(o.x, o.y);
  ctx.scale(Math.max(squash, 0.15), 1);
  ctx.fillStyle = p["--game-coin-edge"];
  ctx.beginPath();
  ctx.arc(0, 0, 11, 0, TAU);
  ctx.fill();
  ctx.fillStyle = p["--game-coin"];
  ctx.beginPath();
  ctx.arc(0, 0, 8.5, 0, TAU);
  ctx.fill();
  if (logo && squash > 0.5) {
    // Habillage d'annonceur : son logo sur les pièces.
    ctx.beginPath();
    ctx.arc(0, 0, 8.5, 0, TAU);
    ctx.clip();
    ctx.drawImage(logo, -8.5, -8.5, 17, 17);
  } else {
    ctx.fillStyle = p["--game-coin-edge"];
    ctx.font = "800 11px ui-rounded, -apple-system, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("N", 0, 0.5);
  }
  ctx.restore();
}

function gem(ctx: CanvasRenderingContext2D, p: Palette, o: GameObject, t: number, still: boolean) {
  ctx.save();
  ctx.translate(o.x, o.y);
  if (!still) ctx.rotate(Math.sin(t / 300 + o.phase) * 0.2);
  ctx.shadowColor = p["--game-gem"];
  ctx.shadowBlur = 12;
  ctx.fillStyle = p["--game-gem"];
  ctx.beginPath();
  ctx.moveTo(0, -13);
  ctx.lineTo(11, -3);
  ctx.lineTo(0, 13);
  ctx.lineTo(-11, -3);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = p["--game-light"];
  ctx.globalAlpha = 0.7;
  ctx.beginPath();
  ctx.moveTo(0, -13);
  ctx.lineTo(4, -3);
  ctx.lineTo(-4, -3);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function enemy(ctx: CanvasRenderingContext2D, p: Palette, o: GameObject, t: number, still: boolean) {
  ctx.save();
  ctx.translate(o.x, o.y);
  if (o.enemy === "bird" || o.enemy === "vulture") {
    const s = o.enemy === "vulture" ? 1.5 : 1;
    const flap = still ? 4 * s : Math.sin(t / 80 + o.phase) * 7 * s;
    ctx.strokeStyle = p[o.enemy === "vulture" ? "--game-vulture" : "--game-bird"];
    ctx.lineWidth = 3 * s;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-14 * s, -flap);
    ctx.quadraticCurveTo(-6 * s, -4 * s, 0, 0);
    ctx.quadraticCurveTo(6 * s, -4 * s, 14 * s, -flap);
    ctx.stroke();
    ctx.fillStyle = p["--game-danger"];
    ctx.beginPath();
    ctx.arc(0, 1, 2.2 * s, 0, TAU);
    ctx.fill();
  } else if (o.enemy === "drone") {
    ctx.fillStyle = p["--game-drone"];
    ctx.fillRect(-12, -4, 24, 8);
    ctx.strokeStyle = p["--game-drone-arm"];
    ctx.lineWidth = 2;
    for (const dx of [-14, 14]) {
      ctx.beginPath();
      ctx.moveTo(dx - 8, -8);
      ctx.lineTo(dx + 8, -8);
      ctx.stroke();
    }
    // Feux clignotants (allumés en continu si les animations sont réduites).
    ctx.fillStyle = still || Math.floor(t / 250 + o.phase) % 2 ? p["--game-danger"] : p["--game-danger-dim"];
    ctx.beginPath();
    ctx.arc(0, 4, 3, 0, TAU);
    ctx.fill();
  } else {
    const r = 11 + (still ? 0 : Math.sin(t / 90 + o.phase) * 2);
    ctx.shadowColor = p["--game-spark"];
    ctx.shadowBlur = 18;
    ctx.fillStyle = p["--game-spark"];
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.55, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = p["--game-light"];
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + (still ? 0 : t / 200);
      ctx.moveTo(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5);
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
  ctx.restore();
}

export type DrawOptions = {
  /** Horloge (ms) des animations. */
  t: number;
  /** Temps écoulé depuis l'image précédente, en 1/60 s (0 = décor immobile). */
  frames: number;
  /** Animations réduites : ni tremblement, ni clignotement, décor fixe. */
  still: boolean;
  logo: HTMLImageElement | null;
  /** Bandeau de niveau : « NIVEAU 2 » et nom du décor. */
  banner: { eyebrow: string; title: string } | null;
};

/** Dessin d'une image (coordonnées logiques 360 × 640, mises à l'échelle par la transformation du contexte). */
export function drawSky(ctx: CanvasRenderingContext2D, s: GameState, p: Palette, sc: Scenery, o: DrawOptions): void {
  const scene = sceneOf(s.level);
  const frames = o.still ? 0 : o.frames;
  ctx.save();
  if (s.shake > 0 && !o.still) {
    const k = s.shake * 56;
    ctx.translate((Math.random() - 0.5) * k, (Math.random() - 0.5) * k);
  }
  background(ctx, p, sc, scene, s.level, o.t, frames, o.still);
  for (const obj of s.objects) {
    if (!obj.active) continue;
    if (obj.type === "coin") coin(ctx, p, obj, o.t, o.logo, o.still);
    else if (obj.type === "gem") gem(ctx, p, obj, o.t, o.still);
    else enemy(ctx, p, obj, o.t, o.still);
  }
  // Invulnérable : l'avion clignote (ou devient translucide si les animations sont réduites).
  const tilt = Math.max(-1, Math.min(1, s.planeVx / 5));
  if (s.invulnerable > 0 && o.still) ctx.globalAlpha = 0.5;
  if (!(s.invulnerable > 0 && !o.still && Math.floor(o.t / 90) % 2 === 0)) plane(ctx, p, s.planeX, s.planeY, o.t, tilt, o.still);
  ctx.globalAlpha = 1;

  for (let i = sc.particles.length - 1; i >= 0; i--) {
    const q = sc.particles[i]!;
    q.x += q.vx * o.frames;
    q.y += q.vy * o.frames;
    q.life -= o.frames;
    if (q.life <= 0) {
      sc.particles.splice(i, 1);
      continue;
    }
    ctx.globalAlpha = Math.max(q.life / 40, 0);
    ctx.fillStyle = q.color;
    if (q.text) {
      ctx.font = "800 16px ui-rounded, -apple-system, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(q.text, q.x, q.y);
    } else ctx.fillRect(q.x, q.y, 3, 3);
  }
  ctx.globalAlpha = 1;

  if (o.banner && s.banner > 0) {
    ctx.globalAlpha = Math.min(1, s.banner * 2);
    ctx.fillStyle = p["--game-banner"];
    ctx.globalAlpha *= 0.7;
    ctx.fillRect(0, 250, W, 90);
    ctx.globalAlpha = Math.min(1, s.banner * 2);
    ctx.textAlign = "center";
    ctx.fillStyle = p["--game-banner-eyebrow"];
    ctx.font = "700 12px -apple-system, system-ui, sans-serif";
    ctx.fillText(o.banner.eyebrow, W / 2, 283);
    ctx.fillStyle = p["--game-light"];
    ctx.font = "800 26px ui-rounded, -apple-system, system-ui, sans-serif";
    ctx.fillText(o.banner.title, W / 2, 318);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}
