import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";
import { formatTicketCode } from "@nextin/shared";
import { MasterDetail, SavedFromQuery, SplitRow } from "@/components/admin/master-detail";
import { SplitListPane } from "@/components/admin/split-pane";
import { Badge } from "@/components/ui/badge";
import { Button, IconLink } from "@/components/ui/button";
import { ListSection } from "@/components/ui/list";
import { ServiceTile } from "@/components/ui/service-tile";
import { getBranch } from "@/lib/admin/branch";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/** Services d'une agence : liste à gauche, édition à droite sans changer de page (maître-détail). */
export default async function ServicesLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgId: string; branchId: string }>;
}) {
  const { orgId, branchId } = await params;
  const { branch, canManage } = await getBranch(orgId, branchId);
  const t = await getTranslations("services");
  const ta = await getTranslations("admin");
  const supabase = await getSupabaseServerClient();
  const { data: services } = await supabase
    .from("services")
    .select("id, name, prefix, color, default_service_seconds, active")
    .eq("branch_id", branchId)
    .order("sort_order")
    .order("prefix");
  const base = `/app/o/${orgId}/branches/${branchId}`;

  const list = (
    <SplitListPane
      title={t("title")}
      subtitle={t("subtitle")}
      eyebrow={branch.name}
      back={{ href: base, label: branch.name }}
      trailing={canManage && services?.length ? <IconLink href={`${base}/services/new`} label={t("new")} icon={<Plus />} /> : null}
    >
      <SavedFromQuery message={ta("saved")} />
      {services?.length ? (
        <ListSection>
          {services.map((s) => (
            <SplitRow
              key={s.id}
              segment={s.id}
              href={`${base}/services/${s.id}`}
              icon={<ServiceTile letter={s.prefix} color={s.color} />}
              title={s.name}
              subtitle={`${formatTicketCode(s.prefix, 1)} · ${t("minutes", { count: Math.round(s.default_service_seconds / 60) })}`}
              accessory={s.active ? "chevron" : <Badge>{ta("inactive")}</Badge>}
            />
          ))}
        </ListSection>
      ) : (
        <>
          <p className="rounded-[var(--radius-xl)] bg-grouped-secondary px-5 py-8 text-center text-body text-label-secondary">{t("empty")}</p>
          {canManage ? (
            <Button asChild block>
              <Link href={`${base}/services/new`}>
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
