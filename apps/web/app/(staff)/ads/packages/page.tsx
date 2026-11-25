import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Plus, Tag } from "lucide-react";
import { AdminPage } from "@/components/admin/admin-page";
import { AdsNav } from "@/components/ads/ads-nav";
import { PackageList } from "@/components/ads/package-list";
import { BottomBar } from "@/components/ui/bottom-bar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { getAdvertiserContext } from "@/lib/ads/context";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("ads");
  return { title: t("packagesTitle") };
}

/** Formules (lecture seule) : prix et contenu de chaque formule, puis « Nouvelle campagne ». */
export default async function PackagesPage() {
  const { advertiser, role } = await getAdvertiserContext("/ads/packages");
  if (!advertiser) redirect("/ads");
  if (role === "cashier") redirect("/ads/redeem");
  const t = await getTranslations("ads");
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase.from("ad_packages").select("*").eq("active", true).eq("house", false).order("sort_order");
  const packages = data ?? [];
  return (
    <AdminPage narrow title={t("packagesTitle")} eyebrow={advertiser.name} subtitle={t("packagesBody")}>
      <AdsNav variant="inline" role={role} />
      {packages.length ? <PackageList packages={packages} /> : <EmptyState title={t("packagesEmpty")} icon={<Tag />} />}
      <BottomBar>
        <Button asChild block>
          <Link href="/ads/campaigns/new">
            <Plus aria-hidden className="size-5" />
            {t("newCampaign")}
          </Link>
        </Button>
      </BottomBar>
    </AdminPage>
  );
}
