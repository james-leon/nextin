import "server-only";
import { cache } from "react";
import { requireStaffSession, type StaffSession } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export type AdvertiserRole = "owner" | "editor" | "cashier";

export type AdvertiserContext = {
  session: StaffSession;
  advertiser: { id: string; name: string; sector: string; city: string | null; status: string } | null;
  /** Rôle de l'utilisateur : un caissier ne fait que valider les bons. */
  role: AdvertiserRole | null;
};

/** Compte annonceur de l'utilisateur connecté (le premier, s'il en a plusieurs ; RLS : membres seulement). */
export const getAdvertiserContext = cache(async (next = "/ads"): Promise<AdvertiserContext> => {
  const session = await requireStaffSession(next);
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase
    .from("advertiser_members")
    .select("role, advertiser:advertisers(id, name, sector, city, status)")
    .eq("user_id", session.userId)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  const advertiser = (data?.advertiser as AdvertiserContext["advertiser"]) ?? null;
  return { session, advertiser, role: advertiser ? (data!.role as AdvertiserRole) : null };
});
