"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, Download, FileSpreadsheet, Stethoscope } from "lucide-react";
import { staffTopic } from "@nextin/shared/queue/realtime";
import {
  comparisonRange,
  delta,
  peakIndex,
  periodRange,
  shiftPeriod,
  toMinutes,
  type Delta,
  type StatsPeriod,
} from "@nextin/shared/stats";
import { Badge, StatusDot } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { ListIcon, ListRow, ListSection } from "@/components/ui/list";
import { NavigationBar } from "@/components/ui/navigation-bar";
import { ProgressBar } from "@/components/ui/progress-bar";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { SelectField } from "@/components/ui/select-field";
import { ServiceTile } from "@/components/ui/service-tile";
import { Sheet } from "@/components/ui/sheet";
import { StatCard } from "@/components/ui/stat-card";
import { counterName } from "@/lib/desk/counter-name";
import type { DashboardData, DashboardQuery } from "@/lib/stats/dashboard";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/cn";
import { BarChart } from "./bar-chart";

/** Une file est signalée chargée (orange) au-delà de 20 minutes d'attente estimée. */
const BUSY_WAIT_SECONDS = 20 * 60;

function Panel({ title, aside, children, className }: { title: string; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section aria-label={title} className={cn("squircle flex min-w-0 flex-col gap-4 rounded-[var(--radius-xl)] bg-grouped-secondary p-5 shadow-card", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-headline">{title}</h2>
        {aside ? <span className="text-footnote text-label-secondary">{aside}</span> : null}
      </div>
      {children}
    </section>
  );
}

/**
 * Tableau de bord (maquette 06) : indicateurs comparés à la période précédente, affluence par heure, files en direct,
 * tickets par jour, postes, services, praticiens et rendez-vous. Données anonymes uniquement.
 * Ordinateur : toute la largeur à droite du menu ; tablette : deux colonnes ; téléphone : une colonne.
 */
export function DashboardView({
  org,
  branches,
  canViewAll,
  canExport,
  canAdvanced,
  today,
  initialQuery,
  initialData,
}: {
  org: { id: string; name: string };
  branches: { id: string; name: string }[];
  canViewAll: boolean;
  /** Export CSV compris dans la formule (M10a). */
  canExport: boolean;
  /** Statistiques avancées (postes, praticiens) comprises dans la formule (M10a). */
  canAdvanced: boolean;
  today: string;
  initialQuery: DashboardQuery;
  initialData: DashboardData;
}) {
  const t = useTranslations("dashboard");
  const tk = useTranslations("counterKinds");
  const tc = useTranslations("common");
  const locale = useLocale();
  const supabase = getSupabaseBrowserClient();
  const [query, setQuery] = useState(initialQuery);
  const [result, setResult] = useState<{ key: string; data: DashboardData }>({ key: JSON.stringify(initialQuery), data: initialData });
  const [exportOpen, setExportOpen] = useState(false);
  const data = result.data;
  const loading = result.key !== JSON.stringify(query);

  const range = useMemo(() => periodRange(query.period, query.anchor), [query.period, query.anchor]);
  const compare = useMemo(() => comparisonRange(query.period, range, today), [query.period, range, today]);
  const live = range.from <= today && today <= range.to;
  const scope = query.branchId ? branches.filter((b) => b.id === query.branchId) : branches;
  const refreshing = useRef(false);

  useEffect(() => {
    let alive = true;
    const key = JSON.stringify(query);
    const load = () =>
      supabase
        .rpc("dashboard_stats", {
          p_org: org.id,
          p_branch: (query.branchId ?? null) as string,
          p_from: range.from,
          p_to: range.to,
          p_compare_from: compare.from,
          p_compare_to: compare.to,
        })
        .then(({ data: next }) => {
          refreshing.current = false;
          if (alive && next) setResult({ key, data: next as unknown as DashboardData });
        });
    void load();
    if (!live) {
      return () => {
        alive = false;
      };
    }
    // Période en cours : mise à jour à chaque mouvement de file (au plus toutes les 5 s) et chaque minute.
    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      if (timer || refreshing.current) return;
      timer = setTimeout(() => {
        timer = null;
        refreshing.current = true;
        void load();
      }, 5_000);
    };
    const channels = scope.slice(0, 10).map((b) =>
      supabase.channel(staffTopic(b.id), { config: { private: true } }).on("broadcast", { event: "board" }, schedule).subscribe(),
    );
    const poll = setInterval(() => void load(), 60_000);
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      clearInterval(poll);
      channels.forEach((c) => void supabase.removeChannel(c));
    };
    // `scope` dérive de query.branchId (déjà en dépendance).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, org.id, query, range, compare, live]);

  const fmtNumber = (n: number, digits = 0) => new Intl.NumberFormat(locale, { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(n);
  const minutes = (s: number | null | undefined) => (s == null ? t("none") : t("minutes", { value: toMinutes(s)! }));
  const longDate = (d: string, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale, { ...opts, timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));
  const reference =
    query.period === "day"
      ? t("vsDay", { weekday: longDate(compare.from, { weekday: "long" }) })
      : query.period === "week"
        ? t("vsWeek")
        : t("vsMonth");
  const trend = (d: Delta) => {
    if (!d) return undefined;
    if (d.value === 0) return t("stable");
    const value = `${d.value > 0 ? "+" : "−"}${fmtNumber(Math.abs(d.value), d.kind === "points" ? 1 : 0)}`;
    return d.kind === "percent"
      ? t("deltaPercent", { value, reference })
      : d.kind === "minutes"
        ? t("deltaMinutes", { value, reference })
        : t("deltaPoints", { value, reference });
  };
  const prev = data.previous;
  const kpis = [
    { label: t("issued"), value: fmtNumber(data.totals.issued), d: delta(data.totals.issued, prev?.issued, "percent", "up") },
    { label: t("waitAvg"), value: minutes(data.totals.wait_avg_seconds), d: delta(data.totals.wait_avg_seconds, prev?.wait_avg_seconds, "minutes", "down") },
    { label: t("serviceAvg"), value: minutes(data.totals.service_avg_seconds), d: delta(data.totals.service_avg_seconds, prev?.service_avg_seconds, "minutes", "neutral") },
    {
      label: t("abandonRate"),
      value: data.totals.abandon_rate == null ? t("none") : t("percent", { value: fmtNumber(data.totals.abandon_rate, 1) }),
      d: delta(data.totals.abandon_rate, prev?.abandon_rate, "points", "down"),
    },
  ];

  const title =
    query.period === "day"
      ? query.anchor === today
        ? t("today")
        : longDate(query.anchor, { weekday: "long", day: "numeric", month: "long" })
      : query.period === "week"
        ? live
          ? t("thisWeek")
          : t("weekOf", { date: longDate(range.from, { day: "numeric", month: "long" }) })
        : live
          ? t("thisMonth")
          : longDate(range.from, { month: "long", year: "numeric" });

  // Heures affichées : de 7 h à 17 h au minimum, élargies à l'activité réelle.
  const active = data.hourly.map((v, h) => (v > 0 ? h : -1)).filter((h) => h >= 0);
  const firstHour = Math.min(7, active[0] ?? 7);
  const lastHour = Math.max(17, active[active.length - 1] ?? 17);
  const hours = data.hourly.slice(firstHour, lastHour + 1);
  const hourPeak = peakIndex(hours);
  const dayPeak = peakIndex(data.daily.map((d) => d.issued));
  const maxWait = Math.max(BUSY_WAIT_SECONDS, ...data.live.map((s) => s.wait_seconds));
  const counterLabel = (c: { kind: string; number: number; label: string | null }) => counterName(c, (k) => tk(k as "cabinet"));
  const statusTone = { open: "green", paused: "orange", closed: "neutral" } as const;
  const statusLabel = { open: t("statusOpen"), paused: t("statusPaused"), closed: t("statusClosed") } as const;
  const duration = (s: number) => t("hoursMinutes", { hours: Math.floor(s / 3600), minutes: String(Math.floor((s % 3600) / 60)).padStart(2, "0") });
  const showBranch = !query.branchId && branches.length > 1;
  const exportHref = (kind: "services" | "counters") =>
    `/app/o/${org.id}/dashboard/export?${new URLSearchParams({ kind, from: range.from, to: range.to, ...(query.branchId ? { branch: query.branchId } : {}) })}`;

  const th = "px-3 py-2 text-left text-footnote font-normal text-label-secondary first:pl-0 last:pr-0";
  const td = "px-3 py-3 first:pl-0 last:pr-0";
  const num = "text-right tabular";

  return (
    <div className="pb-16">
      <NavigationBar
        title={title}
        eyebrow={`${org.name}${query.branchId ? ` · ${branches.find((b) => b.id === query.branchId)?.name ?? ""}` : ""}`}
        trailing={
          canExport ? (
            <Button variant="gray" leadingIcon={<Download />} onClick={() => setExportOpen(true)}>
              <span className="hidden sm:inline">{t("export")}</span>
              <span className="sr-only sm:hidden">{t("export")}</span>
            </Button>
          ) : undefined
        }
        contentClassName="max-w-none lg:px-8"
      />

      <div className="flex flex-col gap-5 px-4 pt-3 lg:px-8" aria-busy={loading}>
        {/* Période, navigation et agence. */}
        <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end md:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <SegmentedControl
              label={t("periodLabel")}
              value={query.period}
              onValueChange={(period: StatsPeriod) => setQuery((q) => ({ ...q, period }))}
              options={[
                { value: "day", label: t("day") },
                { value: "week", label: t("week") },
                { value: "month", label: t("month") },
              ]}
              className="sm:w-72"
            />
            <div className="flex items-center gap-1">
              <IconButton label={t("previous")} icon={<ChevronLeft />} variant="plain" onClick={() => setQuery((q) => ({ ...q, anchor: shiftPeriod(q.period, q.anchor, -1) }))} />
              <Button variant="gray" onClick={() => setQuery((q) => ({ ...q, anchor: today }))} disabled={live}>
                {t("current")}
              </Button>
              <IconButton
                label={t("next")}
                icon={<ChevronRight />}
                variant="plain"
                disabled={range.to >= today}
                onClick={() => setQuery((q) => ({ ...q, anchor: shiftPeriod(q.period, q.anchor, 1) }))}
              />
            </div>
          </div>
          {branches.length > 1 || canViewAll ? (
            <SelectField
              label={t("branch")}
              value={query.branchId ?? ""}
              onChange={(e) => setQuery((q) => ({ ...q, branchId: e.target.value || null }))}
              options={[...(canViewAll ? [{ value: "", label: t("allBranches") }] : []), ...branches.map((b) => ({ value: b.id, label: b.name }))]}
              className="md:w-64"
            />
          ) : null}
        </div>

        <div className={cn("grid grid-cols-2 gap-3 transition-opacity lg:grid-cols-4 lg:gap-5", loading && "opacity-60")}>
          {kpis.map((k) => (
            <StatCard key={k.label} label={k.label} value={k.value} trend={trend(k.d)} trendTone={k.d?.tone ?? "neutral"} className="shadow-card lg:px-5 lg:py-5" />
          ))}
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
          <Panel title={t("hourly")} aside={hourPeak >= 0 ? t("peak", { hour: firstHour + hourPeak }) : t("hourlyUnit")}>
            {data.totals.issued ? (
              <BarChart
                caption={t("hourly")}
                columns={[t("hourly"), t("hourlyUnit")]}
                highlight={hourPeak}
                bars={hours.map((v, i) => ({
                  key: String(firstHour + i),
                  label: t("hourLabel", { hour: firstHour + i }),
                  value: v,
                  tooltip: t("hourTooltip", { hour: firstHour + i, count: v }),
                }))}
              />
            ) : (
              <p className="py-16 text-center text-body text-label-secondary">{t("empty")}</p>
            )}
          </Panel>

          <Panel
            title={t("live")}
            aside={
              <Badge tone="green" shape="tag">
                <span aria-hidden className="size-1.5 rounded-full bg-green" />
                {t("liveBadge")}
              </Badge>
            }
          >
            <ul role="list" className="flex flex-col gap-4">
              {data.live.map((s) => {
                const name = `${showBranch ? `${s.branch} · ` : ""}${locale === "en" && s.name_en ? s.name_en : s.name}`;
                return (
                  <li key={`${s.branch}-${s.id}`} className="flex flex-col gap-1.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-body">{name}</span>
                      <span className="shrink-0 text-subheadline text-label-secondary tabular">
                        {!s.open && !s.waiting ? t("liveClosed") : s.waiting ? t("liveWaiting", { count: s.waiting, minutes: toMinutes(s.wait_seconds)! }) : t("liveEmpty")}
                      </span>
                    </div>
                    <ProgressBar
                      value={s.wait_seconds / maxWait}
                      tone={s.wait_seconds >= BUSY_WAIT_SECONDS ? "orange" : "accent"}
                      label={t("liveLoad", { name })}
                    />
                  </li>
                );
              })}
            </ul>
          </Panel>
        </div>

        {query.period !== "day" ? (
          <Panel title={t("daily")} aside={t("hourlyUnit")}>
            <BarChart
              caption={t("daily")}
              columns={[t("day"), t("hourlyUnit")]}
              highlight={dayPeak}
              bars={data.daily.map((d) => ({
                key: d.day,
                label: query.period === "week" ? longDate(d.day, { weekday: "short" }) : longDate(d.day, { day: "numeric" }),
                value: d.issued,
                tooltip: t("dayTooltip", { date: longDate(d.day, { weekday: "short", day: "numeric", month: "short" }), count: d.issued }),
              }))}
            />
          </Panel>
        ) : null}

        {canAdvanced ? (
          <Panel title={t("counters")}>
            {data.counters.length ? (
              <>
                <table className="hidden w-full text-body md:table">
                  <thead>
                    <tr className="hairline-b">
                      <th scope="col" className={th}>{t("counter")}</th>
                      <th scope="col" className={th}>{t("practitioner")}</th>
                      {live ? <th scope="col" className={th}>{t("status")}</th> : null}
                      <th scope="col" className={cn(th, "text-right")}>{t("served")}</th>
                      <th scope="col" className={cn(th, "text-right")}>{t("serviceAvgShort")}</th>
                      <th scope="col" className={cn(th, "text-right")}>{t("noShow")}</th>
                      <th scope="col" className={cn(th, "hidden text-right xl:table-cell")}>{t("ratingShort")}</th>
                      <th scope="col" className={cn(th, "hidden text-right xl:table-cell")}>{t("openTime")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.counters.map((c) => (
                      <tr key={c.id} className="hairline-t first:shadow-none">
                        <th scope="row" className={cn(td, "text-left font-semibold")}>
                          {showBranch ? <span className="font-normal text-label-secondary">{c.branch} · </span> : null}
                          {counterLabel(c)}
                        </th>
                        <td className={td}>{c.practitioner ?? t("none")}</td>
                        {live ? (
                          <td className={td}>
                            <Badge tone={statusTone[c.status]} shape="tag">
                              {statusLabel[c.status]}
                            </Badge>
                          </td>
                        ) : null}
                        <td className={cn(td, num)}>{c.served}</td>
                        <td className={cn(td, num)}>{minutes(c.service_avg_seconds)}</td>
                        <td className={cn(td, num)}>{c.no_show}</td>
                        <td className={cn(td, num, "hidden xl:table-cell")}>{c.rating_avg == null ? t("none") : fmtNumber(c.rating_avg, 1)}</td>
                        <td className={cn(td, num, "hidden xl:table-cell")}>{c.open_seconds ? duration(c.open_seconds) : t("none")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <ul role="list" className="-mx-5 md:hidden">
                  {data.counters.map((c) => (
                    <li key={c.id} className="group/row pl-5">
                      <div className="list-separator flex items-center gap-3 py-2.5 pr-5">
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-body font-semibold">{counterLabel(c)}</span>
                          <span className="truncate text-subheadline text-label-secondary">{c.practitioner ?? t("none")}</span>
                        </span>
                        <span className="flex shrink-0 flex-col items-end">
                          <span className="text-body tabular">
                            {c.served} · {minutes(c.service_avg_seconds)}
                          </span>
                          {live ? <StatusDot tone={statusTone[c.status]} label={statusLabel[c.status]} /> : null}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="py-6 text-center text-body text-label-secondary">{t("empty")}</p>
            )}
          </Panel>
        ) : null}

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <Panel title={t("services")}>
            {data.services.length ? (
              <ListSection className="-mx-5 [&>ul]:rounded-none [&>ul]:bg-transparent">
                {data.services.map((s) => (
                  <ListRow
                    key={s.id}
                    icon={<ServiceTile letter={s.prefix} color={s.color} className="size-[1.875rem] rounded-[7px] text-subheadline" />}
                    title={`${showBranch ? `${s.branch} · ` : ""}${locale === "en" && s.name_en ? s.name_en : s.name}`}
                    subtitle={
                      <span className="tabular">
                        {t("waitShort")} {minutes(s.wait_avg_seconds)} · {t("abandonShort")}{" "}
                        {s.abandon_rate == null ? t("none") : t("percent", { value: fmtNumber(s.abandon_rate, 1) })}
                      </span>
                    }
                    detail={<span className="tabular">{fmtNumber(s.issued)}</span>}
                  />
                ))}
              </ListSection>
            ) : (
              <p className="py-6 text-center text-body text-label-secondary">{t("empty")}</p>
            )}
          </Panel>

          <div className="flex flex-col gap-5">
            <Panel title={t("appointments")}>
              <dl className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                {(
                  [
                    ["booked", data.appointments.booked],
                    ["completed", data.appointments.completed],
                    ["apptNoShow", data.appointments.no_show],
                    ["cancelled", data.appointments.cancelled],
                    ["upcoming", data.appointments.upcoming],
                  ] as const
                ).map(([key, value]) => (
                  <div key={key} className="flex flex-col">
                    <dt className="text-footnote text-label-secondary">{t(key)}</dt>
                    <dd className="text-title2 font-bold tabular">{value}</dd>
                  </div>
                ))}
              </dl>
            </Panel>
            {canAdvanced ? (
              <Panel title={t("practitioners")} aside={data.totals.rating_count ? t("ratingCount", { count: data.totals.rating_count }) : undefined}>
                {data.practitioners.length ? (
                  <ListSection className="-mx-5 [&>ul]:rounded-none [&>ul]:bg-transparent">
                    {data.practitioners.map((p) => (
                      <ListRow
                        key={p.id}
                        icon={
                          <ListIcon color="var(--navy)">
                            <Stethoscope />
                          </ListIcon>
                        }
                        title={`${showBranch ? `${p.branch} · ` : ""}${p.name}`}
                        subtitle={
                          <span className="tabular">
                            {t("served")} {p.served} · {minutes(p.service_avg_seconds)} · {t("appointmentsShort")} {p.appointments}
                            {p.absences + p.late ? ` · ${t("absences")} ${p.absences + p.late}` : ""}
                          </span>
                        }
                        detail={p.rating_avg == null ? undefined : <span className="tabular">{fmtNumber(p.rating_avg, 1)} / 5</span>}
                      />
                    ))}
                  </ListSection>
                ) : (
                  <p className="py-6 text-center text-body text-label-secondary">{t("empty")}</p>
                )}
              </Panel>
            ) : null}
          </div>
        </div>
      </div>

      <Sheet open={exportOpen} onOpenChange={setExportOpen} title={t("exportTitle")} description={t("exportBody")} closeLabel={tc("close")}>
        <ListSection>
          {(["services", "counters"] as const).map((kind) => (
            <ListRow
              key={kind}
              href={exportHref(kind)}
              download
              icon={
                <ListIcon color="var(--green-fill)">
                  <FileSpreadsheet />
                </ListIcon>
              }
              title={kind === "services" ? t("exportServices") : t("exportCounters")}
              subtitle={`${range.from} → ${range.to > today ? today : range.to}`}
              accessory={<Download aria-hidden className="size-5 text-label-tertiary" />}
            />
          ))}
        </ListSection>
      </Sheet>
    </div>
  );
}
