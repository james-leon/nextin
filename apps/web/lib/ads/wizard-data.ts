import "server-only";
import { firstIncompleteStep, stepFromNumber, type CampaignStatus, type CampaignStep } from "@nextin/shared/ads";
import type { BranchOption } from "@/components/ads/branches-section";
import type { WizardProps } from "@/components/ads/campaign-wizard";
import type { QuizInitial } from "@/components/ads/quiz-editor";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { campaignInitial } from "./campaign-initial";
import { campaignFormData } from "./form-data";
import type { QuizAnswer } from "./types";

/**
 * Données du parcours « Nouvelle campagne » (maquette v2 24) : formules proposées (actives, hors Maison), villes et
 * types ciblables, et pour une campagne déjà commencée, ses visuels, quiz, habillage, visa et agences proposées.
 * Étape demandée (`?step=n`) si elle est ouverte, sinon la première étape incomplète.
 */
export async function wizardData(
  advertiser: { id: string; sector: string },
  campaignId: string | null,
  requested: string | undefined,
): Promise<{ props: Omit<WizardProps, "orgTypes">; campaignName: string | null; status: CampaignStatus } | null> {
  const supabase = await getSupabaseServerClient();
  const base = await campaignFormData();
  const packages = base.packages.filter((p) => !p.house);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const sectorOf = async (code: string) => (await supabase.from("ad_sectors").select("requires_health_visa").eq("code", code).maybeSingle()).data;

  if (!campaignId) {
    const sector = await sectorOf(advertiser.sector);
    return {
      campaignName: null,
      status: "draft",
      props: {
        step: "package",
        campaignId: null,
        advertiserId: advertiser.id,
        packages,
        cities: base.cities,
        today: base.today,
        initial: { name: "", packageCode: "", sector: advertiser.sector, startsOn: base.today, surfaces: [], targetCities: [], targetOrgTypes: [], schedules: [] },
        creatives: [],
        quiz: null,
        skin: null,
        visa: { required: !!sector?.requires_health_visa, number: null, hasDocument: false },
        branchOptions: null,
        supabaseUrl,
      },
    };
  }

  const found = await campaignInitial(campaignId);
  if (!found || found.campaign.advertiser_id !== advertiser.id) return null;
  const c = found.campaign;
  const [{ data: creatives }, { data: quiz }, { data: skin }, sector] = await Promise.all([
    supabase.from("ad_creatives").select("*").eq("campaign_id", c.id).order("sort_order"),
    supabase.from("ad_quizzes").select("*, questions:ad_quiz_questions(question, answers, position)").eq("campaign_id", c.id).maybeSingle(),
    supabase.from("ad_game_skins").select("*").eq("campaign_id", c.id).maybeSingle(),
    sectorOf(c.sector),
  ]);
  const pkg = base.packages.find((p) => p.code === c.package_code);
  const branchOptions = pkg?.max_branches != null ? ((await supabase.rpc("campaign_branch_options", { p_campaign: c.id })).data as BranchOption[] | null) : null;
  const quizData: QuizInitial = quiz
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
  const progress = { saved: true, creatives: (creatives ?? []).length };
  const asked = stepFromNumber(requested);
  const step: CampaignStep = asked && (asked !== "submit" || progress.creatives > 0) ? asked : firstIncompleteStep(progress);
  return {
    campaignName: c.name,
    status: c.status,
    props: {
      step,
      campaignId: c.id,
      advertiserId: advertiser.id,
      packages,
      cities: base.cities,
      today: base.today,
      initial: found.initial,
      creatives: creatives ?? [],
      quiz: quizData,
      skin: skin ?? null,
      visa: { required: !!sector?.requires_health_visa, number: c.health_visa_number, hasDocument: !!c.health_visa_document_path },
      branchOptions,
      supabaseUrl,
    },
  };
}
