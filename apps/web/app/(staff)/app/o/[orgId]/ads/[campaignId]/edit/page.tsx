import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { saveCampaign } from "@/app/(staff)/ads/actions";
import { AdminPage } from "@/components/admin/admin-page";
import { CampaignForm } from "@/components/ads/campaign-form";
import { getOrgContext } from "@/lib/admin/context";
import { campaignInitial } from "@/lib/ads/campaign-initial";
import { campaignFormData } from "@/lib/ads/form-data";
import { isEditable } from "@/lib/ads/types";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("ads");
  return { title: t("edit") };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditHouseAdPage({ params }: { params: Promise<{ orgId: string; campaignId: string }> }) {
  const { orgId, campaignId } = await params;
  if (!UUID.test(campaignId)) notFound();
  const ctx = await getOrgContext(orgId);
  if (!ctx.canManageOrg) notFound();
  const found = await campaignInitial(campaignId);
  if (!found || found.campaign.organization_id !== orgId) notFound();
  const path = `/app/o/${orgId}/ads/${campaignId}`;
  if (!isEditable(found.campaign)) redirect(path);
  const t = await getTranslations("ads");
  const data = await campaignFormData();
  return (
    <AdminPage title={found.campaign.name} eyebrow={t("edit")} back={{ href: path, label: found.campaign.name }} wide>
      <CampaignForm mode="house" {...data} initial={found.initial} action={saveCampaign.bind(null, { campaignId })} />
    </AdminPage>
  );
}
