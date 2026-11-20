"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Heart, Music, Pause, Play, RotateCcw, Volume2 } from "lucide-react";
import { adFileUrl, type AdCandidate } from "@nextin/shared/ads";
import {
  BEST_SCORE_KEY,
  WORLD,
  LIVES,
  advance,
  createGame,
  placeOnPlane,
  sceneOf,
  startGame,
  type GameInput,
  type GameState,
  type ObjectType,
  type Scene,
} from "@nextin/shared/ads/sky-catch";
import type { GameSkin, SkyCatchResult } from "@/lib/client/games";
import { callRpc, SUPABASE_URL } from "@/lib/client/supabase-public";
import { useLiteLocale, useLiteT } from "@/lib/i18n/lite";
import { cn } from "@/lib/cn";
import { CouponCard } from "./coupon-card";
import { Interstitial } from "./interstitial";
import { createSkyAudio, readSoundPrefs, type SkyAudio, type SoundPrefs } from "./sky-audio";
import { SKY_TOKENS, burst, createScenery, drawSky, readPalette, type Palette } from "./sky-scene";

type Phase = "ready" | "playing" | "paused" | "ad" | "over" | "frozen";

const SCENE_KEY: Record<Scene, string> = { douala: "sceneDouala", sunset: "sceneSunset", night: "sceneNight", storm: "sceneStorm" };

function readBest(): number {
  try {
    return Number(localStorage.getItem(BEST_SCORE_KEY) ?? 0) || 0;
  } catch {
    return 0;
  }
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Sky Catch (maquette v2 12) : moteur pur de `@nextin/shared/ads/sky-catch` (trois vies, pièces et gemmes, quatre
 * décors tous les 200 points), rendu canvas sans bibliothèque (`sky-scene.ts`), sons Web Audio (`sky-audio.ts`).
 * Pause automatique en arrière-plan ; pub interstitielle au passage d'un niveau (espacement de la plateforme) ; bon de
 * l'habillage en fin de partie. À l'appel, la partie se fige et le score est enregistré (`onSaved`).
 */
export function SkyCatch({
  token,
  skin,
  frozen,
  skipAfter,
  nextInterstitial,
  couponBaseUrl,
  onSaved,
}: {
  token: string;
  skin: GameSkin | null;
  /** Appel en cours : partie figée et enregistrée. */
  frozen: boolean;
  skipAfter: number;
  nextInterstitial: () => AdCandidate | null;
  couponBaseUrl: string;
  /** Partie enregistrée à l'appel : score et bon éventuel (affichés par « C'est votre tour »). */
  onSaved?: (result: SkyCatchResult) => void;
}) {
  const t = useLiteT("games");
  const locale = useLiteLocale();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const game = useRef<GameState>(createGame());
  const input = useRef<GameInput>({ target: null, dx: 0, dy: 0 });
  const keys = useRef({ left: false, right: false, up: false, down: false });
  const playId = useRef<string | null>(null);
  const interstitials = useRef(0);
  const audio = useRef<SkyAudio | null>(null);
  const [phase, setPhase] = useState<Phase>("ready");
  const phaseRef = useRef<Phase>("ready");
  const [hud, setHud] = useState({ score: 0, level: 1, lives: LIVES });
  const [announce, setAnnounce] = useState("");
  const [ad, setAd] = useState<AdCandidate | null>(null);
  const [result, setResult] = useState<SkyCatchResult | null>(null);
  // Composant chargé seulement dans le navigateur : lecture directe des préférences de l'appareil.
  const [best, setBest] = useState(readBest);
  const [sound, setSound] = useState<SoundPrefs>(readSoundPrefs);
  const textsRef = useRef({ level: (n: number) => t("level", { n }), scene: (s: Scene) => t(SCENE_KEY[s]) });
  useEffect(() => {
    textsRef.current = { level: (n: number) => t("level", { n }), scene: (s: Scene) => t(SCENE_KEY[s]) };
  }, [t]);

  const go = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
    const sky = audio.current;
    if (!sky) return;
    if (next === "playing") sky.startMusic(game.current.level);
    else sky.stopMusic();
  }, []);

  useEffect(() => {
    audio.current = createSkyAudio(readSoundPrefs());
    return () => audio.current?.close();
  }, []);

  // Fin de partie (trois chocs) ou appel : score envoyé sans identifiant, record local, bon éventuel.
  const save = useCallback(
    (reason: "over" | "frozen") => {
      const s = game.current;
      if (s.score > readBest()) {
        try {
          localStorage.setItem(BEST_SCORE_KEY, String(s.score));
        } catch {
          // Record non gardé (stockage indisponible).
        }
        setBest(s.score);
      }
      const id = playId.current;
      playId.current = null;
      const fallback: SkyCatchResult = { levels: s.levelsCompleted, score: s.score, coupon: null };
      if (!id) {
        if (reason === "frozen") onSaved?.(fallback);
        return;
      }
      void callRpc<SkyCatchResult>("finish_sky_catch", {
        p_ticket_token: token,
        p_play: id,
        p_levels: s.levelsCompleted,
        p_score: s.score,
        p_interstitials: interstitials.current,
      }).then(({ data }) => {
        const saved = data ?? fallback;
        setResult(saved);
        if (reason === "frozen") onSaved?.(saved);
      });
    },
    [onSaved, token],
  );

  // Boucle d'animation : pas fixe (moteur), rendu à la fréquence de l'écran, une image sur deux si l'appareil peine.
  useEffect(() => {
    const canvas = canvasRef.current;
    const area = areaRef.current;
    const stage = stageRef.current;
    if (!canvas || !area || !stage) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;
    let palette: Palette = readPalette(stage, skin);
    let still = prefersReducedMotion();
    const scenery = createScenery();
    let logo: HTMLImageElement | null = null;
    if (skin?.coin_logo_path) {
      const img = new Image();
      img.decoding = "async";
      img.crossOrigin = "anonymous";
      img.onload = () => (logo = img);
      img.src = adFileUrl(SUPABASE_URL, skin.coin_logo_path);
    }
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMotion = () => (still = motion.matches);
    motion.addEventListener("change", onMotion);

    const render = (now: number, frames: number) => {
      const s = game.current;
      const showBanner = phaseRef.current === "playing" && s.banner > 0;
      drawSky(ctx, s, palette, scenery, {
        t: now,
        frames,
        still,
        logo,
        banner: showBanner ? { eyebrow: textsRef.current.level(s.level).toUpperCase(), title: textsRef.current.scene(sceneOf(s.level)) } : null,
      });
    };
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const scale = Math.min(area.clientWidth / WORLD.width, area.clientHeight / WORLD.height);
      stage.style.width = `${WORLD.width * scale}px`;
      stage.style.height = `${WORLD.height * scale}px`;
      canvas.width = Math.round(WORLD.width * scale * dpr);
      canvas.height = Math.round(WORLD.height * scale * dpr);
      ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
      palette = readPalette(stage, skin);
      render(performance.now(), 0);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(area);

    const acc = { t: 0 };
    let last = performance.now();
    let raf = 0;
    let frame = 0;
    let slow = 0;
    let lastHud = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min((now - last) / 1000, 0.25);
      last = now;
      slow = slow * 0.95 + (dt > 0.04 ? 1 : 0) * 0.05;
      frame += 1;
      const s = game.current;
      const playing = phaseRef.current === "playing";
      if (playing) {
        const k = keys.current;
        input.current.dx = k.left === k.right ? 0 : k.left ? -1 : 1;
        input.current.dy = k.up === k.down ? 0 : k.up ? -1 : 1;
        advance(s, input.current, dt, acc, Math.random);
        // Un événement (pièce, choc, niveau) met le tableau de bord à jour tout de suite.
        if (s.events.length) lastHud = 0;
        handleEvents(s);
      }
      // Décor animé seulement pendant la partie ; image fixe sinon (pause, écrans, appel).
      if (playing && (slow < 0.5 || frame % 2 === 0)) render(now, dt * 60);
      if (playing && (now - lastHud > 150 || s.status !== "playing")) {
        // `playing` vaut pour cette image même si un événement vient d'ouvrir une pub : le niveau atteint s'affiche.
        lastHud = now;
        setHud({ score: s.score, level: s.level, lives: s.lives });
      }
    };
    // Sons, effets et annonces des événements du pas (vidés ensuite).
    const handleEvents = (s: GameState) => {
      const sky = audio.current;
      for (const e of s.events) {
        if (e.type === "coin") {
          sky?.play("coin");
          burst(scenery, e.x, e.y, palette["--game-coin"], 8, "+10");
        } else if (e.type === "gem") {
          sky?.play("gem");
          burst(scenery, e.x, e.y, palette["--game-gem"], 14, "+50");
        } else if (e.type === "hit") {
          sky?.play("hit");
          burst(scenery, e.x, e.y, palette["--game-danger"], 16);
          try {
            navigator.vibrate?.(80);
          } catch {
            // Vibration indisponible.
          }
          setAnnounce(t("lifeLost", { count: s.lives }));
        } else if (e.type === "level") {
          sky?.play("level");
          setAnnounce(t("levelScene", { n: s.level, scene: textsRef.current.scene(sceneOf(s.level)) }));
          const due = nextInterstitial();
          if (due) {
            interstitials.current += 1;
            setAd(due);
            go("ad");
          } else sky?.startMusic(s.level);
        } else if (e.type === "over") {
          sky?.play("over");
          setHud({ score: s.score, level: s.level, lives: 0 });
          go("over");
          save("over");
        }
      }
      s.events.length = 0;
    };
    raf = requestAnimationFrame(tick);
    const onVisibility = () => {
      if (document.hidden && phaseRef.current === "playing") go("paused");
      last = performance.now();
    };
    document.addEventListener("visibilitychange", onVisibility);

    // Tests automatisés seulement (drapeau posé par Playwright) : placer un objet devant l'avion.
    let testHook = false;
    try {
      testHook = localStorage.getItem("nextin.e2e") === "1";
    } catch {
      testHook = false;
    }
    const w = window as Window & { __skyCatch?: { state: () => GameState; place: (type: ObjectType) => void; score: (n: number) => void } };
    if (testHook) {
      w.__skyCatch = {
        state: () => game.current,
        place: (type) => placeOnPlane(game.current, type),
        score: (n) => void (game.current.score = n),
      };
    }
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      motion.removeEventListener("change", onMotion);
      document.removeEventListener("visibilitychange", onVisibility);
      if (testHook) delete w.__skyCatch;
    };
  }, [skin, go, nextInterstitial, save, t]);

  // Appel : la partie se fige et le score est enregistré.
  useEffect(() => {
    if (!frozen) return;
    const current = phaseRef.current;
    // Affichage dérivé de `frozen` (pas d'état modifié ici) ; la boucle et la musique s'arrêtent.
    phaseRef.current = "frozen";
    audio.current?.stopMusic();
    if (current === "playing" || current === "paused" || current === "ad") save("frozen");
    else onSaved?.({ levels: game.current.levelsCompleted, score: game.current.score, coupon: null });
    // Uniquement au passage à l'appel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frozen]);

  // Clavier : flèches pour piloter, Espace pour la pause (jamais quand un bouton a le focus : il réagit déjà).
  useEffect(() => {
    const map: Record<string, keyof typeof keys.current> = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down" };
    const down = (e: KeyboardEvent) => {
      const dir = map[e.key];
      if (dir) {
        keys.current[dir] = true;
        if (phaseRef.current === "playing") e.preventDefault();
        return;
      }
      if (e.key !== " " || (e.target as HTMLElement | null)?.closest("button, input, a")) return;
      if (phaseRef.current === "playing") {
        e.preventDefault();
        go("paused");
      } else if (phaseRef.current === "paused") {
        e.preventDefault();
        go("playing");
      }
    };
    const up = (e: KeyboardEvent) => {
      const dir = map[e.key];
      if (dir) keys.current[dir] = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [go]);

  const newGame = useCallback(async () => {
    audio.current?.unlock();
    startGame(game.current);
    interstitials.current = 0;
    setResult(null);
    setHud({ score: 0, level: 1, lives: LIVES });
    setAnnounce(t("levelScene", { n: 1, scene: t(SCENE_KEY.douala) }));
    go("playing");
    const { data } = await callRpc<string>("start_sky_catch", { p_ticket_token: token, p_skin: skin?.id ?? null });
    playId.current = data;
  }, [go, skin, t, token]);

  function toggleSound(kind: keyof SoundPrefs) {
    const sky = audio.current;
    sky?.unlock();
    const next = { ...sound, [kind]: !sound[kind] };
    setSound(next);
    sky?.setPrefs(next);
    if (kind === "music" && next.music && phaseRef.current === "playing") sky?.startMusic(game.current.level);
  }

  function pointer(e: React.PointerEvent<HTMLCanvasElement>) {
    if (phaseRef.current !== "playing") return;
    const rect = e.currentTarget.getBoundingClientRect();
    // Cible un peu au-dessus du doigt : l'avion reste visible sous le pouce.
    input.current.target = { x: ((e.clientX - rect.left) / rect.width) * WORLD.width, y: ((e.clientY - rect.top) / rect.height) * WORLD.height - 40 };
  }

  const reward = skin ? (locale === "en" && skin.reward_en ? skin.reward_en : skin.reward) : null;
  const sceneName = t(SCENE_KEY[sceneOf(hud.level)]);
  const view: Phase = frozen ? "frozen" : phase;
  const overlay =
    view === "ready" ? (
      <Overlay>
        <p className="text-footnote font-bold tracking-[0.14em] uppercase" style={{ color: "var(--game-banner-eyebrow)" }}>
          {t("eyebrow")}
        </p>
        <h2 className="text-large-title font-extrabold">{t("skyCatch")}</h2>
        <p className="max-w-[28ch] text-subheadline" style={{ color: "var(--game-text-soft)" }}>
          {t("howTo")}
        </p>
        <ul role="list" className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-footnote" style={{ color: "var(--game-text-soft)" }}>
          {(
            [
              ["--game-coin", "legendCoin"],
              ["--game-gem", "legendGem"],
              ["--game-danger", "legendObstacle"],
            ] as const
          ).map(([color, key]) => (
            <li key={key} className="flex items-center gap-1.5">
              <span aria-hidden className="size-3 rounded-full" style={{ background: `var(${color})` }} />
              {t(key)}
            </li>
          ))}
        </ul>
        {skin ? (
          <p className="text-footnote" style={{ color: "var(--game-text-soft)" }}>
            {t("sponsoredBy", { advertiser: skin.advertiser })}
            {reward ? ` · ${reward}` : ""}
          </p>
        ) : null}
        <PlayButton onClick={newGame} icon={<Play />}>
          {t("play")}
        </PlayButton>
        <p className="max-w-[30ch] text-footnote" style={{ color: "var(--game-text-soft)" }}>
          {t("stopsAtCall")} <span className="max-md:hidden">{t("controls")}</span>
        </p>
        {best ? (
          <p className="tabular text-footnote" style={{ color: "var(--game-text-soft)" }}>
            {t("bestScore", { score: best })}
          </p>
        ) : null}
      </Overlay>
    ) : view === "paused" ? (
      <Overlay>
        <h2 className="text-large-title font-extrabold">{t("pause")}</h2>
        <PlayButton onClick={() => go("playing")} icon={<Play />}>
          {t("resume")}
        </PlayButton>
      </Overlay>
    ) : view === "over" ? (
      <Overlay scroll>
        <p className="text-footnote font-bold tracking-[0.14em] uppercase" style={{ color: "var(--game-banner-eyebrow)" }}>
          {skin ? (locale === "en" && skin.end_title_en ? skin.end_title_en : skin.end_title) : t("gameOver")}
        </p>
        <p className="font-rounded text-[3.5rem] leading-none font-extrabold tabular">{hud.score}</p>
        <p className="tabular text-subheadline" style={{ color: "var(--game-text-soft)" }}>
          {t("bestScore", { score: best })}
        </p>
        {result?.coupon ? <CouponCard coupon={result.coupon} couponBaseUrl={couponBaseUrl} advertiser={skin?.advertiser} /> : null}
        <PlayButton onClick={newGame} icon={<RotateCcw />}>
          {t("playAgain")}
        </PlayButton>
      </Overlay>
    ) : null;

  const inGame = view === "playing" || view === "paused";
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div ref={areaRef} className="relative flex min-h-0 flex-1 items-center justify-center p-3">
        <div
          ref={stageRef}
          className="squircle relative overflow-hidden rounded-[var(--radius-2xl)] text-white select-none"
          style={SKY_TOKENS as React.CSSProperties}
        >
          <canvas
            ref={canvasRef}
            aria-label={t("canvasLabel")}
            role="img"
            className="absolute inset-0 size-full touch-none"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              pointer(e);
            }}
            onPointerMove={(e) => (e.pointerType !== "mouse" || e.buttons) && pointer(e)}
            onPointerUp={() => (input.current.target = null)}
            onPointerCancel={() => (input.current.target = null)}
          />
          {/* Tableau de bord : score, niveau et décor, vies ; à droite musique, effets et pause. */}
          <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-center gap-1.5 p-3 pr-[3.75rem] text-subheadline font-bold">
            <span className="tabular rounded-full px-2.5 py-1" style={{ background: "var(--game-hud)" }} data-testid="sky-score">
              {t("points", { score: hud.score })}
            </span>
            <span className="rounded-full px-2.5 py-1 text-footnote font-semibold" style={{ background: "var(--game-hud)" }} data-testid="sky-level">
              {t("levelScene", { n: hud.level, scene: sceneName })}
            </span>
            <span
              role="img"
              aria-label={t("lives", { count: hud.lives })}
              data-testid="sky-lives"
              data-lives={hud.lives}
              className="flex items-center gap-0.5 rounded-full px-2 py-1.5"
              style={{ background: "var(--game-hud)" }}
            >
              {Array.from({ length: LIVES }, (_, i) => (
                <Heart
                  key={i}
                  aria-hidden
                  className="size-3.5"
                  style={{ color: i < hud.lives ? "var(--game-heart)" : "var(--game-heart-empty)", fill: i < hud.lives ? "currentColor" : "none" }}
                />
              ))}
            </span>
          </div>
          <div className="absolute top-3 right-3 z-20 flex flex-col gap-2">
            <GameButton label={t("music")} pressed={sound.music} onClick={() => toggleSound("music")} icon={<Music />} />
            <GameButton label={t("sfx")} pressed={sound.sfx} onClick={() => toggleSound("sfx")} icon={<Volume2 />} />
            <GameButton
              label={view === "paused" ? t("resume") : t("pause")}
              disabled={!inGame}
              onClick={() => go(view === "playing" ? "paused" : "playing")}
              icon={view === "paused" ? <Play /> : <Pause />}
            />
          </div>
          {overlay}
          {view === "ad" && ad ? (
            // Pub interstitielle au passage d'un niveau : par-dessus le jeu (le canvas reste monté), puis reprise.
            <div className="absolute inset-0 z-30 flex flex-col overflow-y-auto bg-grouped text-label">
              <Interstitial
                ad={ad}
                token={token}
                skipAfter={skipAfter}
                onDone={() => {
                  setAd(null);
                  go("playing");
                }}
              />
            </div>
          ) : null}
          <p aria-live="polite" className="sr-only">
            {announce}
          </p>
        </div>
      </div>
    </div>
  );
}

function PlayButton({ onClick, icon, children }: { onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="pressable squircle inline-flex min-h-12 items-center justify-center gap-2 rounded-[14px] px-7 text-headline font-bold [&_svg]:size-5"
      style={{ background: "var(--game-button)", color: "var(--game-button-text)" }}
    >
      {icon}
      {children}
    </button>
  );
}

function GameButton({ label, icon, onClick, pressed, disabled }: { label: string; icon: React.ReactNode; onClick: () => void; pressed?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "pressable squircle flex size-11 items-center justify-center rounded-[12px] text-white disabled:opacity-40 [&_svg]:size-5 [&_svg]:stroke-2",
        pressed === false && "opacity-55",
      )}
      style={{ background: "var(--game-hud)" }}
    >
      {icon}
    </button>
  );
}

function Overlay({ children, scroll }: { children: React.ReactNode; scroll?: boolean }) {
  return (
    <div
      className={cn("absolute inset-0 z-10 flex flex-col items-center justify-center gap-3.5 p-6 text-center", scroll && "justify-start overflow-y-auto pt-10")}
      style={{ background: "var(--game-overlay)" }}
    >
      {children}
    </div>
  );
}
