import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Megaphone, Plus } from "lucide-react";
import { isLocale } from "@nextin/shared/i18n";
import { AdminPage } from "@/components/admin/admin-page";
import { AdsNav } from "@/components/ads/ads-nav";
import { AdvertiserSignup } from "@/components/ads/advertiser-signup";
import { CAMPAIGN_TONE } from "@/components/ads/campaign-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ListIcon, ListRow, ListSection } from "@/components/ui/list";
import { getAdvertiserContext } from "@/lib/ads/context";
import { formatShortDay } from "@/lib/billing/format";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("ads");
  return { title: t("title") };
}

/** Espace annonceur : ouverture du compte, puis liste des campagnes. */
export default async function AdsHome() {
  const { advertiser, role } = await getAdvertiserContext();
  // Caissier : seule la validation des bons le concerne.
  if (role === "cashier") redirect("/ads/redeem");
  const t = await getTranslations("ads");
  const current = await getLocale();
  const locale = isLocale(current) ? current : "fr";
  const supabase = await getSupabaseServerClient();
  if (!advertiser) {
    const { data: sectors } = await supabase.from("ad_sectors").select("*").order("sort_order");
    return (
      <AdminPage title={t("title")} eyebrow={t("eyebrow")}>
        <AdvertiserSignup sectors={sectors ?? []} />
      </AdminPage>
    );
  }
  const { data: campaigns } = await supabase
    .from("ad_campaigns")
    .select("id, name, status, starts_on, ends_on, package_code")
    .eq("advertiser_id", advertiser.id)
    .order("created_at", { ascending: false });
  return (
    <AdminPage
      title={t("nav.campaigns")}
      eyebrow={advertiser.name}
      wide
      trailing={
        <Button asChild variant="gray" size="md">
          <Link href="/ads/campaigns/new">
            <Plus aria-hidden className="size-4" />
            {t("newCampaign")}
          </Link>
        </Button>
      }
    >
      <AdsNav variant="inline" role={role} />
      <ListSection footer={campaigns?.length ? undefined : t("campaignsEmpty")}>
        {(campaigns ?? []).map((c) => (
          <ListRow
            key={c.id}
            href={`/ads/campaigns/${c.id}`}
            icon={
              <ListIcon color="var(--accent-fill)">
                <Megaphone />
              </ListIcon>
            }
            title={<span className="font-semibold">{c.name}</span>}
            subtitle={`${c.package_code.charAt(0).toUpperCase()}${c.package_code.slice(1)} · ${t("period", {
              from: formatShortDay(`${c.starts_on}T12:00:00Z`, locale),
              to: formatShortDay(`${c.ends_on}T12:00:00Z`, locale),
            })}`}
            accessory={<Badge tone={CAMPAIGN_TONE[c.status]}>{t(`status.${c.status}`)}</Badge>}
          />
        ))}
      </ListSection>
    </AdminPage>
  );
}
