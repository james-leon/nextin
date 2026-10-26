import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import type { MemberRole } from "@nextin/shared";
import type { Database } from "@nextin/shared/database";
import { requireStaffSession, type StaffSession } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type Org = Pick<Database["public"]["Tables"]["organizations"]["Row"], "id" | "name" | "slug" | "type" | "status" | "default_locale">;

export type OrgContext = {
  session: StaffSession;
  org: Org;
  /** Rôle le plus large dans l'établissement (null pour un super admin sans affectation). */
  role: MemberRole | null;
  /** Gestion de tout l'établissement (org_admin ou super admin). */
  canManageOrg: boolean;
  /** Agences gérées par un responsable d'agence (vide si canManageOrg). */
  managedBranchIds: string[];
  canManageBranch: (branchId: string) => boolean;
  /** Le membre peut-il gérer le personnel (org_admin ou responsable d'agence) ? */
  canManageStaff: boolean;
};

const ROLE_ORDER: MemberRole[] = ["org_admin", "branch_manager", "receptionist", "agent"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Contexte d'un établissement pour la requête : session, organisation (via RLS) et droits. */
export const getOrgContext = cache(async (orgId: string): Promise<OrgContext> => {
  if (!UUID.test(orgId)) notFound();
  const session = await requireStaffSession(`/app/o/${orgId}`);
  const supabase = await getSupabaseServerClient();
  const { data: org } = await supabase
    .from("organizations")
    .select("id, name, slug, type, status, default_locale")
    .eq("id", orgId)
    .maybeSingle();
  if (!org) notFound();

  const mine = session.memberships.filter((m) => m.organizationId === orgId);
  const role = mine.map((m) => m.role).sort((a, b) => ROLE_ORDER.indexOf(a) - ROLE_ORDER.indexOf(b))[0] ?? null;
  const canManageOrg = session.isPlatformAdmin || mine.some((m) => m.role === "org_admin");
  const managedBranchIds = canManageOrg
    ? []
    : mine.filter((m) => m.role === "branch_manager" && m.branchId).map((m) => m.branchId as string);

  return {
    session,
    org,
    role,
    canManageOrg,
    managedBranchIds,
    canManageBranch: (branchId) => canManageOrg || managedBranchIds.includes(branchId),
    canManageStaff: canManageOrg || managedBranchIds.length > 0,
  };
});
