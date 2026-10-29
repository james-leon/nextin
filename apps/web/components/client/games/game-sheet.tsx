"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { BellRing, ChevronLeft, ChevronRight, CircleHelp, Plane, WifiOff, X } from "lucide-react";
import { interstitialDue, type AdCandidate } from "@nextin/shared/ads";
import { Button, IconButton } from "@/components/ui/button";
import { CalloutCard } from "@/components/ui/callout-card";
import { ListIcon } from "@/components/ui/list";
import { Spinner } from "@/components/ui/spinner";
import type { GameSession } from "@/lib/client/games";
import { flushAdEvents } from "@/lib/client/ad-events";
import { callRpc } from "@/lib/client/supabase-public";
import { LiteIntlProvider, useLiteLocale, useLiteT } from "@/lib/i18n/lite";
import { QuizGame } from "./quiz-game";
import { SkyCatch } from "./sky-catch";

export type GameKind = "quiz" | "sky";

const subscribeOnline = (cb: () => void) => {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
};

/**
 * Feuille « Jouer en attendant » (chargée à la demande) : plein écran, le numéro et l'attente restent visibles en
 * haut. À l'appel, le jeu se fige et « C'est votre tour » prend toute la place.
 */
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
  const en = locale === "en";

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="game-sheet-title" className="fixed inset-0 z-50 flex flex-col bg-grouped safe-top">
      <header className="flex items-center gap-2 px-2 py-1.5 hairline-b">
        {kind ? (
          <IconButton label={t("sheetTitle")} icon={<ChevronLeft />} variant="plain" onClick={() => setKind(null)} disabled={!!call} />
        ) : (
          <IconButton ref={closeRef} label={t("close")} icon={<X />} variant="plain" onClick={onClose} />
        )}
        <div className="flex min-w-0 flex-1 flex-col items-center text-center">
          <p id="game-sheet-title" className="text-headline font-extrabold text-ticket-number">
            {code}
          </p>
          <p className="truncate text-footnote text-label-secondary">{status}</p>
        </div>
        {kind ? <IconButton ref={closeRef} label={t("close")} icon={<X />} variant="plain" onClick={onClose} /> : <span aria-hidden className="size-11" />}
      </header>

      {!online ? (
        <CalloutCard icon={<WifiOff />} className="mx-4 mt-3" role="status">
          {t("offline")}
        </CalloutCard>
      ) : null}

      <div className="relative mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col overflow-y-auto">
        {session === null ? (
          <div className="flex flex-1 items-center justify-center">
            <Spinner label={t("loading")} />
          </div>
        ) : session === "error" ? (
          <CalloutCard icon={<CircleHelp />} className="m-4" role="alert">
            {t("unavailable")}
          </CalloutCard>
        ) : kind === "quiz" && quiz ? (
          <QuizGame token={token} quiz={quiz} skipAfter={session.interstitial.skip_after} nextInterstitial={nextInterstitial} couponBaseUrl={couponBaseUrl} />
        ) : kind === "sky" && sky ? (
          <SkyCatch
            token={token}
            skin={sky.skin}
            frozen={!!call}
            skipAfter={session.interstitial.skip_after}
            nextInterstitial={nextInterstitial}
            couponBaseUrl={couponBaseUrl}
          />
        ) : (
          <div className="flex flex-col gap-3 p-4">
            <h2 className="px-4 text-title2 font-bold">{t("sheetTitle")}</h2>
            <ul role="list" className="squircle overflow-hidden rounded-[var(--radius-md)] bg-grouped-secondary">
              {quiz ? (
                <GameRow
                  icon={<CircleHelp />}
                  color="var(--accent-fill)"
                  title={t("quiz")}
                  subtitle={quiz.played ? t("quizPlayed") : t("quizBody", { title: en && quiz.title_en ? quiz.title_en : quiz.title })}
                  onClick={() => setKind("quiz")}
                />
              ) : null}
              {sky ? (
                <GameRow
                  icon={<Plane />}
                  color="var(--brand-tile)"
                  title={t("skyCatch")}
                  subtitle={sky.skin ? `${t("skyCatchBody")} · ${t("sponsoredBy", { advertiser: sky.skin.advertiser })}` : t("skyCatchBody")}
                  onClick={() => setKind("sky")}
                />
              ) : null}
            </ul>
            {!quiz && !sky ? <CalloutCard icon={<CircleHelp />}>{t("unavailable")}</CalloutCard> : null}
          </div>
        )}

        {call ? (
          <div role="alertdialog" aria-modal="true" aria-labelledby="your-turn" className="call-flash absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-grouped p-6 text-center">
            <span className="squircle flex size-16 items-center justify-center rounded-[18px] bg-green-tint text-green-text">
              <BellRing aria-hidden className="size-8 stroke-[1.75]" />
            </span>
            <p id="your-turn" className="text-large-title font-bold">
              {t("yourTurn")}
            </p>
            <p className="text-body text-label-secondary">{t("yourTurnBody", { code, counter: call.counter })}</p>
            <Button ref={turnRef} block className="max-w-sm" onClick={onClose}>
              {t("backToTicket")}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function GameRow({ icon, color, title, subtitle, onClick }: { icon: React.ReactNode; color: string; title: string; subtitle: string; onClick: () => void }) {
  return (
    <li className="group/row pl-4">
      <button type="button" onClick={onClick} className="pressable flex min-h-16 w-full items-center gap-3 text-left">
        <ListIcon color={color}>{icon}</ListIcon>
        <span className="flex min-w-0 flex-1 items-center gap-3 py-3 pr-4 list-separator">
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-body font-semibold">{title}</span>
            <span className="text-subheadline text-label-secondary">{subtitle}</span>
          </span>
          <ChevronRight aria-hidden className="size-5 shrink-0 text-label-tertiary" />
        </span>
      </button>
    </li>
  );
}
