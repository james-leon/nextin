"use client";

import { useActionState } from "react";
import { useLiteT } from "@/lib/i18n/lite";
import { goToEntryCode } from "@/app/(client)/c/actions";
import { BottomBar } from "@/components/ui/bottom-bar";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";

/** Saisie du code court imprimé sous le QR code (secours si la caméra n'est pas utilisable). */
export function CodeForm() {
  const t = useLiteT("client.code");
  const [state, action, pending] = useActionState(goToEntryCode, null);
  return (
    <form action={action} className="flex flex-col gap-4">
      <TextField
        name="code"
        label={t("label")}
        placeholder={t("placeholder")}
        hint={t("body")}
        error={state?.invalid ? t("invalid") : undefined}
        autoComplete="off"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        maxLength={8}
        required
        autoFocus
        className="[&_input]:text-title3 [&_input]:font-semibold [&_input]:tracking-[0.3em] [&_input]:uppercase"
      />
      <BottomBar>
        <Button type="submit" block loading={pending}>
          {t("submit")}
        </Button>
      </BottomBar>
    </form>
  );
}
