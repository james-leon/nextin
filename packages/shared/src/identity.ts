/**
 * Nom du client (et âge ou numéro de dossier) : règles de l'agence et validation, sans dépendance (pages client).
 * Miroir de `public.normalize_customer_identity` / `public.assert_customer_name`. Le nom n'est visible que du
 * personnel de l'agence : jamais sur l'écran TV, dans l'annonce vocale, les messages ni les statistiques.
 */
export const CUSTOMER_NAME_MODES = ["off", "optional", "required"] as const;
export type CustomerNameMode = (typeof CUSTOMER_NAME_MODES)[number];
export const CUSTOMER_NAME_EXTRAS = ["none", "age", "file_number"] as const;
export type CustomerNameExtra = (typeof CUSTOMER_NAME_EXTRAS)[number];
export type IdentityRules = { mode: CustomerNameMode; extra: CustomerNameExtra };

export const NAME_MAX = 80;
export const FILE_NUMBER_MAX = 40;
export const AGE_MAX = 130;

/** Mode par défaut d'une nouvelle agence : obligatoire pour les cliniques et hôpitaux. */
export function defaultNameMode(orgType: string): CustomerNameMode {
  return orgType === "clinic" || orgType === "hospital" ? "required" : "off";
}

export type IdentityInput = { name?: string | null; age?: string | number | null; fileNumber?: string | null };
export type Identity = { name: string | null; age: number | null; fileNumber: string | null };

/** Espaces superflus retirés ; null si vide. */
export function normalizeName(value: string | null | undefined): string | null {
  const v = (value ?? "").trim().replace(/\s+/g, " ");
  return v || null;
}

/**
 * Identité nettoyée selon les règles (rien si le nom n'est pas demandé, le champ supplémentaire seulement s'il est
 * demandé) ou code d'erreur du dictionnaire `errors` : `name_required`, `identity_invalid`.
 */
export function parseIdentity(rules: IdentityRules, input: IdentityInput): { ok: true; identity: Identity } | { ok: false; error: "name_required" | "identity_invalid" } {
  const none: Identity = { name: null, age: null, fileNumber: null };
  if (rules.mode === "off") return { ok: true, identity: none };
  const name = normalizeName(input.name);
  if (!name && rules.mode === "required") return { ok: false, error: "name_required" };
  if (name && name.length > NAME_MAX) return { ok: false, error: "identity_invalid" };
  let age: number | null = null;
  if (rules.extra === "age" && input.age !== null && input.age !== undefined && String(input.age).trim() !== "") {
    const n = Number(String(input.age).trim());
    if (!Number.isInteger(n) || n < 0 || n > AGE_MAX) return { ok: false, error: "identity_invalid" };
    age = n;
  }
  let fileNumber: string | null = null;
  if (rules.extra === "file_number") {
    fileNumber = normalizeName(input.fileNumber);
    if (fileNumber && fileNumber.length > FILE_NUMBER_MAX) return { ok: false, error: "identity_invalid" };
  }
  return { ok: true, identity: { name, age, fileNumber } };
}

/** Ligne affichée au personnel : « Nom · 42 ans » ou « Nom · Dossier D-123 » (libellés fournis par l'appelant). */
export function identityLine(identity: Partial<Identity> | null | undefined, labels: { age: (n: number) => string; file: (v: string) => string }): string | null {
  if (!identity) return null;
  const parts = [identity.name, identity.age != null ? labels.age(identity.age) : null, identity.fileNumber ? labels.file(identity.fileNumber) : null];
  const line = parts.filter(Boolean).join(" · ");
  return line || null;
}

/** Clé de mémorisation sur l'appareil du client (localStorage) : rempli d'avance la fois suivante. */
export const IDENTITY_STORAGE_KEY = "nextin.identity";
