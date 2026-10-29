import type { Metadata } from "next";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { UserPlus, UserRound, X } from "lucide-react";
import { AdminPage } from "@/components/admin/admin-page";
import { ConfirmAction } from "@/components/admin/confirm-action";
import { SavedNotice } from "@/components/admin/saved-notice";
import { Badge } from "@/components/ui/badge";
import { BottomBar } from "@/components/ui/bottom-bar";
import { Button } from "@/components/ui/button";
import { DataTable, td, th } from "@/components/ui/data-table";
import { ListIcon, ListRow, ListSection } from "@/components/ui/list";
import { getOrgContext } from "@/lib/admin/context";
import { cn } from "@/lib/cn";
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

  const members_ = members ?? [];
  const expires = (iso: string) => format.dateTime(new Date(iso), { day: "numeric", month: "long" });
  const revoke = (inv: { id: string; email: string | null }) => (
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
  );

  return (
    <AdminPage title={t("title")} subtitle={t("subtitle")} eyebrow={ctx.org.name} back={{ href: `/app/o/${orgId}`, label: ta("nav.overview") }}>
      <SavedNotice show={!!saved} />

      {/* Téléphone et tablette : liste groupée (sous-titre sur deux lignes au plus). */}
      <ListSection header={t("members")} className="lg:hidden">
        {members_.map((m) => {
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

      {/* Ordinateur : tableau (nom, rôle, agences, e-mail, statut, actions). */}
      <section aria-labelledby="members-title" className="hidden flex-col gap-1.5 lg:flex">
        <h2 id="members-title" className="px-4 text-footnote uppercase text-label-secondary">
          {t("members")}
        </h2>
        <DataTable
          label={t("members")}
          head={
            <>
              <th scope="col" className={th}>{t("colName")}</th>
              <th scope="col" className={th}>{t("colRole")}</th>
              <th scope="col" className={th}>{t("colScope")}</th>
              <th scope="col" className={th}>{t("colEmail")}</th>
              <th scope="col" className={th}>{t("colStatus")}</th>
              <th scope="col" className={cn(th, "text-right")}>{t("colActions")}</th>
            </>
          }
        >
          {members_.map((m) => {
            const self = m.user_id === ctx.session.userId;
            const editable = ctx.canManageStaff && !self;
            return (
              <tr key={m.membership_id}>
                <td className={td}>
                  <span className="flex min-w-0 items-center gap-3">
                    <ListIcon color={m.active ? "var(--brand-tile)" : "var(--label-tertiary)"}>
                      <UserRound />
                    </ListIcon>
                    <span className="truncate font-semibold">{m.full_name || m.email}</span>
                    {self ? <Badge tone="accent">{t("you")}</Badge> : null}
                  </span>
                </td>
                <td className={cn(td, "whitespace-nowrap")}>{tr(m.role)}</td>
                <td className={td}>{scope(m.branch_id)}</td>
                <td className={cn(td, "max-w-72 truncate text-label-secondary")}>{m.email}</td>
                <td className={td}>{m.active ? <Badge tone="green">{t("active")}</Badge> : <Badge tone="orange">{t("inactive")}</Badge>}</td>
                <td className={cn(td, "text-right")}>
                  {editable ? (
                    <Button asChild variant="plain" size="md">
                      <Link href={`/app/o/${orgId}/staff/${m.membership_id}`} aria-label={`${t("edit")} · ${m.full_name || m.email}`}>
                        {t("edit")}
                      </Link>
                    </Button>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </DataTable>
      </section>

      {ctx.canManageStaff ? (
        <>
          <ListSection header={t("invitations")} className={invitations?.length ? "lg:hidden" : undefined}>
            {invitations?.length ? (
              invitations.map((inv) => (
                <li key={inv.id} className="group/row pl-4">
                  <span className="list-separator flex min-h-11 items-center justify-between gap-3 py-2 pr-2">
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-body">{inv.email}</span>
                      <span className="line-clamp-2 text-subheadline text-label-secondary">
                        {[tr(inv.role), scope(inv.branch_id), t("expires", { date: expires(inv.expires_at) })].join(" · ")}
                      </span>
                    </span>
                    {revoke(inv)}
                  </span>
                </li>
              ))
            ) : (
              <li className="px-4 py-3 text-body text-label-secondary">{t("noInvitations")}</li>
            )}
          </ListSection>
          {invitations?.length ? (
            <section aria-labelledby="invitations-title" className="hidden flex-col gap-1.5 lg:flex">
              <h2 id="invitations-title" className="px-4 text-footnote uppercase text-label-secondary">
                {t("invitations")}
              </h2>
              <DataTable
                label={t("invitations")}
                head={
                  <>
                    <th scope="col" className={th}>{t("colEmail")}</th>
                    <th scope="col" className={th}>{t("colRole")}</th>
                    <th scope="col" className={th}>{t("colScope")}</th>
                    <th scope="col" className={th}>{t("colExpires")}</th>
                    <th scope="col" className={cn(th, "text-right")}>{t("colActions")}</th>
                  </>
                }
              >
                {invitations.map((inv) => (
                  <tr key={inv.id}>
                    <td className={cn(td, "max-w-80 truncate")}>{inv.email}</td>
                    <td className={cn(td, "whitespace-nowrap")}>{tr(inv.role)}</td>
                    <td className={td}>{scope(inv.branch_id)}</td>
                    <td className={cn(td, "whitespace-nowrap text-label-secondary")}>{expires(inv.expires_at)}</td>
                    <td className={cn(td, "text-right")}>{revoke(inv)}</td>
                  </tr>
                ))}
              </DataTable>
            </section>
          ) : null}
          {/* Action principale : en bas sur téléphone et tablette, dans la barre de titre sur ordinateur. */}
          <BottomBar>
            <Button asChild block>
              <Link href={`/app/o/${orgId}/staff/invite`}>
                <UserPlus aria-hidden className="size-5" />
                {t("invite")}
              </Link>
            </Button>
          </BottomBar>
        </>
      ) : null}
    </AdminPage>
  );
}
