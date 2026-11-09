"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { acceptInvitation } from "@/app/(auth)/invite/[token]/actions";
import { Button } from "@/components/ui/button";
import { FormError } from "./form-error";

export function AcceptInvitationForm({ token, acceptLabel, acceptingLabel }: { token: string; acceptLabel: string; acceptingLabel: string }) {
  const te = useTranslations("errors");
  const [state, action, pending] = useActionState(acceptInvitation, null);
  return (
    <form action={action} className="flex flex-col gap-4">
      <FormError message={state && !state.ok ? te(state.error) : null} />
      <input type="hidden" name="token" value={token} />
      <Button type="submit" block loading={pending} loadingLabel={acceptingLabel}>
        {acceptLabel}
      </Button>
    </form>
  );
}
