import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { CheckCircle2 } from "lucide-react";
import { formatXaf } from "@nextin/shared";
import { isLocale, type Locale } from "@nextin/shared/i18n";
import { AdminPage } from "@/components/admin/admin-page";
import { SubscriptionActions } from "@/components/platform/subscription-actions";
import { Badge } from "@/components/ui/badge";
import { CalloutCard } from "@/components/ui/callout-card";
import { ListRow, ListSection } from "@/components/ui/list";
import { formatDay, formatShortDay } from "@/lib/billing/format";
import type { AdminSubscriptionDetail } from "@/lib/billing/platform";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("platform");
  return { title: t("detailTitle") };
}

const TONE = { trialing: "accent", active: "green", past_due: "orange", read_only: "orange", suspended: "red" } as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Détail d'un abonnement (super admin) : état, actions journalisées, historique, factures. */
export default async function SubscriptionDetail({
  params,
  searchParams,
}: {
  params: Promise<{ subscriptionId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { subscriptionId } = await params;
  const { saved } = await searchParams;
  if (!UUID.test(subscriptionId)) notFound();
  const t = await getTranslations("platform");
  const tb = await getTranslations("billing");
  const current = await getLocale();
  const locale: Locale = isLocale(current) ? current : "fr";
  const supabase = await getSupabaseServerClient();
  const [{ data }, { data: plans }] = await Promise.all([
    supabase.rpc("admin_subscription_detail", { p_subscription: subscriptionId }),
    supabase.from("plans").select("id, name").order("sort_order"),
  ]);
  if (!data) notFound();
  const d = data as unknown as AdminSubscriptionDetail;
  const s = d.subscription;
  const xaf = (n: number) => formatXaf(n, locale);
  const eventKey = (type: string) => (t.has(`events.${type}` as Parameters<typeof t.has>[0]) ? t(`events.${type}` as Parameters<typeof t>[0]) : type);

  return (
    <AdminPage title={d.organization.name} eyebrow={t("detailTitle")} back={{ href: "/admin", label: t("nav.subscriptions") }}>
      {saved ? (
        <CalloutCard tone="green" role="status" icon={<CheckCircle2 />}>
          {t("saved")}
        </CalloutCard>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Badge shape="pill" tone={TONE[s.status]}>
          {tb(`status.${s.status}`)}
        </Badge>
        {d.organization.suspended_reason?.startsWith("moderation") ? (
          <Badge shape="pill" tone="red">
            {t("moderation")}
          </Badge>
        ) : null}
        <span className="text-subheadline text-label-secondary">
          {s.status === "trialing" && s.trial_ends_at
            ? t("rowTrial", { date: formatDay(s.trial_ends_at, locale) })
            : s.current_period_end
              ? t("rowPeriod", { date: formatDay(s.current_period_end, locale) })
              : t("rowNone")}
        </span>
        {s.pending_status && s.pending_status_after ? (
          <span className="text-subheadline text-orange-text">
            {t("pending", { status: tb(`status.${s.pending_status}`), date: formatShortDay(s.pending_status_after, locale) })}
          </span>
        ) : null}
      </div>

      <SubscriptionActions
        subscriptionId={s.id}
        organizationId={d.organization.id}
        planId={s.plan_id}
        plans={plans ?? []}
        suspendedForModeration={d.organization.status === "suspended" && !!d.organization.suspended_reason?.startsWith("moderation")}
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <ListSection header={t("history")}>
          {d.events.map((e, i) => (
            <ListRow
              key={i}
              title={eventKey(e.type)}
              subtitle={typeof e.payload.reason === "string" ? e.payload.reason : undefined}
              detail={<span className="text-subheadline">{formatShortDay(e.created_at, locale)}</span>}
            />
          ))}
        </ListSection>
        <ListSection header={t("invoices")} footer={d.invoices.length ? undefined : tb("invoicesEmpty")}>
          {d.invoices.map((i) => (
            <ListRow
              key={i.id}
              href={`/app/o/${d.organization.id}/billing/invoices/${i.id}`}
              download
              title={<span className="tabular">{i.number}</span>}
              subtitle={tb("invoiceSubtitle", { date: formatShortDay(i.issued_at, locale), amount: xaf(i.total_xaf) })}
              detail={tb(`invoiceStatus.${i.status}`)}
            />
          ))}
        </ListSection>
      </div>
    </AdminPage>
  );
}
