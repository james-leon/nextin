import "server-only";
import { cache } from "react";
import { requireStaffSession, type StaffSession } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export type AdvertiserContext = {
  session: StaffSession;
  advertiser: { id: string; name: string; sector: string; city: string | null; status: string } | null;
};

/** Compte annonceur de l'utilisateur connecté (le premier, s'il en a plusieurs ; RLS : membres seulement). */
export const getAdvertiserContext = cache(async (next = "/ads"): Promise<AdvertiserContext> => {
  const session = await requireStaffSession(next);
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase.from("advertisers").select("id, name, sector, city, status").order("created_at").limit(1).maybeSingle();
  return { session, advertiser: data ?? null };
});
