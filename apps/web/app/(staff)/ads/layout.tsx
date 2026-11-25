import { getLocale, getTranslations } from "next-intl/server";
import { AdsNav } from "@/components/ads/ads-nav";
import { SidebarShell } from "@/components/shell/sidebar-shell";
import { getAdvertiserContext } from "@/lib/ads/context";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Espace annonceur (M10b, maquette v2 24) : compte connecté ; barre latérale bleu nuit sur grand écran (carte de
 * l'annonceur « Secteur · Ville », rubriques selon le rôle, personne connectée), repliable sur tablette portrait.
 */
export default async function AdsLayout({ children }: { children: React.ReactNode }) {
  const [{ advertiser, role, session }, t, locale] = await Promise.all([getAdvertiserContext(), getTranslations("common"), getLocale()]);
  const ta = await getTranslations("ads");
  let card: { name: string; summary: string } | null = null;
  if (advertiser) {
    const supabase = await getSupabaseServerClient();
    const { data: sector } = await supabase.from("ad_sectors").select("name, name_en").eq("code", advertiser.sector).maybeSingle();
    const sectorName = sector ? (locale === "en" ? sector.name_en : sector.name) : "";
    card = {
      name: advertiser.name,
      summary: advertiser.city && sectorName ? ta("advertiserSummary", { sector: sectorName, city: advertiser.city }) : sectorName || (advertiser.city ?? ""),
    };
  }
  return (
    <SidebarShell
      labels={{ open: t("sidebarShow"), close: t("sidebarHide") }}
      sidebar={<AdsNav variant="sidebar" advertiser={card} role={role} user={session.fullName ?? session.email} />}
    >
      {children}
    </SidebarShell>
  );
}
