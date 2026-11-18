import { getFormatter, getTranslations } from "next-intl/server";
import { UserPlus, Users } from "lucide-react";
import { canAssignRole } from "@nextin/shared";
import { FilterList } from "@/components/admin/filter-list";
import { MasterDetail, SavedFromQuery, SplitRow } from "@/components/admin/master-detail";
import { OrgMfaSwitch } from "@/components/admin/org-mfa-switch";
import { PendingInvitations } from "@/components/admin/pending-invitations";
import { SplitListPane } from "@/components/admin/split-pane";
import { IconLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ListSection } from "@/components/ui/list";
import { getOrgContext } from "@/lib/admin/context";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { initialsOf } from "@/lib/text/initials";
import { setOrgMfaRequired } from "../_actions/people";

/** Couleurs des initiales : tirées du nom, toujours les mêmes pour une personne. */
const AVATAR = ["var(--brand-tile)", "var(--accent-fill)", "var(--green-fill)", "var(--icon-indigo)", "var(--icon-gray)"];
const avatarColor = (seed: string) => AVATAR[[...seed].reduce((n, c) => n + c.charCodeAt(0), 0) % AVATAR.length]!;

/**
 * Personnel (maquette v2 18) : membres puis invitations en attente dans la même colonne (recherche, « + » pour
 * inviter), l'accès du membre à droite sur tablette et ordinateur. Double authentification de toute l'équipe en bas.
 */
export default async function StaffLayout({ children, params }: { children: React.ReactNode; params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const ctx = await getOrgContext(orgId);
  const t = await getTranslations("staffMgmt");
  const tr = await getTranslations("roles");
  const ta = await getTranslations("admin");
  const format = await getFormatter();
  const supabase = await getSupabaseServerClient();
  const [{ data: members }, { data: invitations }, { data: branches }, { data: security }] = await Promise.all([
    supabase.rpc("list_org_members", { p_org: orgId }),
    ctx.canManageStaff
      ? supabase
          .from("invitations")
          .select("id, email, role, branch_id, expires_at")
          .eq("organization_id", orgId)
          .is("accepted_at", null)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    supabase.from("branches").select("id, name").eq("organization_id", orgId),
    supabase.from("organizations").select("mfa_required_all").eq("id", orgId).maybeSingle(),
  ]);
  const branchName = new Map((branches ?? []).map((b) => [b.id, b.name]));
  const scope = (branchId: string | null) => (branchId ? branchName.get(branchId) : ta("allBranches"));
  const actorRole = ctx.canManageOrg ? "org_admin" : "branch_manager";
  const all = members ?? [];

  const list = (
    <SplitListPane
      title={t("title")}
      eyebrow={ctx.org.name}
      back={{ href: `/app/o/${orgId}`, label: ta("nav.overview") }}
      trailing={ctx.canManageStaff ? <IconLink href={`/app/o/${orgId}/staff/invite`} label={t("invite")} icon={<UserPlus />} /> : null}
    >
      <SavedFromQuery message={ta("saved")} />
      <FilterList
        label={t("search")}
        clearLabel={t("searchClear")}
        texts={all.map((m) => `${m.full_name ?? ""} ${m.email} ${tr(m.role)}`)}
        empty={<EmptyState title={t("noMatch")} icon={<Users />} />}
      >
        <ListSection header={`${t("members")} · ${all.length}`}>
          {all.map((m) => {
            const self = m.user_id === ctx.session.userId;
            const editable = ctx.canManageStaff && !self && canAssignRole(actorRole, m.role);
            const name = m.full_name || m.email;
            return (
                <SplitRow
                  key={m.membership_id}
                  segment={m.membership_id}
                  href={editable ? `/app/o/${orgId}/staff/${m.membership_id}` : undefined}
                  icon={
                    <span
                      aria-hidden
                      className="flex size-9 shrink-0 items-center justify-center rounded-full text-footnote font-semibold text-white"
                      style={{ background: m.active ? avatarColor(name) : "var(--icon-gray)" }}
                    >
                      {initialsOf(name)}
                    </span>
                  }
                  title={
                    <span className={m.active ? undefined : "text-label-secondary"}>
                      {name}
                      {self ? <span className="text-label-secondary"> · {t("you")}</span> : null}
                    </span>
                  }
                  subtitle={m.active ? [tr(m.role), scope(m.branch_id)].filter(Boolean).join(" · ") : `${tr(m.role)} · ${t("disabled")}`}
                  accessory={editable ? "chevron" : undefined}
                />
            );
          })}
        </ListSection>
      </FilterList>
      {ctx.canManageStaff ? (
        <PendingInvitations
          compact
          orgId={orgId}
          invitations={(invitations ?? []).map((inv) => ({
            id: inv.id,
            email: inv.email ?? "",
            role: tr(inv.role),
            scope: scope(inv.branch_id) ?? "",
            expires: format.dateTime(new Date(inv.expires_at), { day: "numeric", month: "long" }),
          }))}
        />
      ) : null}
      {/* Double authentification pour tout le personnel (B5) : administrateurs seulement. */}
      {ctx.canManageOrg && security ? (
        <OrgMfaSwitch initial={security.mfa_required_all === true} action={setOrgMfaRequired.bind(null, orgId)} />
      ) : null}
    </SplitListPane>
  );

  return <MasterDetail list={list}>{children}</MasterDetail>;
}
