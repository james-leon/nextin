import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { UserMinus, UserRoundCheck, UserRoundX } from "lucide-react";
import { canAssignRole } from "@nextin/shared";
import { AdminPage } from "@/components/admin/admin-page";
import { ConfirmAction } from "@/components/admin/confirm-action";
import { MembershipForm } from "@/components/admin/membership-form";
import { manageableBranches } from "@/lib/admin/branches";
import { getOrgContext } from "@/lib/admin/context";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { removeMembership, setMembershipActive, updateMembership } from "../../_actions/people";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("staffMgmt");
  return { title: t("editTitle") };
}

export default async function MemberPage({ params }: { params: Promise<{ orgId: string; membershipId: string }> }) {
  const { orgId, membershipId } = await params;
  const ctx = await getOrgContext(orgId);
  if (!ctx.canManageStaff) notFound();
  const supabase = await getSupabaseServerClient();
  const [{ data: members }, branches] = await Promise.all([supabase.rpc("list_org_members", { p_org: orgId }), manageableBranches(ctx)]);
  const m = members?.find((x) => x.membership_id === membershipId);
  const actorRole = ctx.canManageOrg ? "org_admin" : "branch_manager";
  // Ni soi-même, ni un membre de rang égal ou supérieur (pour un responsable d'agence).
  if (!m || m.user_id === ctx.session.userId || !canAssignRole(actorRole, m.role)) notFound();
  const t = await getTranslations("staffMgmt");
  const tr = await getTranslations("roles");
  return (
    <AdminPage title={m.full_name || m.email} subtitle={[tr(m.role), m.full_name ? m.email : null].filter(Boolean).join(" · ")} back={{ href: `/app/o/${orgId}/staff`, label: t("title") }}>
      <MembershipForm action={updateMembership.bind(null, orgId, membershipId)} actorRole={actorRole} initial={{ role: m.role, branchId: m.branch_id }} branches={branches} />
      <div className="flex flex-col gap-1">
        <ConfirmAction
          action={setMembershipActive.bind(null, orgId, membershipId, !m.active)}
          label={m.active ? t("deactivate") : t("reactivate")}
          title={m.active ? t("deactivate") : t("reactivate")}
          body={m.full_name || m.email}
          confirmLabel={m.active ? t("deactivate") : t("reactivate")}
          destructive={m.active}
          variant={m.active ? "destructive-plain" : "plain"}
          icon={m.active ? <UserRoundX aria-hidden className="size-5" /> : <UserRoundCheck aria-hidden className="size-5" />}
        />
        <ConfirmAction
          action={removeMembership.bind(null, orgId, membershipId)}
          label={t("remove")}
          title={t("removeConfirmTitle")}
          body={t("removeConfirmBody")}
          confirmLabel={t("remove")}
          icon={<UserMinus aria-hidden className="size-5" />}
        />
      </div>
    </AdminPage>
  );
}
