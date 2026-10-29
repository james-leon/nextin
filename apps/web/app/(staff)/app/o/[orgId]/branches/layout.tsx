import { getTranslations } from "next-intl/server";
import { Building2, Plus } from "lucide-react";
import { MasterDetail, SavedFromQuery, SplitRow } from "@/components/admin/master-detail";
import { SplitListPane } from "@/components/admin/split-pane";
import { Button, IconLink } from "@/components/ui/button";
import { ListIcon, ListSection } from "@/components/ui/list";
import { getOrgContext } from "@/lib/admin/context";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import Link from "next/link";

/** Agences et services : liste des agences à gauche, fiche de l'agence à droite (maître-détail, revue responsive). */
export default async function BranchesLayout({ children, params }: { children: React.ReactNode; params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const ctx = await getOrgContext(orgId);
  const t = await getTranslations("branches");
  const ta = await getTranslations("admin");
  const supabase = await getSupabaseServerClient();
  const { data: branches } = await supabase
    .from("branches")
    .select("id, name, city, services(count), counters(count)")
    .eq("organization_id", orgId)
    .order("sort_order");

  const list = (
    <SplitListPane
      title={t("title")}
      subtitle={t("subtitle")}
      eyebrow={ctx.org.name}
      back={{ href: `/app/o/${orgId}`, label: ta("nav.overview") }}
      trailing={ctx.canManageOrg && branches?.length ? <IconLink href={`/app/o/${orgId}/branches/new`} label={t("new")} icon={<Plus />} /> : null}
    >
      <SavedFromQuery message={ta("saved")} />
      {branches?.length ? (
        <ListSection>
          {branches.map((b) => (
            <SplitRow
              key={b.id}
              segment={b.id}
              href={`/app/o/${orgId}/branches/${b.id}`}
              icon={
                <ListIcon color="var(--brand-tile)">
                  <Building2 />
                </ListIcon>
              }
              title={<span className="font-semibold">{b.name}</span>}
              subtitle={[b.city, t("servicesCount", { count: b.services[0]?.count ?? 0 }), t("countersCount", { count: b.counters[0]?.count ?? 0 })]
                .filter(Boolean)
                .join(" · ")}
              accessory="chevron"
            />
          ))}
        </ListSection>
      ) : (
        <>
          <p className="rounded-[var(--radius-xl)] bg-grouped-secondary px-5 py-8 text-center text-body text-label-secondary">{t("empty")}</p>
          {ctx.canManageOrg ? (
            <Button asChild block>
              <Link href={`/app/o/${orgId}/branches/new`}>
                <Plus aria-hidden className="size-5" />
                {t("new")}
              </Link>
            </Button>
          ) : null}
        </>
      )}
    </SplitListPane>
  );

  return <MasterDetail list={list}>{children}</MasterDetail>;
}
