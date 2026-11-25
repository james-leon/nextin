import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { saveAdPreferences } from "@/app/(staff)/app/o/[orgId]/_actions/ads";
import { AdminPage } from "@/components/admin/admin-page";
import { AdPreferencesForm } from "@/components/ads/ad-preferences-form";
import { getOrgContext } from "@/lib/admin/context";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("adPrefs");
  return { title: t("title") };
}

/**
 * Publicité de l'établissement (maquette v2 24, P10) : secteurs refusés, jeux pendant l'attente, annonces Maison.
 * Enregistrement automatique. Administrateurs uniquement.
 */
export default async function OrgAdsPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const ctx = await getOrgContext(orgId);
  if (!ctx.canManageOrg) notFound();
  const t = await getTranslations("adPrefs");
  const ta = await getTranslations("admin");
  const supabase = await getSupabaseServerClient();
  const [{ data: sectors }, { data: prefs }, { count }] = await Promise.all([
    supabase.from("ad_sectors").select("*").eq("active", true).order("sort_order"),
    supabase.from("organization_ad_preferences").select("*").eq("organization_id", orgId).maybeSingle(),
    supabase.from("ad_campaigns").select("id", { count: "exact", head: true }).eq("organization_id", orgId).neq("status", "ended"),
  ]);
  return (
    <AdminPage narrow title={t("title")} eyebrow={ctx.org.name} back={{ href: `/app/o/${orgId}`, label: ta("nav.overview") }}>
      <AdPreferencesForm
        sectors={sectors ?? []}
        prefs={prefs ?? { blocked_sectors: [], quiz_enabled: true, sky_catch_enabled: true, house_ads_enabled: true }}
        action={saveAdPreferences.bind(null, orgId)}
        house={{ href: `/app/o/${orgId}/ads/house`, count: count ?? 0 }}
      />
    </AdminPage>
  );
}
