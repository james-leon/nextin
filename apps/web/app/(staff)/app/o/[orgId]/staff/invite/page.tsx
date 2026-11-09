import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AdminPage } from "@/components/admin/admin-page";
import { InviteForm } from "@/components/admin/invite-form";
import { manageableBranches } from "@/lib/admin/branches";
import { getOrgContext } from "@/lib/admin/context";
import { inviteMember } from "../../_actions/people";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("staffMgmt");
  return { title: t("inviteTitle") };
}

export default async function InvitePage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const ctx = await getOrgContext(orgId);
  if (!ctx.canManageStaff) notFound();
  const t = await getTranslations("staffMgmt");
  const branches = await manageableBranches(ctx);
  return (
    <AdminPage narrow title={t("inviteTitle")} eyebrow={ctx.org.name} back={{ href: `/app/o/${orgId}/staff`, label: t("title") }}>
      <InviteForm
        action={inviteMember.bind(null, orgId)}
        actorRole={ctx.canManageOrg ? "org_admin" : "branch_manager"}
        branches={branches}
        orgName={ctx.org.name}
        doneHref={`/app/o/${orgId}/staff`}
      />
    </AdminPage>
  );
}
