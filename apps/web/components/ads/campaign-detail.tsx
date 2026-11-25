import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { CheckCircle2, Clock, CreditCard, FileEdit, Pause, XCircle } from "lucide-react";
import { formatXaf } from "@nextin/shared";
import { campaignEditable, campaignNotice, campaignSummary } from "@nextin/shared/ads";
import { isLocale, type Locale } from "@nextin/shared/i18n";
import { AdminPage } from "@/components/admin/admin-page";
import { Button } from "@/components/ui/button";
import { CalloutCard } from "@/components/ui/callout-card";
import { TintedCallout } from "@/components/ui/tinted-callout";
import { dayRange, longDay } from "@/lib/ads/format";
import type { CampaignStats } from "@/lib/ads/types";
import { formatShortDay } from "@/lib/billing/format";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { BranchesSection, type BranchList } from "./branches-section";
import { CampaignPrimary } from "./campaign-primary";
import { CampaignStatsView } from "./campaign-stats";
import { CampaignSummaryCard } from "./campaign-summary";
import { InvoicesRow } from "./invoices-row";

const NOTICE_ICON = {
  draft: <FileEdit />,
  pending_review: <Clock />,
  rejected: <XCircle />,
  awaiting_payment: <CreditCard />,
  active: <CheckCircle2 />,
  paused: <Pause />,
  ended: <CheckCircle2 />,
} as const;

/**
 * Détail d'une campagne d'annonceur (maquette v2 24, D1 et P6) : sur-titre « Campagne · formule Argent », une seule
 * phrase de statut en encadré teinté, puis six chiffres et le graphique par jour une fois la diffusion commencée (sinon
 * le récapitulatif), les agences retenues et les factures. Action principale : « Payer 15 000 FCFA » après validation.
 */
export async function CampaignDetail({ campaignId, advertiserId, submitted }: { campaignId: string; advertiserId: string; submitted?: boolean }) {
  const t = await getTranslations("ads");
  const tb = await getTranslations("billing");
  const current = await getLocale();
  const locale: Locale = isLocale(current) ? current : "fr";
  const supabase = await getSupabaseServerClient();
  const { data: c } = await supabase.from("ad_campaigns").select("*").eq("id", campaignId).maybeSingle();
  if (!c || c.advertiser_id !== advertiserId) notFound();
  const [{ data: pkg }, { data: creatives }, { data: quiz }, statsResult, { data: invoices }] = await Promise.all([
    supabase.from("ad_packages").select("*").eq("code", c.package_code).single(),
    supabase.from("ad_creatives").select("kind").eq("campaign_id", c.id),
    supabase.from("ad_quizzes").select("id, questions:ad_quiz_questions(id)").eq("campaign_id", c.id).maybeSingle(),
    supabase.rpc("campaign_stats", { p_campaign: c.id }),
    supabase.from("invoices").select("id, number, status, total_xaf, issued_at").eq("campaign_id", c.id).order("issued_at", { ascending: false }),
  ]);
  if (!pkg) notFound();
  const editable = campaignEditable(c.status);
  const stats = statsResult.data as unknown as CampaignStats | null;
  const running = ["active", "paused", "ended"].includes(c.status);
  const branchList = !editable ? ((await supabase.rpc("campaign_branch_list", { p_campaign: c.id })).data as BranchList | null) : null;
  const pkgName = locale === "en" ? pkg.name_en : pkg.name;
  const summary = campaignSummary({
    package: { price_xaf: editable ? pkg.price_xaf : c.price_xaf, duration_days: pkg.duration_days, max_branches: pkg.max_branches },
    startsOn: c.starts_on,
    cities: c.target_cities,
    orgTypes: c.target_org_types,
    creatives: (creatives ?? []) as { kind: "image" | "video" }[],
    quizQuestions: ((quiz as unknown as { questions?: unknown[] } | null)?.questions ?? []).length,
  });

  // Une seule phrase de statut (maquette : « Diffusée du 14 au 28 novembre dans 12 agences. »).
  const notice = campaignNotice(c.status);
  const range = dayRange(c.starts_on, c.ends_on, locale);
  const sentence =
    c.status === "active"
      ? t("activeNotice", { ...range, count: stats?.branches ?? 0 })
      : c.status === "awaiting_payment"
        ? t("awaitingNotice", { date: longDay(c.starts_on, locale) })
        : c.status === "pending_review"
          ? t("pendingNotice")
          : c.status === "rejected"
            ? t("rejectedNotice", { note: c.moderation_note ?? "" })
            : c.status === "paused"
              ? t("pausedNotice", { note: c.moderation_note ?? "" })
              : c.status === "ended"
                ? t("endedNotice", { date: longDay(c.ends_on, locale) })
                : t("draftNotice");

  return (
    <AdminPage
      inSplit
      title={c.name}
      eyebrow={t("overPackage", { name: pkgName })}
      back={{ href: "/ads/campaigns", label: t("nav.campaigns") }}
      trailing={
        editable ? (
          <Button asChild variant="tinted" size="md">
            <Link href={`/ads/campaigns/${c.id}/edit`}>{t("edit")}</Link>
          </Button>
        ) : undefined
      }
    >
      {submitted && c.status === "pending_review" ? (
        <CalloutCard tone="green" role="status" icon={<CheckCircle2 />}>
          {t("submittedNotice")}
        </CalloutCard>
      ) : null}
      <TintedCallout tone={notice.tone} role={c.status === "rejected" ? "alert" : "status"} icon={NOTICE_ICON[c.status]} data-testid="campaign-notice">
        {notice.title ? (
          <>
            <span className="block font-semibold text-orange-text">{t("awaitingTitle")}</span>
            {sentence}
          </>
        ) : (
          sentence
        )}
      </TintedCallout>
      {running && stats ? (
        <CampaignStatsView stats={stats} />
      ) : (
        <CampaignSummaryCard variant="full" packageName={pkgName} durationDays={pkg.duration_days} summary={summary} quizAllowed={pkg.quiz_allowed} />
      )}
      {branchList ? <BranchesSection campaignId={c.id} max={pkg.max_branches} options={null} list={branchList} /> : null}
      {(invoices ?? []).length ? (
        <InvoicesRow
          invoices={(invoices ?? []).map((i) => ({
            id: i.id,
            number: i.number,
            subtitle: `${formatShortDay(i.issued_at, locale)} · ${formatXaf(i.total_xaf, locale)}`,
            status: tb(`invoiceStatus.${i.status}`),
            href: `/ads/invoices/${i.id}`,
          }))}
        />
      ) : null}
      {c.status === "awaiting_payment" ? <CampaignPrimary campaignId={c.id} kind="pay" label={t("pay", { amount: formatXaf(c.price_xaf, locale) })} /> : null}
    </AdminPage>
  );
}
