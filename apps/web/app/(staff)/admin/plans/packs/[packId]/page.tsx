import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { CheckCircle2 } from "lucide-react";
import { AdminPage } from "@/components/admin/admin-page";
import { PackForm, type PackFormValues } from "@/components/platform/pack-form";
import { CalloutCard } from "@/components/ui/callout-card";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("platform");
  return { title: t("packEdit") };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Création (`/admin/plans/packs/new`) ou édition d'une extension de quota. */
export default async function PackPage({
  params,
  searchParams,
}: {
  params: Promise<{ packId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { packId } = await params;
  const { saved } = await searchParams;
  const t = await getTranslations("platform");
  const ta = await getTranslations("admin");
  let pack: PackFormValues = { id: null, code: "", kind: "tickets", quantity: 1000, price_xaf: 0, name: "", name_en: null, active: true };
  if (packId !== "new") {
    if (!UUID.test(packId)) notFound();
    const supabase = await getSupabaseServerClient();
    const { data } = await supabase.from("quota_packs").select("id, code, kind, quantity, price_xaf, name, name_en, active").eq("id", packId).maybeSingle();
    if (!data) notFound();
    pack = data as PackFormValues;
  }
  return (
    <AdminPage narrow title={pack.id ? pack.name : t("packNew")} eyebrow={t("packEdit")} back={{ href: "/admin/plans", label: t("plansTitle") }}>
      {saved ? (
        <CalloutCard tone="green" role="status" icon={<CheckCircle2 />}>
          {ta("saved")}
        </CalloutCard>
      ) : null}
      <PackForm pack={pack} />
    </AdminPage>
  );
}
