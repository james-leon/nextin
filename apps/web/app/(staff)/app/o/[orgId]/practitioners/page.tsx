import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Plus, Stethoscope, Trash2 } from "lucide-react";
import { AdminPage } from "@/components/admin/admin-page";
import { ConfirmAction } from "@/components/admin/confirm-action";
import { SavedNotice } from "@/components/admin/saved-notice";
import { SpecialtyForm } from "@/components/admin/specialty-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ListIcon, ListRow, ListSection } from "@/components/ui/list";
import { getOrgContext } from "@/lib/admin/context";
import { listSpecialties } from "@/lib/admin/specialties";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { createSpecialty, deleteSpecialty } from "../_actions/people";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("practitioners");
  return { title: t("title") };
}

export default async function PractitionersPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { orgId } = await params;
  const { saved } = await searchParams;
  const ctx = await getOrgContext(orgId);
  const t = await getTranslations("practitioners");
  const ta = await getTranslations("admin");
  const supabase = await getSupabaseServerClient();
  const [specialties, { data: practitioners }] = await Promise.all([
    listSpecialties(orgId),
    supabase
      .from("practitioners")
      .select("id, title, display_name, active, branch_id, specialty:specialties(name), branch:branches(name)")
      .eq("organization_id", orgId)
      .order("display_name"),
  ]);
  const canCreate = ctx.canManageOrg || ctx.managedBranchIds.length > 0;

  return (
    <AdminPage title={t("title")} subtitle={t("subtitle")} eyebrow={ctx.org.name} back={{ href: `/app/o/${orgId}`, label: ta("nav.overview") }}>
      <SavedNotice show={!!saved} />
      {practitioners?.length ? (
        <ListSection>
          {practitioners.map((p) => (
            <ListRow
              key={p.id}
              href={`/app/o/${orgId}/practitioners/${p.id}`}
              icon={
                <ListIcon color="var(--accent-fill)">
                  <Stethoscope />
                </ListIcon>
              }
              title={[p.title, p.display_name].filter(Boolean).join(" ")}
              subtitle={[p.specialty?.name, p.branch?.name].filter(Boolean).join(" · ") || undefined}
              accessory={p.active ? "chevron" : <Badge>{ta("inactive")}</Badge>}
            />
          ))}
        </ListSection>
      ) : (
        <p className="rounded-[var(--radius-xl)] bg-grouped-secondary px-5 py-8 text-center text-body text-label-secondary">{t("empty")}</p>
      )}
      {canCreate ? (
        <Button asChild block variant={practitioners?.length ? "tinted" : "filled"}>
          <Link href={`/app/o/${orgId}/practitioners/new`}>
            <Plus aria-hidden className="size-5" />
            {t("new")}
          </Link>
        </Button>
      ) : null}

      <section aria-labelledby="specialties-title" className="flex flex-col gap-3">
        <h2 id="specialties-title" className="px-1 text-title3 font-semibold">
          {t("specialties")}
        </h2>
        <ListSection footer={t("specialtiesHint")}>
          {specialties.length ? (
            specialties.map((s) => (
              <li key={s.id} className="group/row pl-4">
                <span className="list-separator flex min-h-11 items-center justify-between gap-3 py-1 pr-2">
                  <span className="text-body">
                    {s.name}
                    {s.name_en ? <span className="text-label-secondary" lang="en">{` · ${s.name_en}`}</span> : null}
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
      </section>
    </AdminPage>
  );
}
