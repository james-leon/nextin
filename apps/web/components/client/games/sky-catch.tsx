"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { adFileUrl, type AdCandidate } from "@nextin/shared/ads";
import {
  BEST_SCORE_KEY,
  COIN_POINTS,
  PLANE,
  WORLD,
  advance,
  createGame,
  startLevel,
  type GameInput,
  type GameState,
} from "@nextin/shared/ads/sky-catch";
import { Button, IconButton } from "@/components/ui/button";
import type { GameSkin, SkyCatchResult } from "@/lib/client/games";
import { callRpc, SUPABASE_URL } from "@/lib/client/supabase-public";
import { cn } from "@/lib/cn";
import { useLiteLocale, useLiteT } from "@/lib/i18n/lite";
import { CouponCard } from "./coupon-card";
import { Interstitial } from "./interstitial";

type Palette = { skyTop: string; skyBottom: string; cloud: string; coin: string; coinEdge: string; storm: string; bolt: string; primary: string; secondary: string };

/** Couleurs du thème courant (jetons CSS) ; l'habillage Or remplace celles de l'avion. */
function readPalette(skin: GameSkin | null): Palette {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string) => css.getPropertyValue(name).trim();
  return {
    skyTop: v("--game-sky-top"),
    skyBottom: v("--game-sky-bottom"),
    cloud: v("--game-cloud"),
    coin: v("--game-coin"),
    coinEdge: v("--game-coin-edge"),
    storm: v("--game-storm"),
    bolt: v("--game-bolt"),
    primary: skin?.plane_primary ?? v("--accent-fill"),
    secondary: skin?.plane_secondary ?? v("--orange-fill"),
  };
}

function readBest(): number {
  try {
    return Number(localStorage.getItem(BEST_SCORE_KEY) ?? 0) || 0;
  } catch {
    return 0;
  }
}

/** Dessin d'une image du monde (coordonnées logiques 360 × 640, mises à l'échelle par la transformation). */
function draw(ctx: CanvasRenderingContext2D, s: GameState, p: Palette, logo: HTMLImageElement | null, clouds: number) {
  const g = ctx.createLinearGradient(0, 0, 0, WORLD.height);
  g.addColorStop(0, p.skyTop);
  g.addColorStop(1, p.skyBottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);

  // Nuages décoratifs qui défilent lentement (profondeur).
  ctx.fillStyle = p.cloud;
  for (let i = 0; i < 4; i++) {
    const y = ((clouds * (18 + i * 6) + i * 170) % (WORLD.height + 80)) - 40;
    const x = (i * 97 + 40) % WORLD.width;
    ctx.beginPath();
    ctx.ellipse(x, y, 46, 14, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 26, y - 8, 28, 12, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const o of s.objects) {
    if (!o.active) continue;
    if (o.kind === "coin") {
      const squash = Math.abs(Math.cos(o.spin));
      ctx.save();
      ctx.translate(o.x, o.y);
      ctx.scale(Math.max(squash, 0.25), 1);
      ctx.beginPath();
      ctx.arc(0, 0, o.r, 0, Math.PI * 2);
      ctx.fillStyle = p.coin;
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = p.coinEdge;
      ctx.stroke();
      if (logo && squash > 0.5) {
        ctx.beginPath();
        ctx.arc(0, 0, o.r - 3, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(logo, -(o.r - 3), -(o.r - 3), (o.r - 3) * 2, (o.r - 3) * 2);
      }
      ctx.restore();
    } else {
      ctx.fillStyle = p.storm;
      ctx.beginPath();
      ctx.ellipse(o.x, o.y, o.r * 1.2, o.r * 0.7, 0, 0, Math.PI * 2);
      ctx.ellipse(o.x - o.r * 0.6, o.y + 2, o.r * 0.7, o.r * 0.55, 0, 0, Math.PI * 2);
      ctx.ellipse(o.x + o.r * 0.6, o.y + 2, o.r * 0.7, o.r * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = p.bolt;
      ctx.beginPath();
      ctx.moveTo(o.x + 2, o.y + o.r * 0.4);
      ctx.lineTo(o.x - 6, o.y + o.r * 1.1);
      ctx.lineTo(o.x, o.y + o.r * 1.05);
      ctx.lineTo(o.x - 4, o.y + o.r * 1.6);
      ctx.lineTo(o.x + 7, o.y + o.r * 0.85);
      ctx.lineTo(o.x + 1, o.y + o.r * 0.9);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Avion vu de dessus, légèrement incliné dans la direction du mouvement.
  const w = PLANE.halfWidth;
  ctx.save();
  ctx.translate(s.planeX, PLANE.y);
  ctx.rotate(s.tilt * 0.18);
  ctx.fillStyle = p.secondary;
  ctx.beginPath();
  ctx.moveTo(-w, 4);
  ctx.quadraticCurveTo(0, -6, w, 4);
  ctx.lineTo(w * 0.8, 9);
  ctx.lineTo(-w * 0.8, 9);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = p.primary;
  ctx.beginPath();
  ctx.ellipse(0, 0, 6, PLANE.halfHeight + 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-9, 15);
  ctx.lineTo(9, 15);
  ctx.lineTo(0, 9);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

type Phase = "ready" | "playing" | "paused" | "level_complete" | "ad" | "game_over";

/**
 * Sky Catch (§12.7) : moteur pur de `@nextin/shared/ads/sky-catch`, rendu canvas 2D vectoriel. Pause automatique en
 * arrière-plan et pendant l'appel ; pub interstitielle entre deux niveaux ; bon de l'habillage en fin de partie.
 */
export function SkyCatch({
  token,
  skin,
  frozen,
  skipAfter,
  nextInterstitial,
  couponBaseUrl,
}: {
  token: string;
  skin: GameSkin | null;
  /** Appel en cours : partie figée. */
  frozen: boolean;
  skipAfter: number;
  nextInterstitial: () => AdCandidate | null;
  couponBaseUrl: string;
}) {
  const t = useLiteT("games");
  const locale = useLiteLocale();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const game = useRef<GameState>(createGame());
  const input = useRef<GameInput>({ targetX: null, direction: 0 });
  const playId = useRef<string | null>(null);
  const interstitials = useRef(0);
  const [phase, setPhase] = useState<Phase>("ready");
  const [hud, setHud] = useState({ level: 1, score: 0, coins: 0, time: 30 });
  const [ad, setAd] = useState<AdCandidate | null>(null);
  const [result, setResult] = useState<SkyCatchResult | null>(null);
  // Composant chargé seulement dans le navigateur : lecture directe du record local.
  const [best, setBest] = useState(readBest);
  const phaseRef = useRef<Phase>("ready");
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // Boucle d'animation : pas fixe (moteur), rendu à la fréquence de l'écran, 30 i/s si l'appareil peine.
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;
    let palette = readPalette(skin);
    let logo: HTMLImageElement | null = null;
    if (skin?.coin_logo_path) {
      const img = new Image();
      img.decoding = "async";
      img.crossOrigin = "anonymous";
      img.onload = () => (logo = img);
      img.src = adFileUrl(SUPABASE_URL, skin.coin_logo_path);
    }
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const style = getComputedStyle(wrap);
      const width = wrap.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const height = wrap.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
      const scale = Math.min(width / WORLD.width, height / WORLD.height);
      canvas.style.width = `${WORLD.width * scale}px`;
      canvas.style.height = `${WORLD.height * scale}px`;
      canvas.width = Math.round(WORLD.width * scale * dpr);
      canvas.height = Math.round(WORLD.height * scale * dpr);
      ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
      draw(ctx, game.current, palette, logo, 0);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    const themeObserver = new MutationObserver(() => (palette = readPalette(skin)));
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    const acc = { t: 0 };
    let last = performance.now();
    let raf = 0;
    let frame = 0;
    let slow = 0;
    let lastHud = 0;
    let clouds = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = (now - last) / 1000;
      last = now;
      // Appareil lent (> 40 ms par image en moyenne) : une image sur deux.
      slow = slow * 0.95 + (dt > 0.04 ? 1 : 0) * 0.05;
      frame += 1;
      const s = game.current;
      if (phaseRef.current !== "playing") return;
      advance(s, input.current, dt, acc, Math.random);
      clouds += dt;
      if (slow < 0.5 || frame % 2 === 0) draw(ctx, s, palette, logo, clouds);
      if (now - lastHud > 250 || s.status !== "playing") {
        lastHud = now;
        setHud({ level: s.level, score: s.score, coins: s.coins, time: Math.ceil(s.timeLeft) });
      }
      if (s.status === "level_complete") setPhase("level_complete");
      else if (s.status === "game_over") setPhase("game_over");
    };
    raf = requestAnimationFrame(tick);
    const onVisibility = () => {
      if (document.hidden && phaseRef.current === "playing") setPhase("paused");
      last = performance.now();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      themeObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [skin]);

  // Appel : la partie se fige (reprise possible ensuite).
  useEffect(() => {
    if (frozen && phaseRef.current === "playing") setPhase("paused");
  }, [frozen]);

  // Fin de partie : score envoyé (sans identifiant), record local, bon éventuel.
  useEffect(() => {
    if (phase !== "game_over" || !playId.current) return;
    const s = game.current;
    const id = playId.current;
    playId.current = null;
    if (s.score > readBest()) {
      try {
        localStorage.setItem(BEST_SCORE_KEY, String(s.score));
      } catch {
        // Record non gardé (stockage indisponible).
      }
      setBest(s.score);
    }
    void callRpc<SkyCatchResult>("finish_sky_catch", {
      p_ticket_token: token,
      p_play: id,
      p_levels: s.levelsCompleted,
      p_score: s.score,
      p_interstitials: interstitials.current,
    }).then(({ data }) => setResult(data ?? { levels: s.levelsCompleted, score: s.score, coupon: null }));
  }, [phase, token]);

  const newGame = useCallback(async () => {
    game.current = createGame();
    interstitials.current = 0;
    setResult(null);
    const { data } = await callRpc<string>("start_sky_catch", { p_ticket_token: token, p_skin: skin?.id ?? null });
    playId.current = data;
    startLevel(game.current);
    setHud({ level: 1, score: 0, coins: 0, time: Math.ceil(game.current.timeLeft) });
    setPhase("playing");
    canvasRef.current?.focus();
  }, [skin, token]);

  function nextLevel() {
    const due = nextInterstitial();
    if (due) {
      interstitials.current += 1;
      setAd(due);
      setPhase("ad");
      return;
    }
    resumeNextLevel();
  }

  function resumeNextLevel() {
    setAd(null);
    startLevel(game.current);
    setPhase("playing");
    canvasRef.current?.focus();
  }

  function pointer(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    input.current.targetX = ((e.clientX - rect.left) / rect.width) * WORLD.width;
  }

  function key(e: React.KeyboardEvent<HTMLCanvasElement>, down: boolean) {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      input.current.targetX = null;
      input.current.direction = down ? (e.key === "ArrowLeft" ? -1 : 1) : 0;
    } else if (down && (e.key === " " || e.key === "Escape") && phase === "playing") {
      e.preventDefault();
      setPhase("paused");
    }
  }

  if (phase === "ad" && ad) return <Interstitial ad={ad} token={token} skipAfter={skipAfter} onDone={resumeNextLevel} />;

  const reward = skin ? (locale === "en" && skin.reward_en ? skin.reward_en : skin.reward) : null;
  const light = "bg-white text-navy hover:bg-white/90 active:bg-white/80";
  const eyebrow = "text-caption font-bold tracking-[0.14em] text-orange uppercase";
  const overlay =
    phase === "ready" ? (
      <Overlay>
        <p className={eyebrow}>{t("pairsEyebrow")}</p>
        <p className="font-rounded text-large-title font-extrabold">{t("skyCatch")}</p>
        <p className="max-w-[28ch] text-subheadline text-white/85">{t("skyCatchBody")}</p>
        <p className="flex flex-wrap justify-center gap-3.5 text-footnote text-white/85">
          <span className="flex items-center gap-1.5">
            <i aria-hidden className="size-3 rounded-full bg-[var(--game-coin)]" />
            {t("legendCoin", { points: COIN_POINTS })}
          </span>
          <span className="flex items-center gap-1.5">
            <i aria-hidden className="size-3 rounded-full bg-[var(--game-storm)]" />
            {t("legendStorm")}
          </span>
        </p>
        {skin ? (
          <p className="text-footnote text-white/85">
            {t("sponsoredBy", { advertiser: skin.advertiser })}
            {reward ? ` · ${reward}` : ""}
          </p>
        ) : null}
        <Button className={light} onClick={newGame} leadingIcon={<Play />}>
          {t("start")}
        </Button>
        <p className="max-w-[30ch] text-footnote text-white/75">
          {t("controls")} {t("autoStop")}
        </p>
        {best ? <p className="text-footnote text-white/75">{t("best", { score: best })}</p> : null}
      </Overlay>
    ) : phase === "paused" ? (
      <Overlay>
        <p className="font-rounded text-large-title font-extrabold">{t("paused")}</p>
        <Button className={light} onClick={() => (setPhase("playing"), canvasRef.current?.focus())} leadingIcon={<Play />}>
          {t("resume")}
        </Button>
      </Overlay>
    ) : phase === "level_complete" ? (
      <Overlay>
        <p className={eyebrow}>{t("level", { n: hud.level })}</p>
        <p className="font-rounded text-title1 font-extrabold">{t("levelComplete", { n: hud.level })}</p>
        <p className="font-rounded text-headline text-white/85 tabular">
          {hud.score} · {t("coins", { count: hud.coins })}
        </p>
        <Button className={light} onClick={nextLevel}>
          {t("nextLevel")}
        </Button>
      </Overlay>
    ) : phase === "game_over" ? (
      <Overlay scroll>
        <p className={eyebrow}>{t("gameOver")}</p>
        <p className="font-rounded text-[56px] leading-none font-extrabold tabular">{hud.score}</p>
        {skin ? <p className="text-title3 font-bold">{locale === "en" && skin.end_title_en ? skin.end_title_en : skin.end_title}</p> : null}
        <p className="text-subheadline text-white/85 tabular">
          {t("level", { n: hud.level })} · {t("best", { score: best })}
        </p>
        {result?.coupon ? (
          <div className="w-full text-label">
            <CouponCard coupon={result.coupon} couponBaseUrl={couponBaseUrl} advertiser={skin?.advertiser} />
          </div>
        ) : null}
        <Button className={light} onClick={newGame} leadingIcon={<Play />}>
          {t("playAgain")}
        </Button>
      </Overlay>
    ) : null;

  const chip = "rounded-full bg-black/45 px-2.5 py-1.5 font-rounded text-footnote font-bold text-white tabular";
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={wrapRef} className="relative flex min-h-0 flex-1 items-center justify-center p-4">
        <div className="relative overflow-hidden rounded-[28px] bg-navy">
          <canvas
            ref={canvasRef}
            tabIndex={0}
            aria-label={`${t("skyCatch")} · ${t("controls")}`}
            className="block touch-none outline-none focus-visible:shadow-[inset_0_0_0_3px_var(--accent-tint)]"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              pointer(e);
            }}
            onPointerMove={(e) => e.buttons && pointer(e)}
            onPointerUp={() => (input.current.targetX = null)}
            onKeyDown={(e) => key(e, true)}
            onKeyUp={(e) => key(e, false)}
          />
          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center gap-2 p-3" aria-live="off">
            <span className={chip}>{hud.score}</span>
            <span className={cn(chip, "font-semibold")}>{t("level", { n: hud.level })}</span>
            <span className={cn(chip, "ml-auto")}>{t("timeLeft", { seconds: hud.time })}</span>
          </div>
          <div className="absolute top-14 right-3">
            <IconButton
              label={phase === "playing" ? t("pause") : t("resume")}
              icon={phase === "playing" ? <Pause /> : <Play />}
              variant="plain"
              className="rounded-[12px] bg-black/45 text-white hover:bg-black/55 disabled:opacity-0"
              disabled={phase !== "playing" && phase !== "paused"}
              onClick={() => setPhase(phase === "playing" ? "paused" : "playing")}
            />
          </div>
          {overlay}
        </div>
      </div>
    </div>
  );
}

function Overlay({ children, scroll }: { children: React.ReactNode; scroll?: boolean }) {
  return (
    <div
      className={cn(
        "absolute inset-0 flex flex-col items-center justify-center gap-3.5 bg-navy/85 p-6 text-center text-white",
        scroll && "justify-start overflow-y-auto",
      )}
    >
      {children}
    </div>
  );
}
