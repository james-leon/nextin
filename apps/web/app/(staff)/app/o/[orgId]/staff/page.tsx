import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { UsersRound } from "lucide-react";
import { SplitPlaceholder } from "@/components/admin/split-pane";
import { getOrgContext } from "@/lib/admin/context";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("staffMgmt");
  return { title: t("title") };
}

/** Panneau de détail sans membre choisi (tablette et ordinateur) ; la liste est dans le gabarit (maquette v2 18). */
export default async function StaffPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const ctx = await getOrgContext(orgId);
  const t = await getTranslations("staffMgmt");
  const supabase = await getSupabaseServerClient();
  const [{ data: members }, { count: invitations }] = await Promise.all([
    supabase.rpc("list_org_members", { p_org: orgId }),
    ctx.canManageStaff
      ? supabase.from("invitations").select("id", { count: "exact", head: true }).eq("organization_id", orgId).is("accepted_at", null)
      : Promise.resolve({ count: 0 }),
  ]);
  const all = members ?? [];
  return (
    <SplitPlaceholder
      icon={<UsersRound />}
      title={t("pickTitle")}
      text={t("pickText")}
      stats={[
        { label: t("statMembers"), value: all.length },
        { label: t("statActive"), value: all.filter((m) => m.active).length },
        { label: t("statInvitations"), value: invitations ?? 0 },
      ]}
    />
  );
}
