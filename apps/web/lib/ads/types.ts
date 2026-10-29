import type { Database } from "@nextin/shared/database";

type Tables = Database["public"]["Tables"];
export type CampaignRow = Tables["ad_campaigns"]["Row"];
export type CreativeRow = Tables["ad_creatives"]["Row"];
export type PackageRow = Tables["ad_packages"]["Row"];
export type SectorRow = Tables["ad_sectors"]["Row"];
export type QuizRow = Tables["ad_quizzes"]["Row"];
export type QuizQuestionRow = Tables["ad_quiz_questions"]["Row"];
export type SkinRow = Tables["ad_game_skins"]["Row"];
export type CampaignStatus = Database["public"]["Enums"]["campaign_status"];
export type AdSurface = Database["public"]["Enums"]["ad_surface"];

export type QuizAnswer = { text: string; text_en?: string | null; correct?: boolean };

/** Réponse de `campaign_stats`. */
export type CampaignStats = {
  totals: {
    impressions: number;
    clicks: number;
    skips: number;
    quiz_plays: number;
    game_plays: number;
    interstitial_impressions: number;
    interstitial_skips: number;
    coupons_issued: number;
    coupons_redeemed: number;
  };
  days: { day: string; impressions: number; clicks: number; plays: number; coupons_issued: number; coupons_redeemed: number }[];
  branches: number;
};

/** Champs de `save_campaign` à partir d'une campagne existante (pour n'en changer qu'une partie, ex. le visa). */
export function campaignFields(c: CampaignRow, schedules: { weekday: number; start_time: string; end_time: string }[]) {
  return {
    name: c.name,
    package_code: c.package_code,
    sector: c.sector,
    starts_on: c.starts_on,
    surfaces: c.surfaces,
    target_cities: c.target_cities,
    target_org_types: c.target_org_types,
    health_visa_number: c.health_visa_number ?? "",
    health_visa_document_path: c.health_visa_document_path ?? "",
    schedules: schedules.map((s) => ({ weekday: s.weekday, start_time: s.start_time.slice(0, 5), end_time: s.end_time.slice(0, 5) })),
  };
}

/** Campagne modifiable par son annonceur (brouillon ou refusée) ; une annonce Maison l'est tant qu'elle n'est pas terminée. */
export function isEditable(c: Pick<CampaignRow, "status" | "organization_id">): boolean {
  return c.organization_id ? c.status !== "ended" : c.status === "draft" || c.status === "rejected";
}
