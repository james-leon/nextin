"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Bell, CheckCircle2, Clock, MessageCircle, Share, WifiOff, XCircle } from "lucide-react";
import { callForCode, type BoardCall, type BranchBoard } from "@nextin/shared/queue/live";
import { boardTopic, REALTIME_EVENTS, ticketTopic } from "@nextin/shared/queue/realtime";
import { TicketBottomActions } from "@/components/ticket/ticket-bottom-actions";
import { Badge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { CalloutCard } from "@/components/ui/callout-card";
import { NavigationBar } from "@/components/ui/navigation-bar";
import { TicketHero } from "@/components/ui/ticket-hero";
import { useLiteLocale, useLiteT } from "@/lib/i18n/lite";
import { primeAttention, signalAttention } from "@/lib/client/attention";
import { savedTicket, saveTicket } from "@/lib/client/my-tickets";
import { onRealtimeStatus, subscribeBroadcast, type RealtimeStatus } from "@/lib/client/realtime";
import { callRpc } from "@/lib/client/supabase-public";
import { waitingProgress } from "@/lib/client/ticket-progress";
import type { CounterRef, TicketView } from "@/lib/client/types";

// Chargés seulement quand ils servent (page client < 200 Ko au premier chargement).
const AlertDialog = dynamic(() => import("@/components/ui/alert-dialog").then((m) => m.AlertDialog), { ssr: false });
const TicketRating = dynamic(() => import("./ticket-rating").then((m) => m.TicketRating), { ssr: false });

const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/\D/g, "") ?? "";

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

/** Écran 03 « Mon ticket » : numéro et attente en héros, suivi en temps réel, appel, fin de passage. */
export function TicketLive({ token, initial }: { token: string; initial: TicketView }) {
  const t = useLiteT("client.ticket");
  const tk = useLiteT("counterKinds");
  const locale = useLiteLocale();
  const [view, setView] = useState(initial);
  const [board, setBoard] = useState<BranchBoard | null>(null);
  const [status, setStatus] = useState<RealtimeStatus>("connecting");
  const [now, setNow] = useState(() => new Date());
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [copied, setCopied] = useState(false);
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
    const refreshBoard = () =>
      callRpc<BranchBoard | null>("get_branch_board", { p_branch: initial.branch.id }).then(({ data }) => data && setBoard(data));
    const offTicket = subscribeBroadcast(ticketTopic(token), REALTIME_EVENTS.ticket, (p) => setView(p as TicketView), refreshTicket);
    const offBoard = subscribeBroadcast(boardTopic(initial.branch.id), REALTIME_EVENTS.board, (p) => setBoard(p as BranchBoard), refreshBoard);
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
    if (!savedTicket(token)) saveTicket({ token, code: initial.display_code, entry: null });
  }, [token, initial.display_code]);

  const call = board ? callForCode(board, view.display_code) : null;
  const progress = view.status === "waiting" ? waitingProgress(view, board, storedMaxAhead, now) : null;

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
  const back = entry ? { href: `/q/${entry}`, label: t("back") } : { href: "/", label: t("home") };
  const nowServing = board?.calls.find((c) => c.service_id === view.service.id && c.code !== view.display_code);

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

  async function cancel() {
    const { data } = await callRpc<TicketView>("cancel_my_ticket", { p_token: token });
    if (data) setView(data);
  }

  const active = view.status === "waiting" || view.status === "called";
  const heroCommon = {
    code: view.display_code,
    service: serviceName,
    place,
    aheadLabel: t("ahead"),
    waitLabel: t("wait"),
    progressLabel: t("progress"),
  };

  return (
    <main className={active ? "min-h-dvh pb-36" : "min-h-dvh pb-40"}>
      <NavigationBar
        variant="inline"
        title={t("title")}
        back={back}
        trailing={<IconButton label={copied ? t("copied") : t("share")} icon={<Share />} variant="plain" onClick={share} />}
        contentClassName="max-w-lg"
      />
      <div className="mx-auto flex max-w-lg flex-col gap-4 px-4 pt-3">
        {status === "offline" ? (
          <Badge shape="pill" tone="red" className="self-center" role="status">
            <WifiOff aria-hidden />
            {t("offline")}
          </Badge>
        ) : null}

        {view.status === "waiting" && progress ? (
          <TicketHero
            {...heroCommon}
            ahead={progress.ahead}
            wait={progress.imminent ? t("waitNow") : t("waitValue", { minutes: progress.minutes })}
            progress={progress.progress}
            nowServing={nowServing ? t("nowServing", { code: nowServing.code, counter: counterName(nowServing) }) : undefined}
          />
        ) : view.status === "called" || view.status === "serving" ? (
          <TicketHero
            {...heroCommon}
            ahead={0}
            wait=""
            progress={1}
            state="called"
            calledTitle={view.status === "called" ? t("calledTitle") : t("servingTitle")}
            calledBody={
              view.counter
                ? view.status === "called"
                  ? t("calledBody", { counter: counterName(view.counter) })
                  : t("servingBody", { counter: counterName(view.counter) })
                : undefined
            }
          />
        ) : (
          <section
            aria-live="polite"
            className="squircle flex flex-col items-center gap-2 rounded-[var(--radius-xl)] bg-grouped-secondary px-5 py-7 text-center shadow-card"
          >
            {view.status === "served" ? (
              <CheckCircle2 aria-hidden className="size-10 stroke-[1.5] text-green" />
            ) : (
              <XCircle aria-hidden className="size-10 stroke-[1.5] text-label-secondary" />
            )}
            <p className="text-title2 font-bold">
              {view.status === "served" ? t("servedTitle") : view.status === "cancelled" ? t("cancelledTitle") : t("noShowTitle")}
            </p>
            <p className="text-callout text-label-secondary">
              {view.display_code} · {serviceName} · {place}
            </p>
            {view.status === "cancelled" ? <p className="text-body text-label-secondary">{t("cancelledBody")}</p> : null}
            {view.status === "no_show" ? <p className="text-body text-label-secondary">{t("noShowBody")}</p> : null}
          </section>
        )}

        {view.status === "called" && call && call.recall_count > 0 ? (
          <Badge shape="pill" tone="orange" className="self-center">
            <Bell aria-hidden />
            {t("recalled", { count: call.recall_count })}
          </Badge>
        ) : null}

        {active && WHATSAPP_NUMBER ? (
          <Button asChild block variant="tinted">
            <a href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(`NEXTIN ${token}`)}`} target="_blank" rel="noopener">
              <MessageCircle aria-hidden className="size-5" />
              {t("whatsapp")}
            </a>
          </Button>
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

        {view.status === "waiting" ? <CalloutCard icon={<Bell />}>{t("keepOpen")}</CalloutCard> : null}

        {view.status === "served" ? (
          view.rating_enabled && view.rating == null ? (
            <TicketRating token={token} onRated={setView} />
          ) : view.rating != null ? (
            <CalloutCard icon={<CheckCircle2 />} tone="green" role="status">
              {t("rated")}
            </CalloutCard>
          ) : null
        ) : null}

        {view.status === "cancelled" || view.status === "no_show" ? (
          <Button asChild block variant="tinted">
            <Link href={entry ? `/q/${entry}` : "/"}>{t("newTicket")}</Link>
          </Button>
        ) : null}
      </div>

      {active ? (
        <>
          <TicketBottomActions
            source={view.source}
            onMyWayLabel={t("onMyWay")}
            cancelLabel={t("cancel")}
            onCancel={() => setConfirmCancel(true)}
          />
          {confirmCancel ? (
            <AlertDialog
              open
              onOpenChange={setConfirmCancel}
              title={t("cancelTitle")}
              description={t("cancelBody")}
              cancelLabel={t("cancelKeep")}
              actionLabel={t("cancel")}
              destructive
              onAction={cancel}
            />
          ) : null}
        </>
      ) : null}
    </main>
  );
}
