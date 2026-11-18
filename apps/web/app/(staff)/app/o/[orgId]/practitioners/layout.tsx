import { EmptyState } from "@/components/ui/empty-state";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { Bookmark, Plus, Stethoscope } from "lucide-react";
import { MasterDetail, SavedFromQuery, SplitRow } from "@/components/admin/master-detail";
import { StatCard, StatGroup } from "@/components/ui/stat-card";
import { initialsOf } from "@/lib/text/initials";
import { SplitListPane } from "@/components/admin/split-pane";
import { Badge } from "@/components/ui/badge";
import { Button, IconLink } from "@/components/ui/button";
import { ListIcon, ListSection } from "@/components/ui/list";
import { getOrgContext } from "@/lib/admin/context";
import { listSpecialties } from "@/lib/admin/specialties";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Praticiens : liste (et spécialités) à gauche, fiche à droite sans changer de page (maître-détail).
 * Les horaires d'un praticien (`/<id>/schedule`) s'ouvrent en pleine largeur.
 */
export default async function PractitionersLayout({ children, params }: { children: React.ReactNode; params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
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

  // Congé en cours (maquette v2 18 : « En congé jusqu'au 22 nov. » en orange dans la liste).
  const today = new Date().toISOString().slice(0, 10);
  const { data: leaves } = await supabase
    .from("practitioner_leaves")
    .select("practitioner_id, ends_on")
    .eq("organization_id", orgId)
    .lte("starts_on", today)
    .gte("ends_on", today);
  const onLeave = new Map((leaves ?? []).map((l) => [l.practitioner_id, l.ends_on]));
  const format = await getFormatter();
  const all = practitioners ?? [];
  const groups = new Map<string, typeof all>();
  for (const p of all) {
    const key = p.specialty?.name ?? "";
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  const ordered = [...groups.entries()].sort(([a], [b]) => (a ? (b ? a.localeCompare(b) : -1) : 1));

  const list = (
    <SplitListPane
      title={t("title")}
      eyebrow={ctx.org.name}
      back={{ href: `/app/o/${orgId}`, label: ta("nav.overview") }}
      trailing={canCreate && all.length ? <IconLink href={`/app/o/${orgId}/practitioners/new`} label={t("new")} icon={<Plus />} /> : null}
    >
      <SavedFromQuery message={ta("saved")} />
      {all.length ? (
        <>
          <StatGroup className="lg:grid-cols-3">
            <StatCard label={t("statTotal")} value={all.length} className="px-4 py-3" />
            <StatCard label={t("statActive")} value={all.filter((p) => p.active).length} className="px-4 py-3" />
            <StatCard label={t("statSpecialties")} value={specialties.length} className="px-4 py-3" />
          </StatGroup>
          {/* Regroupés par spécialité (maquette v2 18), sans spécialité en dernier. */}
          {ordered.map(([name, group]) => (
            <ListSection key={name || "none"} header={name || t("noSpecialty")}>
              {group.map((p) => {
                const full = [p.title, p.display_name].filter(Boolean).join(" ");
                const leave = onLeave.get(p.id);
                return (
                  <SplitRow
                    key={p.id}
                    segment={p.id}
                    href={`/app/o/${orgId}/practitioners/${p.id}`}
                    icon={
                      <span
                        aria-hidden
                        className={`flex size-9 shrink-0 items-center justify-center rounded-full text-footnote font-semibold ${p.active ? "bg-accent text-white" : "bg-fill-secondary text-label"}`}
                      >
                        {initialsOf(full)}
                      </span>
                    }
                    title={full}
                    subtitle={
                      leave ? (
                        <span className="text-orange-text">{t("onLeaveUntil", { date: format.dateTime(new Date(`${leave}T12:00:00`), { day: "numeric", month: "short" }) })}</span>
                      ) : (
                        p.branch?.name ?? undefined
                      )
                    }
                    accessory={p.active ? "chevron" : <Badge>{ta("inactive")}</Badge>}
                  />
                );
              })}
            </ListSection>
          ))}
        </>
      ) : (
        <>
          <EmptyState title={t("empty")} icon={<Stethoscope />} />
          {canCreate ? (
            <Button asChild block>
              <Link href={`/app/o/${orgId}/practitioners/new`}>
                <Plus aria-hidden className="size-5" />
                {t("new")}
              </Link>
            </Button>
          ) : null}
        </>
      )}
      <ListSection>
        <SplitRow
          segment="specialties"
          href={`/app/o/${orgId}/practitioners/specialties`}
          icon={
            <ListIcon color="var(--icon-indigo)">
              <Bookmark />
            </ListIcon>
          }
          title={t("specialties")}
          detail={<span className="tabular">{specialties.length}</span>}
          accessory="chevron"
        />
      </ListSection>
    </SplitListPane>
  );

  return <MasterDetail list={list}>{children}</MasterDetail>;
}
