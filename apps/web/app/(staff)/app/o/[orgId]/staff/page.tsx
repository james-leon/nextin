import type { Metadata } from "next";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { UserPlus, UserRound, X } from "lucide-react";
import { AdminPage } from "@/components/admin/admin-page";
import { ConfirmAction } from "@/components/admin/confirm-action";
import { SavedNotice } from "@/components/admin/saved-notice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ListIcon, ListRow, ListSection } from "@/components/ui/list";
import { getOrgContext } from "@/lib/admin/context";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { revokeInvitation } from "../_actions/people";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("staffMgmt");
  return { title: t("title") };
}

export default async function StaffPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { orgId } = await params;
  const { saved } = await searchParams;
  const ctx = await getOrgContext(orgId);
  const t = await getTranslations("staffMgmt");
  const tr = await getTranslations("roles");
  const ta = await getTranslations("admin");
  const format = await getFormatter();
  const supabase = await getSupabaseServerClient();
  const [{ data: members }, { data: invitations }, { data: branches }] = await Promise.all([
    supabase.rpc("list_org_members", { p_org: orgId }),
    supabase
      .from("invitations")
      .select("id, email, role, branch_id, expires_at")
      .eq("organization_id", orgId)
      .is("accepted_at", null)
      .order("created_at", { ascending: false }),
    supabase.from("branches").select("id, name").eq("organization_id", orgId),
  ]);
  const branchName = new Map((branches ?? []).map((b) => [b.id, b.name]));
  const scope = (branchId: string | null) => (branchId ? branchName.get(branchId) : ta("allBranches"));

  return (
    <AdminPage title={t("title")} subtitle={t("subtitle")} eyebrow={ctx.org.name} back={{ href: `/app/o/${orgId}`, label: ta("nav.overview") }}>
      <SavedNotice show={!!saved} />
      <ListSection header={t("members")}>
        {(members ?? []).map((m) => {
          const self = m.user_id === ctx.session.userId;
          return (
            <ListRow
              key={m.membership_id}
              href={ctx.canManageStaff && !self ? `/app/o/${orgId}/staff/${m.membership_id}` : undefined}
              icon={
                <ListIcon color={m.active ? "var(--brand-tile)" : "var(--label-tertiary)"}>
                  <UserRound />
                </ListIcon>
              }
              title={
                <span className="flex items-center gap-2">
                  <span className="truncate">{m.full_name || m.email}</span>
                  {self ? <Badge tone="accent">{t("you")}</Badge> : null}
                </span>
              }
              subtitle={[tr(m.role), scope(m.branch_id), m.full_name ? m.email : null].filter(Boolean).join(" · ")}
              accessory={!m.active ? <Badge tone="orange">{t("inactive")}</Badge> : ctx.canManageStaff && !self ? "chevron" : undefined}
            />
          );
        })}
      </ListSection>

      {ctx.canManageStaff ? (
        <>
          <ListSection header={t("invitations")}>
            {invitations?.length ? (
              invitations.map((inv) => (
                <li key={inv.id} className="group/row pl-4">
                  <span className="list-separator flex min-h-11 items-center justify-between gap-3 py-2 pr-2">
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-body">{inv.email}</span>
                      <span className="text-subheadline text-label-secondary">
                        {[tr(inv.role), scope(inv.branch_id), t("expires", { date: format.dateTime(new Date(inv.expires_at), { day: "numeric", month: "long" }) })].join(" · ")}
                      </span>
                    </span>
                    <ConfirmAction
                      action={revokeInvitation.bind(null, orgId, inv.id)}
                      label={ta("cancel")}
                      title={t("revoke")}
                      body={inv.email ?? ""}
                      confirmLabel={t("revoke")}
                      block={false}
                      size="md"
                      icon={<X aria-hidden className="size-4" />}
                    />
                  </span>
                </li>
              ))
            ) : (
              <li className="px-4 py-3 text-body text-label-secondary">{t("noInvitations")}</li>
            )}
          </ListSection>
          <Button asChild block>
            <Link href={`/app/o/${orgId}/staff/invite`}>
              <UserPlus aria-hidden className="size-5" />
              {t("invite")}
            </Link>
          </Button>
        </>
      ) : null}
    </AdminPage>
  );
}
