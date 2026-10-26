"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { absoluteUrl, canAssignRole, isMemberRole } from "@nextin/shared";
import { messages } from "@nextin/shared/i18n";
import { inviteFormSchema, practitionerFormSchema, specialtyFormSchema } from "@nextin/shared/schemas";
import { getOrgContext } from "@/lib/admin/context";
import { mapDbError } from "@/lib/admin/db-errors";
import { formObject } from "@/lib/admin/form";
import { fieldErrorsFrom, type ActionResult } from "@/lib/auth/errors";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const KNOWN = Object.keys(messages.fr.errors);
const id = z.uuid();

function check(...ids: (string | null | undefined)[]) {
  if (ids.some((v) => v != null && !id.safeParse(v).success)) redirect("/app");
}

function done(orgId: string, path: string): never {
  revalidatePath(`/app/o/${orgId}`, "layout");
  redirect(`${path}${path.includes("?") ? "&" : "?"}saved=1`);
}

/* ─── Spécialités ─────────────────────────────────────────────────────────── */

export async function createSpecialty(orgId: string, _prev: ActionResult | null, data: FormData): Promise<ActionResult> {
  check(orgId);
  await getOrgContext(orgId);
  const parsed = specialtyFormSchema.safeParse(formObject(data));
  if (!parsed.success) return { ok: false, error: "generic", fieldErrors: fieldErrorsFrom(parsed.error, KNOWN) };
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase
    .from("specialties")
    .insert({ organization_id: orgId, name: parsed.data.name, name_en: parsed.data.nameEn });
  if (error) {
    const code = mapDbError(error, "name_taken");
    return code === "name_taken" ? { ok: false, error: code, fieldErrors: { name: code } } : { ok: false, error: code };
  }
  done(orgId, `/app/o/${orgId}/practitioners`);
}

export async function deleteSpecialty(orgId: string, specialtyId: string): Promise<ActionResult> {
  check(orgId, specialtyId);
  await getOrgContext(orgId);
  const supabase = await getSupabaseServerClient();
  const { data: affected, error } = await supabase.from("specialties").delete().eq("id", specialtyId).eq("organization_id", orgId)
    .select("id");
  if (error) return { ok: false, error: mapDbError(error) };
  if (!affected?.length) return { ok: false, error: "not_allowed" };
  done(orgId, `/app/o/${orgId}/practitioners`);
}

/* ─── Praticiens ──────────────────────────────────────────────────────────── */

export async function savePractitioner(
  orgId: string,
  practitionerId: string | null,
  _prev: ActionResult | null,
  data: FormData,
): Promise<ActionResult> {
  check(orgId, practitionerId);
  await getOrgContext(orgId);
  const parsed = practitionerFormSchema.safeParse(formObject(data));
  if (!parsed.success) return { ok: false, error: "generic", fieldErrors: fieldErrorsFrom(parsed.error, KNOWN) };
  const v = parsed.data;
  const row = { title: v.title, display_name: v.displayName, specialty_id: v.specialtyId, branch_id: v.branchId, active: v.active };
  const supabase = await getSupabaseServerClient();
  const { error } = practitionerId
    ? await supabase.from("practitioners").update(row).eq("id", practitionerId).eq("organization_id", orgId)
    : await supabase.from("practitioners").insert({ ...row, organization_id: orgId });
  if (error) return { ok: false, error: mapDbError(error) };
  done(orgId, `/app/o/${orgId}/practitioners`);
}

export async function deletePractitioner(orgId: string, practitionerId: string): Promise<ActionResult> {
  check(orgId, practitionerId);
  await getOrgContext(orgId);
  const supabase = await getSupabaseServerClient();
  const { data: affected, error } = await supabase.from("practitioners").delete().eq("id", practitionerId).eq("organization_id", orgId)
    .select("id");
  if (error) return { ok: false, error: mapDbError(error) };
  if (!affected?.length) return { ok: false, error: "not_allowed" };
  done(orgId, `/app/o/${orgId}/practitioners`);
}

/* ─── Personnel ───────────────────────────────────────────────────────────── */

export async function inviteMember(
  orgId: string,
  _prev: ActionResult<{ link?: string; email?: string }> | null,
  data: FormData,
): Promise<ActionResult<{ link?: string; email?: string }>> {
  check(orgId);
  const ctx = await getOrgContext(orgId);
  const parsed = inviteFormSchema.safeParse(formObject(data));
  if (!parsed.success) return { ok: false, error: "generic", fieldErrors: fieldErrorsFrom(parsed.error, KNOWN) };
  const v = parsed.data;
  // Un responsable d'agence n'invite que pour son agence et des rôles inférieurs (vérifié aussi en base).
  if (!ctx.canManageOrg && (!v.branchId || !ctx.managedBranchIds.includes(v.branchId) || !canAssignRole("branch_manager", v.role))) {
    return { ok: false, error: "not_allowed" };
  }
  const supabase = await getSupabaseServerClient();
  const { data: token, error } = await supabase.rpc("create_invitation", {
    p_org: orgId,
    p_role: v.role,
    p_branch: v.branchId ?? undefined,
    p_email: v.email,
  });
  if (error) return { ok: false, error: mapDbError(error) };
  revalidatePath(`/app/o/${orgId}/staff`);
  return { ok: true, link: absoluteUrl(`/invite/${token}`), email: v.email };
}

export async function revokeInvitation(orgId: string, invitationId: string): Promise<ActionResult> {
  check(orgId, invitationId);
  await getOrgContext(orgId);
  const supabase = await getSupabaseServerClient();
  const { data: affected, error } = await supabase.from("invitations").delete().eq("id", invitationId).eq("organization_id", orgId)
    .select("id");
  if (error) return { ok: false, error: mapDbError(error) };
  if (!affected?.length) return { ok: false, error: "not_allowed" };
  done(orgId, `/app/o/${orgId}/staff`);
}

export async function updateMembership(
  orgId: string,
  membershipId: string,
  _prev: ActionResult | null,
  data: FormData,
): Promise<ActionResult> {
  check(orgId, membershipId);
  const ctx = await getOrgContext(orgId);
  const role = data.get("role");
  const branchRaw = data.get("branchId");
  const branchId = typeof branchRaw === "string" && branchRaw !== "" ? branchRaw : null;
  if (!isMemberRole(role)) return { ok: false, error: "role_required", fieldErrors: { role: "role_required" } };
  check(branchId);
  if (role === "branch_manager" && !branchId) return { ok: false, error: "branch_required", fieldErrors: { branchId: "branch_required" } };
  if (!ctx.canManageOrg && (!branchId || !ctx.managedBranchIds.includes(branchId))) return { ok: false, error: "not_allowed" };
  const supabase = await getSupabaseServerClient();
  const { data: affected, error } = await supabase
    .from("memberships")
    .update({ role, branch_id: role === "org_admin" ? null : branchId })
    .eq("id", membershipId)
    .eq("organization_id", orgId)
    .select("id");
  if (error) return { ok: false, error: mapDbError(error) };
  if (!affected?.length) return { ok: false, error: "not_allowed" };
  done(orgId, `/app/o/${orgId}/staff`);
}

export async function setMembershipActive(orgId: string, membershipId: string, active: boolean): Promise<ActionResult> {
  check(orgId, membershipId);
  await getOrgContext(orgId);
  const supabase = await getSupabaseServerClient();
  const { data: affected, error } = await supabase.from("memberships").update({ active }).eq("id", membershipId).eq("organization_id", orgId)
    .select("id");
  if (error) return { ok: false, error: mapDbError(error) };
  if (!affected?.length) return { ok: false, error: "not_allowed" };
  done(orgId, `/app/o/${orgId}/staff`);
}

export async function removeMembership(orgId: string, membershipId: string): Promise<ActionResult> {
  check(orgId, membershipId);
  await getOrgContext(orgId);
  const supabase = await getSupabaseServerClient();
  const { data: affected, error } = await supabase.from("memberships").delete().eq("id", membershipId).eq("organization_id", orgId)
    .select("id");
  if (error) return { ok: false, error: mapDbError(error) };
  if (!affected?.length) return { ok: false, error: "not_allowed" };
  done(orgId, `/app/o/${orgId}/staff`);
}
