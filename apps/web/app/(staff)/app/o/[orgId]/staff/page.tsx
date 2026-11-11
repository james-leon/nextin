import type { Metadata } from "next";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { UserPlus, UserRound } from "lucide-react";
import { AdminPage } from "@/components/admin/admin-page";
import { SavedNotice } from "@/components/admin/saved-notice";
import { Badge } from "@/components/ui/badge";
import { BottomBar } from "@/components/ui/bottom-bar";
import { Button } from "@/components/ui/button";
import { DataTable, td, th } from "@/components/ui/data-table";
import { ListIcon, ListRow, ListSection } from "@/components/ui/list";
import { getOrgContext } from "@/lib/admin/context";
import { cn } from "@/lib/cn";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { OrgMfaSwitch } from "@/components/admin/org-mfa-switch";
import { setOrgMfaRequired } from "../_actions/people";
import { PendingInvitations } from "@/components/admin/pending-invitations";

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
  const [{ data: members }, { data: invitations }, { data: branches }, { data: security }] = await Promise.all([
    supabase.rpc("list_org_members", { p_org: orgId }),
    supabase
      .from("invitations")
      .select("id, email, role, branch_id, expires_at")
      .eq("organization_id", orgId)
      .is("accepted_at", null)
      .order("created_at", { ascending: false }),
    supabase.from("branches").select("id, name").eq("organization_id", orgId),
    supabase.from("organizations").select("mfa_required_all").eq("id", orgId).maybeSingle(),
  ]);
  const branchName = new Map((branches ?? []).map((b) => [b.id, b.name]));
  const scope = (branchId: string | null) => (branchId ? branchName.get(branchId) : ta("allBranches"));

  const members_ = members ?? [];
  const expires = (iso: string) => format.dateTime(new Date(iso), { day: "numeric", month: "long" });
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
          <PendingInvitations
            orgId={orgId}
            invitations={(invitations ?? []).map((inv) => ({
              id: inv.id,
              email: inv.email ?? "",
              role: tr(inv.role),
              scope: scope(inv.branch_id) ?? "",
              expires: expires(inv.expires_at),
            }))}
          />
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
      {/* Double authentification pour tout le personnel (B5) : administrateurs seulement. */}
      {ctx.canManageOrg && security ? (
        <OrgMfaSwitch initial={security.mfa_required_all === true} action={setOrgMfaRequired.bind(null, orgId)} />
      ) : null}
    </AdminPage>
  );
}
