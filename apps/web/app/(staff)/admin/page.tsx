import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { formatXaf } from "@nextin/shared";
import { isLocale, type Locale } from "@nextin/shared/i18n";
import { AdminPage } from "@/components/admin/admin-page";
import { BarChart } from "@/components/dashboard/bar-chart";
import { OrgTypeIcon } from "@/components/ui/org-type-icon";
import { PlatformNav } from "@/components/platform/platform-sidebar";
import { Badge } from "@/components/ui/badge";
import { ListIcon, ListRow, ListSection } from "@/components/ui/list";
import { StatCard } from "@/components/ui/stat-card";
import { formatShortDay } from "@/lib/billing/format";
import { STATUS_FILTERS, type AdminRevenue, type AdminSubscriptionRow, type StatusFilter } from "@/lib/billing/platform";
import { cn } from "@/lib/cn";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("platform");
  return { title: t("title") };
}

const TONE = { trialing: "accent", active: "green", past_due: "orange", read_only: "orange", suspended: "red" } as const;

/** Console Wintek (§11.9) : revenus, puis abonnements filtrables par statut et par nom. */
export default async function PlatformHome({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const status: StatusFilter = (STATUS_FILTERS as readonly string[]).includes(sp.status ?? "") ? (sp.status as StatusFilter) : "all";
  const q = (sp.q ?? "").slice(0, 80);
  const t = await getTranslations("platform");
  const tb = await getTranslations("billing");
  const current = await getLocale();
  const locale: Locale = isLocale(current) ? current : "fr";
  const supabase = await getSupabaseServerClient();
  const [{ data: rev }, { data: rows }] = await Promise.all([
    supabase.rpc("admin_revenue"),
    supabase.rpc("admin_subscriptions", { p_status: status, p_query: q || (null as unknown as string) }),
  ]);
  // Le gabarit refuse déjà les non-administrateurs ; la page peut être rendue en parallèle, sans données.
  if (!rev) notFound();
  const revenue = rev as unknown as AdminRevenue;
  const subs = (rows ?? []) as unknown as AdminSubscriptionRow[];
  const xaf = (n: number) => formatXaf(n, locale);
  const months = revenue.collected_by_month;
  const peak = months.reduce((best, m, i) => (m.total_xaf > (months[best]?.total_xaf ?? -1) ? i : best), -1);
  const href = (s: StatusFilter) => `/admin?${new URLSearchParams({ ...(s !== "all" ? { status: s } : {}), ...(q ? { q } : {}) })}`;

  return (
    <AdminPage title={t("title")} eyebrow={t("eyebrow")} wide>
      <PlatformNav variant="inline" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label={t("mrr")} value={<span className="tabular">{xaf(revenue.mrr_xaf)}</span>} />
        <StatCard label={t("collected")} value={<span className="tabular">{xaf(revenue.collected_month_xaf)}</span>} />
        <StatCard label={t("trials")} value={<span className="tabular">{t("trialsValue", { converted: revenue.trials_converted, started: revenue.trials_started })}</span>} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section aria-labelledby="collected-title" className="squircle flex min-w-0 flex-col gap-3 rounded-[var(--radius-xl)] bg-grouped-secondary p-5 shadow-card">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="collected-title" className="text-headline">
              {t("collectedByMonth")}
            </h2>
            <span className="text-footnote text-label-secondary">{t("thousands")}</span>
          </div>
          <BarChart
            bars={months.map((m) => ({ key: m.month, label: m.month.slice(5), value: Math.round(m.total_xaf / 1000), tooltip: `${m.month} · ${xaf(m.total_xaf)}` }))}
            highlight={peak}
            caption={t("collectedByMonth")}
            columns={[t("month"), t("thousands")]}
          />
        </section>
        <ListSection header={t("byPlan")}>
          {revenue.by_plan.map((p) => (
            <ListRow key={p.code} title={p.name} subtitle={`${tb("status.trialing")} : ${p.trialing}`} detail={<span className="tabular">{p.paying}</span>} />
          ))}
        </ListSection>
      </div>

      <section aria-labelledby="subs-title" className="flex flex-col gap-3">
        <h2 id="subs-title" className="px-4 text-title3 font-bold">
          {t("nav.subscriptions")}
        </h2>
        <form action="/admin" className="flex flex-col gap-3 px-0 sm:flex-row sm:items-center">
          {status !== "all" ? <input type="hidden" name="status" value={status} /> : null}
          <label className="sr-only" htmlFor="admin-q">
            {t("search")}
          </label>
          <input
            id="admin-q"
            name="q"
            type="search"
            defaultValue={q}
            placeholder={t("search")}
            className="squircle h-11 w-full rounded-[var(--radius-md)] bg-grouped-secondary px-4 text-body text-label placeholder:text-label-tertiary outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-tint)] sm:max-w-sm"
          />
        </form>
        <nav aria-label={t("filter")}>
          <ul role="list" className="flex gap-2 overflow-x-auto pb-1">
            {STATUS_FILTERS.map((s) => (
              <li key={s}>
                <Link
                  href={href(s)}
                  aria-current={status === s ? "true" : undefined}
                  className={cn(
                    "pressable inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-subheadline whitespace-nowrap",
                    status === s ? "bg-accent-tint font-semibold text-accent-on-tint" : "bg-fill-tertiary text-label",
                  )}
                >
                  {s === "all" ? t("all") : tb(`status.${s}`)}
                  {s !== "all" && revenue.by_status[s] ? <span className="tabular">{revenue.by_status[s]}</span> : null}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <ListSection footer={subs.length ? undefined : t("empty")}>
          {subs.map((s) => (
            <ListRow
              key={s.id}
              href={`/admin/subscriptions/${s.id}`}
              icon={
                <ListIcon color="var(--brand-tile)">
                  <OrgTypeIcon type={s.org_type as Parameters<typeof OrgTypeIcon>[0]["type"]} />
                </ListIcon>
              }
              title={<span className="font-semibold">{s.organization}</span>}
              subtitle={[
                s.plan_name,
                t("rowBranches", { count: s.branches }),
                s.status === "trialing" && s.trial_ends_at
                  ? t("rowTrial", { date: formatShortDay(s.trial_ends_at, locale) })
                  : s.current_period_end
                    ? t("rowPeriod", { date: formatShortDay(s.current_period_end, locale) })
                    : t("rowNone"),
                s.last_payment ? t("lastPayment", { date: formatShortDay(s.last_payment.paid_at, locale), amount: xaf(s.last_payment.total_xaf) }) : t("noPayment"),
              ].join(" · ")}
              accessory={
                <span className="flex items-center gap-2">
                  <Badge tone={TONE[s.status]}>{tb(`status.${s.status}`)}</Badge>
                </span>
              }
            />
          ))}
        </ListSection>
      </section>
    </AdminPage>
  );
}
