import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { CheckCircle2, Clock, Pause, Pencil, Radio, XCircle } from "lucide-react";
import { formatXaf } from "@nextin/shared";
import { isLocale, type Locale } from "@nextin/shared/i18n";
import { AdminPage } from "@/components/admin/admin-page";
import { ConfirmAction } from "@/components/admin/confirm-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalloutCard } from "@/components/ui/callout-card";
import { ListRow, ListSection } from "@/components/ui/list";
import { formatDay, formatShortDay } from "@/lib/billing/format";
import { isEditable, type CampaignStats, type QuizAnswer } from "@/lib/ads/types";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { BranchesSection, type BranchList, type BranchOption } from "./branches-section";
import { CampaignPrimary } from "./campaign-primary";
import { CampaignStatsView } from "./campaign-stats";
import { CreativesSection } from "./creatives-section";
import { QuizEditor } from "./quiz-editor";
import { SkinEditor } from "./skin-editor";
import { VisaCard } from "./visa-card";

export const CAMPAIGN_TONE = {
  draft: "neutral",
  pending_review: "orange",
  rejected: "red",
  awaiting_payment: "accent",
  active: "green",
  paused: "orange",
  ended: "neutral",
} as const;

/**
 * Page d'une campagne (espace annonceur) ou d'une annonce Maison (back-office) : statut, réglages, visa, visuels,
 * quiz, habillage, statistiques et factures ; une seule action principale selon le statut.
 */
export async function CampaignPage({
  campaignId,
  organizationId,
  back,
  editHref,
  stopAction,
  saved,
}: {
  campaignId: string;
  /** Back-office : l'annonce Maison doit appartenir à cet établissement ; sinon, campagne d'annonceur. */
  organizationId?: string;
  back: { href: string; label: string };
  editHref: string;
  /** Annonce Maison : arrêt par l'établissement. */
  stopAction?: () => Promise<import("@/lib/auth/errors").ActionResult>;
  saved?: boolean;
}) {
  const t = await getTranslations("ads");
  const tp = await getTranslations("adPrefs");
  const tt = await getTranslations("orgTypes");
  const tb = await getTranslations("billing");
  const current = await getLocale();
  const locale: Locale = isLocale(current) ? current : "fr";
  const supabase = await getSupabaseServerClient();
  const { data: c } = await supabase.from("ad_campaigns").select("*").eq("id", campaignId).maybeSingle();
  if (!c || (organizationId ? c.organization_id !== organizationId : !c.advertiser_id)) notFound();
  const [{ data: pkg }, { data: sector }, { data: creatives }, { data: quiz }, { data: skin }, { data: schedules }, statsResult, { data: invoices }, { data: owner }] =
    await Promise.all([
      supabase.from("ad_packages").select("*").eq("code", c.package_code).single(),
      supabase.from("ad_sectors").select("*").eq("code", c.sector).single(),
      supabase.from("ad_creatives").select("*").eq("campaign_id", c.id).order("sort_order"),
      supabase.from("ad_quizzes").select("*, questions:ad_quiz_questions(question, answers, position)").eq("campaign_id", c.id).maybeSingle(),
      supabase.from("ad_game_skins").select("*").eq("campaign_id", c.id).maybeSingle(),
      supabase.from("ad_schedules").select("weekday, start_time, end_time").eq("campaign_id", c.id),
      supabase.rpc("campaign_stats", { p_campaign: c.id }),
      supabase.from("invoices").select("id, number, status, total_xaf, issued_at").eq("campaign_id", c.id).order("issued_at", { ascending: false }),
      c.advertiser_id
        ? supabase.from("advertisers").select("name").eq("id", c.advertiser_id).single()
        : supabase.from("organizations").select("name").eq("id", c.organization_id!).single(),
    ]);
  if (!pkg || !sector) notFound();
  const house = !!c.organization_id;
  const editable = isEditable(c);
  const ownerFolder = c.advertiser_id ?? `org-${c.organization_id}`;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const stats = statsResult.data as unknown as CampaignStats | null;
  // Agences : choix possible tant que la campagne est modifiable (formule plafonnée), liste une fois validée.
  const branchOptions =
    !house && editable && pkg.max_branches != null
      ? ((await supabase.rpc("campaign_branch_options", { p_campaign: c.id })).data as BranchOption[] | null)
      : null;
  const branchList =
    !house && !editable ? ((await supabase.rpc("campaign_branch_list", { p_campaign: c.id })).data as BranchList | null) : null;
  // Prix figé à la soumission ; avant, celui de la formule choisie.
  const price = editable && !house ? pkg.price_xaf : c.price_xaf;
  const label = (x: { name: string; name_en: string | null }) => (locale === "en" ? (x.name_en ?? x.name) : x.name);
  const sectorName = locale === "en" ? sector.name_en : sector.name;
  const tw = await getTranslations("weekdays");
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

  const notice =
    c.status === "rejected" ? (
      <CalloutCard tone="red" role="alert" icon={<XCircle />}>
        {t("rejectedNotice", { note: c.moderation_note ?? "" })}
      </CalloutCard>
    ) : c.status === "pending_review" ? (
      <CalloutCard tone="orange" role="status" icon={<Clock />}>
        {t("pendingNotice")}
      </CalloutCard>
    ) : c.status === "awaiting_payment" ? (
      <CalloutCard tone="accent" role="status" icon={<CheckCircle2 />}>
        {t("awaitingNotice", { date: formatDay(`${c.starts_on}T12:00:00Z`, locale) })}
      </CalloutCard>
    ) : c.status === "active" ? (
      <CalloutCard tone="green" role="status" icon={<Radio />}>
        {t("activeNotice", { from: formatDay(`${c.starts_on}T12:00:00Z`, locale), to: formatDay(`${c.ends_on}T12:00:00Z`, locale), count: stats?.branches ?? 0 })}
      </CalloutCard>
    ) : c.status === "paused" ? (
      <CalloutCard tone="orange" role="status" icon={<Pause />}>
        {t("pausedNotice", { note: c.moderation_note ?? "" })}
      </CalloutCard>
    ) : c.status === "ended" ? (
      <CalloutCard icon={<CheckCircle2 />}>{t("endedNotice", { date: formatDay(`${c.ends_on}T12:00:00Z`, locale) })}</CalloutCard>
    ) : null;

  const primary =
    editable && (c.status === "draft" || c.status === "rejected") ? (
      <CampaignPrimary campaignId={c.id} kind="submit" label={house ? tp("publish") : t("submit")} />
    ) : c.status === "awaiting_payment" && !house ? (
      <CampaignPrimary campaignId={c.id} kind="pay" label={t("pay", { amount: formatXaf(c.price_xaf, locale) })} />
    ) : null;

  return (
    <AdminPage
      title={c.name}
      eyebrow={owner?.name ?? ""}
      back={back}
      trailing={
        editable ? (
          <Button asChild variant="gray" size="md">
            <Link href={editHref}>
              <Pencil aria-hidden className="size-4" />
              {t("edit")}
            </Link>
          </Button>
        ) : undefined
      }
    >
      {saved ? (
        <CalloutCard tone="green" role="status" icon={<CheckCircle2 />}>
          {c.status === "pending_review" ? t("submittedNotice") : t("saved")}
        </CalloutCard>
      ) : null}
      {notice}
      <div className="grid grid-cols-1 gap-7 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="flex min-w-0 flex-col gap-7">
          {!house && sector.requires_health_visa ? (
            <VisaCard campaignId={c.id} owner={ownerFolder} number={c.health_visa_number} hasDocument={!!c.health_visa_document_path} editable={editable} />
          ) : null}
          {!house ? <BranchesSection campaignId={c.id} max={pkg.max_branches} options={branchOptions} list={branchList} /> : null}
          <CreativesSection
            campaignId={c.id}
            owner={ownerFolder}
            creatives={creatives ?? []}
            editable={editable}
            videoAllowed={c.surfaces.length === 1 && c.surfaces[0] === "tv"}
            supabaseUrl={supabaseUrl}
          />
          {pkg.quiz_allowed ? <QuizEditor campaignId={c.id} quiz={quizData} editable={editable} /> : null}
          {pkg.game_skin_allowed ? <SkinEditor campaignId={c.id} owner={ownerFolder} skin={skin} editable={editable} supabaseUrl={supabaseUrl} /> : null}
          {stats && ["active", "paused", "ended"].includes(c.status) ? <CampaignStatsView stats={stats} /> : null}
        </div>
        <div className="flex min-w-0 flex-col gap-7">
          <ListSection>
            <ListRow title={t("statusLabel")} detail={<Badge tone={CAMPAIGN_TONE[c.status]}>{t(`status.${c.status}`)}</Badge>} />
            <ListRow title={t("package")} detail={label(pkg)} />
            <ListRow title={t("sector")} detail={sectorName} />
            <ListRow
              title={t("startsOn")}
              subtitle={t("period", { from: formatShortDay(`${c.starts_on}T12:00:00Z`, locale), to: formatShortDay(`${c.ends_on}T12:00:00Z`, locale) })}
            />
            <ListRow title={t("surfacesTitle")} subtitle={c.surfaces.map((s) => t(`surfaces.${s}`)).join(" · ")} />
            {!house ? (
              <ListRow
                title={t("targeting")}
                subtitle={[
                  c.target_cities.length ? c.target_cities.join(", ") : t("citiesHint"),
                  c.target_org_types.length ? c.target_org_types.map((o) => tt(o)).join(", ") : t("orgTypesHint"),
                ].join(" · ")}
              />
            ) : null}
            {(schedules ?? []).length ? (
              <ListRow
                title={t("schedules")}
                subtitle={(schedules ?? []).map((s) => `${tw(String(s.weekday) as "1")} ${s.start_time.slice(0, 5)}–${s.end_time.slice(0, 5)}`).join(" · ")}
              />
            ) : null}
            {!house ? <ListRow title={t("price")} detail={<span className="tabular">{price ? formatXaf(price, locale) : t("free")}</span>} /> : null}
          </ListSection>
          {(invoices ?? []).length ? (
            <ListSection header={t("invoices")}>
              {(invoices ?? []).map((i) => (
                <ListRow
                  key={i.id}
                  href={`/ads/invoices/${i.id}`}
                  download
                  title={<span className="tabular">{i.number}</span>}
                  subtitle={`${formatShortDay(i.issued_at, locale)} · ${formatXaf(i.total_xaf, locale)}`}
                  detail={tb(`invoiceStatus.${i.status}`)}
                />
              ))}
            </ListSection>
          ) : null}
          {house && stopAction && c.status !== "ended" ? (
            <ConfirmAction action={stopAction} label={tp("stop")} title={tp("stopTitle")} body={tp("stopBody")} confirmLabel={tp("stop")} />
          ) : null}
        </div>
      </div>
      {primary}
    </AdminPage>
  );
}
