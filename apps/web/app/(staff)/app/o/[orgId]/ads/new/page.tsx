import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { saveCampaign } from "@/app/(staff)/ads/actions";
import { AdminPage } from "@/components/admin/admin-page";
import { CampaignForm } from "@/components/ads/campaign-form";
import { getOrgContext } from "@/lib/admin/context";
import { campaignFormData } from "@/lib/ads/form-data";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("adPrefs");
  return { title: t("newHouseAd") };
}

/** Nouvelle annonce Maison : gratuite, sans validation, diffusée dans les agences de l'établissement. */
export default async function NewHouseAdPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const ctx = await getOrgContext(orgId);
  if (!ctx.canManageOrg) notFound();
  const t = await getTranslations("adPrefs");
  const data = await campaignFormData();
  return (
    <AdminPage title={t("newHouseAd")} eyebrow={ctx.org.name} subtitle={t("houseIntro")} back={{ href: `/app/o/${orgId}/ads`, label: t("title") }} wide>
      <CampaignForm mode="house" {...data} action={saveCampaign.bind(null, { organizationId: orgId })} />
    </AdminPage>
  );
}
