import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { saveCampaign } from "@/app/(staff)/ads/actions";
import { AdminPage } from "@/components/admin/admin-page";
import { CampaignForm } from "@/components/ads/campaign-form";
import { campaignInitial } from "@/lib/ads/campaign-initial";
import { getAdvertiserContext } from "@/lib/ads/context";
import { campaignFormData } from "@/lib/ads/form-data";
import { isEditable } from "@/lib/ads/types";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("ads");
  return { title: t("edit") };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditCampaignPage({ params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;
  if (!UUID.test(campaignId)) notFound();
  const { advertiser } = await getAdvertiserContext(`/ads/campaigns/${campaignId}/edit`);
  const found = await campaignInitial(campaignId);
  if (!found || !advertiser || found.campaign.advertiser_id !== advertiser.id) notFound();
  if (!isEditable(found.campaign)) redirect(`/ads/campaigns/${campaignId}`);
  const t = await getTranslations("ads");
  const data = await campaignFormData();
  return (
    <AdminPage title={found.campaign.name} eyebrow={t("edit")} back={{ href: `/ads/campaigns/${campaignId}`, label: found.campaign.name }} wide>
      <CampaignForm mode="advertiser" {...data} initial={found.initial} action={saveCampaign.bind(null, { campaignId })} />
    </AdminPage>
  );
}
