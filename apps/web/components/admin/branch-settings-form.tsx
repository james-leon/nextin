"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Minus, Plus } from "lucide-react";
import type { ActionResult } from "@/lib/auth/errors";
import { FormError } from "@/components/auth/form-error";
import { BottomBar } from "@/components/ui/bottom-bar";
import { Button, IconButton } from "@/components/ui/button";
import { ListSection } from "@/components/ui/list";
import { ListSwitchRow } from "@/components/ui/list-switch-row";
import { useFormErrors } from "./use-form-errors";

type Settings = { remote: boolean; priorities: boolean; rating: boolean; almostTurn: number };

export function BranchSettingsForm({
  action,
  initial,
  disabled,
}: {
  action: (p: ActionResult | null, d: FormData) => Promise<ActionResult>;
  initial: Settings;
  disabled?: boolean;
}) {
  const t = useTranslations("branchSettings");
  const ta = useTranslations("admin");
  const [state, formAction, pending] = useActionState(action, null);
  const { top } = useFormErrors(state);
  const [v, setV] = useState(initial);

  return (
    <form action={formAction} noValidate className="flex flex-col gap-6">
      <FormError message={top} />
      <ListSection>
        <ListSwitchRow title={t("remote")} subtitle={t("remoteHint")} checked={v.remote} onCheckedChange={(remote) => setV({ ...v, remote })} disabled={disabled} />
        <ListSwitchRow title={t("priorities")} subtitle={t("prioritiesHint")} checked={v.priorities} onCheckedChange={(priorities) => setV({ ...v, priorities })} disabled={disabled} />
        <ListSwitchRow title={t("rating")} checked={v.rating} onCheckedChange={(rating) => setV({ ...v, rating })} disabled={disabled} />
      </ListSection>
      <ListSection header={t("almostTurn")}>
        <li className="flex min-h-11 items-center justify-between gap-3 px-4 py-1.5">
          <span className="text-body" aria-live="polite">
            {t("almostTurnValue", { count: v.almostTurn })}
          </span>
          <span className="flex items-center gap-2">
            <IconButton label={ta("decrease")} icon={<Minus />} onClick={() => setV({ ...v, almostTurn: Math.max(1, v.almostTurn - 1) })} disabled={disabled || v.almostTurn <= 1} />
            <IconButton label={ta("increase")} icon={<Plus />} onClick={() => setV({ ...v, almostTurn: Math.min(10, v.almostTurn + 1) })} disabled={disabled || v.almostTurn >= 10} />
          </span>
        </li>
      </ListSection>
      <input type="hidden" name="remoteTicketsEnabled" value={String(v.remote)} />
      <input type="hidden" name="prioritiesEnabled" value={String(v.priorities)} />
      <input type="hidden" name="ratingEnabled" value={String(v.rating)} />
      <input type="hidden" name="almostTurnThreshold" value={v.almostTurn} />
      {disabled ? null : (
        <BottomBar>
          <Button type="submit" block loading={pending} loadingLabel={ta("saving")}>
            {ta("save")}
          </Button>
        </BottomBar>
      )}
    </form>
  );
}
