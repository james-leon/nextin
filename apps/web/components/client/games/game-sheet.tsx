"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, CircleHelp, Gift, Layers, Plane, WifiOff } from "lucide-react";
import { interstitialDue, type AdCandidate } from "@nextin/shared/ads";
import { BEST_SCORE_KEY } from "@nextin/shared/ads/sky-catch";
import { PAIR_LEVELS } from "@nextin/shared/games/pairs";
import { Button } from "@/components/ui/button";
import { LiveIndicator } from "@/components/ui/badge";
import { CalloutCard } from "@/components/ui/callout-card";
import { Spinner } from "@/components/ui/spinner";
import type { GameSession, SkyCatchResult } from "@/lib/client/games";
import { CouponCard } from "./coupon-card";
import { flushAdEvents } from "@/lib/client/ad-events";
import { callRpc } from "@/lib/client/supabase-public";
import { cn } from "@/lib/cn";
import { LiteIntlProvider, useLiteLocale, useLiteT } from "@/lib/i18n/lite";
import { PairsGame, readPairsBest } from "./pairs-game";
import { QuizGame } from "./quiz-game";
import { QuizSeries, readQuizBest } from "./quiz-series";
import { SkyCatch } from "./sky-catch";

export type GameKind = "quiz" | "series" | "pairs" | "sky";

/** Record de Sky Catch sur l'appareil (null si aucun ou stockage indisponible). */
function readSkyBest(): number | null {
  try {
    const n = Number(localStorage.getItem(BEST_SCORE_KEY));
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

const subscribeOnline = (cb: () => void) => {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
};

/**
 * Charge les textes des jeux (route légère, mise en cache) puis affiche la feuille, dans un portail : la page du ticket
 * derrière devient inerte (ni focus ni lecteur d'écran) tant que la feuille est ouverte.
 */
export function GameSheet(props: Parameters<typeof GameSheetContent>[0]) {
  const [messages, setMessages] = useState<{ locale: string; games: Record<string, unknown> } | null>(null);
  useEffect(() => {
    const page = document.querySelector("main");
    page?.setAttribute("inert", "");
    return () => page?.removeAttribute("inert");
  }, []);
  useEffect(() => {
    let alive = true;
    fetch("/api/i18n/games")
      .then((r) => (r.ok ? r.json() : null))
      .then((m) => alive && m && setMessages(m))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  return createPortal(
    messages ? (
      <LiteIntlProvider locale={messages.locale} messages={{ games: messages.games }}>
        <GameSheetContent {...props} />
      </LiteIntlProvider>
    ) : (
      <div role="dialog" aria-modal="true" aria-busy="true" aria-label={props.code} className="fixed inset-0 z-50 flex items-center justify-center bg-grouped">
        <Spinner />
      </div>
    ),
    document.body,
  );
}

function GameSheetContent({
  token,
  code,
  status,
  call,
  couponBaseUrl,
  onClose,
}: {
  token: string;
  code: string;
  /** Attente affichée en tête (« 12 min · 3 devant vous »). */
  status: string;
  /** Appel en cours : guichet ou cabinet à rejoindre. */
  call: { counter: string } | null;
  couponBaseUrl: string;
  onClose: () => void;
}) {
  const t = useLiteT("games");
  const locale = useLiteLocale();
  const [session, setSession] = useState<GameSession | null | "error">(null);
  const [kind, setKind] = useState<GameKind | null>(null);
  // Partie de Sky Catch enregistrée à l'appel : score (et bon éventuel) rappelés sur « C'est votre tour ».
  const [saved, setSaved] = useState<SkyCatchResult | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const turnRef = useRef<HTMLButtonElement>(null);
  const lastAd = useRef<number | null>(null);
  const adIndex = useRef(0);
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);

  useEffect(() => {
    let alive = true;
    void callRpc<GameSession | null>("game_session", { p_ticket_token: token }).then(({ data }) => alive && setSession(data ?? "error"));
    return () => {
      alive = false;
    };
  }, [token]);

  // Feuille modale : défilement de la page bloqué, focus sur « Fermer », Échap pour quitter, statistiques envoyées.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
      previous?.focus?.();
      void flushAdEvents();
    };
  }, [onClose]);

  useEffect(() => {
    if (call) turnRef.current?.focus();
  }, [call]);

  // Interstitielles : lot tiré par la base, dans l'ordre, avec l'espacement minimal de la plateforme.
  const nextInterstitial = useCallback((): AdCandidate | null => {
    if (session === null || session === "error") return null;
    if (!interstitialDue(Date.now(), lastAd.current, session.interstitial.min_gap, session.sequence.length > 0)) return null;
    const id = session.sequence[adIndex.current % session.sequence.length];
    adIndex.current += 1;
    const ad = session.ads.find((a) => a.creative_id === id) ?? null;
    if (ad) lastAd.current = Date.now();
    return ad;
  }, [session]);

  const ready = session !== null && session !== "error";
  const quiz = ready ? session.quiz : null;
  const sky = ready ? session.sky_catch : null;
  const series = ready && session.quiz_bank === true;
  const en = locale === "en";
  // Records de l'appareil, relus à chaque retour à la liste des jeux.
  const records = useMemo(() => {
    if (kind) return null;
    const pairsLevel = PAIR_LEVELS.find((p) => readPairsBest(p) !== null);
    return {
      sky: readSkyBest(),
      series: readQuizBest(),
      pairs: pairsLevel ? { moves: readPairsBest(pairsLevel)!, level: PAIR_LEVELS.indexOf(pairsLevel) } : null,
    };
  }, [kind]);
  const levelKeys = ["levelEasy", "levelMedium", "levelHard"] as const;

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="game-sheet-title" className="fixed inset-0 z-50 flex flex-col bg-grouped safe-top">
      <header className="flex items-center gap-2 px-2 pt-1.5">
        {kind ? (
          <Button ref={closeRef} variant="plain" leadingIcon={<ChevronLeft />} onClick={() => setKind(null)} disabled={!!call}>
            {t("sheetTitle")}
          </Button>
        ) : (
          <Button ref={closeRef} variant="plain" leadingIcon={<ChevronLeft />} onClick={onClose} aria-label={t("close")}>
            {t("ticketTitle")}
          </Button>
        )}
      </header>
      {/* Le ticket reste en haut : numéro, attente, « En direct ». */}
      <div className="mx-auto w-full max-w-lg px-4 pt-1 pb-2">
        <p className="flex items-center gap-2.5 rounded-[12px] bg-grouped-secondary px-3.5 py-2.5">
          <span id="game-sheet-title" className="font-rounded text-title3 font-extrabold whitespace-nowrap text-ticket-number">
            {code}
          </span>
          <span className="min-w-0 flex-1 truncate text-footnote text-label-secondary">{status}</span>
          <LiveIndicator label={t("live")} />
        </p>
      </div>

      {!online ? (
        <CalloutCard icon={<WifiOff />} className="mx-4 mb-2" role="status">
          {t("offline")}
        </CalloutCard>
      ) : null}

      <div className="relative mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col overflow-y-auto">
        {session === null ? (
          <div className="flex flex-1 items-center justify-center">
            <Spinner label={t("loading")} />
          </div>
        ) : kind === "pairs" ? (
          <PairsGame frozen={!!call} />
        ) : session === "error" ? (
          <CalloutCard icon={<CircleHelp />} className="m-4" role="alert">
            {t("unavailable")}
          </CalloutCard>
        ) : kind === "quiz" && quiz ? (
          <QuizGame token={token} quiz={quiz} skipAfter={session.interstitial.skip_after} nextInterstitial={nextInterstitial} couponBaseUrl={couponBaseUrl} />
        ) : kind === "series" && series ? (
          <QuizSeries token={token} skipAfter={session.interstitial.skip_after} nextInterstitial={nextInterstitial} />
        ) : kind === "sky" && sky ? (
          <SkyCatch
            token={token}
            skin={sky.skin}
            frozen={!!call}
            skipAfter={session.interstitial.skip_after}
            nextInterstitial={nextInterstitial}
            couponBaseUrl={couponBaseUrl}
            onSaved={setSaved}
          />
        ) : (
          <div className="flex flex-col gap-3 px-4 pt-2 pb-6">
            <h2 className="font-bold text-large-title text-balance">{t("sheetTitle")}</h2>
            <ul role="list" className="grid grid-cols-2 gap-3">
              {sky ? (
                <GameCard
                  icon={<Plane />}
                  color="var(--accent-fill)"
                  title={t("skyCatch")}
                  subtitle={sky.skin ? t("sponsoredBy", { advertiser: sky.skin.advertiser }) : t("skyCatchBody")}
                  record={records?.sky ? t("best", { score: records.sky }) : null}
                  onClick={() => setKind("sky")}
                />
              ) : null}
              <GameCard
                icon={<Layers />}
                color="var(--green-fill)"
                title={t("pairsTitle")}
                subtitle={t("pairsBody")}
                record={
                  records?.pairs
                    ? t("best", { score: `${t("moves", { count: records.pairs.moves })} · ${t(levelKeys[records.pairs.level]!, { pairs: PAIR_LEVELS[records.pairs.level]! })}` })
                    : null
                }
                onClick={() => setKind("pairs")}
              />
              {series ? (
                <GameCard
                  wide
                  icon={<CircleHelp />}
                  color="var(--orange-fill)"
                  title={t("quizSeries")}
                  subtitle={t("quizSeriesBody")}
                  record={records?.series ? t("best", { score: t("goodAnswers", { count: records.series }) }) : null}
                  onClick={() => setKind("series")}
                />
              ) : null}
              {quiz ? (
                <GameCard
                  wide
                  icon={<Gift />}
                  color="var(--icon-indigo)"
                  title={t("quizSponsored")}
                  subtitle={
                    quiz.played
                      ? t("quizPlayed")
                      : `${en && quiz.title_en ? quiz.title_en : quiz.title} · ${en && quiz.reward_en ? quiz.reward_en : quiz.reward}`
                  }
                  record={t("sponsoredBy", { advertiser: quiz.advertiser })}
                  onClick={() => setKind("quiz")}
                />
              ) : null}
            </ul>
          </div>
        )}

        {call ? (
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="your-turn"
            className="absolute inset-0 z-40 flex animate-fade-in flex-col items-center justify-center gap-3 overflow-y-auto bg-called p-6 text-center text-white"
          >
            <p id="your-turn" className="text-subheadline font-bold tracking-[0.14em] uppercase">
              {t("yourTurn")}
            </p>
            <p className="font-rounded text-[56px] leading-none font-extrabold">{code}</p>
            {call.counter ? <p className="text-headline">{t("presentAt", { counter: call.counter })}</p> : null}
            {kind === "sky" && saved ? (
              <p className="tabular text-subheadline" data-testid="sky-saved">
                {t("savedScore", { score: saved.score })}
              </p>
            ) : null}
            {kind === "sky" && saved?.coupon ? (
              <div className="w-full max-w-sm text-label">
                <CouponCard coupon={saved.coupon} couponBaseUrl={couponBaseUrl} />
              </div>
            ) : null}
            <Button ref={turnRef} block className="mt-4 max-w-xs bg-white text-called hover:bg-white/90 active:bg-white/80" onClick={onClose}>
              {t("backToTicket")}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Carte de jeu (maquette v2 01) : carré de couleur, nom, accroche et record de l'appareil. */
function GameCard({
  icon,
  color,
  title,
  subtitle,
  record,
  wide,
  onClick,
}: {
  icon: React.ReactNode;
  color: string;
  title: string;
  subtitle: string;
  record: string | null;
  wide?: boolean;
  onClick: () => void;
}) {
  return (
    <li className={wide ? "col-span-2" : undefined}>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "pressable flex h-full w-full gap-2.5 rounded-[16px] bg-grouped-secondary p-3.5 text-left focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent-tint",
          wide ? "flex-row items-center" : "min-h-[126px] flex-col",
        )}
      >
        <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-[10px] text-white [&>svg]:size-[22px] [&>svg]:stroke-[1.75]" style={{ background: color }}>
          {icon}
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-callout font-semibold">{title}</span>
          <span className="text-footnote text-label-secondary">{subtitle}</span>
          {record ? <span className="text-footnote font-semibold text-accent-text tabular">{record}</span> : null}
        </span>
      </button>
    </li>
  );
}
