import { getLocale, getTranslations } from "next-intl/server";
import { billingBanner } from "@nextin/shared/billing";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { BillingBanner } from "@/components/billing/billing-banner";
import { QuotaBanner } from "@/components/billing/quota-banner";
import { SuspendedGate } from "@/components/billing/suspended-gate";
import { SidebarShell } from "@/components/shell/sidebar-shell";
import { getOrgContext } from "@/lib/admin/context";
import type { QuotaStatus } from "@/lib/billing/types";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/** Back-office d'un établissement : barre latérale (repliable sur tablette portrait), bandeau d'abonnement, contenu. */
export default async function OrgLayout({ children, params }: { children: React.ReactNode; params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const ctx = await getOrgContext(orgId);
  const supabase = await getSupabaseServerClient();
  // Tout le personnel voit le statut de l'abonnement (RLS) ; aucun abonnement : établissement pilote.
  const [{ data: sub }, { data: quota }, { data: settings }, { count: branchCount }] = await Promise.all([
    supabase.from("subscriptions").select("status, trial_ends_at, grace_ends_at, plans!subscriptions_plan_id_fkey(name, name_en)").eq("organization_id", orgId).maybeSingle(),
    // Consommation du mois : alerte à 80 %, limite atteinte, blocage du lendemain (tout le personnel).
    supabase.rpc("staff_quota_status", { p_org: orgId }),
    supabase.from("platform_settings").select("quota_alert_percent").maybeSingle(),
    // Carte de l'établissement en tête de la barre latérale : « 2 agences · Business » (agences visibles sous RLS).
    supabase.from("branches").select("id", { count: "exact", head: true }).eq("organization_id", orgId),
  ]);
  const banner = billingBanner(
    sub ? { status: sub.status, trialEndsAt: sub.trial_ends_at, graceEndsAt: sub.grace_ends_at } : null,
    new Date(),
  );
  const suspended =
    ctx.org.status !== "suspended" ? null : sub?.status === "suspended" ? "subscription" : "moderation";
  const t = await getTranslations("common");
  const ta = await getTranslations("admin");
  const tr = await getTranslations("roles");
  const locale = await getLocale();
  const plan = sub?.plans as { name: string; name_en: string | null } | null | undefined;
  const planName = plan ? (locale === "en" ? (plan.name_en ?? plan.name) : plan.name) : ta("sidebar.pilot");
  const orgSummary = `${ta("sidebar.branches", { count: branchCount ?? 0 })} · ${planName}`;
  const user = {
    name: ctx.session.fullName ?? ctx.session.email ?? "",
    role: ctx.session.isPlatformAdmin && !ctx.role ? ta("nav.platform") : ctx.role ? tr(ctx.role) : "",
  };
  return (
    <SidebarShell
      labels={{ open: t("sidebarShow"), close: t("sidebarHide") }}
      sidebar={
        <AdminSidebar
          orgId={ctx.org.id}
          orgName={ctx.org.name}
          orgSummary={orgSummary}
          user={user}
          canManageOrg={ctx.canManageOrg}
          isPlatformAdmin={ctx.session.isPlatformAdmin}
        />
      }
    >
      <BillingBanner banner={banner} orgId={orgId} canPay={ctx.canManageOrg} />
      <QuotaBanner
        quota={(quota as unknown as QuotaStatus | null) ?? null}
        alertPercent={settings?.quota_alert_percent ?? 80}
        orgId={orgId}
        canManage={ctx.canManageOrg}
      />
      <SuspendedGate orgId={orgId} reason={ctx.session.isPlatformAdmin ? null : suspended} canPay={ctx.canManageOrg}>
        {children}
      </SuspendedGate>
    </SidebarShell>
  );
}
