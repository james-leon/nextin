import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { MemberRole } from "@nextin/shared";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export type StaffMembership = {
  organizationId: string;
  branchId: string | null;
  role: MemberRole;
};

/** Double authentification (B5) : exigée (réglages de la plateforme ou de l'établissement), facteur enregistré, niveau de la session. */
export type MfaStatus = { required: boolean; enrolled: boolean; aal: "aal1" | "aal2" };

export type StaffSession = {
  userId: string;
  email: string | null;
  isPlatformAdmin: boolean;
  memberships: StaffMembership[];
  mfa: MfaStatus;
};

/** Session du personnel (non anonyme), mise en cache pour la durée de la requête. */
export const getStaffSession = cache(async (): Promise<StaffSession | null> => {
  const supabase = await getSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user || user.is_anonymous) return null;

  const [{ data: memberships }, { data: isAdmin }, { data: mfa }] = await Promise.all([
    supabase.from("memberships").select("organization_id, branch_id, role").eq("user_id", user.id).eq("active", true),
    supabase.rpc("is_platform_admin"),
    supabase.rpc("my_mfa_status"),
  ]);
  // Base pas encore migrée (B5) : rien n'est exigé.
  const status = (mfa ?? null) as Partial<MfaStatus> | null;

  return {
    userId: user.id,
    email: user.email ?? null,
    isPlatformAdmin: isAdmin === true,
    memberships: (memberships ?? []).map((m) => ({
      organizationId: m.organization_id,
      branchId: m.branch_id,
      role: m.role,
    })),
    mfa: { required: status?.required === true, enrolled: status?.enrolled === true, aal: status?.aal === "aal2" ? "aal2" : "aal1" },
  };
});

/**
 * Double authentification : code à saisir si un facteur est enregistré et que la session n'est pas encore en aal2,
 * enregistrement d'un facteur si elle est exigée et absente. Les pages de la double authentification passent
 * `{ mfa: false }` (sinon elles se redirigeraient vers elles-mêmes).
 */
export function mfaRedirect(session: StaffSession, next: string): string | null {
  if (session.mfa.enrolled && session.mfa.aal !== "aal2") return `/mfa?next=${encodeURIComponent(next)}`;
  if (session.mfa.required && !session.mfa.enrolled) return `/app/settings/security?setup=1&next=${encodeURIComponent(next)}`;
  return null;
}

export async function requireStaffSession(next = "/app", options: { mfa?: boolean } = {}): Promise<StaffSession> {
  const session = await getStaffSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (options.mfa !== false) {
    const target = mfaRedirect(session, next);
    if (target) redirect(target);
  }
  return session;
}

/** Vrai si la session a l'un des rôles sur l'organisation (et l'agence, si précisée). */
export function hasOrgRole(
  session: StaffSession,
  organizationId: string,
  roles: readonly MemberRole[],
  branchId?: string,
): boolean {
  if (session.isPlatformAdmin) return true;
  return session.memberships.some(
    (m) =>
      m.organizationId === organizationId &&
      roles.includes(m.role) &&
      (branchId === undefined || m.branchId === null || m.branchId === branchId),
  );
}

export async function requireOrgRole(
  organizationId: string,
  roles: readonly MemberRole[],
  branchId?: string,
): Promise<StaffSession> {
  const session = await requireStaffSession();
  if (!hasOrgRole(session, organizationId, roles, branchId)) redirect("/app?error=forbidden");
  return session;
}

export async function requirePlatformAdmin(): Promise<StaffSession> {
  const session = await requireStaffSession("/admin");
  if (!session.isPlatformAdmin) redirect("/app?error=forbidden");
  return session;
}
