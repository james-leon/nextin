import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Trash2 } from "lucide-react";
import { AdminPage } from "@/components/admin/admin-page";
import { ConfirmAction } from "@/components/admin/confirm-action";
import { SpecialtyForm } from "@/components/admin/specialty-form";
import { ListSection } from "@/components/ui/list";
import { getOrgContext } from "@/lib/admin/context";
import { listSpecialties } from "@/lib/admin/specialties";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { createSpecialty, deleteSpecialty } from "../../_actions/people";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("practitioners");
  return { title: t("specialties") };
}

/** Spécialités (maquette v2 18) : nom en français et en anglais, nombre de praticiens ; ajout et suppression. */
export default async function SpecialtiesPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const ctx = await getOrgContext(orgId);
  const t = await getTranslations("practitioners");
  const ta = await getTranslations("admin");
  const supabase = await getSupabaseServerClient();
  const [specialties, { data: practitioners }] = await Promise.all([
    listSpecialties(orgId),
    supabase.from("practitioners").select("specialty_id").eq("organization_id", orgId),
  ]);
  const count = (id: string) => (practitioners ?? []).filter((p) => p.specialty_id === id).length;
  return (
    <AdminPage inSplit title={t("specialties")} eyebrow={ctx.org.name} back={{ href: `/app/o/${orgId}/practitioners`, label: t("title") }}>
      <ListSection footer={t("specialtiesHint")}>
        {specialties.length ? (
          specialties.map((s) => (
            <li key={s.id} className="group/row pl-4">
              <span className="list-separator flex min-h-11 items-center justify-between gap-3 py-2 pr-2">
                <span className="flex min-w-0 flex-col">
                  <span className="text-body">{s.name}</span>
                  <span className="text-footnote text-label-secondary">
                    {s.name_en ? <span lang="en">{s.name_en} · </span> : null}
                    {t("practitionersCount", { count: count(s.id) })}
                  </span>
                </span>
                {ctx.canManageOrg ? (
                  <ConfirmAction
                    action={deleteSpecialty.bind(null, orgId, s.id)}
                    label={ta("delete")}
                    title={t("deleteSpecialtyTitle")}
                    body={t("deleteSpecialtyBody")}
                    confirmLabel={ta("delete")}
                    block={false}
                    size="md"
                    icon={<Trash2 aria-hidden className="size-4" />}
                  />
                ) : null}
              </span>
            </li>
          ))
        ) : (
          <li className="px-4 py-3 text-body text-label-secondary">{t("noSpecialties")}</li>
        )}
      </ListSection>
      {ctx.canManageOrg ? <SpecialtyForm action={createSpecialty.bind(null, orgId)} /> : null}
    </AdminPage>
  );
}
