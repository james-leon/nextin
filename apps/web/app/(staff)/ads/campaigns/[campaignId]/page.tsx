import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { CampaignPage } from "@/components/ads/campaign-page";
import { getAdvertiserContext } from "@/lib/ads/context";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("ads");
  return { title: t("nav.campaigns") };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AdvertiserCampaignPage({
  params,
  searchParams,
}: {
  params: Promise<{ campaignId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { campaignId } = await params;
  const { saved } = await searchParams;
  if (!UUID.test(campaignId)) notFound();
  await getAdvertiserContext(`/ads/campaigns/${campaignId}`);
  const t = await getTranslations("ads");
  return (
    <CampaignPage
      campaignId={campaignId}
      back={{ href: "/ads", label: t("nav.campaigns") }}
      editHref={`/ads/campaigns/${campaignId}/edit`}
      saved={!!saved}
    />
  );
}
