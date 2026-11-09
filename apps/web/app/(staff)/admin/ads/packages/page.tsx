import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { CheckCircle2 } from "lucide-react";
import { AdminPage } from "@/components/admin/admin-page";
import { AdCatalog } from "@/components/platform/ad-catalog";
import { CalloutCard } from "@/components/ui/callout-card";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("adsAdmin");
  return { title: t("packagesTitle") };
}

/** Formules Maison / Bronze / Argent / Or et secteurs : tout est modifiable ici, rien n'est écrit dans le code. */
export default async function AdPackagesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { saved } = await searchParams;
  const t = await getTranslations("adsAdmin");
  const supabase = await getSupabaseServerClient();
  const [{ data: packages }, { data: sectors }] = await Promise.all([
    supabase.from("ad_packages").select("*").order("sort_order"),
    supabase.from("ad_sectors").select("*").order("sort_order"),
  ]);
  return (
    <AdminPage title={t("packagesTitle")} back={{ href: "/admin/ads", label: t("title") }}>
      {saved ? (
        <CalloutCard tone="green" role="status" icon={<CheckCircle2 />}>
          {t("saved")}
        </CalloutCard>
      ) : null}
      <AdCatalog packages={packages ?? []} sectors={sectors ?? []} />
    </AdminPage>
  );
}
