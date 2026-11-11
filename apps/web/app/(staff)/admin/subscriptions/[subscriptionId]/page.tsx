import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { CheckCircle2 } from "lucide-react";
import { formatXaf } from "@nextin/shared";
import { isLocale, type Locale } from "@nextin/shared/i18n";
import { AdminPage } from "@/components/admin/admin-page";
import { LimitsForm } from "@/components/platform/limits-form";
import { SubscriptionActions } from "@/components/platform/subscription-actions";
import { Badge } from "@/components/ui/badge";
import { CalloutCard } from "@/components/ui/callout-card";
import { ListRow, ListSection } from "@/components/ui/list";
import { formatDay, formatShortDay } from "@/lib/billing/format";
import type { AdminSubscriptionDetail } from "@/lib/billing/platform";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { ResendInvitationButton } from "@/components/admin/resend-invitation-button";
import { resendOwnerInvitation } from "../../actions";

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
    supabase
      .from("plans")
      .select("id, name, included_branches, max_services, max_counters, max_displays, max_users, tickets_per_month, whatsapp_quota, history_months")
      .order("sort_order"),
  ]);
  if (!data) notFound();
  const d = data as unknown as AdminSubscriptionDetail;
  const tm = await getTranslations("platform.manual");
  // Factures réglées par un paiement manuel en vigueur (C1).
  const { data: manualRows } = d.invoices.length
    ? await supabase.from("manual_payments").select("invoice_id").in("invoice_id", d.invoices.map((i) => i.id)).is("cancelled_at", null)
    : { data: [] };
  const manualInvoices = new Set((manualRows ?? []).map((m) => m.invoice_id));
  // Responsable invité depuis la console (P1) et pas encore inscrit : renvoi possible (P2).
  const { data: ownerInvites } = await supabase
    .from("invitations")
    .select("id, email, expires_at")
    .eq("organization_id", d.organization.id)
    .eq("role", "org_admin")
    .is("accepted_at", null)
    .order("created_at", { ascending: false });
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

      {ownerInvites?.length ? (
        <ListSection header={t("ownerInvitation")} footer={t("ownerInvitationFooter")}>
          {ownerInvites.map((inv) => (
            <ListRow
              key={inv.id}
              title={inv.email ?? ""}
              subtitle={t("ownerInvitationExpires", { date: formatShortDay(inv.expires_at, locale) })}
              trailing={inv.email ? <ResendInvitationButton email={inv.email} action={resendOwnerInvitation.bind(null, inv.id)} /> : null}
            />
          ))}
        </ListSection>
      ) : null}

      <SubscriptionActions
        subscriptionId={s.id}
        organizationId={d.organization.id}
        planId={s.plan_id}
        plans={(plans ?? []).map((p) => ({ id: p.id, name: p.name }))}
        suspendedForModeration={d.organization.status === "suspended" && !!d.organization.suspended_reason?.startsWith("moderation")}
      />

      <LimitsForm
        subscriptionId={s.id}
        overrides={(s as unknown as { limit_overrides?: Record<string, number | null> }).limit_overrides ?? {}}
        plan={plans?.find((p) => p.id === s.plan_id) ?? {}}
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
              subtitle={[
                tb("invoiceSubtitle", { date: formatShortDay(i.issued_at, locale), amount: xaf(i.total_xaf) }),
                tb(`invoiceStatus.${i.status}`),
              ].join(" · ")}
              // C1 : encaissement hors ligne d'une facture ouverte, ou détail du paiement manuel (annulation).
              trailing={
                i.status === "open" || manualInvoices.has(i.id) ? (
                  <Link
                    href={`/admin/invoices/${i.id}/payment`}
                    aria-label={i.status === "open" ? tm("actionLabel", { number: i.number }) : tm("detailsLabel", { number: i.number })}
                    className="inline-flex min-h-11 items-center text-subheadline font-semibold text-accent-text"
                  >
                    {i.status === "open" ? tm("action") : tm("details")}
                  </Link>
                ) : null
              }
            />
          ))}
        </ListSection>
      </div>
    </AdminPage>
  );
}
