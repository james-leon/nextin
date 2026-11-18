"use client";

import { useActionState, useState } from "react";
import { useLiteT } from "@/lib/i18n/lite";
import { goToEntryCode } from "@/app/(client)/c/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

const LENGTH = 6;

/**
 * Saisie du code court imprimé sous le QR code (maquette v2 02, secours si la caméra n'est pas utilisable) : six
 * cases en chiffres arrondis, la case en cours entourée de bleu. Un vrai champ texte (étiqueté « Code ») reste
 * dessous, invisible : clavier, collage et remplissage automatique fonctionnent comme d'habitude.
 */
export function CodeForm() {
  const t = useLiteT("client.code");
  const [state, action, pending] = useActionState(goToEntryCode, null);
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(true);
  const chars = value.replace(/\s/g, "").toUpperCase().slice(0, LENGTH).split("");
  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="relative">
        <div aria-hidden className="grid grid-cols-6 gap-2">
          {Array.from({ length: LENGTH }, (_, i) => (
            <span
              key={i}
              className={cn(
                "squircle flex h-[3.875rem] items-center justify-center rounded-[12px] bg-grouped-secondary font-rounded text-title1 font-bold text-ticket-number",
                focused && i === Math.min(chars.length, LENGTH - 1) && "shadow-[inset_0_0_0_2px_var(--accent-text)]",
              )}
            >
              {chars[i] ?? ""}
            </span>
          ))}
        </div>
        <input
          name="code"
          aria-label={t("label")}
          aria-describedby="code-hint"
          aria-invalid={state?.invalid || undefined}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoComplete="off"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          maxLength={8}
          required
          autoFocus
          className="absolute inset-0 size-full cursor-text rounded-[12px] bg-transparent text-transparent caret-transparent opacity-[0.01] outline-none"
        />
      </div>
      <p id="code-hint" className={cn("text-footnote", state?.invalid ? "text-red-text" : "text-label-secondary")} role={state?.invalid ? "alert" : undefined}>
        {state?.invalid ? t("invalid") : t("hint")}
      </p>
      <Button type="submit" block loading={pending}>
        {t("submit")}
      </Button>
    </form>
  );
}
