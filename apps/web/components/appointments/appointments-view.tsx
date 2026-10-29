"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { AlertTriangle, CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { addDays, localDate, weekDays, weekStart } from "@nextin/shared/appointments";
import { staffTopic } from "@nextin/shared/queue/realtime";
import { BottomBar } from "@/components/ui/bottom-bar";
import { Button, IconButton } from "@/components/ui/button";
import { ListRow, ListSection } from "@/components/ui/list";
import { NavigationBar } from "@/components/ui/navigation-bar";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Sheet } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { listAppointments, type Appointment, type AppointmentsContext } from "@/lib/desk/appointments";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/cn";
import { AppointmentDetail } from "./appointment-detail";
import { BookingForm } from "./booking-form";
import { longDay, shortDay, timeOf } from "./format";
import { AppointmentStatusBadge } from "./status-badge";
import { RequestsInbox } from "./requests-inbox";
import { useMediaQuery } from "@/components/ui/use-media-query";

type View = "day" | "week" | "requests";
type Pane = { kind: "detail"; id: string } | { kind: "book" } | { kind: "reschedule"; id: string } | null;

/** Heure de début et de fin, en colonne (repère visuel d'une ligne de rendez-vous). */
function TimeColumn({ a, tz, locale }: { a: Appointment; tz: string; locale: string }) {
  return (
    <span className="flex w-14 shrink-0 flex-col items-end py-2.5 tabular">
      <span className="text-callout font-semibold">{timeOf(a.starts_at, locale, tz)}</span>
      <span className="text-footnote text-label-secondary">{timeOf(a.ends_at, locale, tz)}</span>
    </span>
  );
}

/**
 * Rendez-vous de l'agence (accueil) : vue du jour ou de la semaine, filtre par praticien, détail et actions,
 * prise de rendez-vous. Ordinateur : liste et détail côte à côte, semaine en 7 colonnes ; téléphone : liste et feuilles.
 */
export function AppointmentsView({ ctx, initialView = "day", pendingRequests = 0 }: { ctx: AppointmentsContext; initialView?: View; pendingRequests?: number }) {
  const t = useTranslations("appointments");
  const tr = useTranslations("reception");
  const tc = useTranslations("common");
  const locale = useLocale();
  const supabase = getSupabaseBrowserClient();
  const desktop = useMediaQuery("(min-width: 1024px)");
  const tz = ctx.branch.timeZone;
  const [view, setView] = useState<View>(initialView);
  const [date, setDate] = useState(ctx.today);
  const [practitioner, setPractitioner] = useState<string>("all");
  // Résultat rattaché à sa requête : changer de jour ou de filtre affiche le chargement sans effacement explicite.
  const [data, setData] = useState<{ key: string; items: Appointment[] } | null>(null);
  const [pane, setPane] = useState<Pane>(null);

  const days = useMemo(() => (view === "week" ? weekDays(date) : [date]), [view, date]);
  const from = days[0]!;
  const to = days[days.length - 1]!;

  const key = `${from}|${to}|${practitioner}`;
  const items = data?.key === key ? data.items : null;

  const load = useCallback(async () => {
    const next = await listAppointments(supabase, ctx.branch.id, from, to, practitioner === "all" ? null : practitioner).catch(() => null);
    if (next) setData({ key: `${from}|${to}|${practitioner}`, items: next });
  }, [supabase, ctx.branch.id, from, to, practitioner]);

  useEffect(() => {
    let alive = true;
    listAppointments(supabase, ctx.branch.id, from, to, practitioner === "all" ? null : practitioner).then(
      (next) => alive && setData({ key: `${from}|${to}|${practitioner}`, items: next }),
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, [supabase, ctx.branch.id, from, to, practitioner]);

  // Arrivées, appels et fins de passage mettent à jour les statuts : canal privé de l'agence + vérification de secours.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const channel = supabase
      .channel(staffTopic(ctx.branch.id), { config: { private: true } })
      .on("broadcast", { event: "board" }, () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => void load(), 400);
      })
      .subscribe();
    const poll = setInterval(() => void load(), 30_000);
    return () => {
      if (timer) clearTimeout(timer);
      clearInterval(poll);
      void supabase.removeChannel(channel);
    };
  }, [supabase, ctx.branch.id, load]);

  const byId = (id: string) => items?.find((a) => a.id === id) ?? null;
  const selected = pane && pane.kind !== "book" ? byId(pane.id) : null;
  const step = view === "day" ? 1 : 7;
  const title = view === "day" ? longDay(date, locale) : t("weekOf", { date: longDay(weekStart(date), locale) });

  function changed(next: Appointment) {
    setData((d) => (d ? { ...d, items: d.items.map((a) => (a.id === next.id ? next : a)) } : d));
    void load();
  }

  function booked(a: Appointment) {
    setPane(desktop && view === "day" ? { kind: "detail", id: a.id } : null);
    setDate(localDate(a.starts_at, tz));
    void load();
  }

  const inline = desktop && view === "day";
  const detailContent = (a: Appointment) => (
    <AppointmentDetail key={a.id} appointment={a} ctx={ctx} onChanged={changed} onReschedule={() => setPane({ kind: "reschedule", id: a.id })} />
  );
  const rescheduling = pane?.kind === "reschedule" ? byId(pane.id) : null;

  const row = (a: Appointment, compact = false) => (
    <ListRow
      key={a.id}
      icon={<TimeColumn a={a} tz={tz} locale={locale} />}
      title={a.customer_label ?? t("noLabel")}
      subtitle={compact ? a.practitioner.name : `${a.practitioner.name} · ${locale === "en" && a.service.name_en ? a.service.name_en : a.service.name}`}
      detail={
        <span className="flex items-center gap-1.5">
          {a.conflict ? <AlertTriangle aria-label={t("conflict")} className="size-4 text-orange" /> : null}
          <AppointmentStatusBadge status={a.display_status} />
        </span>
      }
      accessory={inline ? undefined : "chevron"}
      onClick={() => setPane({ kind: "detail", id: a.id })}
      className={cn(inline && pane?.kind !== "book" && pane?.id === a.id && "bg-fill-tertiary")}
    />
  );

  const loading = (
    <div role="status" className="flex flex-col gap-2">
      <span className="sr-only">{tc("loading")}</span>
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-14 rounded-[var(--radius-md)]" />
      ))}
    </div>
  );

  return (
    <main className="min-h-dvh pb-40 lg:pb-16">
      <NavigationBar
        title={t("title")}
        eyebrow={`${ctx.branch.organizationName} · ${ctx.branch.name}`}
        back={{ href: `/desk/reception/${ctx.branch.id}`, label: tr("title") }}
        trailing={
          <Button className="hidden lg:inline-flex" leadingIcon={<Plus />} onClick={() => setPane({ kind: "book" })}>
            {t("new")}
          </Button>
        }
        contentClassName="max-w-7xl"
      />

      <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 pt-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <SegmentedControl
            label={t("viewLabel")}
            value={view}
            onValueChange={(v) => {
              setView(v);
              setPane(null);
            }}
            options={[
              { value: "day", label: t("day") },
              { value: "week", label: t("week") },
              { value: "requests", label: pendingRequests ? `${t("requestsView")} (${pendingRequests})` : t("requestsView") },
            ]}
            className="w-full md:w-96"
          />
          <div className={cn("flex items-center gap-1", view === "requests" && "invisible")}>
            <IconButton label={view === "day" ? t("previousDay") : t("previousWeek")} icon={<ChevronLeft />} variant="plain" onClick={() => setDate(addDays(date, -step))} />
            <Button size="md" variant="gray" onClick={() => setDate(ctx.today)} disabled={days.includes(ctx.today)}>
              {t("today")}
            </Button>
            <IconButton label={view === "day" ? t("nextDay") : t("nextWeek")} icon={<ChevronRight />} variant="plain" onClick={() => setDate(addDays(date, step))} />
          </div>
        </div>
        <h2 className="text-title2 font-bold first-letter:uppercase" aria-live="polite">
          {view === "requests" ? t("requests.title") : title}
        </h2>

        {view === "requests" ? (
          <RequestsInbox
            ctx={ctx}
            onBooked={(d) => {
              setDate(d);
            }}
          />
        ) : null}

        {view !== "requests" && ctx.practitioners.length > 1 ? (
          <div role="radiogroup" aria-label={t("practitionerFilter")} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {[{ id: "all", name: t("allPractitioners") }, ...ctx.practitioners].map((p) => (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={practitioner === p.id}
                onClick={() => setPractitioner(p.id)}
                className={cn(
                  "pressable min-h-11 shrink-0 rounded-full px-4 text-subheadline font-semibold",
                  practitioner === p.id ? "bg-accent text-white" : "bg-grouped-secondary text-label",
                )}
              >
                {p.name}
              </button>
            ))}
          </div>
        ) : null}

        {view === "requests" ? null : view === "day" ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start xl:grid-cols-[minmax(0,30rem)_minmax(0,1fr)]">
            <section aria-label={title}>
              {items === null ? (
                loading
              ) : items.length ? (
                <ListSection header={t("count", { count: items.length })}>{items.map((a) => row(a))}</ListSection>
              ) : (
                <div className="squircle flex flex-col items-center gap-2 rounded-[var(--radius-lg)] bg-grouped-secondary px-6 py-10 text-center">
                  <CalendarDays aria-hidden className="size-9 stroke-[1.5] text-label-tertiary" />
                  <p className="text-body text-label-secondary">{t("empty")}</p>
                </div>
              )}
            </section>
            {desktop ? (
              <aside
                aria-label={pane?.kind === "book" ? t("new") : pane?.kind === "reschedule" ? t("rescheduleTitle") : t("detail")}
                className="squircle sticky top-24 rounded-[var(--radius-xl)] bg-grouped-secondary p-5 shadow-card"
              >
                {pane?.kind === "book" ? (
                  <>
                    <h2 className="pb-1 text-title3 font-semibold">{t("new")}</h2>
                    <p className="pb-5 text-subheadline text-label-secondary">{t("newBody")}</p>
                    <BookingForm ctx={{ ...ctx, today: ctx.today }} onDone={booked} />
                  </>
                ) : rescheduling ? (
                  <>
                    <h2 className="pb-1 text-title3 font-semibold">{t("rescheduleTitle")}</h2>
                    <p className="pb-5 text-subheadline text-label-secondary">{t("rescheduleBody")}</p>
                    <BookingForm ctx={ctx} reschedule={rescheduling} onDone={booked} />
                  </>
                ) : selected ? (
                  detailContent(selected)
                ) : (
                  <div className="flex flex-col items-center gap-2 py-16 text-center">
                    <CalendarDays aria-hidden className="size-10 stroke-[1.5] text-label-tertiary" />
                    <p className="text-body text-label-secondary">{t("selectHint")}</p>
                  </div>
                )}
              </aside>
            ) : null}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-7 md:gap-2 xl:gap-3">
            {days.map((d) => {
              const dayItems = (items ?? []).filter((a) => localDate(a.starts_at, tz) === d);
              const s = shortDay(d, locale);
              const isToday = d === ctx.today;
              return (
                <section key={d} aria-label={longDay(d, locale)} className="flex min-w-0 flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDate(d);
                      setView("day");
                    }}
                    className="pressable flex min-h-11 items-baseline gap-2 rounded-[var(--radius-sm)] px-2 text-left md:flex-col md:items-center md:gap-0 md:py-1"
                  >
                    <span className={cn("text-footnote font-semibold uppercase", isToday ? "text-accent-text" : "text-label-secondary")}>{s.weekday}</span>
                    <span
                      className={cn(
                        "text-title3 font-bold tabular",
                        isToday && "md:flex md:size-9 md:items-center md:justify-center md:rounded-full md:bg-accent md:text-white",
                      )}
                    >
                      {s.day}
                    </span>
                    <span className="text-footnote text-label-secondary md:hidden">{t("count", { count: dayItems.length })}</span>
                  </button>
                  {items === null ? (
                    <Skeleton className="h-16 rounded-[var(--radius-md)]" />
                  ) : dayItems.length ? (
                    <ul role="list" className="flex flex-col gap-1.5">
                      {dayItems.map((a) => (
                        <li key={a.id}>
                          <button
                            type="button"
                            onClick={() => setPane({ kind: "detail", id: a.id })}
                            className="pressable squircle flex min-h-11 w-full flex-col gap-0.5 rounded-[var(--radius-sm)] bg-grouped-secondary px-3 py-2 text-left shadow-card"
                            style={{ borderLeft: `3px solid ${a.service.color}` }}
                          >
                            <span className="flex flex-wrap items-center gap-x-1.5">
                              <span className="text-subheadline font-semibold tabular">{timeOf(a.starts_at, locale, tz)}</span>
                              <span className="min-w-0 max-w-full truncate text-subheadline">{a.customer_label ?? t("noLabel")}</span>
                              {a.conflict ? <AlertTriangle aria-label={t("conflict")} className="size-3.5 shrink-0 text-orange" /> : null}
                            </span>
                            <span className="truncate text-footnote text-label-secondary">{a.practitioner.name}</span>
                            {a.display_status === "confirmed" ? null : (
                              <span className="pt-0.5">
                                <AppointmentStatusBadge status={a.display_status} />
                              </span>
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="hidden px-2 text-footnote text-label-secondary md:block">{t("emptyDay")}</p>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>

      <BottomBar className="lg:hidden">
        <Button block leadingIcon={<Plus />} onClick={() => setPane({ kind: "book" })}>
          {t("new")}
        </Button>
      </BottomBar>

      {/* Téléphone, tablette et vue semaine : détail, prise et reprogrammation en feuille. */}
      {!inline && pane ? (
        <Sheet
          open
          onOpenChange={(o) => !o && setPane(null)}
          title={pane.kind === "book" ? t("new") : pane.kind === "reschedule" ? t("rescheduleTitle") : t("detail")}
          description={pane.kind === "book" ? t("newBody") : pane.kind === "reschedule" ? t("rescheduleBody") : undefined}
          closeLabel={tc("close")}
        >
          {pane.kind === "book" ? (
            <BookingForm ctx={ctx} onDone={booked} />
          ) : rescheduling ? (
            <BookingForm ctx={ctx} reschedule={rescheduling} onDone={booked} />
          ) : selected ? (
            <div className="pt-2">{detailContent(selected)}</div>
          ) : null}
        </Sheet>
      ) : null}
    </main>
  );
}
