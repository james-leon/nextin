import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Megaphone, Plus } from "lucide-react";
import { CAMPAIGN_STATUS_TONE, campaignListLine } from "@nextin/shared/ads";
import { isLocale } from "@nextin/shared/i18n";
import { MasterDetail, SavedFromQuery, SplitRow } from "@/components/admin/master-detail";
import { SplitListPane } from "@/components/admin/split-pane";
import { AdsNav } from "@/components/ads/ads-nav";
import { Badge } from "@/components/ui/badge";
import { Button, IconLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ListIcon, ListSection } from "@/components/ui/list";
import { getAdvertiserContext } from "@/lib/ads/context";
import { shortDay, STATUS_FILL } from "@/lib/ads/format";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Campagnes de l'annonceur (maquette v2 24) : liste à gauche (carré coloré selon le statut, « Argent · jusqu'au
 * 28 nov. », pastille), détail à droite. La nouvelle campagne s'ouvre en pleine largeur (parcours en 5 étapes).
 */
export default async function CampaignsLayout({ children }: { children: React.ReactNode }) {
  const { advertiser, role } = await getAdvertiserContext("/ads/campaigns");
  if (!advertiser) redirect("/ads");
  if (role === "cashier") redirect("/ads/redeem");
  const t = await getTranslations("ads");
  const current = await getLocale();
  const locale = isLocale(current) ? current : "fr";
  const supabase = await getSupabaseServerClient();
  const [{ data: campaigns }, { data: packages }] = await Promise.all([
    supabase
      .from("ad_campaigns")
      .select("id, name, status, starts_on, ends_on, package_code")
      .eq("advertiser_id", advertiser.id)
      .order("created_at", { ascending: false }),
    supabase.from("ad_packages").select("code, name, name_en, duration_days"),
  ]);
  const pkgs = new Map((packages ?? []).map((p) => [p.code, p]));
  const all = campaigns ?? [];

  const list = (
    <SplitListPane
      title={t("nav.campaigns")}
      eyebrow={advertiser.name}
      trailing={all.length ? <IconLink href="/ads/campaigns/new" label={t("newCampaign")} icon={<Plus />} /> : null}
    >
      <AdsNav variant="inline" role={role} />
      <SavedFromQuery message={t("saved")} />
      {all.length ? (
        <ListSection>
          {all.map((c) => {
            const pkg = pkgs.get(c.package_code);
            const pkgName = pkg ? (locale === "en" ? pkg.name_en : pkg.name) : c.package_code;
            const line = campaignListLine(c.status);
            const tone = CAMPAIGN_STATUS_TONE[c.status];
            return (
              <SplitRow
                key={c.id}
                segment={c.id}
                href={`/ads/campaigns/${c.id}`}
                icon={
                  <ListIcon color={STATUS_FILL[tone]}>
                    <Megaphone />
                  </ListIcon>
                }
                title={<span className="font-semibold">{c.name}</span>}
                subtitle={
                  line === "until"
                    ? t("listUntil", { package: pkgName, date: shortDay(c.ends_on, locale) })
                    : line === "ended"
                      ? t("listEnded", { date: shortDay(c.ends_on, locale) })
                      : t("listDuration", { package: pkgName, count: pkg?.duration_days ?? 0 })
                }
                accessory={
                  <Badge tone={tone} shape="pill">
                    {t(`status.${c.status}`)}
                  </Badge>
                }
              />
            );
          })}
        </ListSection>
      ) : (
        <>
          <EmptyState title={t("campaignsEmpty")} icon={<Megaphone />} />
          <Button asChild block>
            <Link href="/ads/campaigns/new">
              <Plus aria-hidden className="size-5" />
              {t("newCampaign")}
            </Link>
          </Button>
        </>
      )}
    </SplitListPane>
  );

  return (
    <MasterDetail list={list} full={["new"]}>
      {children}
    </MasterDetail>
  );
}
