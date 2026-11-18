import { messages } from "@nextin/shared/i18n";
import { queueErrorCode } from "@nextin/shared/queue";
import type { ErrorCode } from "@/lib/auth/errors";

const KNOWN = new Set(Object.keys(messages.fr.errors));

/** Code d'erreur métier renvoyé par une RPC (message = clé du dictionnaire `errors`, quel que soit le SQLSTATE). */
function businessCode(message: string | undefined): ErrorCode | null {
  return message && KNOWN.has(message) ? (message as ErrorCode) : null;
}

/**
 * Erreur PostgREST/Postgres → code du dictionnaire `errors`.
 * `unique` précise le message d'une violation d'unicité selon le contexte (préfixe, numéro, nom…).
 * Les erreurs métier des RPC (message = code, SQLSTATE P04xx ou 22023) sont reprises telles quelles : jamais
 * « Une erreur est survenue » quand la base donne la vraie raison.
 */
export function mapDbError(error: { code?: string; message?: string } | null, unique: ErrorCode = "name_taken"): ErrorCode {
  if (!error) return "generic";
  const queue = queueErrorCode(error);
  if (queue) return queue;
  const business = businessCode(error.message);
  if (business && error.code !== "23505") return business;
  switch (error.code) {
    case "23505":
      return unique;
    case "23503":
      return "in_use";
    case "42501":
    case "PGRST301":
      return "not_allowed";
    case "P0001":
      return /org_admin/i.test(error.message ?? "") ? "last_admin" : "generic";
    case "P0002":
    case "PGRST116":
      return "not_found";
    case "P0429":
      return "rate_limited";
    default:
      return "generic";
  }
}

/**
 * Champ du formulaire concerné par un code d'erreur : le premier nom de la liste présent dans le formulaire envoyé.
 * Le message s'affiche alors sous ce champ (et reste aussi en tête du formulaire).
 */
const ERROR_FIELDS: Partial<Record<ErrorCode, readonly string[]>> = {
  reason_required: ["reason", "note"],
  invalid_email: ["email", "ownerEmail", "managerEmail"],
  email_invalid: ["email", "ownerEmail", "managerEmail"],
  email_required: ["email", "ownerEmail", "managerEmail"],
  user_not_found: ["email"],
  invalid_plan: ["planId"],
  invalid_trial_days: ["trialDays"],
  trial_days_invalid: ["trialDays"],
  invalid_slug: ["slug"],
  invalid_name: ["name"],
  name_taken: ["name"],
  invalid_phone: ["phone", "ownerPhone"],
  phone_invalid: ["phone", "ownerPhone"],
  invalid_branch: ["branchName"],
  invalid_type: ["type"],
  invalid_services: ["services"],
  amount_mismatch: ["amountXaf"],
  reference_required: ["reference"],
  invalid_method: ["method"],
  invalid_date: ["paidOn", "date"],
  pack_code_invalid: ["code"],
  prefix_taken: ["prefix"],
};

export function fieldForError(code: ErrorCode, fields: Iterable<string>): string | null {
  const present = new Set(fields);
  return ERROR_FIELDS[code]?.find((f) => present.has(f)) ?? null;
}

/** Échec d'une action à partir d'une erreur de la base : vraie raison, et sous le bon champ si le formulaire l'a. */
export function dbFailure(
  error: { code?: string; message?: string } | null,
  form?: FormData | Record<string, unknown>,
  unique: ErrorCode = "name_taken",
): { ok: false; error: ErrorCode; fieldErrors?: Partial<Record<string, ErrorCode>> } {
  const code = mapDbError(error, unique);
  if (!form) return { ok: false, error: code };
  const keys = form instanceof FormData ? [...new Set(form.keys())] : Object.keys(form);
  const field = fieldForError(code, keys);
  return field ? { ok: false, error: code, fieldErrors: { [field]: code } } : { ok: false, error: code };
}
