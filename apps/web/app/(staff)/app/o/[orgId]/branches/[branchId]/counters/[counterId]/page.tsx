import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Trash2 } from "lucide-react";
import { AdminPage } from "@/components/admin/admin-page";
import { ConfirmAction } from "@/components/admin/confirm-action";
import { CounterForm } from "@/components/admin/counter-form";
import { ReadOnlyNotice } from "@/components/admin/read-only-notice";
import { getBranch } from "@/lib/admin/branch";
import { counterFormData } from "@/lib/admin/counters";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { deleteCounter, saveCounter } from "../../../../_actions/structure";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("counters");
  return { title: t("editTitle") };
}

export default async function EditCounterPage({ params }: { params: Promise<{ orgId: string; branchId: string; counterId: string }> }) {
  const { orgId, branchId, counterId } = await params;
  const { canManage } = await getBranch(orgId, branchId);
  if (!/^[0-9a-f-]{36}$/i.test(counterId)) notFound();
  const t = await getTranslations("counters");
  const tk = await getTranslations("counterKinds");
  const ta = await getTranslations("admin");
  const supabase = await getSupabaseServerClient();
  const [{ data: c }, data] = await Promise.all([
    supabase.from("counters").select("*, counter_services(service_id)").eq("id", counterId).eq("branch_id", branchId).maybeSingle(),
    counterFormData(branchId, counterId),
  ]);
  if (!c) notFound();
  return (
    <AdminPage title={`${tk(c.kind)} ${c.number}`} eyebrow={t("editTitle")} back={{ href: `/app/o/${orgId}/branches/${branchId}/counters`, label: t("title") }}>
      <ReadOnlyNotice show={!canManage} />
      <CounterForm
        action={saveCounter.bind(null, orgId, branchId, counterId)}
        {...data}
        disabled={!canManage}
        initial={{
          kind: c.kind,
          number: c.number,
          label: c.label,
          defaultPractitionerId: c.default_practitioner_id,
          serviceIds: c.counter_services.map((cs) => cs.service_id),
          active: c.active,
        }}
      />
      {canManage ? (
        <ConfirmAction
          action={deleteCounter.bind(null, orgId, branchId, counterId)}
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
