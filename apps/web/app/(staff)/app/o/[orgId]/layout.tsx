import { billingBanner } from "@nextin/shared/billing";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { BillingBanner } from "@/components/billing/billing-banner";
import { SuspendedGate } from "@/components/billing/suspended-gate";
import { getOrgContext } from "@/lib/admin/context";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/** Back-office d'un établissement : barre latérale (grand écran), bandeau d'abonnement, contenu. */
export default async function OrgLayout({ children, params }: { children: React.ReactNode; params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const ctx = await getOrgContext(orgId);
  const supabase = await getSupabaseServerClient();
  // Tout le personnel voit le statut de l'abonnement (RLS) ; aucun abonnement : établissement pilote.
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("status, trial_ends_at, grace_ends_at")
    .eq("organization_id", orgId)
    .maybeSingle();
  const banner = billingBanner(
    sub ? { status: sub.status, trialEndsAt: sub.trial_ends_at, graceEndsAt: sub.grace_ends_at } : null,
    new Date(),
  );
  const suspended =
    ctx.org.status !== "suspended" ? null : sub?.status === "suspended" ? "subscription" : "moderation";
  return (
    <div className="flex min-h-dvh lg:[--shell-sidebar:16rem]">
      <AdminSidebar orgId={ctx.org.id} orgName={ctx.org.name} canManageOrg={ctx.canManageOrg} isPlatformAdmin={ctx.session.isPlatformAdmin} />
      <main className="min-w-0 flex-1 pb-36">
        <BillingBanner banner={banner} orgId={orgId} canPay={ctx.canManageOrg} />
        <SuspendedGate orgId={orgId} reason={ctx.session.isPlatformAdmin ? null : suspended} canPay={ctx.canManageOrg}>
          {children}
        </SuspendedGate>
      </main>
    </div>
  );
}
