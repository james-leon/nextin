"use client";

import { useTranslations } from "next-intl";
import type { Appointment, AppointmentPractitioner, AppointmentRequest } from "@/lib/desk/appointments";
import { initialsOf } from "@/lib/text/initials";
import { cn } from "@/lib/cn";
import { timeOf } from "./format";

/** Hauteur d'une heure dans la grille (rem : suit la taille de texte de l'utilisateur). */
const HOUR_REM = 3.25;
/** Couleurs des pastilles d'initiales, une par colonne (contraste AA avec le texte blanc). */
const AVATARS = ["var(--accent-fill)", "var(--called-fill)", "var(--icon-indigo)", "var(--brand-tile)"];

/** Minutes depuis minuit, à l'heure de l'agence. */
function minutesOf(iso: string, tz: string) {
  const parts = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: tz }).formatToParts(new Date(iso));
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return h * 60 + m;
}

type Kind = "arrived" | "absent" | "upcoming" | "request" | "void";

const BLOCK: Record<Kind, string> = {
  arrived: "bg-green-tint border-l-[3px] border-green",
  absent: "bg-fill-tertiary border-l-[3px] border-label-tertiary text-label-secondary",
  upcoming: "bg-accent-tint border-l-[3px] border-accent",
  request: "bg-orange-tint border-2 border-dashed border-orange",
  void: "bg-grouped border-l-[3px] border-separator text-label-secondary line-through",
};

/**
 * Agenda du jour de l'accueil (maquette v2 20) : une colonne par praticien, l'heure à gauche, la ligne rouge de l'heure
 * actuelle ; rendez-vous arrivés en vert, absents en gris, à venir en bleu, demande à traiter en orange pointillé ;
 * un praticien en congé a sa colonne hachurée. Chaque rendez-vous ouvre son détail (une seule action principale à
 * droite : « Marquer arrivé »).
 */
export function DayAgenda({
  practitioners,
  items,
  requests,
  onLeave,
  tz,
  locale,
  isToday,
  now,
  selectedId,
  onOpen,
  onOpenRequest,
}: {
  practitioners: AppointmentPractitioner[];
  items: Appointment[];
  /** Demandes en attente qui tombent ce jour-là, sur un praticien affiché. */
  requests: AppointmentRequest[];
  /** Praticiens en congé ce jour-là. */
  onLeave: Set<string>;
  tz: string;
  locale: string;
  isToday: boolean;
  now: number;
  selectedId: string | null;
  onOpen: (id: string) => void;
  onOpenRequest: (id: string) => void;
}) {
  const t = useTranslations("appointments");
  const ts = useTranslations("appointments.status");
  const isVoid = (a: Appointment) => a.display_status === "cancelled" || a.display_status === "rescheduled";
  const shown = items.filter((a) => !isVoid(a));
  // Plage horaire : de 08:00 à 18:00 au moins, élargie aux rendez-vous et demandes du jour.
  const starts = [...shown.map((a) => minutesOf(a.starts_at, tz)), ...requests.map((r) => minutesOf(r.preferred_starts_at!, tz))];
  const ends = shown.map((a) => minutesOf(a.ends_at, tz));
  const first = Math.min(8, ...starts.map((m) => Math.floor(m / 60)));
  const last = Math.max(18, ...ends.map((m) => Math.ceil(m / 60)), ...starts.map((m) => Math.floor(m / 60) + 1));
  const hours = Array.from({ length: last - first }, (_, i) => first + i);
  const top = (minutes: number) => `${((minutes - first * 60) / 60) * HOUR_REM}rem`;
  const nowMinutes = isToday ? minutesOf(new Date(now).toISOString(), tz) : null;
  const showNow = nowMinutes !== null && nowMinutes >= first * 60 && nowMinutes <= last * 60;
  const columns = `3.5rem repeat(${practitioners.length}, minmax(11rem, 1fr))`;
  const kindOf = (a: Appointment): Kind =>
    isVoid(a)
      ? "void"
      : a.display_status === "checked_in" || a.display_status === "completed" || a.display_status === "waiting"
      ? "arrived"
      : a.display_status === "no_show"
        ? "absent"
        : "upcoming";

  return (
    <section aria-label={t("agendaDay")} className="squircle overflow-x-auto rounded-[var(--radius-lg)] bg-grouped-secondary">
      <div className="grid min-w-full" style={{ gridTemplateColumns: columns }}>
        {/* En-têtes : initiales et nom du praticien (« · congé » s'il est absent toute la journée). */}
        <div className="hairline-b" />
        {practitioners.map((p, i) => (
          <div key={p.id} className="flex min-h-12 items-center gap-2 border-l border-separator px-3 py-2 hairline-b">
            <span
              aria-hidden
              className="flex size-7 shrink-0 items-center justify-center rounded-full text-caption font-semibold text-white"
              style={{ background: onLeave.has(p.id) ? "var(--fill-secondary)" : AVATARS[i % AVATARS.length] }}
            >
              <span className={onLeave.has(p.id) ? "text-label" : undefined}>{initialsOf(p.name)}</span>
            </span>
            <span className={cn("min-w-0 truncate text-subheadline font-semibold", onLeave.has(p.id) && "text-label-secondary")}>
              {p.name}
              {onLeave.has(p.id) ? ` · ${t("leaveShort")}` : ""}
            </span>
          </div>
        ))}

      </div>
      <div className="relative grid min-w-full" style={{ gridTemplateColumns: columns }}>
        {/* Axe des heures. */}
        <div className="relative" style={{ height: `${hours.length * HOUR_REM}rem` }}>
          {hours.map((h) => (
            <span key={h} className="absolute right-2 -translate-y-1/2 text-caption text-label-secondary tabular" style={{ top: top(h * 60) }}>
              {String(h).padStart(2, "0")}:00
            </span>
          ))}
        </div>

        {practitioners.map((p) => {
          // Créneaux annulés ou reprogrammés d'abord (grisés, barrés), recouverts par les rendez-vous actifs.
          const own = [...items.filter((a) => isVoid(a)), ...shown].filter((a) => a.practitioner.id === p.id);
          const ownRequests = requests.filter((r) => r.practitioner_id === p.id);
          const leave = onLeave.has(p.id);
          return (
            <div
              key={p.id}
              className={cn(
                "relative border-l border-separator",
                leave && "bg-[repeating-linear-gradient(135deg,var(--fill-tertiary)_0_10px,transparent_10px_20px)]",
              )}
              style={{ height: `${hours.length * HOUR_REM}rem` }}
            >
              {hours.slice(1).map((h) => (
                <span key={h} aria-hidden className="absolute inset-x-0 border-t border-separator/60" style={{ top: top(h * 60) }} />
              ))}
              <ul role="list" aria-label={p.name}>
                {own.map((a) => {
                  const start = minutesOf(a.starts_at, tz);
                  const end = Math.max(start + 20, minutesOf(a.ends_at, tz));
                  const kind = kindOf(a);
                  const label =
                    kind === "arrived" ? t("arrivedShort") : kind === "absent" ? t("absentShort") : kind === "void" ? ts(a.display_status) : (a.customer_label ?? (locale === "en" && a.service.name_en ? a.service.name_en : a.service.name));
                  const long = end - start >= 50;
                  return (
                    <li key={a.id} className="absolute inset-x-1" style={{ top: top(start), height: `${((end - start) / 60) * HOUR_REM - 0.15}rem` }}>
                      <button
                        type="button"
                        onClick={() => onOpen(a.id)}
                        aria-label={[timeOf(a.starts_at, locale, tz), a.customer_label, locale === "en" && a.service.name_en ? a.service.name_en : a.service.name, ts(a.display_status)]
                          .filter(Boolean)
                          .join(" · ")}
                        aria-current={selectedId === a.id ? "true" : undefined}
                        className={cn(
                          "pressable flex size-full min-h-6 flex-col overflow-hidden rounded-[6px] px-2 py-0.5 text-left",
                          BLOCK[kind],
                          selectedId === a.id && "ring-2 ring-accent",
                        )}
                      >
                        <span className="truncate text-footnote font-semibold tabular">
                          {timeOf(a.starts_at, locale, tz)} · {label}
                        </span>
                        {long ? (
                          <span className="truncate text-caption text-label-secondary">
                            {locale === "en" && a.service.name_en ? a.service.name_en : a.service.name}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
                {ownRequests.map((r) => {
                  const start = minutesOf(r.preferred_starts_at!, tz);
                  return (
                    <li key={r.id} className="absolute inset-x-1" style={{ top: top(start), height: `${(30 / 60) * HOUR_REM - 0.15}rem` }}>
                      <button
                        type="button"
                        onClick={() => onOpenRequest(r.id)}
                        className={cn("pressable flex size-full min-h-6 items-center overflow-hidden rounded-[6px] px-2 text-left", BLOCK.request)}
                      >
                        <span className="truncate text-footnote font-semibold tabular">
                          {timeOf(r.preferred_starts_at!, locale, tz)} · {t("requestShort")}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
        {/* Ligne rouge de l'heure actuelle, au-dessus des colonnes (le jour même seulement). */}
        {showNow ? (
          <div aria-hidden className="pointer-events-none absolute right-0 left-[3.5rem] flex items-center" style={{ top: top(nowMinutes!) }}>
            <span className="-ml-1 size-2 -translate-y-px rounded-full bg-red" />
            <span className="h-px flex-1 -translate-y-px bg-red" />
          </div>
        ) : null}
      </div>
    </section>
  );
}
