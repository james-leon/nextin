import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { CheckCircle2, Megaphone, Plus } from "lucide-react";
import { isLocale } from "@nextin/shared/i18n";
import { saveAdPreferences } from "@/app/(staff)/app/o/[orgId]/_actions/ads";
import { AdminPage } from "@/components/admin/admin-page";
import { AdPreferencesForm } from "@/components/ads/ad-preferences-form";
import { CAMPAIGN_TONE } from "@/components/ads/campaign-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalloutCard } from "@/components/ui/callout-card";
import { ListIcon, ListRow, ListSection } from "@/components/ui/list";
import { getOrgContext } from "@/lib/admin/context";
import { formatShortDay } from "@/lib/billing/format";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("adPrefs");
  return { title: t("title") };
}

/** Publicité de l'établissement (M10b) : jeux, secteurs refusés, annonces Maison. Administrateurs uniquement. */
export default async function OrgAdsPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { orgId } = await params;
  const { saved } = await searchParams;
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
    supabase
      .from("ad_campaigns")
      .select("id, name, status, starts_on, ends_on")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <AdminPage
      title={t("title")}
      eyebrow={ctx.org.name}
      wide
      trailing={
        <Button asChild variant="gray" size="md">
          <Link href={`/app/o/${orgId}/ads/new`}>
            <Plus aria-hidden className="size-4" />
            {t("newHouseAd")}
          </Link>
        </Button>
      }
    >
      {saved ? (
        <CalloutCard tone="green" role="status" icon={<CheckCircle2 />}>
          {ta("saved")}
        </CalloutCard>
      ) : null}
      <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
        <AdPreferencesForm
          sectors={sectors ?? []}
          prefs={prefs ?? { blocked_sectors: [], quiz_enabled: true, sky_catch_enabled: true, house_ads_enabled: true }}
          action={saveAdPreferences.bind(null, orgId)}
        />
        <ListSection header={t("houseAds")} footer={house?.length ? t("houseIntro") : t("houseEmpty")}>
          {(house ?? []).map((c) => (
            <ListRow
              key={c.id}
              href={`/app/o/${orgId}/ads/${c.id}`}
              icon={
                <ListIcon color="var(--orange-fill)">
                  <Megaphone />
                </ListIcon>
              }
              title={<span className="font-semibold">{c.name}</span>}
              subtitle={ta("period", {
                from: formatShortDay(`${c.starts_on}T12:00:00Z`, locale),
                to: formatShortDay(`${c.ends_on}T12:00:00Z`, locale),
              })}
              accessory={<Badge tone={CAMPAIGN_TONE[c.status]}>{ta(`status.${c.status}`)}</Badge>}
            />
          ))}
        </ListSection>
      </div>
    </AdminPage>
  );
}
