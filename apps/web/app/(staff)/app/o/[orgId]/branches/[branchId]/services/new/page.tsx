import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AdminPage } from "@/components/admin/admin-page";
import { ServiceForm } from "@/components/admin/service-form";
import { getBranch } from "@/lib/admin/branch";
import { listSpecialties } from "@/lib/admin/specialties";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { saveService } from "../../../../_actions/structure";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("services");
  return { title: t("new") };
}

export default async function NewServicePage({ params }: { params: Promise<{ orgId: string; branchId: string }> }) {
  const { orgId, branchId } = await params;
  const { branch, canManage } = await getBranch(orgId, branchId);
  if (!canManage) notFound();
  const t = await getTranslations("services");
  const supabase = await getSupabaseServerClient();
  const [{ data: existing }, specialties] = await Promise.all([
    supabase.from("services").select("prefix, sort_order").eq("branch_id", branchId),
    listSpecialties(orgId),
  ]);
  return (
    <AdminPage title={t("new")} eyebrow={branch.name} back={{ href: `/app/o/${orgId}/branches/${branchId}/services`, label: t("title") }}>
      <ServiceForm
        action={saveService.bind(null, orgId, branchId, null)}
        takenPrefixes={(existing ?? []).map((s) => s.prefix)}
        specialties={specialties}
        sortOrder={Math.max(0, ...(existing ?? []).map((s) => s.sort_order)) + 1}
      />
    </AdminPage>
  );
}
