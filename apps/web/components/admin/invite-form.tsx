"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Check, MailCheck, MessageCircle, UserPlus } from "lucide-react";
import { MEMBER_ROLES, canAssignRole, type MemberRole } from "@nextin/shared";
import type { ActionResult } from "@/lib/auth/errors";
import { FormError } from "@/components/auth/form-error";
import { BottomBar } from "@/components/ui/bottom-bar";
import { Button } from "@/components/ui/button";
import { ListRow, ListSection } from "@/components/ui/list";
import { SelectField } from "@/components/ui/select-field";
import { FormGroup, TextField } from "@/components/ui/text-field";
import { CopyButton } from "./copy-button";
import { useFormErrors } from "./use-form-errors";

type Result = ActionResult<{ link?: string; email?: string; mailSent?: boolean }>;

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
    // Maquette v2 18 : confirmation centrée, puis le lien de secours (copier, WhatsApp) si l'e-mail n'arrive pas.
    return (
      <div className="flex flex-col gap-6" role="status">
        <div className="flex flex-col items-center gap-3 pt-2 text-center">
          <span
            aria-hidden
            className={`flex size-16 items-center justify-center rounded-full text-on-accent ${state.mailSent ? "bg-green" : "bg-accent"}`}
          >
            {state.mailSent ? <Check className="size-8 stroke-[2.5]" /> : <MailCheck className="size-8 stroke-[1.75]" />}
          </span>
          <h2 className="text-title2 font-bold text-balance">{state.mailSent ? t("sentTitle") : t("createdTitle")}</h2>
          <p className="max-w-md text-body text-label-secondary">
            {state.mailSent ? t("sentBody", { email: state.email ?? "" }) : t("mailFailed", { email: state.email ?? "" })}
          </p>
        </div>
        <ListSection header={t("fallbackHeader")} footer={state.mailSent ? t("fallbackHint") : undefined}>
          <li className="px-4 py-3">
            <p className="truncate rounded-[8px] bg-fill-tertiary px-3 py-2 font-mono text-footnote text-label-secondary" title={state.link}>
              {state.link}
            </p>
          </li>
          <li className="group/row px-2 py-1">
            <CopyButton value={state.link} label={t("copyLink")} copiedLabel={t("copied")} variant="plain" />
          </li>
          <li className="group/row px-2 py-1">
            <Button asChild variant="plain">
              <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer">
                <MessageCircle aria-hidden className="size-5 text-green-text" />
                {t("shareWhatsapp")}
              </a>
            </Button>
          </li>
        </ListSection>
        <Button asChild variant="tinted" block>
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
      <FormGroup>
        <TextField grouped name="email" type="email" inputMode="email" autoComplete="off" label={t("email")} placeholder="nom@etablissement.cm" required error={field("email")} />
      </FormGroup>
      <ListSection header={t("role")} radioGroupLabel={t("role")}>
        {roles.map((r) => (
          <ListRow key={r} role="radio" selected={role === r} onClick={() => setRole(r)} title={tr(r)} subtitle={t(`roleHint.${r}`)} accessory="check" />
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
