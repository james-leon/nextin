import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { CampaignDetail } from "@/components/ads/campaign-detail";
import { getAdvertiserContext } from "@/lib/ads/context";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("ads");
  return { title: t("nav.campaigns") };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Détail d'une campagne, à droite de la liste (maître-détail). */
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
  const { advertiser } = await getAdvertiserContext(`/ads/campaigns/${campaignId}`);
  if (!advertiser) redirect("/ads");
  return <CampaignDetail campaignId={campaignId} advertiserId={advertiser.id} submitted={!!saved} />;
}
