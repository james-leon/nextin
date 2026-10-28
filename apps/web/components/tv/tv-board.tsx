"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Volume2, VolumeX, WifiOff } from "lucide-react";
import { waitMinutes } from "@nextin/shared/queue/estimate";
import type { BoardCall, BranchBoard } from "@nextin/shared/queue/live";
import { spellTicketCode } from "@nextin/shared/ticket";
import { Logo } from "@/components/ui/logo";
import { ServiceTile } from "@/components/ui/service-tile";
import { useLiteLocale, useLiteT } from "@/lib/i18n/lite";
import { qrMatrix } from "@/lib/qr/matrix";
import { tvCalls } from "@/lib/tv/calls";
import { cn } from "@/lib/cn";
import type { TvSession } from "./types";

/** Écran de salle d'attente (maquette 05) : ticket appelé en héros, appels précédents, files, QR code d'entrée. */
export function TvBoard({
  session,
  board,
  offline,
  soundOn,
  onEnableSound,
}: {
  session: TvSession;
  board: BranchBoard;
  offline: boolean;
  soundOn: boolean;
  onEnableSound: () => void;
}) {
  const t = useLiteT("tv");
  const tk = useLiteT("counterKinds");
  const locale = useLiteLocale();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(id);
  }, []);

  const { hero, others } = tvCalls(board, session.service_ids);
  const services = board.services.filter((s) => session.service_ids.length === 0 || session.service_ids.includes(s.id));
  const qr = useMemo(() => (session.entry_url ? qrMatrix(session.entry_url, 2) : null), [session.entry_url]);
  const counterKind = (c: BoardCall) => (c.counter_label ? c.counter_label : tk(c.counter_kind));
  const name = (s: (typeof services)[number]) => (locale === "en" && s.name_en ? s.name_en : s.name);
  const clock = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone: session.branch.timezone }).format(now);

  return (
    <main className="flex h-dvh flex-col gap-[2.2vh] overflow-hidden bg-tv px-[3.5vw] pt-[4vh] pb-[3.5vh] text-white">
      <header className="flex items-center gap-6">
        <Logo tone="inverse" className="[&>span:first-child]:size-[5.5vh] [&>span:last-child]:text-[3.4vh]" />
        <p className="truncate text-[2.8vh] text-white/80">
          {session.organization.name} · {session.branch.name}
        </p>
        <div className="ml-auto flex items-center gap-4">
          {offline ? (
            <span role="status" className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-[2vh]">
              <WifiOff aria-hidden className="size-[2.4vh]" />
              {t("offline")}
            </span>
          ) : null}
          <button
            type="button"
            onClick={onEnableSound}
            className={cn(
              "pressable flex min-h-11 items-center gap-2 rounded-full px-4 py-2 text-[2vh]",
              soundOn ? "bg-white/10 text-white/80" : "bg-accent text-white",
            )}
          >
            {soundOn ? <Volume2 aria-hidden className="size-[2.4vh]" /> : <VolumeX aria-hidden className="size-[2.4vh]" />}
            {soundOn ? t("soundOn") : t("enableSound")}
          </button>
          <p className="text-[5.5vh] leading-none font-bold tabular">{clock}</p>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[1.45fr_1fr] gap-[2.2vw]">
        <div className="flex min-h-0 flex-col gap-[2.2vh]">
          <section
            aria-live="assertive"
            aria-label={t("called")}
            className="squircle flex min-h-0 flex-1 items-center justify-between gap-6 rounded-[2.4vw] bg-white px-[4vw] text-ticket-number"
          >
            {hero ? (
              <>
                <div key={`${hero.code}-${hero.called_at}`} className="min-w-0 animate-pop-in">
                  <p className="text-[3.2vh] font-bold tracking-[0.08em] text-label-secondary uppercase">{t("called")}</p>
                  <p className="text-[min(20vh,11vw)] leading-[0.95] font-extrabold whitespace-nowrap">
                    <span aria-hidden>{hero.code}</span>
                    <span className="sr-only">{spellTicketCode(hero.code)}</span>
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-[2vw]">
                  <ArrowRight aria-hidden className="size-[7vh] stroke-[2.5] text-orange" />
                  <div className="text-right">
                    <p className="text-[3.6vh] text-label-secondary">{counterKind(hero)}</p>
                    {hero.counter_label ? null : <p className="text-[16vh] leading-none font-extrabold">{hero.counter_number}</p>}
                  </div>
                </div>
              </>
            ) : (
              <p className="w-full text-center text-[4vh] text-label-secondary">{t("noCall")}</p>
            )}
          </section>
          {/* Derniers appels : aucune tuile vide, un tiret discret tant qu'il n'y a pas d'appel précédent. */}
          <section aria-label={t("previousCalls")} className="flex h-[11vh] shrink-0 flex-col">
            {others.length ? (
              <ul role="list" className="grid h-full grid-cols-3 gap-[1.6vw]">
                {others.map((c) => (
                  <li key={`${c.code}-${c.called_at}`} className="squircle flex items-center justify-between gap-3 rounded-[1.4vw] bg-tv-surface px-[1.8vw]">
                    <span className="shrink-0 text-[4.4vh] leading-none font-extrabold whitespace-nowrap">
                      <span aria-hidden>{c.code}</span>
                      <span className="sr-only">{spellTicketCode(c.code)}</span>
                    </span>
                    <span className="min-w-0 truncate text-[2.4vh] text-white/80">
                      {counterKind(c)} {c.counter_label ? "" : c.counter_number}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="flex h-full items-center px-[1.8vw] text-[2.4vh] text-white/80">
                <span aria-hidden>–</span>
                <span className="sr-only">{t("noPreviousCall")}</span>
              </p>
            )}
          </section>
        </div>

        <div className="flex min-h-0 flex-col gap-[2.2vh]">
          <section aria-label={t("waitingHeader")} className="squircle flex min-h-0 flex-1 flex-col rounded-[2.4vw] bg-tv-surface px-[2.2vw] py-[3vh]">
            <h2 className="pb-[1.5vh] text-[2.4vh] font-semibold tracking-[0.1em] text-white/80 uppercase">{t("waitingHeader")}</h2>
            <ul role="list" className="flex min-h-0 flex-col gap-[1.6vh] overflow-hidden">
              {services.map((s) => (
                <li key={s.id} className="flex items-center gap-[1.2vw]">
                  <ServiceTile letter={s.prefix} color={s.color} className="size-[6vh] rounded-[1.2vh] text-[3vh]" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[2.8vh] leading-tight font-semibold">{name(s)}</span>
                    <span className="truncate text-[2.3vh] text-white/80 tabular">
                      {t("waiting", { count: s.waiting.length })}
                      {s.waiting.length ? ` · ${t("wait", { minutes: waitMinutes(s.wait_seconds) })}` : ""}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
          {qr ? (
            <section className="squircle flex items-center gap-[1.6vw] rounded-[2.4vw] bg-white px-[1.8vw] py-[2.2vh] text-ticket-number">
              <svg viewBox={`0 0 ${qr.size} ${qr.size}`} role="img" aria-label={t("scanTitle")} className="size-[15vh] shrink-0 rounded-[1vh]" shapeRendering="crispEdges">
                <rect width={qr.size} height={qr.size} fill="#fff" />
                <path d={qr.path} fill="#000" />
              </svg>
              <div className="min-w-0">
                <p className="text-[3vh] leading-tight font-bold text-balance">{t("scanTitle")}</p>
                <p className="text-[2.4vh] leading-snug text-label-secondary">{t("scanBody")}</p>
                {session.entry ? <p className="mt-1 text-[2.4vh] font-semibold text-label-secondary tabular">{t("code", { code: session.entry.short_code })}</p> : null}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </main>
  );
}
