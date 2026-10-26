import type { ErrorCode } from "@/lib/auth/errors";

/**
 * Erreur PostgREST/Postgres → code du dictionnaire `errors`.
 * `unique` précise le message d'une violation d'unicité selon le contexte (préfixe, numéro, nom…).
 */
export function mapDbError(error: { code?: string; message?: string } | null, unique: ErrorCode = "name_taken"): ErrorCode {
  if (!error) return "generic";
  switch (error.code) {
    case "23505":
      return unique;
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
