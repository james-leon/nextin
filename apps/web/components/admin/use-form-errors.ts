"use client";

import { useTranslations } from "next-intl";
import type { ActionResult } from "@/lib/auth/errors";

/** Erreurs d'un ActionResult : par champ (traduites) et générale (si aucune erreur de champ). */
export function useFormErrors(state: ActionResult<object> | null) {
  const te = useTranslations("errors");
  const failed = state && !state.ok ? state : null;
  return {
    field: (name: string) => {
      const code = failed?.fieldErrors?.[name];
      return code ? te(code) : undefined;
    },
    top: failed && !failed.fieldErrors ? te(failed.error) : null,
  };
}
