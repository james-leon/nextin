import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AdminPage } from "@/components/admin/admin-page";
import { PractitionerForm } from "@/components/admin/practitioner-form";
import { manageableBranches } from "@/lib/admin/branches";
import { getOrgContext } from "@/lib/admin/context";
import { listSpecialties } from "@/lib/admin/specialties";
import { savePractitioner } from "../../_actions/people";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("practitioners");
  return { title: t("new") };
}

export default async function NewPractitionerPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const ctx = await getOrgContext(orgId);
  const [branches, specialties] = await Promise.all([manageableBranches(ctx), listSpecialties(orgId)]);
  if (!branches.length) notFound();
  const t = await getTranslations("practitioners");
  return (
    <AdminPage title={t("new")} eyebrow={ctx.org.name} back={{ href: `/app/o/${orgId}/practitioners`, label: t("title") }}>
      <PractitionerForm action={savePractitioner.bind(null, orgId, null)} specialties={specialties} branches={branches} />
    </AdminPage>
  );
}
