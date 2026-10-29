import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AdminPage } from "@/components/admin/admin-page";
import { AdsNav } from "@/components/ads/ads-nav";
import { RedeemForm } from "@/components/ads/redeem-form";
import { getAdvertiserContext } from "@/lib/ads/context";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("ads");
  return { title: t("redeemTitle") };
}

/** Validation d'un bon de réduction en caisse (commerçant annonceur, ou personnel pour une annonce Maison). */
export default async function RedeemPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams;
  const { advertiser, role } = await getAdvertiserContext("/ads/redeem");
  const t = await getTranslations("ads");
  const initial = typeof code === "string" && /^[A-Za-z0-9]{8,22}$/.test(code) ? code : "";
  return (
    <AdminPage title={t("redeemTitle")} eyebrow={advertiser?.name ?? t("title")}>
      <AdsNav variant="inline" role={role} />
      {role === "cashier" ? <p className="px-4 text-footnote text-label-secondary">{t("cashierNotice")}</p> : null}
      <RedeemForm key={initial} initialCode={initial} />
    </AdminPage>
  );
}
