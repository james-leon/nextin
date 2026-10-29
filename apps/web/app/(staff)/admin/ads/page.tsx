import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Megaphone, SlidersHorizontal } from "lucide-react";
import { isLocale } from "@nextin/shared/i18n";
import { AdminPage } from "@/components/admin/admin-page";
import { CAMPAIGN_TONE } from "@/components/ads/campaign-page";
import { PlatformNav } from "@/components/platform/platform-sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ListIcon, ListRow, ListSection } from "@/components/ui/list";
import { formatShortDay } from "@/lib/billing/format";
import { cn } from "@/lib/cn";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("adsAdmin");
  return { title: t("title") };
}

const TABS = ["pending", "active", "all"] as const;
type Tab = (typeof TABS)[number];

/** Modération des campagnes (§12.5) : à valider (plus anciennes d'abord), en cours, toutes. */
export default async function PlatformAdsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: raw } = await searchParams;
  const tab: Tab = TABS.includes(raw as Tab) ? (raw as Tab) : "pending";
  const t = await getTranslations("adsAdmin");
  const ta = await getTranslations("ads");
  const current = await getLocale();
  const locale = isLocale(current) ? current : "fr";
  const supabase = await getSupabaseServerClient();
  let query = supabase
    .from("ad_campaigns")
    .select("id, name, status, sector, package_code, starts_on, ends_on, submitted_at, organization_id, advertiser:advertisers(name), organization:organizations(name)")
    .limit(200);
  if (tab === "pending") query = query.eq("status", "pending_review").order("submitted_at", { ascending: true });
  else if (tab === "active") query = query.in("status", ["active", "paused", "awaiting_payment"]).order("starts_on", { ascending: false });
  else query = query.order("created_at", { ascending: false });
  const { data: campaigns } = await query;

  return (
    <AdminPage
      title={t("title")}
      wide
      trailing={
        <Button asChild variant="gray" size="md">
          <Link href="/admin/ads/packages">
            <SlidersHorizontal aria-hidden className="size-4" />
            {t("packagesTitle")}
          </Link>
        </Button>
      }
    >
      <PlatformNav variant="inline" />
      <nav aria-label={t("title")}>
        <ul role="list" className="flex gap-2 overflow-x-auto">
          {TABS.map((k) => (
            <li key={k}>
              <Link
                href={k === "pending" ? "/admin/ads" : `/admin/ads?tab=${k}`}
                aria-current={tab === k ? "page" : undefined}
                className={cn(
                  "pressable inline-flex min-h-11 items-center rounded-full px-4 text-subheadline whitespace-nowrap",
                  tab === k ? "bg-accent-tint font-semibold text-accent-on-tint" : "bg-fill-tertiary text-label",
                )}
              >
                {t(`tabs.${k}`)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <ListSection footer={campaigns?.length ? undefined : t("empty")}>
        {(campaigns ?? []).map((c) => {
          const owner = c.organization_id ? `${c.organization?.name ?? ""} · ${ta("house")}` : (c.advertiser?.name ?? "");
          return (
            <ListRow
              key={c.id}
              href={`/admin/ads/${c.id}`}
              icon={
                <ListIcon color={c.organization_id ? "var(--orange-fill)" : "var(--accent-fill)"}>
                  <Megaphone />
                </ListIcon>
              }
              title={<span className="font-semibold">{c.name}</span>}
              subtitle={`${owner} · ${c.package_code.charAt(0).toUpperCase()}${c.package_code.slice(1)} · ${ta("period", {
                from: formatShortDay(`${c.starts_on}T12:00:00Z`, locale),
                to: formatShortDay(`${c.ends_on}T12:00:00Z`, locale),
              })}`}
              accessory={<Badge tone={CAMPAIGN_TONE[c.status]}>{ta(`status.${c.status}`)}</Badge>}
            />
          );
        })}
      </ListSection>
    </AdminPage>
  );
}
