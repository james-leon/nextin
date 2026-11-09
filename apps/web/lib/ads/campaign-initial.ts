import "server-only";
import type { CampaignInitial } from "@/components/ads/campaign-form";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { CampaignRow } from "./types";

/** Campagne et valeurs initiales de son formulaire (RLS : seulement si l'utilisateur peut la voir). */
export async function campaignInitial(campaignId: string): Promise<{ campaign: CampaignRow; initial: CampaignInitial } | null> {
  const supabase = await getSupabaseServerClient();
  const [{ data: c }, { data: schedules }] = await Promise.all([
    supabase.from("ad_campaigns").select("*").eq("id", campaignId).maybeSingle(),
    supabase.from("ad_schedules").select("weekday, start_time, end_time").eq("campaign_id", campaignId),
  ]);
  if (!c) return null;
  return {
    campaign: c,
    initial: {
      name: c.name,
      packageCode: c.package_code,
      sector: c.sector,
      startsOn: c.starts_on,
      surfaces: c.surfaces,
      targetCities: c.target_cities,
      targetOrgTypes: c.target_org_types,
      schedules: (schedules ?? []).map((s) => ({ weekday: s.weekday, start_time: s.start_time.slice(0, 5), end_time: s.end_time.slice(0, 5) })),
    },
  };
}
