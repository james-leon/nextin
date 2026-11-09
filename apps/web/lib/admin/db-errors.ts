import { queueErrorCode } from "@nextin/shared/queue";
import type { ErrorCode } from "@/lib/auth/errors";

/**
 * Erreur PostgREST/Postgres → code du dictionnaire `errors`.
 * `unique` précise le message d'une violation d'unicité selon le contexte (préfixe, numéro, nom…).
 * Les erreurs métier des RPC de file (message = code) sont reprises telles quelles.
 */
export function mapDbError(error: { code?: string; message?: string } | null, unique: ErrorCode = "name_taken"): ErrorCode {
  if (!error) return "generic";
  const queue = queueErrorCode(error);
  if (queue) return queue;
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
