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

export type StaffSession = {
  userId: string;
  email: string | null;
  isPlatformAdmin: boolean;
  memberships: StaffMembership[];
};

/** Session du personnel (non anonyme), mise en cache pour la durée de la requête. */
export const getStaffSession = cache(async (): Promise<StaffSession | null> => {
  const supabase = await getSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user || user.is_anonymous) return null;

  const [{ data: memberships }, { data: isAdmin }] = await Promise.all([
    supabase.from("memberships").select("organization_id, branch_id, role").eq("user_id", user.id).eq("active", true),
    supabase.rpc("is_platform_admin"),
  ]);

  return {
    userId: user.id,
    email: user.email ?? null,
    isPlatformAdmin: isAdmin === true,
    memberships: (memberships ?? []).map((m) => ({
      organizationId: m.organization_id,
      branchId: m.branch_id,
      role: m.role,
    })),
  };
});

export async function requireStaffSession(next = "/app"): Promise<StaffSession> {
  const session = await getStaffSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(next)}`);
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
