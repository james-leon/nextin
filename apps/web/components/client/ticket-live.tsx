"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { BadgeCheck, Bell, Check, ChevronLeft, ChevronRight, Clock, Hand, Info, MessageCircle, Share, WifiOff } from "lucide-react";
import { optInLink } from "@nextin/shared/notifications/opt-in";
import { callForCode, isActiveCall, type BoardCall, type BranchBoard } from "@nextin/shared/queue/live";
import { REALTIME_EVENTS, ticketTopic } from "@nextin/shared/queue/realtime";
import { TicketBottomActions } from "@/components/ticket/ticket-bottom-actions";
import { Badge, LiveIndicator } from "@/components/ui/badge";
import { CalloutCard } from "@/components/ui/callout-card";
import { OptionList, OptionRow } from "./option-row";
import { TicketHero } from "@/components/ui/ticket-hero";
import { LiteIntlProvider, useLiteLocale, useLiteT } from "@/lib/i18n/lite";
import { primeAttention, signalAttention } from "@/lib/client/attention";
import { subscribeBoard } from "@/lib/client/board-feed";
import { savedTicket, saveTicket } from "@/lib/client/my-tickets";
import { onRealtimeStatus, subscribeBroadcast, type RealtimeStatus } from "@/lib/client/realtime";
import { callRpc } from "@/lib/client/supabase-public";
import { ticketAvailability, waitingProgress } from "@/lib/client/ticket-progress";
import type { CounterRef, TicketView } from "@/lib/client/types";
import { LazyMount } from "./lazy-mount";
import { lazyComponent } from "@/lib/client/lazy";

// Chargés seulement quand ils servent (page client < 200 Ko au premier chargement ; `lazyComponent` plutôt que
// `next/dynamic`, plus léger).
const AlertDialog = lazyComponent(() => import("@/components/ui/alert-dialog").then((m) => m.AlertDialog), { ssr: false });
// Ticket fini (terminé, annulé, clôturé) : rendu côté serveur s'il sert, jamais téléchargé pour un ticket en cours.
const TicketEnded = lazyComponent(() => import("./ticket-ended").then((m) => m.TicketEnded));
// « C'est votre tour » plein écran : chargé seulement à l'appel (budget de la page).
const CalledScreen = lazyComponent(() => import("./called-screen").then((m) => m.CalledScreen));
const PushAlerts = lazyComponent(() => import("./push-alerts").then((m) => m.PushAlerts), { ssr: false });
// Ticket à distance seulement : rendu côté serveur s'il sert, jamais téléchargé pour un ticket pris sur place.
const RemoteTicketCard = lazyComponent(() => import("./remote-ticket-card").then((m) => m.RemoteTicketCard));
// Publicité et jeux (M10b) : jamais dans le premier chargement.
const SponsoredCard = lazyComponent(() => import("./sponsored-card").then((m) => m.SponsoredCard), { ssr: false });
const GameSheet = lazyComponent(() => import("./games/game-sheet").then((m) => m.GameSheet), { ssr: false });
// Carte « Jouer en attendant » : montée 3 s après le chargement (LazyMount), son code aussi (budget de 200 Ko).
const PlayCard = lazyComponent(() => import("./games/play-card").then((m) => m.PlayCard), { ssr: false });

const aheadKey = (token: string) => `nextin-ahead-${token}`;
const noSubscribe = () => () => {};

/** Plus grand nombre de personnes devant vu sur cet appareil (barre de progression). */
function readMaxAhead(token: string): number {
  try {
    return Number(localStorage.getItem(aheadKey(token)) ?? 0) || 0;
  } catch {
    return 0;
  }
}

/**
 * « Mon ticket » (maquette v2 01) : établissement et « En direct » en tête, carte du ticket (numéro en chiffres
 * arrondis, personnes devant et file en points, attente estimée), alertes WhatsApp juste dessous, jeux, puis les
 * actions en bas du contenu. À l'appel : écran vert plein (« C'est votre tour », poste, « J'arrive »), avec la
 * vibration et le son d'appel.
 */
export function TicketLive({
  token,
  initial,
  whatsappNumber,
  vapidKey,
  couponBaseUrl,
  gameCards,
}: {
  token: string;
  initial: TicketView;
  /** Numéro WhatsApp de NextIn (opt-in), lu côté serveur ; null : bouton masqué. */
  whatsappNumber: string | null;
  /** Clé publique VAPID (web push) ; null : pas de notification sur le téléphone. */
  vapidKey: string | null;
  /** Adresse absolue des bons de réduction (`/coupon/`), encodée dans leur QR code. */
  couponBaseUrl: string;
  /** Textes des cartes de jeu et de pub (les autres textes des jeux sont chargés avec la feuille). */
  gameCards: Record<string, string>;
}) {
  const t = useLiteT("client.ticket");
  const tk = useLiteT("counterKinds");
  const locale = useLiteLocale();
  const [view, setView] = useState(initial);
  const [board, setBoard] = useState<BranchBoard | null>(null);
  const [status, setStatus] = useState<RealtimeStatus>("connecting");
  const [now, setNow] = useState(() => new Date());
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [copied, setCopied] = useState(false);
  const [playing, setPlaying] = useState(false);
  // Écran plein « C'est votre tour » : refermé par « J'arrive », rouvert à chaque rappel.
  const [calledSeen, setCalledSeen] = useState<string | null>(null);
  const lastAlert = useRef<string | null>(null);
  // Données gardées sur l'appareil, lues sans décalage d'hydratation (null / 0 côté serveur).
  const entry = useSyncExternalStore(noSubscribe, () => savedTicket(token)?.entry ?? null, () => null);
  const storedMaxAhead = useSyncExternalStore(noSubscribe, () => readMaxAhead(token), () => 0);

  const counterName = (c: CounterRef | Pick<BoardCall, "counter_kind" | "counter_number" | "counter_label">) =>
    "kind" in c ? (c.label ?? `${tk(c.kind)} ${c.number}`) : (c.counter_label ?? `${tk(c.counter_kind)} ${c.counter_number}`);

  // Ticket et tableau de l'agence en direct ; rechargés à chaque (re)connexion.
  useEffect(() => {
    const refreshTicket = () =>
      callRpc<TicketView | null>("get_ticket", { p_token: token }).then(({ data }) => data && setView(data));
    const offTicket = subscribeBroadcast(ticketTopic(token), REALTIME_EVENTS.ticket, (p) => setView(p as TicketView), refreshTicket);
    const offBoard = subscribeBoard(initial.branch.id, setBoard);
    const offStatus = onRealtimeStatus(setStatus);
    const tick = setInterval(() => setNow(new Date()), 30_000);
    const unprime = primeAttention();
    return () => {
      offTicket();
      offBoard();
      offStatus();
      clearInterval(tick);
      unprime();
    };
  }, [token, initial.branch.id]);

  // Lien gardé sur l'appareil (onglet « Mon ticket »), y compris pour un lien reçu (ticket d'accueil, partage).
  useEffect(() => {
    const saved = savedTicket(token);
    // Ticket à distance (M9) : l'agence est gardée pour confirmer la présence au scan de son QR code.
    if (!saved || (initial.remote && !saved.remote)) {
      saveTicket({ token, code: initial.display_code, entry: null, ...(initial.remote ? { branchId: initial.branch.id, remote: true } : {}) });
    }
  }, [token, initial.display_code, initial.remote, initial.branch.id]);

  const call = board ? callForCode(board, view.display_code) : null;
  const progress = view.status === "waiting" ? waitingProgress(view, board, storedMaxAhead, now) : null;
  const availability = view.status === "waiting" ? ticketAvailability(view, board, now) : null;

  useEffect(() => {
    if (!progress || progress.maxAhead <= readMaxAhead(token)) return;
    try {
      localStorage.setItem(aheadKey(token), String(progress.maxAhead));
    } catch {
      // Stockage indisponible : la barre repart du nombre actuel.
    }
  }, [progress, token]);

  // Appel (et chaque rappel) : vibration, son, titre de l'onglet.
  useEffect(() => {
    if (view.status !== "called") {
      lastAlert.current = null;
      document.title = `${view.display_code} · ${t("title")}`;
      return;
    }
    const key = `${view.called_at}:${call?.recall_count ?? 0}`;
    if (lastAlert.current !== key) {
      lastAlert.current = key;
      signalAttention();
    }
    document.title = `${t("calledTitle")} · ${view.display_code}`;
  }, [view.status, view.called_at, view.display_code, call?.recall_count, t]);

  const serviceName = locale === "en" && view.service.name_en ? view.service.name_en : view.service.name;
  const place = view.organization.name;
  const goTo = (c: CounterRef) =>
    c.label ? t("goToLabel", { counter: c.label }) : t(`goTo.${c.kind}`, { number: c.number });
  const callKey = view.status === "called" ? `${view.called_at}:${call?.recall_count ?? 0}` : null;
  const nowServing = board?.calls.find((c) => isActiveCall(c) && c.service_id === view.service.id && c.code !== view.display_code);

  async function share() {
    const url = window.location.href;
    const text = t("shareText", { code: view.display_code, place });
    if (navigator.share) {
      await navigator.share({ title: view.display_code, text, url }).catch(() => undefined);
    } else if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(url).then(() => setCopied(true), () => undefined);
    } else {
      // Page non sécurisée (test en Wi-Fi local) : partage par WhatsApp.
      window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, "_blank", "noopener");
    }
  }

  async function signalOnMyWay() {
    const { data } = await callRpc<TicketView>("signal_on_my_way", { p_token: token });
    if (data) setView(data);
  }

  // C3 : demande d'aide à l'accueil (5 minutes entre deux demandes, vérifié par la base).
  const [help, setHelp] = useState<"idle" | "sending" | "sent" | "soon">("idle");
  // Confirmation éphémère en bas de l'écran (maquette v2 21), en plus de la ligne devenue verte.
  const [toast, setToast] = useState<string | null>(null);
  async function requestHelp() {
    setHelp("sending");
    const { error } = await callRpc<unknown>("request_ticket_help", { p_token: token });
    setHelp(!error ? "sent" : error.message === "help_too_soon" ? "soon" : "idle");
    if (!error) {
      setToast(t("helpSentTitle"));
      setTimeout(() => setToast(null), 3000);
    }
  }

  async function cancel() {
    const { data } = await callRpc<TicketView>("cancel_my_ticket", { p_token: token });
    if (data) setView(data);
  }

  // Attente affichée : jamais « D'un instant à l'autre » si personne ne peut appeler (agence fermée, aucun poste).
  const waitText = (): string => {
    if (!progress) return "";
    if (availability?.kind === "noCounter") return t(`noCounterOpen.${view.service.counter_kind ?? "guichet"}`);
    if (availability?.kind === "closed") {
      const next = availability.next;
      if (!next) return t("closedNow");
      if (next.inDays === 0) return t("opensToday", { time: next.opensAt });
      if (next.inDays === 1) return t("opensTomorrow", { time: next.opensAt });
      // 2 novembre 2026 = lundi (jour ISO 1).
      const day = new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: "UTC" }).format(
        new Date(Date.UTC(2026, 10, 1 + next.weekday)),
      );
      return t("opensOn", { day, time: next.opensAt });
    }
    return progress.imminent ? t("waitNow") : t("waitValue", { minutes: progress.minutes });
  };
  const wait = waitText();

  const active = view.status === "waiting" || view.status === "called";
  const closeGame = useCallback(() => setPlaying(false), []);
  const heroCommon = {
    code: view.display_code,
    service: view.remote ? `${serviceName} · ${t("remoteShort")}` : serviceName,
    waitLabel: t("wait"),
    progressLabel: t("progress"),
  };

  return (
    <main className="min-h-dvh pb-12">
      <h1 className="sr-only">{t("title")}</h1>
      <div className="mx-auto flex max-w-lg items-center justify-between gap-2 px-4 pt-[max(env(safe-area-inset-top),0.75rem)] lg:max-w-5xl lg:pt-8">
        {/* Retour à la liste des tickets : pas de barre d'onglets sur le ticket (rien ne le masque, budget de la page). */}
        <Link
          href="/t"
          prefetch={false}
          aria-label={t("allTickets")}
          className="pressable -ml-2 flex size-11 shrink-0 items-center justify-center rounded-full text-accent-text"
        >
          <ChevronLeft aria-hidden className="size-6 stroke-[2.25]" />
        </Link>
        <p className="min-w-0 flex-1 truncate text-footnote font-medium text-label-secondary uppercase">
          {place} · {view.branch.name}
        </p>
        <div className="flex min-h-11 shrink-0 items-center gap-1">
          {status !== "offline" && active ? <LiveIndicator label={t("live")} /> : null}
        </div>
      </div>
      {/* Ordinateur : le ticket à gauche (héros, attente), alertes et actions à droite. */}
      <div className="mx-auto grid max-w-lg grid-cols-1 gap-4 px-4 pt-3 lg:max-w-5xl lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:items-start lg:gap-8">
        <div className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-16">
        {status === "offline" ? (
          <Badge shape="pill" tone="red" className="self-center" role="status">
            <WifiOff aria-hidden />
            {t("offline")}
          </Badge>
        ) : null}

        {/* Appel manqué (absent automatique) : encadré orange au-dessus du ticket, qui reste utilisable ; au prochain
            appel manqué, le ticket est annulé (maquette v2 21). */}
        {view.status === "waiting" && (view.missed_calls ?? 0) > 0 ? (
          <CalloutCard icon={<Bell />} tone="orange" role="status" data-testid="missed-call">
            <span className="block font-semibold text-orange-text">{t("missedCallTitle")}</span>
            {t("missedCallBody")}
          </CalloutCard>
        ) : null}

        {view.status === "waiting" && progress ? (
          <TicketHero
            {...heroCommon}
            ahead={progress.ahead}
            aheadText={progress.ahead === 0 ? t("youAreNext") : t("aheadCount", { count: progress.ahead })}
            wait={wait}
            progress={progress.progress}
            side={
              nowServing
                ? { value: nowServing.code, label: t("nowServingAt", { counter: counterName(nowServing) }) }
                : { value: String(progress.ahead), label: t("ahead") }
            }
          />
        ) : view.status === "called" || view.status === "serving" ? (
          <TicketHero
            {...heroCommon}
            ahead={0}
            aheadText=""
            wait=""
            progress={1}
            state="called"
            calledTitle={view.status === "called" ? t("calledTitle") : t("servingTitle")}
            calledBody={view.counter ? (view.status === "called" ? goTo(view.counter) : counterName(view.counter)) : undefined}
          />
        ) : (
          <TicketEnded view={view} token={token} serviceName={serviceName} entry={entry} onRated={setView} />
        )}

        {/* Accès prioritaire : accordé uniquement par le personnel (accueil, poste ou arrivée d'un rendez-vous). */}
        {active && view.priority_reason ? (
          <Badge shape="pill" tone="accent" className="self-center" data-testid="ticket-priority">
            <BadgeCheck aria-hidden />
            {t("priority")}
          </Badge>
        ) : null}


        {/* Agence fermée ou aucun poste ouvert : jamais « D'un instant à l'autre » (maquette v2 21). */}
        {view.status === "waiting" && (availability?.kind === "closed" || availability?.kind === "noCounter") ? (
          <CalloutCard icon={<Clock />} tone="accent" role="status">
            <span className="block font-semibold">{wait}</span>
            {availability.kind === "closed" ? t("closedBody") : t("noCounterBody")}
          </CalloutCard>
        ) : null}
        {view.status === "waiting" ? (
          <p className="px-4 text-footnote text-label-secondary">{view.alerts?.whatsapp || view.alerts?.push ? t("keepOpenAlerts") : t("keepOpen")}</p>
        ) : null}

        {view.status === "called" && call && call.recall_count > 0 ? (
          <Badge shape="pill" tone="orange" className="self-center">
            <Bell aria-hidden />
            {t("recalled", { count: call.recall_count })}
          </Badge>
        ) : null}

        </div>
        <div className="flex min-w-0 flex-col gap-4">
        {/* Maquette v2 21 : sous le ticket, deux groupes — être prévenu (WhatsApp, notification), puis l'aide. */}
        {active && (view.alerts?.whatsapp || whatsappNumber || vapidKey) ? (
          <OptionList label={t("alertsSection")}>
            {view.alerts?.whatsapp ? (
              <OptionRow
                status
                color="var(--green-fill)"
                icon={<MessageCircle />}
                title={t("whatsappOn")}
                trailing={<Check aria-hidden className="size-5 stroke-[2.5] text-accent-text" />}
              />
            ) : whatsappNumber ? (
              <OptionRow
                href={optInLink(whatsappNumber, view.display_code, token, locale === "en" ? "en" : "fr")}
                external
                color="var(--green-fill)"
                icon={<MessageCircle />}
                title={<span className="text-accent-text">{t("whatsapp")}</span>}
              />
            ) : null}
            {vapidKey ? <PushAlerts token={token} vapidKey={vapidKey} subscribed={!!view.alerts?.push} variant="row" /> : null}
          </OptionList>
        ) : null}

        {view.status === "waiting" && view.remote ? (
          <RemoteTicketCard
            token={token}
            view={view}
            waitSeconds={progress ? (progress.imminent ? 0 : progress.minutes * 60) : view.wait_seconds}
            now={now}
            onChange={setView}
          />
        ) : null}

        {view.status === "waiting" && view.practitioner_late_until && new Date(view.practitioner_late_until).getTime() > now.getTime() ? (
          <CalloutCard icon={<Clock />} role="status">
            {t("practitionerLate", {
              time: new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Douala" }).format(
                new Date(view.practitioner_late_until),
              ),
            })}
          </CalloutCard>
        ) : null}


        {view.status === "waiting" ? (
          <LiteIntlProvider locale={locale} messages={{ games: gameCards }}>
            <LazyMount>
              <div className="flex flex-col gap-4">
                <PlayCard token={token} onOpen={() => setPlaying(true)} />
                <SponsoredCard token={token} />
              </div>
            </LazyMount>
          </LiteIntlProvider>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <OptionList label={t("helpSection")}>
            {active ? (
              help === "sent" || help === "soon" ? (
                <OptionRow
                  status
                  color="var(--green-fill)"
                  icon={<Check />}
                  title={t("helpSentTitle")}
                  subtitle={help === "sent" ? t("helpSentBody") : t("helpTooSoon")}
                />
              ) : (
                <OptionRow
                  onClick={help === "sending" ? undefined : requestHelp}
                  color="var(--orange-fill)"
                  icon={<Hand />}
                  title={<span className="text-accent-text">{t("helpRequest")}</span>}
                />
              )
            ) : null}
            {/* C2 : aide (questions fréquentes, téléphone et horaires de l'établissement). */}
            <OptionRow
              href={`/help?t=${encodeURIComponent(token)}`}
              color="var(--icon-gray)"
              icon={<Info />}
              title={t("helpLink")}
              trailing={<ChevronRight aria-hidden className="size-[1.125rem] shrink-0 stroke-[2.25] text-label-tertiary" />}
            />
            {active ? <OptionRow onClick={share} color="var(--accent-fill)" icon={<Share />} title={copied ? t("copied") : t("share")} /> : null}
          </OptionList>
          {help === "sent" ? <p className="px-4 text-footnote text-label-secondary">{t("helpAgain")}</p> : null}
        </div>
        {/* En bas du contenu, jamais fixé : « Je suis en route » (à distance) puis « Annuler le ticket » en lien gris. */}
        {active ? (
          <TicketBottomActions
            source={view.source}
            onMyWayLabel={view.remote?.on_my_way_at ? t("scanToConfirm") : t("onMyWay")}
            onMyWay={signalOnMyWay}
            onMyWayHref={view.remote?.on_my_way_at ? "/" : undefined}
            hideRemote={!view.remote || !!view.remote.presence_confirmed_at}
            cancelLabel={t("cancel")}
            onCancel={() => setConfirmCancel(true)}
          />
        ) : null}
        </div>
      </div>

      {playing && (view.status === "waiting" || view.status === "called") ? (
        <GameSheet
          token={token}
          code={view.display_code}
          status={
            progress
              ? `${wait} · ${progress.ahead === 0 ? t("youAreNext") : `${t("ahead")} : ${progress.ahead}`}`
              : t("calledTitle")
          }
          call={view.status === "called" ? { counter: view.counter ? counterName(view.counter) : "" } : null}
          couponBaseUrl={couponBaseUrl}
          onClose={closeGame}
        />
      ) : null}

      {/* C'est votre tour : écran vert plein, par-dessus tout (y compris le jeu), jusqu'à « J'arrive ». */}
      {callKey && calledSeen !== callKey ? (
        <CalledScreen
          title={t("calledTitle")}
          code={view.display_code}
          counter={view.counter ? goTo(view.counter) : null}
          service={serviceName}
          action={t("onMyWayToCounter")}
          onDismiss={() => setCalledSeen(callKey)}
        />
      ) : null}

      {toast ? (
        <div
          role="status"
          className="fixed inset-x-0 z-40 flex justify-center px-4 animate-pop-in"
          style={{ bottom: "max(env(safe-area-inset-bottom), 1.5rem)" }}
        >
          <span className="flex min-h-11 items-center gap-2 rounded-full bg-grouped-secondary px-5 text-callout font-semibold shadow-floating">
            <Check aria-hidden className="size-4 stroke-[2.5] text-green" />
            {toast}
          </span>
        </div>
      ) : null}

      {active && confirmCancel ? (
        <AlertDialog
          open
          onOpenChange={setConfirmCancel}
          title={t("cancelTitle", { code: view.display_code })}
          description={t("cancelBody")}
          cancelLabel={t("cancelKeep")}
          actionLabel={t("cancel")}
          destructive
          stacked
          onAction={cancel}
        />
      ) : null}
    </main>
  );
}
