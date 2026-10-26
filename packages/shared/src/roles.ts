/** Rôles du personnel d'un établissement, du plus large au plus restreint. */
export const MEMBER_ROLES = ["org_admin", "branch_manager", "receptionist", "agent"] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

const RANK: Record<MemberRole, number> = {
  org_admin: 3,
  branch_manager: 2,
  receptionist: 1,
  agent: 1,
};

/** Un membre ne peut attribuer qu'un rôle strictement inférieur au sien (sauf org_admin, qui peut tout). */
export function canAssignRole(actor: MemberRole, target: MemberRole): boolean {
  if (actor === "org_admin") return true;
  return RANK[actor] > RANK[target];
}

export function hasAtLeast(role: MemberRole, minimum: MemberRole): boolean {
  return RANK[role] >= RANK[minimum];
}

export function isMemberRole(value: unknown): value is MemberRole {
  return typeof value === "string" && (MEMBER_ROLES as readonly string[]).includes(value);
}
