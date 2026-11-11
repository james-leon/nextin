"use client";

import { TextField } from "@/components/ui/text-field";

/** Champ du code à 6 chiffres (clavier numérique, remplissage automatique du code à usage unique). */
export function TotpCodeField({ label, error, autoFocus }: { label: string; error?: string; autoFocus?: boolean }) {
  return (
    <TextField
      name="code"
      label={label}
      inputMode="numeric"
      autoComplete="one-time-code"
      pattern="[0-9 ]*"
      maxLength={7}
      autoFocus={autoFocus}
      required
      className="[&_input]:tabular [&_input]:tracking-[0.3em]"
      error={error}
    />
  );
}
