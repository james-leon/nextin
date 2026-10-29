import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { saveCampaign } from "@/app/(staff)/ads/actions";
import { AdminPage } from "@/components/admin/admin-page";
import { CampaignForm } from "@/components/ads/campaign-form";
import { getAdvertiserContext } from "@/lib/ads/context";
import { campaignFormData } from "@/lib/ads/form-data";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("ads");
  return { title: t("newCampaign") };
}

export default async function NewCampaignPage() {
  const { advertiser } = await getAdvertiserContext("/ads/campaigns/new");
  if (!advertiser) redirect("/ads");
  const t = await getTranslations("ads");
  const data = await campaignFormData();
  return (
    <AdminPage title={t("newCampaign")} eyebrow={advertiser.name} back={{ href: "/ads", label: t("nav.campaigns") }} wide>
      <CampaignForm mode="advertiser" {...data} action={saveCampaign.bind(null, { advertiserId: advertiser.id })} />
    </AdminPage>
  );
}
