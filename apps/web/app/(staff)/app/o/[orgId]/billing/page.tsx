import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { AlertTriangle, CheckCircle2, CreditCard, FileText, Sparkles } from "lucide-react";
import { formatXaf } from "@nextin/shared";
import { daysUntil } from "@nextin/shared/billing";
import { isLocale, type Locale } from "@nextin/shared/i18n";
import { AdminPage } from "@/components/admin/admin-page";
import { ExtensionList } from "@/components/billing/extension-list";
import { PlanPicker } from "@/components/billing/plan-picker";
import { QuotaPanel } from "@/components/billing/quota-panel";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { CalloutCard } from "@/components/ui/callout-card";
import { ListIcon, ListRow, ListSection } from "@/components/ui/list";
import { getOrgContext } from "@/lib/admin/context";
import { formatDay, formatShortDay } from "@/lib/billing/format";
import type { BillingOverview } from "@/lib/billing/types";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("billing");
  return { title: t("title") };
}

const STATUS_TONE = { trialing: "accent", active: "green", past_due: "orange", read_only: "orange", suspended: "red" } as const;

/** Abonnement (§11) : statut, utilisation, formules, factures. Administrateurs de l'établissement uniquement. */
export default async function BillingPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { orgId } = await params;
  const { scheduled, no_trial: noTrial } = await searchParams;
  const ctx = await getOrgContext(orgId);
  if (!ctx.canManageOrg) notFound();
  const t = await getTranslations("billing");
  const to = await getTranslations("overview");
  const current = await getLocale();
  const locale: Locale = isLocale(current) ? current : "fr";

  const supabase = await getSupabaseServerClient();
  const { data } = await supabase.rpc("billing_overview", { p_org: orgId });
  if (!data) notFound();
  const o = data as unknown as BillingOverview;
  const s = o.subscription;
  const e = o.entitlements;
  const now = new Date();
  const xaf = (n: number) => formatXaf(n, locale);
  const nextPlan = s?.next_plan_id ? o.plans.find((p) => p.id === s.next_plan_id) : null;
  const paidPeriodRunning = !!s?.current_period_end && new Date(s.current_period_end) > now;

  const statusLine = !s
    ? t("pilotBody")
    : s.status === "trialing"
      ? `${t("trialLeft", { days: daysUntil(s.trial_ends_at, now) ?? 0 })} · ${t("trialEnds", { date: formatDay(s.trial_ends_at!, locale) })}`
      : s.status === "active"
        ? t("activeUntil", { date: formatDay(s.current_period_end!, locale) })
        : s.status === "past_due"
          ? t("graceUntil", { date: formatDay(s.grace_ends_at ?? s.current_period_end!, locale) })
          : s.status === "read_only"
            ? t("readOnlyBody")
            : t("suspendedBody", { date: formatDay(s.deletion_due_at ?? now.toISOString(), locale) });
  const planName = (code: string) => {
    const p = o.plans.find((x) => x.code === code);
    return p ? (locale === "en" ? (p.name_en ?? p.name) : p.name) : code;
  };

  return (
    <AdminPage title={t("title")} eyebrow={ctx.org.name} back={{ href: `/app/o/${orgId}`, label: to("title") }}>
      {scheduled ? (
        <CalloutCard tone="green" role="status" icon={<CheckCircle2 />}>
          {t("scheduled")}
        </CalloutCard>
      ) : null}
      {noTrial ? (
        <CalloutCard tone="orange" role="status" icon={<AlertTriangle />}>
          {t("noTrial")}
        </CalloutCard>
      ) : null}

      {/* Maquette v2 06 : une seule colonne pleine largeur (statut, utilisation et extensions, formules, factures). */}
      <div className="flex min-w-0 flex-col gap-7">
          <section aria-labelledby="sub-title" className="squircle flex flex-col gap-2 rounded-[var(--radius-xl)] bg-grouped-secondary p-5 shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
              <h2 id="sub-title" className="min-w-0 text-title2 font-bold">
                {s ? planName(e.subscribed_plan_code ?? e.plan_code) : t("pilot")}
              </h2>
              {s ? (
                <Badge shape="pill" tone={STATUS_TONE[s.status]}>
                  {t(`status.${s.status}`)}
                </Badge>
              ) : (
                <Badge shape="pill" tone="accent">
                  <Sparkles aria-hidden />
                  {t("pilot")}
                </Badge>
              )}
            </div>
            <p className="text-body text-label-secondary">{statusLine}</p>
            {/* Maquette v2 06 : progression de l'essai (durée réglée par Wintek, jamais en dur). */}
            {s?.status === "trialing" && o.settings.trial_days > 0 ? (
              <div className="flex max-w-md flex-col gap-1.5 pt-1">
                <ProgressBar
                  value={Math.min(1, Math.max(0, (o.settings.trial_days - (daysUntil(s.trial_ends_at, now) ?? 0)) / o.settings.trial_days))}
                  label={t("trialProgress", { day: Math.max(1, o.settings.trial_days - (daysUntil(s.trial_ends_at, now) ?? 0)), total: o.settings.trial_days })}
                  tone="orange"
                />
                <p className="text-footnote text-label-secondary">
                  {t("trialProgress", { day: Math.max(1, o.settings.trial_days - (daysUntil(s.trial_ends_at, now) ?? 0)), total: o.settings.trial_days })}
                </p>
              </div>
            ) : null}
            {nextPlan && s?.current_period_end ? (
              <p className="text-subheadline text-label-secondary">
                {t("nextPlan", { plan: planName(nextPlan.code), date: formatDay(s.current_period_end, locale) })}
              </p>
            ) : null}
            {o.discount ? (
              <p className="text-subheadline text-green-text">
                {t("discount", { value: o.discount.kind === "percent" ? `${o.discount.value} %` : xaf(o.discount.value) })}{" "}
                {t("discountRemaining", { count: o.discount.remaining })}
              </p>
            ) : null}
          </section>

          <QuotaPanel
            quota={o.usage.quota}
            alertPercent={o.settings.quota_alert_percent}
            limits={[
              { label: t("usageBranches"), used: o.usage.branches, limit: e.extra_branch_price_xaf != null ? null : e.included_branches },
              { label: t("usageServices"), used: o.usage.services, limit: e.max_services },
              { label: t("usageCounters"), used: o.usage.counters, limit: e.max_counters },
              { label: t("usageDisplays"), used: o.usage.displays, limit: e.max_displays },
              { label: t("usageUsers"), used: o.usage.users, limit: e.max_users },
            ]}
          >
            {s ? <ExtensionList orgId={orgId} packs={o.packs} /> : null}
          </QuotaPanel>

          {s ? (
            <PlanPicker
              orgId={orgId}
              plans={o.plans}
              currentPlanId={s.status === "trialing" ? null : s.plan_id}
              status={s.status}
              paidPeriodRunning={paidPeriodRunning}
              initialPeriod={s.billing_period}
              branches={o.usage.branches}
              preferredCode={e.plan_code}
              organizationName={ctx.org.name}
              contact={{ email: o.settings.contact_email, phone: o.settings.contact_phone }}
            />
          ) : null}

          <ListSection header={t("invoicesTitle")} footer={o.invoices.length ? undefined : t("invoicesEmpty")}>
            {o.invoices.map((i) => (
              <ListRow
                key={i.id}
                href={`/app/o/${orgId}/billing/invoices/${i.id}`}
                download
                icon={
                  <ListIcon color={i.status === "paid" ? "var(--green-fill)" : i.status === "open" ? "var(--accent-fill)" : "var(--label-tertiary)"}>
                    {i.status === "open" ? <CreditCard /> : <FileText />}
                  </ListIcon>
                }
                title={<span className="tabular">{i.number}</span>}
                subtitle={t("invoiceSubtitle", { date: formatShortDay(i.issued_at, locale), amount: xaf(i.total_xaf) })}
                detail={t(`invoiceStatus.${i.status}`)}
                accessory={<span className="sr-only">{t("download", { number: i.number })}</span>}
              />
            ))}
          </ListSection>
      </div>
    </AdminPage>
  );
}
