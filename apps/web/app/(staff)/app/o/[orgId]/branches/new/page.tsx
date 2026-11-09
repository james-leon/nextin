import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AdminPage } from "@/components/admin/admin-page";
import { BranchForm } from "@/components/admin/branch-form";
import { getOrgContext } from "@/lib/admin/context";
import { createBranch } from "../../_actions/structure";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("branches");
  return { title: t("new") };
}

export default async function NewBranchPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const ctx = await getOrgContext(orgId);
  if (!ctx.canManageOrg) notFound();
  const t = await getTranslations("branches");
  return (
    <AdminPage inSplit title={t("new")} eyebrow={ctx.org.name} back={{ href: `/app/o/${orgId}/branches`, label: t("title") }}>
      <BranchForm action={createBranch.bind(null, orgId)} submitLabel={t("create")} submittingLabel={t("creating")} />
    </AdminPage>
  );
}
