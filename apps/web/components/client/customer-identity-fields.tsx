"use client";

import { IDENTITY_STORAGE_KEY, NAME_MAX, FILE_NUMBER_MAX, type IdentityRules } from "@nextin/shared/identity";
import { TextField } from "@/components/ui/text-field";
import { useLiteT } from "@/lib/i18n/lite";

export type IdentityValue = { name: string; age: string; fileNumber: string };
export const EMPTY_IDENTITY: IdentityValue = { name: "", age: "", fileNumber: "" };

/** Identité gardée sur cet appareil (jamais envoyée ailleurs qu'à la prise de ticket) ; vide si le stockage est indisponible. */
export function loadSavedIdentity(): IdentityValue {
  try {
    const raw = window.localStorage.getItem(IDENTITY_STORAGE_KEY);
    if (!raw) return EMPTY_IDENTITY;
    const v = JSON.parse(raw) as Partial<IdentityValue>;
    return {
      name: typeof v.name === "string" ? v.name.slice(0, NAME_MAX) : "",
      age: typeof v.age === "string" ? v.age.slice(0, 3) : "",
      fileNumber: typeof v.fileNumber === "string" ? v.fileNumber.slice(0, FILE_NUMBER_MAX) : "",
    };
  } catch {
    return EMPTY_IDENTITY;
  }
}

export function saveIdentity(value: IdentityValue) {
  try {
    window.localStorage.setItem(IDENTITY_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Navigation privée ou stockage plein : la saisie sera simplement redemandée.
  }
}

/**
 * Nom du client (et âge ou numéro de dossier) selon les règles de l'agence, avant « Prendre mon ticket ».
 * Rien n'est affiché si l'agence ne demande pas le nom.
 */
export function CustomerIdentityFields({
  rules,
  value,
  onChange,
  nameError,
}: {
  rules: IdentityRules;
  value: IdentityValue;
  onChange: (value: IdentityValue) => void;
  nameError?: string;
}) {
  const t = useLiteT("identity");
  if (rules.mode === "off") return null;
  return (
    <section aria-label={t("header")} className="flex flex-col gap-3">
      <TextField
        name="customerName"
        label={rules.mode === "required" ? t("name") : t("nameOptional")}
        placeholder={t("namePlaceholder")}
        autoComplete="name"
        autoCapitalize="words"
        maxLength={NAME_MAX}
        required={rules.mode === "required"}
        value={value.name}
        error={nameError}
        onChange={(e) => onChange({ ...value, name: e.target.value })}
      />
      {rules.extra === "age" ? (
        <TextField
          name="customerAge"
          label={t("age")}
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={3}
          value={value.age}
          onChange={(e) => onChange({ ...value, age: e.target.value.replace(/\D/g, "") })}
        />
      ) : null}
      {rules.extra === "file_number" ? (
        <TextField
          name="customerFileNumber"
          label={t("fileNumber")}
          placeholder={t("fileNumberPlaceholder")}
          autoComplete="off"
          maxLength={FILE_NUMBER_MAX}
          value={value.fileNumber}
          onChange={(e) => onChange({ ...value, fileNumber: e.target.value })}
        />
      ) : null}
      <p className="px-4 text-footnote text-label-secondary">{t("clientFooter")}</p>
    </section>
  );
}
