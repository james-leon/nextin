"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { MEMBER_ROLES, canAssignRole, type MemberRole } from "@nextin/shared";
import type { ActionResult } from "@/lib/auth/errors";
import { FormError } from "@/components/auth/form-error";
import { BottomBar } from "@/components/ui/bottom-bar";
import { Button } from "@/components/ui/button";
import { ListRow, ListSection } from "@/components/ui/list";
import { SelectField } from "@/components/ui/select-field";
import { useFormErrors } from "./use-form-errors";

export function MembershipForm({
  action,
  actorRole,
  initial,
  branches,
}: {
  action: (p: ActionResult | null, d: FormData) => Promise<ActionResult>;
  actorRole: MemberRole;
  initial: { role: MemberRole; branchId: string | null };
  branches: { id: string; name: string }[];
}) {
  const t = useTranslations("staffMgmt");
  const tr = useTranslations("roles");
  const ta = useTranslations("admin");
  const [state, formAction, pending] = useActionState(action, null);
  const { field, top } = useFormErrors(state);
  const roles = MEMBER_ROLES.filter((r) => canAssignRole(actorRole, r));
  const [role, setRole] = useState<MemberRole>(initial.role);
  const isOrgAdmin = actorRole === "org_admin";
  const options = [
    ...(isOrgAdmin && role !== "branch_manager" ? [{ value: "", label: ta("allBranches") }] : []),
    ...branches.map((b) => ({ value: b.id, label: b.name })),
  ];
  return (
    <form action={formAction} noValidate className="flex flex-col gap-5">
      <FormError message={top} />
      <ListSection header={t("role")} radioGroupLabel={t("role")}>
        {roles.map((r) => (
          <ListRow key={r} role="radio" selected={role === r} onClick={() => setRole(r)} title={tr(r)} accessory="check" />
        ))}
      </ListSection>
      <input type="hidden" name="role" value={role} />
      {role === "org_admin" ? (
        <input type="hidden" name="branchId" value="" />
      ) : (
        <SelectField key={role} name="branchId" label={t("branch")} hint={t("branchHint")} defaultValue={initial.branchId ?? ""} options={options} error={field("branchId")} />
      )}
      <BottomBar>
        <Button type="submit" block loading={pending} loadingLabel={ta("saving")}>
          {ta("save")}
        </Button>
      </BottomBar>
    </form>
  );
}
