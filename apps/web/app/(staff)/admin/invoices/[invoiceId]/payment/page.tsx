import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { CheckCircle2, Info } from "lucide-react";
import { formatXaf } from "@nextin/shared";
import { isLocale, type Locale } from "@nextin/shared/i18n";
import { AdminPage } from "@/components/admin/admin-page";
import { CancelManualPayment, ManualPaymentForm } from "@/components/platform/manual-payment-form";
import { Badge } from "@/components/ui/badge";
import { CalloutCard } from "@/components/ui/callout-card";
import { ListRow, ListSection } from "@/components/ui/list";
import { formatDay } from "@/lib/billing/format";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("platform.manual");
  return { title: t("title") };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** C1 — console Wintek : paiement manuel d'une facture (enregistrement, ou annulation avec motif). */
export default async function ManualPaymentPage({
  params,
  searchParams,
}: {
  params: Promise<{ invoiceId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { invoiceId } = await params;
  const { saved } = await searchParams;
  if (!UUID.test(invoiceId)) notFound();
  const t = await getTranslations("platform");
  const tm = await getTranslations("platform.manual");
  const tb = await getTranslations("billing");
  const tc = await getTranslations("channels");
  const current = await getLocale();
  const locale: Locale = isLocale(current) ? current : "fr";
  const supabase = await getSupabaseServerClient();
  const [{ data: invoice }, { data: manual }] = await Promise.all([
    supabase
      .from("invoices")
      .select("id, number, status, total_xaf, paid_at, paid_channel, subscription_id, buyer_snapshot")
      .eq("id", invoiceId)
      .maybeSingle(),
    supabase
      .from("manual_payments")
      .select("id, method, amount_xaf, paid_on, reference, note")
      .eq("invoice_id", invoiceId)
      .is("cancelled_at", null)
      .maybeSingle(),
  ]);
  if (!invoice) notFound();
  const buyer = (invoice.buyer_snapshot as { name?: string } | null)?.name ?? "";
  const total = formatXaf(invoice.total_xaf, locale);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Douala" }).format(new Date());
  const back = invoice.subscription_id
    ? { href: `/admin/subscriptions/${invoice.subscription_id}`, label: t("detailTitle") }
    : { href: "/admin", label: t("nav.subscriptions") };
  const tone = invoice.status === "paid" ? "green" : invoice.status === "void" ? "neutral" : "orange";

  return (
    <AdminPage narrow title={tm("title")} eyebrow={tm("eyebrow", { number: invoice.number })} back={back}>
      {saved ? (
        <CalloutCard tone="green" role="status" icon={<CheckCircle2 />}>
          {tm("recorded")}
        </CalloutCard>
      ) : null}
      <ListSection>
        <ListRow title={tm("invoice")} detail={<span className="tabular">{invoice.number}</span>} />
        <ListRow title={buyer} subtitle={tm("buyer")} />
        <ListRow title={tm("total")} detail={<span className="tabular">{total}</span>} />
        <ListRow
          title={tm("status")}
          detail={
            <Badge shape="pill" tone={tone}>
              {tb(`invoiceStatus.${invoice.status}`)}
            </Badge>
          }
        />
      </ListSection>

      {invoice.status === "open" ? (
        <>
          <p className="px-4 text-subheadline text-label-secondary">{tm("intro")}</p>
          <ManualPaymentForm invoiceId={invoice.id} total={invoice.total_xaf} totalLabel={total} today={today} />
        </>
      ) : invoice.status === "void" ? (
        <CalloutCard icon={<Info />}>{tm("voided")}</CalloutCard>
      ) : manual ? (
        <>
          <ListSection header={tm("details")}>
            <ListRow
              title={tm("paidManual", { date: formatDay(manual.paid_on, locale), method: tm(`methods.${manual.method as "cash"}`) })}
              subtitle={[manual.reference ? tm("recordedBy", { reference: manual.reference }) : tm("noReference"), manual.note].filter(Boolean).join(" · ")}
              detail={<span className="tabular">{formatXaf(manual.amount_xaf, locale)}</span>}
            />
          </ListSection>
          <CancelManualPayment manualPaymentId={manual.id} invoiceId={invoice.id} />
        </>
      ) : (
        <CalloutCard icon={<Info />}>
          {tm("paidOnline", { channel: invoice.paid_channel ? tc(invoice.paid_channel) : "Mobile Money" })}
        </CalloutCard>
      )}
    </AdminPage>
  );
}
