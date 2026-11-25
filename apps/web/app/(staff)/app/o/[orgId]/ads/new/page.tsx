import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AdminPage } from "@/components/admin/admin-page";
import { HouseAdForm } from "@/components/ads/house-ad-form";
import { getOrgContext } from "@/lib/admin/context";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("adPrefs");
  return { title: t("houseTitle") };
}

/** Annonce Maison (maquette v2 24) : gratuite, sans validation, diffusée dans les agences de l'établissement. */
export default async function NewHouseAdPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const ctx = await getOrgContext(orgId);
  if (!ctx.canManageOrg) notFound();
  const t = await getTranslations("adPrefs");
  return (
    <AdminPage narrow title={t("houseTitle")} eyebrow={ctx.org.name} subtitle={t("houseIntro")} back={{ href: `/app/o/${orgId}/ads/house`, label: t("house") }}>
      <HouseAdForm orgId={orgId} orgName={ctx.org.name} />
    </AdminPage>
  );
}
