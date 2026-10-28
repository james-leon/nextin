import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AdminPage } from "@/components/admin/admin-page";
import { MobileOrgNav, SetupOverview } from "@/components/admin/setup-overview";
import { getOrgContext } from "@/lib/admin/context";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("dashboard");
  return { title: t("setupTitle") };
}

/** Démarrage : compteurs et étapes de configuration de l'établissement. */
export default async function SetupPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const ctx = await getOrgContext(orgId);
  const t = await getTranslations("dashboard");
  const to = await getTranslations("overview");
  return (
    <AdminPage title={t("setupTitle")} eyebrow={ctx.org.name} back={{ href: `/app/o/${orgId}`, label: to("title") }}>
      <SetupOverview orgId={orgId} />
      <MobileOrgNav orgId={orgId} />
    </AdminPage>
  );
}
