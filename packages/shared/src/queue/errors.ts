/**
 * Erreurs métier levées par les RPC de file (message = code, SQLSTATE P04xx).
 * Chaque code est aussi une clé du dictionnaire `errors`.
 */
export const QUEUE_ERROR_CODES = [
  "slot_unavailable",
  "schedule_overlap",
  "appointment_not_today",
  "not_found",
  "not_allowed",
  "rate_limited",
  "invalid_entry",
  "branch_closed",
  "service_closed",
  "quota_reached",
  "priority_not_allowed",
  "remote_not_allowed",
  "active_ticket_exists",
  "counter_busy",
  "counter_not_open",
  "invalid_state",
  "already_rated",
  "rating_disabled",
  "consent_required",
  "phone_invalid",
  // M9 — ticket à distance et demandes de rendez-vous.
  "location_required",
  "too_far",
  "requests_disabled",
  "request_duplicate",
  "request_limit",
  "code_invalid",
  "code_expired",
] as const;
export type QueueErrorCode = (typeof QUEUE_ERROR_CODES)[number];

/** Code métier d'une erreur PostgREST issue d'une RPC de file, ou null si l'erreur n'en est pas une. */
export function queueErrorCode(error: { code?: string; message?: string } | null | undefined): QueueErrorCode | null {
  if (!error) return null;
  if (error.code === "42501") return "not_allowed";
  const message = error.message?.trim() ?? "";
  return (QUEUE_ERROR_CODES as readonly string[]).includes(message) ? (message as QueueErrorCode) : null;
}

/** Statut HTTP d'une erreur de file (route handlers). */
export function queueErrorStatus(code: QueueErrorCode): number {
  switch (code) {
    case "not_found":
      return 404;
    case "not_allowed":
      return 403;
    case "rate_limited":
      return 429;
    case "branch_closed":
    case "service_closed":
    case "quota_reached":
      return 410;
    case "counter_busy":
    case "counter_not_open":
    case "invalid_state":
    case "already_rated":
    case "rating_disabled":
    case "active_ticket_exists":
    case "request_duplicate":
    case "request_limit":
    case "code_expired":
      return 409;
    default:
      return 422;
  }
}
