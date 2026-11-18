"use client";

import { CodeBoxes } from "@/components/ui/code-boxes";

/** Code à 6 chiffres de l'application d'authentification : six cases (maquette v2 04), remplissage automatique. */
export function TotpCodeField({ label, error, autoFocus }: { label: string; error?: string; autoFocus?: boolean }) {
  return <CodeBoxes label={label} error={error} autoFocus={autoFocus} />;
}
