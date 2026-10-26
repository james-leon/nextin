import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Trash2 } from "lucide-react";
import { AdminPage } from "@/components/admin/admin-page";
import { ConfirmAction } from "@/components/admin/confirm-action";
import { ReadOnlyNotice } from "@/components/admin/read-only-notice";
import { ServiceForm } from "@/components/admin/service-form";
import { getBranch } from "@/lib/admin/branch";
import { listSpecialties } from "@/lib/admin/specialties";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { deleteService, saveService } from "../../../../_actions/structure";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("services");
  return { title: t("editTitle") };
}

export default async function EditServicePage({ params }: { params: Promise<{ orgId: string; branchId: string; serviceId: string }> }) {
  const { orgId, branchId, serviceId } = await params;
  const { canManage } = await getBranch(orgId, branchId);
  if (!/^[0-9a-f-]{36}$/i.test(serviceId)) notFound();
  const t = await getTranslations("services");
  const ta = await getTranslations("admin");
  const supabase = await getSupabaseServerClient();
  const [{ data: s }, { data: others }, specialties] = await Promise.all([
    supabase.from("services").select("*").eq("id", serviceId).eq("branch_id", branchId).maybeSingle(),
    supabase.from("services").select("prefix").eq("branch_id", branchId).neq("id", serviceId),
    listSpecialties(orgId),
  ]);
  if (!s) notFound();
  return (
    <AdminPage title={s.name} eyebrow={t("editTitle")} back={{ href: `/app/o/${orgId}/branches/${branchId}/services`, label: t("title") }}>
      <ReadOnlyNotice show={!canManage} />
      <ServiceForm
        action={saveService.bind(null, orgId, branchId, serviceId)}
        takenPrefixes={(others ?? []).map((o) => o.prefix)}
        specialties={specialties}
        disabled={!canManage}
        initial={{
          name: s.name,
          nameEn: s.name_en,
          prefix: s.prefix,
          color: s.color,
          minutes: Math.round(s.default_service_seconds / 60),
          maxDailyTickets: s.max_daily_tickets,
          specialtyId: s.specialty_id,
          description: s.description,
          allowPriority: s.allow_priority,
          allowRemote: s.allow_remote,
          active: s.active,
        }}
      />
      {canManage ? (
        <ConfirmAction
          action={deleteService.bind(null, orgId, branchId, serviceId)}
          label={ta("delete")}
          title={t("deleteConfirmTitle")}
          body={t("deleteConfirmBody")}
          confirmLabel={ta("delete")}
          icon={<Trash2 aria-hidden className="size-5" />}
        />
      ) : null}
    </AdminPage>
  );
}
