"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * Code à usage unique en six cases (maquette v2 04 : code par e-mail, double authentification, inscription).
 * Les cases sont dessinées ; la saisie passe par un vrai champ, posé dessus et invisible : clavier numérique,
 * collage (espaces retirés) et remplissage automatique du code reçu (`one-time-code`) fonctionnent normalement.
 * Le libellé reste lu par les lecteurs d'écran (`aria-label`) et l'erreur est reliée au champ.
 */
export function CodeBoxes({
  name = "code",
  label,
  error,
  hint,
  length = 6,
  autoFocus,
}: {
  name?: string;
  label: string;
  error?: string;
  hint?: string;
  length?: number;
  autoFocus?: boolean;
}) {
  const id = useId();
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(Boolean(autoFocus));
  const digits = value.split("");
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <div aria-hidden className="grid gap-2" style={{ gridTemplateColumns: `repeat(${length}, minmax(0, 1fr))` }}>
          {Array.from({ length }, (_, i) => (
            <span
              key={i}
              className={cn(
                "squircle flex h-[3.5rem] items-center justify-center rounded-[var(--radius-md)] bg-grouped-secondary font-rounded text-title1 font-bold text-ticket-number",
                error && "shadow-[inset_0_0_0_1px_var(--red-text)]",
                focused && i === Math.min(digits.length, length - 1) && "shadow-[inset_0_0_0_2px_var(--accent-text)]",
              )}
            >
              {digits[i] ?? ""}
            </span>
          ))}
        </div>
        <input
          id={id}
          name={name}
          aria-label={label}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/\D/g, "").slice(0, length))}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          inputMode="numeric"
          autoComplete="one-time-code"
          autoCorrect="off"
          spellCheck={false}
          required
          autoFocus={autoFocus}
          className="absolute inset-0 size-full cursor-text rounded-[var(--radius-md)] bg-transparent text-transparent caret-transparent opacity-[0.01] outline-none"
        />
      </div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-footnote text-red-text">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-footnote text-label-secondary">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
