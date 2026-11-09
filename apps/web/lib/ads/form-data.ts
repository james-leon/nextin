import "server-only";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/** Données des formulaires de campagne : formules, secteurs, villes ciblables, date du jour (Douala). */
export async function campaignFormData() {
  const supabase = await getSupabaseServerClient();
  const [{ data: packages }, { data: sectors }, { data: cities }] = await Promise.all([
    supabase.from("ad_packages").select("*").eq("active", true).order("sort_order"),
    supabase.from("ad_sectors").select("*").eq("active", true).order("sort_order"),
    supabase.rpc("ad_target_cities"),
  ]);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Douala" }).format(new Date());
  return { packages: packages ?? [], sectors: sectors ?? [], cities: (cities as string[] | null) ?? [], today };
}
