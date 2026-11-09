"use client";

import { useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";
import { localDate } from "@nextin/shared/appointments";
import type { Appointment } from "@/lib/desk/appointments";
import { hourRange, minutesOfDay, placeDay } from "@/lib/desk/agenda";
import { cn } from "@/lib/cn";
import { longDay, shortDay, timeOf } from "./format";

const HOUR_PX = 80;

/**
 * Agenda de la semaine sur ordinateur : une colonne par jour, heures en ordonnée, rendez-vous à leur place et à leur
 * durée (côte à côte s'ils se chevauchent). Repère du patient seulement pour le personnel (jamais diffusé).
 */
export function WeekAgenda({
  days,
  items,
  today,
  tz,
  locale,
  onOpenDay,
  onOpen,
}: {
  days: string[];
  items: Appointment[];
  today: string;
  tz: string;
  locale: string;
  onOpenDay: (day: string) => void;
  onOpen: (id: string) => void;
}) {
  const t = useTranslations("appointments");
  const spans = items.map((a) => ({ item: a, start: minutesOfDay(a.starts_at, tz), end: minutesOfDay(a.ends_at, tz) }));
  const [from, to] = hourRange(spans);
  const hours = Array.from({ length: to - from }, (_, i) => from + i);
  const height = (to - from) * HOUR_PX;

  return (
    <section aria-label={t("agendaLabel")} className="squircle overflow-hidden rounded-[var(--radius-xl)] bg-grouped-secondary shadow-card">
      <div className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] hairline-b">
        <span aria-hidden />
        {days.map((d) => {
          const s = shortDay(d, locale);
          const isToday = d === today;
          return (
            <button
              key={d}
              type="button"
              onClick={() => onOpenDay(d)}
              aria-label={longDay(d, locale)}
              className="pressable flex min-h-11 flex-col items-center py-2"
            >
              <span className={cn("text-footnote font-semibold uppercase", isToday ? "text-accent-text" : "text-label-secondary")}>{s.weekday}</span>
              <span className={cn("flex size-8 items-center justify-center rounded-full text-headline tabular", isToday && "bg-accent text-white")}>{s.day}</span>
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))]" style={{ height }}>
        {/* Heures */}
        <div aria-hidden className="relative">
          {hours.map((h, i) => (
            <span key={h} className="absolute right-2 -translate-y-1/2 text-caption text-label-secondary tabular" style={{ top: i * HOUR_PX }}>
              {i === 0 ? null : `${String(h).padStart(2, "0")}:00`}
            </span>
          ))}
        </div>
        {days.map((d) => {
          const placed = placeDay(spans.filter((s) => localDate(s.item.starts_at, tz) === d));
          return (
            <ul
              key={d}
              role="list"
              aria-label={longDay(d, locale)}
              className="relative border-l-[0.5px] border-separator"
              style={{ backgroundImage: `repeating-linear-gradient(to bottom, var(--separator) 0 0.5px, transparent 0.5px ${HOUR_PX}px)` }}
            >
              {placed.map(({ item: a, start, end, lane, lanes }) => (
                <li
                  key={a.id}
                  className="absolute p-0.5"
                  style={{
                    top: ((start - from * 60) / 60) * HOUR_PX,
                    height: Math.max(((end - start) / 60) * HOUR_PX, 22),
                    left: `${(lane / lanes) * 100}%`,
                    width: `${100 / lanes}%`,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => onOpen(a.id)}
                    className={cn(
                      "pressable squircle flex size-full min-h-0 flex-col overflow-hidden rounded-[8px] bg-grouped px-2 py-1 text-left",
                      (a.display_status === "cancelled" || a.display_status === "rescheduled") && "opacity-60",
                    )}
                    style={{ borderLeft: `3px solid ${a.service.color}` }}
                  >
                    <span className="flex items-center gap-1 text-footnote font-semibold tabular">
                      {timeOf(a.starts_at, locale, tz)}
                      {a.conflict ? <AlertTriangle aria-label={t("conflict")} className="size-3.5 shrink-0 text-orange" /> : null}
                    </span>
                    <span className="truncate text-footnote">{a.customer_label ?? t("noLabel")}</span>
                    <span className="truncate text-caption text-label-secondary">{a.practitioner.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          );
        })}
      </div>
    </section>
  );
}
