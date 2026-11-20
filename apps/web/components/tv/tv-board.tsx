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
    <section className="flex min-h-0 flex-1 flex-col items-center justify-center u-gap-1 u-rounded-1_4 bg-navy u-p-1_6 text-center text-white">
      <svg
        viewBox={`0 0 ${qr.size} ${qr.size}`}
        role="img"
        aria-label={t("scanTitle")}
        className="aspect-square u-h-13 max-h-[60%] shrink u-rounded-1 bg-white u-p-0_8"
        shapeRendering="crispEdges"
      >
        <rect width={qr.size} height={qr.size} fill="#fff" />
        <path d={qr.path} fill="#000" />
      </svg>
      <p className="u-text-2 font-bold text-balance">{t("scanTitle")}</p>
      <p className="u-text-1_3 text-white/80">{t("scanBody")}</p>
      {session.entry ? (
        <p className="u-rounded-0_8 bg-white/12 u-px-1 u-py-0_2 font-rounded u-text-2_2 font-bold tracking-[0.15em]">
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
      <header className="flex items-center u-gap-1_4 bg-navy u-px-2_4 u-py-1_6 text-white">
        <LogoMark className="u-size-3_4 shrink-0" />
        <p className="flex min-w-0 items-baseline u-gap-0_6">
          <span className="truncate u-text-2_1 font-bold">{session.organization.name}</span>
          <span className="truncate u-text-1_3 text-white/75">{session.branch.name}</span>
        </p>
        <p className="ml-auto font-rounded u-text-2_4 font-semibold tabular">{clock}</p>
      </header>

      <div
        className={cn(
          "grid min-h-0 grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)] u-gap-1_6 u-px-2_4 u-py-1_6 transition-opacity",
          offline && "opacity-55 grayscale-[0.4]",
        )}
      >
        {hasCalls ? (
          <section
            aria-live="assertive"
            aria-label={t("called")}
            className="flex min-h-0 flex-col overflow-hidden u-rounded-1_4 bg-grouped-secondary u-px-2 u-py-1_4"
          >
            <p aria-hidden className="u-mb-0_6 grid grid-cols-2 u-text-1_5 font-semibold tracking-[0.04em] text-label-secondary uppercase">
              <span>{t("columnTicket")}</span>
              <span>{t("columnGoTo")}</span>
            </p>
            <ul role="list" className="flex min-h-0 flex-col">
              {view.current.map((c) => {
                const latest = c === view.latest;
                return (
                  <li
                    key={`${c.code}-${c.called_at}`}
                    className="relative grid grid-cols-2 items-center u-border-t-0_15 border-separator u-py-1"
                  >
                    {latest ? (
                      <span aria-hidden className="absolute inset-y-0 u-nleft-1_4 u-w-0_5 bg-orange" />
                    ) : null}
                    <span className="font-rounded u-text-6 leading-none font-bold whitespace-nowrap text-ticket-number">
                      <span aria-hidden>{c.code}</span>
                      <span className="sr-only">{spellTicketCode(c.code)}</span>
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center u-gap-1 u-text-2_9 font-semibold">
                        <span className="truncate">{counterName(c)}</span>
                        {latest ? (
                          <span className="shrink-0 rounded-full bg-orange u-px-0_9 u-py-0_25 u-text-1_2 font-bold text-label">
                            {t("callTag")}
                          </span>
                        ) : null}
                      </span>
                      <span className="block truncate u-text-1_4 text-label-secondary">{serviceName(c.service_id)}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : (
          <section
            aria-label={t("called")}
            className="flex min-h-0 flex-col items-center justify-center u-gap-1 u-rounded-1_4 bg-grouped-secondary text-center u-text-2 text-label-secondary"
          >
            <span aria-hidden className="flex items-end u-gap-0_8">
              {[0, 1, 2].map((i) => (
                <i key={i} className="u-size-1_4 rounded-full bg-label-secondary opacity-35" />
              ))}
            </span>
            {t("noCall")}
          </section>
        )}

        <div className="flex min-h-0 flex-col u-gap-1_6">
          {/* Publicité en alternance avec le QR code de l'agence, avec ou sans appel (règles de diffusion inchangées). */}
          <TvAdSlot ads={session.show_ads ? (session.ads ?? []) : []} adKey={adKey}>
            {qrCard}
          </TvAdSlot>
          {hasCalls ? (
            <section aria-label={t("upNext")} className="u-rounded-1_4 bg-grouped-secondary u-px-1_6 u-py-1_2">
              <h2 className="u-mb-0_6 u-text-1_3 font-semibold tracking-[0.04em] text-label-secondary uppercase">{t("upNext")}</h2>
              <p className="flex flex-wrap u-gap-x-1_4 font-rounded u-text-2_4 font-bold text-ticket-number">
                {view.next.length ? view.next.map((code) => <span key={code}>{code}</span>) : <span className="text-label-secondary">–</span>}
              </p>
            </section>
          ) : (
            <section aria-label={t("previousCalls")} className="u-rounded-1_4 bg-grouped-secondary u-px-1_6 u-py-1_2">
              <h2 className="u-mb-0_6 u-text-1_3 font-semibold tracking-[0.04em] text-label-secondary uppercase">
                {t("previousCalls")}
              </h2>
              {view.previous.length ? (
                <ul role="list" className="flex flex-wrap u-gap-x-1_4 font-rounded u-text-2_2 font-bold text-label-secondary">
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
                <p className="u-text-1_6 text-label-secondary">{t("noPreviousCall")}</p>
              )}
            </section>
          )}
        </div>
      </div>

      <footer className="flex items-center u-gap-1_6 u-px-2_4 u-pt-1 u-pb-1_4 u-text-1_4 text-label-secondary">
        <span aria-hidden className="flex items-end u-gap-0_5">
          <i className="u-size-0_8 rounded-full bg-accent" />
          <i className="u-size-0_7 rounded-full bg-accent" />
          <i className="u-size-0_6 rounded-full bg-accent" />
        </span>
        <p className="min-w-0 truncate">
          <b className="font-semibold text-label">{view.waiting ? t("waitingPeople", { count: view.waiting }) : t("waitingNobody")}</b> {t("waitingSuffix")} · {t("scanHint")}
        </p>
        {presence ? (
          <p className="ml-auto flex shrink-0 items-center u-gap-0_8">
            {t("presenceCode")}
            <span className="u-rounded-0_8 bg-grouped-secondary u-px-1 u-py-0_2 font-rounded u-text-2 font-bold tracking-[0.1em] text-label">
              {presence}
            </span>
          </p>
        ) : null}
      </footer>

      {offline ? (
        <p
          role="status"
          className="absolute u-top-1_8 left-1/2 flex -translate-x-1/2 items-center u-gap-0_8 rounded-full bg-orange u-px-1_8 u-py-0_6 u-text-1_6 font-bold text-label"
        >
          <WifiOff aria-hidden className="u-size-2 stroke-[2.2]" />
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
        className="pressable flex flex-col items-center u-gap-1 u-rounded-2 bg-white u-px-3_6 u-py-2_4 text-center text-navy u-fv-outline-0_3 u-fv-outline-offset-0_3 focus-visible:outline-accent"
      >
        <Volume2 aria-hidden className="u-size-6 stroke-[1.8]" />
        <span className="u-text-3 font-bold">{t("enableSound")}</span>
        <span className="u-text-1_5 text-label-secondary">{t("soundHint")}</span>
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
      className="fixed u-bottom-6 left-1/2 z-30 flex -translate-x-1/2 items-center u-gap-0_8 rounded-full bg-navy u-px-2 u-py-0_8 u-text-1_8 font-semibold text-white shadow-floating"
    >
      <Volume2 aria-hidden className="u-size-2_2" />
      {label}
    </p>
  );
}
