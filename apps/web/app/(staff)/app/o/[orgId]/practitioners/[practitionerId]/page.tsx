import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { CalendarClock, Trash2 } from "lucide-react";
import { AdminPage } from "@/components/admin/admin-page";
import { ConfirmAction } from "@/components/admin/confirm-action";
import { PractitionerForm } from "@/components/admin/practitioner-form";
import { ReadOnlyNotice } from "@/components/admin/read-only-notice";
import { ListIcon, ListRow, ListSection } from "@/components/ui/list";
import { manageableBranches } from "@/lib/admin/branches";
import { getOrgContext } from "@/lib/admin/context";
import { listSpecialties } from "@/lib/admin/specialties";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { deletePractitioner, savePractitioner } from "../../_actions/people";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("practitioners");
  return { title: t("editTitle") };
}

export default async function EditPractitionerPage({ params }: { params: Promise<{ orgId: string; practitionerId: string }> }) {
  const { orgId, practitionerId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(practitionerId)) notFound();
  const ctx = await getOrgContext(orgId);
  const supabase = await getSupabaseServerClient();
  const [{ data: p }, branches, specialties] = await Promise.all([
    supabase.from("practitioners").select("*, branch:branches(id, name)").eq("id", practitionerId).eq("organization_id", orgId).maybeSingle(),
    manageableBranches(ctx),
    listSpecialties(orgId),
  ]);
  if (!p) notFound();
  const canManage = ctx.canManageBranch(p.branch_id);
  const t = await getTranslations("practitioners");
  const ta = await getTranslations("admin");
  const ts = await getTranslations("schedule");
  const branchOptions = canManage ? branches : p.branch ? [p.branch] : [];
  return (
    <AdminPage inSplit title={[p.title, p.display_name].filter(Boolean).join(" ")} eyebrow={t("editTitle")} back={{ href: `/app/o/${orgId}/practitioners`, label: t("title") }}>
      <ReadOnlyNotice show={!canManage} />
      <ListSection>
        <ListRow
          href={`/app/o/${orgId}/practitioners/${practitionerId}/schedule`}
          icon={
            <ListIcon>
              <CalendarClock />
            </ListIcon>
          }
          title={ts("open")}
          accessory="chevron"
        />
      </ListSection>
      <PractitionerForm
        action={savePractitioner.bind(null, orgId, practitionerId)}
        specialties={specialties}
        branches={branchOptions}
        disabled={!canManage}
        initial={{ title: p.title, displayName: p.display_name, specialtyId: p.specialty_id, branchId: p.branch_id, active: p.active }}
      />
      {canManage ? (
        <ConfirmAction
          action={deletePractitioner.bind(null, orgId, practitionerId)}
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
