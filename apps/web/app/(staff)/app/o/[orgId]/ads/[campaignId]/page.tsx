import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { stopHouseCampaign } from "@/app/(staff)/app/o/[orgId]/_actions/ads";
import { CampaignPage } from "@/components/ads/campaign-page";
import { getOrgContext } from "@/lib/admin/context";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("adPrefs");
  return { title: t("houseTitle") };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Annonce Maison : mêmes sections qu'une campagne d'annonceur, publication directe et arrêt par l'établissement. */
export default async function HouseAdPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string; campaignId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { orgId, campaignId } = await params;
  const { saved } = await searchParams;
  if (!UUID.test(campaignId)) notFound();
  const ctx = await getOrgContext(orgId);
  if (!ctx.canManageOrg) notFound();
  const t = await getTranslations("adPrefs");
  return (
    <CampaignPage
      campaignId={campaignId}
      organizationId={orgId}
      back={{ href: `/app/o/${orgId}/ads`, label: t("title") }}
      editHref={`/app/o/${orgId}/ads/${campaignId}/edit`}
      stopAction={stopHouseCampaign.bind(null, orgId, campaignId)}
      saved={!!saved}
    />
  );
}
