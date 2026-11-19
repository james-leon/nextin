"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { MEMBER_ROLES, canAssignRole, type MemberRole } from "@nextin/shared";
import type { ActionResult } from "@/lib/auth/errors";
import { Check } from "lucide-react";
import { ListRow, ListSection } from "@/components/ui/list";
import { SelectField } from "@/components/ui/select-field";
import { useMfaStepUp } from "@/components/security/use-mfa-step-up";
import { AutoSaveStatus, useAutoSave } from "./use-auto-save";
import { useFormErrors } from "./use-form-errors";

/** Ce que chaque rôle permet (maquette v2 18) ; `settings` reste affiché grisé pour les rôles qui ne l'ont pas. */
const CAPABILITIES: Record<MemberRole, string[]> = {
  org_admin: ["allBranches", "staff", "billing", "stats"],
  branch_manager: ["branchSettings", "staff", "stats", "reception"],
  receptionist: ["reception", "tickets", "requests"],
  agent: ["desk", "call"],
};

/**
 * Accès du membre (maquette v2 18) : rôle dans une liste à cocher (une ligne d'explication par rôle), agence pour
 * les rôles limités, puis « ce que ce membre peut faire ». Enregistrement automatique ; un changement de rôle peut
 * demander un code de double authentification récent (B5).
 */
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
  // Changement de rôle (B5) : code de double authentification récent demandé si la base l'exige.
  const stepUp = useMfaStepUp();
  const formRef = useRef<HTMLFormElement>(null);
  const saveState = useAutoSave(formRef, (prev, data) => stepUp.run(() => action(prev, data)));
  const { field } = useFormErrors(saveState.result);
  const roles = MEMBER_ROLES.filter((r) => canAssignRole(actorRole, r));
  const [role, setRole] = useState<MemberRole>(initial.role);
  const isOrgAdmin = actorRole === "org_admin";
  const options = [
    ...(isOrgAdmin && role !== "branch_manager" ? [{ value: "", label: ta("allBranches") }] : []),
    ...branches.map((b) => ({ value: b.id, label: b.name })),
  ];
  return (
    <form ref={formRef} onSubmit={(e) => e.preventDefault()} noValidate className="flex flex-col gap-5">
      {stepUp.dialog}
      <input type="hidden" name="autosave" value="1" />
      <AutoSaveStatus state={saveState} className="-mb-3" />
      <div className="grid grid-cols-1 gap-6 @2xl:grid-cols-2 @2xl:items-start">
        <div className="flex min-w-0 flex-col gap-5">
          <ListSection header={t("role")} radioGroupLabel={t("role")}>
            {roles.map((r) => (
              <ListRow key={r} role="radio" selected={role === r} onClick={() => setRole(r)} title={tr(r)} subtitle={t(`roleHint.${r}`)} accessory="check" />
            ))}
          </ListSection>
          <input type="hidden" name="role" value={role} />
          {role === "org_admin" ? (
            <input type="hidden" name="branchId" value="" />
          ) : (
            <SelectField key={role} name="branchId" label={t("branch")} hint={t("branchHint")} defaultValue={initial.branchId ?? ""} options={options} error={field("branchId")} />
          )}
        </div>
        <ListSection header={t("canDo")}>
          {[...CAPABILITIES[role], ...(role === "org_admin" ? [] : ["settings"])].map((key) => {
            const allowed = CAPABILITIES[role].includes(key);
            return (
              <ListRow
                key={key}
                icon={
                  <span aria-hidden className="flex size-5 items-center justify-center text-accent-text">
                    {allowed ? <Check className="size-[1.125rem] stroke-[2.5]" /> : null}
                  </span>
                }
                title={
                  <span className={allowed ? undefined : "text-label-secondary"}>
                    <span className="sr-only">{allowed ? t("allowed") : t("notAllowed")} : </span>
                    {t(`capability.${key}` as "capability.staff")}
                  </span>
                }
              />
            );
          })}
        </ListSection>
      </div>
    </form>
  );
}
