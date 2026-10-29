import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { AlertTriangle, CheckCircle2, FileText, Info } from "lucide-react";
import { formatXaf } from "@nextin/shared";
import { isLocale, type Locale } from "@nextin/shared/i18n";
import { AdminPage } from "@/components/admin/admin-page";
import { CAMPAIGN_TONE } from "@/components/ads/campaign-page";
import { CampaignStatsView } from "@/components/ads/campaign-stats";
import { CreativesSection } from "@/components/ads/creatives-section";
import { QuizEditor } from "@/components/ads/quiz-editor";
import { SkinEditor } from "@/components/ads/skin-editor";
import { CampaignReview } from "@/components/platform/campaign-review";
import { Badge } from "@/components/ui/badge";
import { CalloutCard } from "@/components/ui/callout-card";
import { ListRow, ListSection } from "@/components/ui/list";
import type { CampaignStats, QuizAnswer } from "@/lib/ads/types";
import { formatShortDay } from "@/lib/billing/format";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("adsAdmin");
  return { title: t("review") };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Validation d'une campagne : tout ce qui sera diffusé (visuels, quiz et bonnes réponses, habillage) et le visa santé. */
export default async function PlatformCampaignPage({
  params,
  searchParams,
}: {
  params: Promise<{ campaignId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { campaignId } = await params;
  const { saved } = await searchParams;
  if (!UUID.test(campaignId)) notFound();
  const t = await getTranslations("adsAdmin");
  const ta = await getTranslations("ads");
  const tt = await getTranslations("orgTypes");
  const tw = await getTranslations("weekdays");
  const current = await getLocale();
  const locale: Locale = isLocale(current) ? current : "fr";
  const supabase = await getSupabaseServerClient();
  const { data: c } = await supabase
    .from("ad_campaigns")
    .select("*, advertiser:advertisers(name, phone_e164, city), organization:organizations(name)")
    .eq("id", campaignId)
    .maybeSingle();
  if (!c) notFound();
  const [{ data: pkg }, { data: sector }, { data: creatives }, { data: quiz }, { data: skin }, { data: schedules }, statsResult] = await Promise.all([
    supabase.from("ad_packages").select("*").eq("code", c.package_code).single(),
    supabase.from("ad_sectors").select("*").eq("code", c.sector).single(),
    supabase.from("ad_creatives").select("*").eq("campaign_id", c.id).order("sort_order"),
    supabase.from("ad_quizzes").select("*, questions:ad_quiz_questions(question, answers, position)").eq("campaign_id", c.id).maybeSingle(),
    supabase.from("ad_game_skins").select("*").eq("campaign_id", c.id).maybeSingle(),
    supabase.from("ad_schedules").select("weekday, start_time, end_time").eq("campaign_id", c.id),
    supabase.rpc("campaign_stats", { p_campaign: c.id }),
  ]);
  if (!pkg || !sector) notFound();
  const house = !!c.organization_id;
  const needsVisa = !house && sector.requires_health_visa;
  const visaOk = !needsVisa || (!!c.health_visa_number && !!c.health_visa_document_path);
  // Justificatif privé : lien signé de courte durée (lecture réservée au super admin et à l'annonceur, RLS du stockage).
  const visaUrl = c.health_visa_document_path
    ? (await supabase.storage.from("ad-documents").createSignedUrl(c.health_visa_document_path, 300)).data?.signedUrl
    : undefined;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const ownerFolder = c.advertiser_id ?? `org-${c.organization_id}`;
  const stats = statsResult.data as unknown as CampaignStats | null;
  const owner = house ? (c.organization?.name ?? "") : (c.advertiser?.name ?? "");
  const quizData = quiz
    ? {
        title: quiz.title,
        reward_text: quiz.reward_text,
        coupon_validity_days: quiz.coupon_validity_days,
        max_coupons: quiz.max_coupons,
        questions: ((quiz as unknown as { questions: { question: string; answers: QuizAnswer[]; position: number }[] }).questions ?? [])
          .sort((a, b) => a.position - b.position)
          .map((q) => ({ question: q.question, answers: q.answers })),
      }
    : null;

  return (
    <AdminPage title={c.name} eyebrow={owner} back={{ href: "/admin/ads", label: t("title") }} wide>
      {saved ? (
        <CalloutCard tone="green" role="status" icon={<CheckCircle2 />}>
          {t("saved")}
        </CalloutCard>
      ) : null}
      {c.moderation_note && c.status !== "pending_review" ? <CalloutCard icon={<Info />}>{c.moderation_note}</CalloutCard> : null}
      <div className="grid grid-cols-1 gap-7 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="flex min-w-0 flex-col gap-7">
          {needsVisa ? (
            <ListSection header={t("visa")}>
              <ListRow title={ta("visaNumber")} detail={c.health_visa_number ?? "—"} />
              {visaUrl ? (
                <ListRow href={visaUrl} download icon={<FileText aria-hidden className="size-5 text-accent-text" />} title={t("visaDocument")} accessory="chevron" />
              ) : null}
            </ListSection>
          ) : null}
          {!visaOk ? (
            <CalloutCard tone="red" role="alert" icon={<AlertTriangle />}>
              {t("visaMissing")}
            </CalloutCard>
          ) : null}
          <CreativesSection campaignId={c.id} owner={ownerFolder} creatives={creatives ?? []} editable={false} videoAllowed={false} supabaseUrl={supabaseUrl} />
          {quizData ? <QuizEditor campaignId={c.id} quiz={quizData} editable={false} /> : null}
          {skin ? <SkinEditor campaignId={c.id} owner={ownerFolder} skin={skin} editable={false} supabaseUrl={supabaseUrl} /> : null}
          {stats && ["active", "paused", "ended"].includes(c.status) ? <CampaignStatsView stats={stats} /> : null}
        </div>
        <div className="flex min-w-0 flex-col gap-7">
          <ListSection>
            <ListRow title={ta("statusLabel")} detail={<Badge tone={CAMPAIGN_TONE[c.status]}>{ta(`status.${c.status}`)}</Badge>} />
            <ListRow title={t("advertiser")} subtitle={house ? `${owner} · ${ta("house")}` : [owner, c.advertiser?.city, c.advertiser?.phone_e164].filter(Boolean).join(" · ")} />
            <ListRow title={t("sector")} detail={locale === "en" ? sector.name_en : sector.name} />
            <ListRow title={ta("package")} detail={locale === "en" ? pkg.name_en : pkg.name} />
            <ListRow
              title={ta("startsOn")}
              subtitle={ta("period", { from: formatShortDay(`${c.starts_on}T12:00:00Z`, locale), to: formatShortDay(`${c.ends_on}T12:00:00Z`, locale) })}
            />
            <ListRow title={ta("surfacesTitle")} subtitle={c.surfaces.map((s) => ta(`surfaces.${s}`)).join(" · ")} />
            <ListRow
              title={t("targeting")}
              subtitle={[
                c.target_cities.length ? c.target_cities.join(", ") : t("allCities"),
                c.target_org_types.length ? c.target_org_types.map((o) => tt(o)).join(", ") : t("allTypes"),
              ].join(" · ")}
            />
            {(schedules ?? []).length ? (
              <ListRow
                title={ta("schedules")}
                subtitle={(schedules ?? []).map((s) => `${tw(String(s.weekday) as "1")} ${s.start_time.slice(0, 5)}–${s.end_time.slice(0, 5)}`).join(" · ")}
              />
            ) : null}
            <ListRow title={ta("price")} detail={<span className="tabular">{c.price_xaf ? formatXaf(c.price_xaf, locale) : ta("free")}</span>} />
          </ListSection>
          {!house ? <CampaignReview campaignId={c.id} status={c.status} canApprove={visaOk && (creatives ?? []).length > 0} /> : null}
        </div>
      </div>
    </AdminPage>
  );
}
