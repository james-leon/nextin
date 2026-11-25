import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AdvertiserSignup } from "@/components/ads/advertiser-signup";
import { getAdvertiserContext } from "@/lib/ads/context";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("ads");
  return { title: t("title") };
}

/** Espace annonceur : ouverture du compte (maquette v2 24), sinon les campagnes (ou les bons pour un caissier). */
export default async function AdsHome() {
  const { advertiser, role } = await getAdvertiserContext();
  if (role === "cashier") redirect("/ads/redeem");
  if (advertiser) redirect("/ads/campaigns");
  const supabase = await getSupabaseServerClient();
  const { data: sectors } = await supabase.from("ad_sectors").select("*").eq("active", true).order("sort_order");
  return <AdvertiserSignup sectors={sectors ?? []} />;
}
