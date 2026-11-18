import { EmptyState } from "@/components/ui/empty-state";
import { getTranslations } from "next-intl/server";
import { Building2, Plus } from "lucide-react";
import { MasterDetail, SavedFromQuery, SplitRow } from "@/components/admin/master-detail";
import { SplitListPane } from "@/components/admin/split-pane";
import { Button, IconLink } from "@/components/ui/button";
import { ListSection } from "@/components/ui/list";
import { Badge } from "@/components/ui/badge";
import { OrgTypeIcon } from "@/components/ui/org-type-icon";
import { StatCard, StatGroup } from "@/components/ui/stat-card";
import { FilterList } from "@/components/admin/filter-list";
import { openingStatus } from "@nextin/shared";
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
    .select("id, name, city, timezone, photo_updated_at, services(count), counters(count), opening_hours(weekday, opens_at, closes_at)")
    .eq("organization_id", orgId)
    .order("sort_order");

  const now = new Date();
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
        <>
          {/* Maquette v2 17 : trois chiffres de l'établissement, recherche, puis une ligne par agence (vignette et état). */}
          <StatGroup className="lg:grid-cols-3">
            <StatCard label={t("statBranches")} value={branches.length} className="px-4 py-3" />
            <StatCard label={t("statServices")} value={branches.reduce((n, b) => n + (b.services[0]?.count ?? 0), 0)} className="px-4 py-3" />
            <StatCard label={t("statCounters")} value={branches.reduce((n, b) => n + (b.counters[0]?.count ?? 0), 0)} className="px-4 py-3" />
          </StatGroup>
          <FilterList
            label={t("searchPlaceholder")}
            clearLabel={t("searchClear")}
            texts={branches.map((b) => `${b.name} ${b.city ?? ""}`)}
            empty={<EmptyState title={t("noMatch")} icon={<Building2 />} />}
          >
            {[
              <ListSection key="list">
                {branches.map((b) => {
                  const open = openingStatus(b.opening_hours ?? [], now, b.timezone).open;
                  const photo = b.photo_updated_at
                    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/branch-photos/${orgId}/${b.id}/thumb.webp?v=${new Date(b.photo_updated_at).getTime()}`
                    : null;
                  return (
                    <SplitRow
                      key={b.id}
                      segment={b.id}
                      href={`/app/o/${orgId}/branches/${b.id}`}
                      icon={
                        photo ? (
                          // eslint-disable-next-line @next/next/no-img-element -- vignette publique déjà recadrée (carrée)
                          <img src={photo} alt="" className="squircle size-10 shrink-0 rounded-[8px] object-cover" />
                        ) : (
                          <span aria-hidden className="squircle flex size-10 shrink-0 items-center justify-center rounded-[8px] bg-accent-tint text-accent-on-tint [&_svg]:size-5 [&_svg]:stroke-[1.75]">
                            <OrgTypeIcon type={ctx.org.type} />
                          </span>
                        )
                      }
                      title={<span className="font-semibold">{b.name}</span>}
                      subtitle={[t("servicesCount", { count: b.services[0]?.count ?? 0 }), t("countersCount", { count: b.counters[0]?.count ?? 0 })].join(" · ")}
                      accessory={
                        <Badge shape="pill" tone={open ? "green" : "neutral"}>
                          {open ? t("openNow") : t("closedNow")}
                        </Badge>
                      }
                    />
                  );
                })}
              </ListSection>,
            ]}
          </FilterList>
        </>
      ) : (
        <>
          <EmptyState title={t("empty")} icon={<Building2 />} />
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
