import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { CheckCircle2 } from "lucide-react";
import { AdminPage } from "@/components/admin/admin-page";
import { AdsNav } from "@/components/ads/ads-nav";
import { CashiersManager } from "@/components/ads/cashiers-manager";
import { CalloutCard } from "@/components/ui/callout-card";
import { getAdvertiserContext } from "@/lib/ads/context";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("ads");
  return { title: t("cashiersTitle") };
}

/** Caissiers de l'annonceur (propriétaire) : validation des bons en caisse, sans accès aux campagnes. */
export default async function CashiersPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const { saved } = await searchParams;
  const { advertiser, role } = await getAdvertiserContext("/ads/cashiers");
  if (!advertiser || role !== "owner") redirect("/ads");
  const t = await getTranslations("ads");
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase.rpc("advertiser_cashiers", { p_advertiser: advertiser.id });
  return (
    <AdminPage title={t("cashiersTitle")} eyebrow={advertiser.name} subtitle={t("cashiersBody")} wide>
      <AdsNav variant="inline" role={role} />
      {saved ? (
        <CalloutCard tone="green" role="status" icon={<CheckCircle2 />}>
          {t("cashierAdded")}
        </CalloutCard>
      ) : null}
      <CashiersManager advertiserId={advertiser.id} cashiers={(data as { user_id: string; email: string; since: string }[] | null) ?? []} />
    </AdminPage>
  );
}
