"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { MessageCircle, UserPlus } from "lucide-react";
import { MEMBER_ROLES, canAssignRole, type MemberRole } from "@nextin/shared";
import type { ActionResult } from "@/lib/auth/errors";
import { FormError } from "@/components/auth/form-error";
import { BottomBar } from "@/components/ui/bottom-bar";
import { Button } from "@/components/ui/button";
import { ListRow, ListSection } from "@/components/ui/list";
import { SelectField } from "@/components/ui/select-field";
import { TextField } from "@/components/ui/text-field";
import { CopyButton } from "./copy-button";
import { useFormErrors } from "./use-form-errors";

type Result = ActionResult<{ link?: string; email?: string }>;

export function InviteForm({
  action,
  actorRole,
  branches,
  orgName,
  doneHref,
}: {
  action: (p: Result | null, d: FormData) => Promise<Result>;
  /** Rôle de la personne qui invite : limite les rôles proposés. */
  actorRole: MemberRole;
  branches: { id: string; name: string }[];
  orgName: string;
  doneHref: string;
}) {
  const t = useTranslations("staffMgmt");
  const tr = useTranslations("roles");
  const ta = useTranslations("admin");
  const [state, formAction, pending] = useActionState(action, null);
  const { field, top } = useFormErrors(state);
  const roles = MEMBER_ROLES.filter((r) => canAssignRole(actorRole, r));
  const [role, setRole] = useState<MemberRole>(roles.includes("receptionist") ? "receptionist" : roles[0]!);
  const isOrgAdmin = actorRole === "org_admin";

  if (state?.ok && state.link) {
    const text = t("whatsappText", { org: orgName, url: state.link });
    return (
      <div className="flex flex-col gap-5" role="status">
        <section className="flex flex-col gap-3 rounded-[var(--radius-xl)] bg-grouped-secondary p-5">
          <h2 className="text-title3 font-semibold">{t("createdTitle")}</h2>
          <p className="text-body text-label-secondary">{t("createdBody", { email: state.email ?? "" })}</p>
          <p className="truncate rounded-[10px] bg-grouped-tertiary px-3 py-2.5 text-subheadline" title={state.link}>
            {state.link}
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button asChild variant="filled" block>
              <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer">
                <MessageCircle aria-hidden className="size-5" />
                {t("shareWhatsapp")}
              </a>
            </Button>
            <CopyButton value={state.link} label={t("copyLink")} copiedLabel={t("copied")} size="lg" block />
          </div>
        </section>
        <Button asChild variant="plain" block>
          <Link href={doneHref}>{t("done")}</Link>
        </Button>
      </div>
    );
  }

  const branchOptions = [
    ...(isOrgAdmin && role !== "branch_manager" && role !== "org_admin" ? [{ value: "", label: ta("allBranches") }] : []),
    ...branches.map((b) => ({ value: b.id, label: b.name })),
  ];

  return (
    <form action={formAction} noValidate className="flex flex-col gap-5">
      <FormError message={top} />
      <TextField name="email" type="email" inputMode="email" autoComplete="off" label={t("email")} placeholder="nom@etablissement.cm" required error={field("email")} />
      <ListSection header={t("role")} radioGroupLabel={t("role")}>
        {roles.map((r) => (
          <ListRow key={r} role="radio" selected={role === r} onClick={() => setRole(r)} title={tr(r)} accessory="check" />
        ))}
      </ListSection>
      <input type="hidden" name="role" value={role} />
      {role === "org_admin" ? (
        <input type="hidden" name="branchId" value="" />
      ) : (
        <SelectField key={role} name="branchId" label={t("branch")} hint={t("branchHint")} options={branchOptions} error={field("branchId")} />
      )}
      <BottomBar>
        <Button type="submit" block loading={pending} loadingLabel={t("sending")} leadingIcon={<UserPlus aria-hidden className="size-5" />}>
          {t("send")}
        </Button>
      </BottomBar>
    </form>
  );
}
