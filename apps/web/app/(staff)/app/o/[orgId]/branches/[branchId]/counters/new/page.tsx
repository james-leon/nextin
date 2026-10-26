import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AdminPage } from "@/components/admin/admin-page";
import { CounterForm } from "@/components/admin/counter-form";
import { getBranch } from "@/lib/admin/branch";
import { counterFormData } from "@/lib/admin/counters";
import { saveCounter } from "../../../../_actions/structure";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("counters");
  return { title: t("new") };
}

export default async function NewCounterPage({ params }: { params: Promise<{ orgId: string; branchId: string }> }) {
  const { orgId, branchId } = await params;
  const { branch, canManage } = await getBranch(orgId, branchId);
  if (!canManage) notFound();
  const t = await getTranslations("counters");
  const data = await counterFormData(branchId);
  return (
    <AdminPage title={t("new")} eyebrow={branch.name} back={{ href: `/app/o/${orgId}/branches/${branchId}/counters`, label: t("title") }}>
      <CounterForm action={saveCounter.bind(null, orgId, branchId, null)} {...data} />
    </AdminPage>
  );
}
