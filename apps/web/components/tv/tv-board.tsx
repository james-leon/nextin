"use client";

import { useEffect, useMemo, useState } from "react";
import { Volume2, WifiOff } from "lucide-react";
import type { BoardCall, BranchBoard } from "@nextin/shared/queue/live";
import { spellTicketCode } from "@nextin/shared/ticket";
import { LogoMark } from "@/components/ui/logo";
import { useLiteLocale, useLiteT } from "@/lib/i18n/lite";
import { qrMatrix } from "@/lib/qr/matrix";
import { presenceCodeOf, tvView } from "@/lib/tv/calls";
import { cn } from "@/lib/cn";
import { TvAdSlot } from "./tv-ad-slot";
import type { TvSession } from "./types";

/**
 * Unité de l'écran TV : 1 % de la largeur d'un écran 16:9 (1vw), réduite si la fenêtre est moins large que haute
 * (même rendu de 720p à la 4K, rien de rogné). Toutes les tailles sont des multiples de `--u`.
 */
export const TV_UNIT_STYLE = { "--u": "min(1vw, 1.7778vh)" } as React.CSSProperties;

/** Libellé du poste (« Cabinet 2 », ou libellé personnalisé). */
export function useCounterName() {
  const tk = useLiteT("counterKinds");
  return (c: BoardCall) => (c.counter_label ? c.counter_label : `${tk(c.counter_kind)} ${c.counter_number}`);
}

/** Nom du service d'un appel (langue de l'écran). */
export function useServiceName(board: BranchBoard) {
  const locale = useLiteLocale();
  return (serviceId: string) => {
    const s = board.services.find((x) => x.id === serviceId);
    return s ? (locale === "en" && s.name_en ? s.name_en : s.name) : "";
  };
}

/**
 * Écran de salle d'attente (maquette v2 09), toujours clair et lisible à 3 m : bandeau bleu nuit, appels en cours
 * (le dernier marqué d'un trait et de l'étiquette « Appel »), colonne publicité ou QR code de l'agence, « À suivre »,
 * personnes en attente et code de présence. Aucun nom de patient : seulement les numéros et les postes.
 */
export function TvBoard({
  session,
  board,
  offline,
  adKey,
}: {
  session: TvSession;
  board: BranchBoard;
  offline: boolean;
  /** File des événements publicitaires de l'écran (jeton d'appareil). */
  adKey: string;
}) {
  const t = useLiteT("tv");
  const locale = useLiteLocale();
  const counterName = useCounterName();
  const serviceName = useServiceName(board);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(id);
  }, []);

  const view = tvView(board, session.service_ids);
  const qrUrl = session.presence_url ?? session.entry_url;
  const qr = useMemo(() => (qrUrl ? qrMatrix(qrUrl, 2) : null), [qrUrl]);
  const presence = presenceCodeOf(session.presence_url);
  const clock = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone: session.branch.timezone }).format(now);
  const hasCalls = view.current.length > 0;

  const qrCard = qr ? (
    <section className="flex min-h-0 flex-1 flex-col items-center justify-center gap-[calc(var(--u)*1)] rounded-[calc(var(--u)*1.4)] bg-navy p-[calc(var(--u)*1.6)] text-center text-white">
      <svg
        viewBox={`0 0 ${qr.size} ${qr.size}`}
        role="img"
        aria-label={t("scanTitle")}
        className="aspect-square h-[calc(var(--u)*13)] max-h-[60%] shrink rounded-[calc(var(--u)*1)] bg-white p-[calc(var(--u)*0.8)]"
        shapeRendering="crispEdges"
      >
        <rect width={qr.size} height={qr.size} fill="#fff" />
        <path d={qr.path} fill="#000" />
      </svg>
      <p className="text-[calc(var(--u)*2)] font-bold text-balance">{t("scanTitle")}</p>
      <p className="text-[calc(var(--u)*1.3)] text-white/80">{t("scanBody")}</p>
      {session.entry ? (
        <p className="rounded-[calc(var(--u)*0.8)] bg-white/12 px-[calc(var(--u)*1)] py-[calc(var(--u)*0.2)] font-rounded text-[calc(var(--u)*2.2)] font-bold tracking-[0.15em]">
          <span className="sr-only">{t("code", { code: session.entry.short_code })}</span>
          <span aria-hidden>{session.entry.short_code}</span>
        </p>
      ) : null}
    </section>
  ) : null;

  return (
    <main
      style={TV_UNIT_STYLE}
      className="relative grid h-dvh grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden bg-grouped leading-snug text-label"
    >
      <header className="flex items-center gap-[calc(var(--u)*1.4)] bg-navy px-[calc(var(--u)*2.4)] py-[calc(var(--u)*1.6)] text-white">
        <LogoMark className="size-[calc(var(--u)*3.4)] shrink-0" />
        <p className="flex min-w-0 items-baseline gap-[calc(var(--u)*0.6)]">
          <span className="truncate text-[calc(var(--u)*2.1)] font-bold">{session.organization.name}</span>
          <span className="truncate text-[calc(var(--u)*1.3)] text-white/75">{session.branch.name}</span>
        </p>
        <p className="ml-auto font-rounded text-[calc(var(--u)*2.4)] font-semibold tabular">{clock}</p>
      </header>

      <div
        className={cn(
          "grid min-h-0 grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)] gap-[calc(var(--u)*1.6)] px-[calc(var(--u)*2.4)] py-[calc(var(--u)*1.6)] transition-opacity",
          offline && "opacity-55 grayscale-[0.4]",
        )}
      >
        {hasCalls ? (
          <section
            aria-live="assertive"
            aria-label={t("called")}
            className="flex min-h-0 flex-col overflow-hidden rounded-[calc(var(--u)*1.4)] bg-grouped-secondary px-[calc(var(--u)*2)] py-[calc(var(--u)*1.4)]"
          >
            <p aria-hidden className="mb-[calc(var(--u)*0.6)] grid grid-cols-2 text-[calc(var(--u)*1.5)] font-semibold tracking-[0.04em] text-label-secondary uppercase">
              <span>{t("columnTicket")}</span>
              <span>{t("columnGoTo")}</span>
            </p>
            <ul role="list" className="flex min-h-0 flex-col">
              {view.current.map((c) => {
                const latest = c === view.latest;
                return (
                  <li
                    key={`${c.code}-${c.called_at}`}
                    className="relative grid grid-cols-2 items-center border-t-[calc(var(--u)*0.15)] border-separator py-[calc(var(--u)*1)]"
                  >
                    {latest ? (
                      <span aria-hidden className="absolute inset-y-0 -left-[calc(var(--u)*1.4)] w-[calc(var(--u)*0.5)] bg-orange" />
                    ) : null}
                    <span className="font-rounded text-[calc(var(--u)*6)] leading-none font-bold whitespace-nowrap text-ticket-number">
                      <span aria-hidden>{c.code}</span>
                      <span className="sr-only">{spellTicketCode(c.code)}</span>
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-[calc(var(--u)*1)] text-[calc(var(--u)*2.9)] font-semibold">
                        <span className="truncate">{counterName(c)}</span>
                        {latest ? (
                          <span className="shrink-0 rounded-full bg-orange px-[calc(var(--u)*0.9)] py-[calc(var(--u)*0.25)] text-[calc(var(--u)*1.2)] font-bold text-label">
                            {t("callTag")}
                          </span>
                        ) : null}
                      </span>
                      <span className="block truncate text-[calc(var(--u)*1.4)] text-label-secondary">{serviceName(c.service_id)}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : (
          <section
            aria-label={t("called")}
            className="flex min-h-0 flex-col items-center justify-center gap-[calc(var(--u)*1)] rounded-[calc(var(--u)*1.4)] bg-grouped-secondary text-center text-[calc(var(--u)*2)] text-label-secondary"
          >
            <span aria-hidden className="flex items-end gap-[calc(var(--u)*0.8)]">
              {[0, 1, 2].map((i) => (
                <i key={i} className="size-[calc(var(--u)*1.4)] rounded-full bg-label-secondary opacity-35" />
              ))}
            </span>
            {t("noCall")}
          </section>
        )}

        <div className="flex min-h-0 flex-col gap-[calc(var(--u)*1.6)]">
          {hasCalls ? (
            <TvAdSlot ads={session.show_ads ? (session.ads ?? []) : []} adKey={adKey}>
              {qrCard}
            </TvAdSlot>
          ) : (
            qrCard
          )}
          {hasCalls ? (
            <section aria-label={t("upNext")} className="rounded-[calc(var(--u)*1.4)] bg-grouped-secondary px-[calc(var(--u)*1.6)] py-[calc(var(--u)*1.2)]">
              <h2 className="mb-[calc(var(--u)*0.6)] text-[calc(var(--u)*1.3)] font-semibold tracking-[0.04em] text-label-secondary uppercase">{t("upNext")}</h2>
              <p className="flex flex-wrap gap-x-[calc(var(--u)*1.4)] font-rounded text-[calc(var(--u)*2.4)] font-bold text-ticket-number">
                {view.next.length ? view.next.map((code) => <span key={code}>{code}</span>) : <span className="text-label-secondary">–</span>}
              </p>
            </section>
          ) : (
            <section aria-label={t("previousCalls")} className="rounded-[calc(var(--u)*1.4)] bg-grouped-secondary px-[calc(var(--u)*1.6)] py-[calc(var(--u)*1.2)]">
              <h2 className="mb-[calc(var(--u)*0.6)] text-[calc(var(--u)*1.3)] font-semibold tracking-[0.04em] text-label-secondary uppercase">
                {t("previousCalls")}
              </h2>
              {view.previous.length ? (
                <ul role="list" className="flex flex-wrap gap-x-[calc(var(--u)*1.4)] font-rounded text-[calc(var(--u)*2.2)] font-bold text-label-secondary">
                  {view.previous.map((c) => (
                    <li key={`${c.code}-${c.called_at}`}>
                      <span aria-hidden>{c.code}</span>
                      <span className="sr-only">
                        {spellTicketCode(c.code)} · {counterName(c)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[calc(var(--u)*1.6)] text-label-secondary">{t("noPreviousCall")}</p>
              )}
            </section>
          )}
        </div>
      </div>

      <footer className="flex items-center gap-[calc(var(--u)*1.6)] px-[calc(var(--u)*2.4)] pt-[calc(var(--u)*1)] pb-[calc(var(--u)*1.4)] text-[calc(var(--u)*1.4)] text-label-secondary">
        <span aria-hidden className="flex items-end gap-[calc(var(--u)*0.5)]">
          <i className="size-[calc(var(--u)*0.8)] rounded-full bg-accent" />
          <i className="size-[calc(var(--u)*0.7)] rounded-full bg-accent" />
          <i className="size-[calc(var(--u)*0.6)] rounded-full bg-accent" />
        </span>
        <p className="min-w-0 truncate">
          <b className="font-semibold text-label">{view.waiting ? t("waitingPeople", { count: view.waiting }) : t("waitingNobody")}</b> {t("waitingSuffix")} · {t("scanHint")}
        </p>
        {presence ? (
          <p className="ml-auto flex shrink-0 items-center gap-[calc(var(--u)*0.8)]">
            {t("presenceCode")}
            <span className="rounded-[calc(var(--u)*0.8)] bg-grouped-secondary px-[calc(var(--u)*1)] py-[calc(var(--u)*0.2)] font-rounded text-[calc(var(--u)*2)] font-bold tracking-[0.1em] text-label">
              {presence}
            </span>
          </p>
        ) : null}
      </footer>

      {offline ? (
        <p
          role="status"
          className="absolute top-[calc(var(--u)*1.8)] left-1/2 flex -translate-x-1/2 items-center gap-[calc(var(--u)*0.8)] rounded-full bg-orange px-[calc(var(--u)*1.8)] py-[calc(var(--u)*0.6)] text-[calc(var(--u)*1.6)] font-bold text-label"
        >
          <WifiOff aria-hidden className="size-[calc(var(--u)*2)] stroke-[2.2]" />
          {t("offline")}
        </p>
      ) : null}
    </main>
  );
}

/**
 * « Activer le son » (maquette v2 23) : voile sur l'écran et grand bouton blanc ; un seul geste à l'installation
 * (télécommande ou souris). Ensuite, « Son activé » s'affiche 3 secondes.
 */
export function TvSoundGate({ soundOn, onEnable }: { soundOn: boolean; onEnable: () => void }) {
  const t = useLiteT("tv");
  // « Son activé » seulement après l'activation (pas si le navigateur l'autorisait déjà au premier affichage).
  const [wasOff, setWasOff] = useState(!soundOn);
  if (!soundOn && !wasOff) setWasOff(true);

  if (soundOn) return wasOff ? <SoundConfirmed label={t("soundOn")} /> : null;
  return (
    <div style={TV_UNIT_STYLE} className="fixed inset-0 z-30 grid place-items-center bg-overlay">
      <button
        type="button"
        autoFocus
        onClick={onEnable}
        className="pressable flex flex-col items-center gap-[calc(var(--u)*1)] rounded-[calc(var(--u)*2)] bg-white px-[calc(var(--u)*3.6)] py-[calc(var(--u)*2.4)] text-center text-navy focus-visible:outline-[calc(var(--u)*0.3)] focus-visible:outline-offset-[calc(var(--u)*0.3)] focus-visible:outline-accent"
      >
        <Volume2 aria-hidden className="size-[calc(var(--u)*6)] stroke-[1.8]" />
        <span className="text-[calc(var(--u)*3)] font-bold">{t("enableSound")}</span>
        <span className="text-[calc(var(--u)*1.5)] text-label-secondary">{t("soundHint")}</span>
      </button>
    </div>
  );
}

/** « Son activé » pendant 3 secondes. */
function SoundConfirmed({ label }: { label: string }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const id = setTimeout(() => setVisible(false), 3_000);
    return () => clearTimeout(id);
  }, []);
  if (!visible) return null;
  return (
    <p
      role="status"
      style={TV_UNIT_STYLE}
      className="fixed bottom-[calc(var(--u)*6)] left-1/2 z-30 flex -translate-x-1/2 items-center gap-[calc(var(--u)*0.8)] rounded-full bg-navy px-[calc(var(--u)*2)] py-[calc(var(--u)*0.8)] text-[calc(var(--u)*1.8)] font-semibold text-white shadow-floating"
    >
      <Volume2 aria-hidden className="size-[calc(var(--u)*2.2)]" />
      {label}
    </p>
  );
}
