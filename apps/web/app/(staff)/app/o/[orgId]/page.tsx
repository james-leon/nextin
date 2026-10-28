import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChevronRight, ListChecks } from "lucide-react";
import { localDate } from "@nextin/shared/appointments";
import { comparisonRange, periodRange } from "@nextin/shared/stats";
import { AdminPage } from "@/components/admin/admin-page";
import { MobileOrgNav, SetupOverview, setupSteps } from "@/components/admin/setup-overview";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { CalloutCard } from "@/components/ui/callout-card";
import { getOrgContext } from "@/lib/admin/context";
import type { DashboardData, DashboardQuery } from "@/lib/stats/dashboard";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("overview");
  return { title: t("title") };
}

/**
 * Vue d'ensemble : tableau de bord (maquette 06) pour les administrateurs et les responsables d'agence ;
 * sinon, compteurs et étapes de démarrage.
 */
export default async function OrgOverview({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const ctx = await getOrgContext(orgId);
  const t = await getTranslations("overview");
  const td = await getTranslations("dashboard");
  const ta = await getTranslations("admin");
  const supabase = await getSupabaseServerClient();

  const { data: rows } = await supabase
    .from("branches")
    .select("id, name, timezone")
    .eq("organization_id", orgId)
    .eq("active", true)
    .order("sort_order")
    .order("name");
  const branches = (rows ?? []).filter((b) => ctx.canManageOrg || ctx.managedBranchIds.includes(b.id));

  if (!branches.length) {
    return (
      <AdminPage title={t("title")} eyebrow={ctx.org.name} back={{ href: "/app", label: ta("nav.organizations") }}>
        <SetupOverview orgId={orgId} />
        <MobileOrgNav orgId={orgId} />
      </AdminPage>
    );
  }

  const today = localDate(new Date(), branches[0]!.timezone);
  const query: DashboardQuery = { branchId: ctx.canManageOrg ? null : branches[0]!.id, period: "day", anchor: today };
  const range = periodRange(query.period, today);
  const compare = comparisonRange(query.period, range, today);
  const [{ data }, setup] = await Promise.all([
    supabase.rpc("dashboard_stats", {
      p_org: orgId,
      p_branch: (query.branchId ?? null) as string,
      p_from: range.from,
      p_to: range.to,
      p_compare_from: compare.from,
      p_compare_to: compare.to,
    }),
    ctx.canManageOrg ? setupSteps(orgId) : Promise.resolve(null),
  ]);
  if (!data) {
    return (
      <AdminPage title={t("title")} eyebrow={ctx.org.name}>
        <CalloutCard icon={<ListChecks />}>{td("notAllowed")}</CalloutCard>
        <MobileOrgNav orgId={orgId} />
      </AdminPage>
    );
  }

  return (
    <>
      <DashboardView
        org={{ id: orgId, name: ctx.org.name }}
        branches={branches.map((b) => ({ id: b.id, name: b.name }))}
        canViewAll={ctx.canManageOrg}
        today={today}
        initialQuery={query}
        initialData={data as unknown as DashboardData}
      />
      <div className="flex flex-col gap-5 px-4 lg:px-8">
        {setup && !setup.complete ? (
          <Link href={`/app/o/${orgId}/setup`} className="pressable block rounded-[var(--radius-lg)]">
            <CalloutCard icon={<ListChecks />} tone="accent">
              <span className="flex items-center gap-2">
                <span className="flex-1">
                  <strong className="font-semibold">{td("setup", { done: setup.done, total: setup.total })}.</strong> {td("setupBody")}
                </span>
                <ChevronRight aria-hidden className="size-5 shrink-0" />
              </span>
            </CalloutCard>
          </Link>
        ) : null}
        <MobileOrgNav orgId={orgId} />
      </div>
    </>
  );
}
