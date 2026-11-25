import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Megaphone, Plus } from "lucide-react";
import { CAMPAIGN_STATUS_TONE } from "@nextin/shared/ads";
import { isLocale } from "@nextin/shared/i18n";
import { saveAdPreferences } from "@/app/(staff)/app/o/[orgId]/_actions/ads";
import { SavedFromQuery } from "@/components/admin/master-detail";
import { AdminPage } from "@/components/admin/admin-page";
import { AdPreferencesForm } from "@/components/ads/ad-preferences-form";
import { Badge } from "@/components/ui/badge";
import { Button, IconLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ListIcon, ListRow, ListSection } from "@/components/ui/list";
import { getOrgContext } from "@/lib/admin/context";
import { shortDay, STATUS_FILL } from "@/lib/ads/format";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("adPrefs");
  return { title: t("house") };
}

/** Annonces Maison de l'établissement : diffusion (interrupteur), liste et « + » (nouvelle annonce). Administrateurs. */
export default async function HouseAdsPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const ctx = await getOrgContext(orgId);
  if (!ctx.canManageOrg) notFound();
  const t = await getTranslations("adPrefs");
  const ta = await getTranslations("ads");
  const current = await getLocale();
  const locale = isLocale(current) ? current : "fr";
  const supabase = await getSupabaseServerClient();
  const [{ data: sectors }, { data: prefs }, { data: house }] = await Promise.all([
    supabase.from("ad_sectors").select("*").eq("active", true).order("sort_order"),
    supabase.from("organization_ad_preferences").select("*").eq("organization_id", orgId).maybeSingle(),
    supabase.from("ad_campaigns").select("id, name, status, starts_on, ends_on").eq("organization_id", orgId).order("created_at", { ascending: false }),
  ]);
  const all = house ?? [];
  return (
    <AdminPage
      narrow
      title={t("house")}
      eyebrow={ctx.org.name}
      subtitle={t("houseIntro")}
      back={{ href: `/app/o/${orgId}/ads`, label: t("title") }}
      trailing={all.length ? <IconLink href={`/app/o/${orgId}/ads/new`} label={t("newHouseAd")} icon={<Plus />} /> : null}
    >
      <SavedFromQuery message={t("saved")} />
      <AdPreferencesForm
        section="house"
        sectors={sectors ?? []}
        prefs={prefs ?? { blocked_sectors: [], quiz_enabled: true, sky_catch_enabled: true, house_ads_enabled: true }}
        action={saveAdPreferences.bind(null, orgId)}
      />
      {all.length ? (
        <ListSection header={t("houseAds")}>
          {all.map((c) => (
            <ListRow
              key={c.id}
              href={`/app/o/${orgId}/ads/${c.id}`}
              icon={
                <ListIcon color={STATUS_FILL[CAMPAIGN_STATUS_TONE[c.status]]}>
                  <Megaphone />
                </ListIcon>
              }
              title={<span className="font-semibold">{c.name}</span>}
              subtitle={ta("period", { from: shortDay(c.starts_on, locale), to: shortDay(c.ends_on, locale) })}
              accessory={
                <Badge tone={CAMPAIGN_STATUS_TONE[c.status]} shape="pill">
                  {ta(`status.${c.status}`)}
                </Badge>
              }
            />
          ))}
        </ListSection>
      ) : (
        <>
          <EmptyState title={t("houseEmpty")} icon={<Megaphone />} />
          <Button asChild block>
            <Link href={`/app/o/${orgId}/ads/new`}>
              <Plus aria-hidden className="size-5" />
              {t("newHouseAd")}
            </Link>
          </Button>
        </>
      )}
    </AdminPage>
  );
}
