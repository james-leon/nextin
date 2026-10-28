/**
 * Règles d'envoi (§5.5), pures et testées : canal WhatsApp (message libre ou modèle), relances,
 * pertinence au moment de l'envoi, délai de garde avant le SMS de secours.
 */
import type { NotifEvent } from "./messages";

/** Statuts d'un ticket utiles ici (enum SQL `ticket_status`). */
type TicketStatus = "waiting" | "called" | "serving" | "served" | "no_show" | "cancelled" | "transferred";

/** Délai de garde : sans accusé de remise WhatsApp de « c'est votre tour » après 2 minutes, un SMS part. */
export const YOUR_TURN_SMS_GUARD_SECONDS = 120;
export const MAX_ATTEMPTS = 3;
/** Marge avant la fin de la fenêtre de 24 h (un message libre envoyé trop tard serait refusé). */
const WINDOW_MARGIN_MS = 60_000;

/** Message libre dans la fenêtre de 24 h ouverte par le client ; modèle approuvé sinon. */
export function whatsappMode(windowExpiresAt: string | null, now: Date = new Date()): "session" | "template" {
  return windowExpiresAt && new Date(windowExpiresAt).getTime() - WINDOW_MARGIN_MS > now.getTime() ? "session" : "template";
}

/** Délai avant un nouvel essai après une erreur temporaire, ou null : abandon (et SMS de secours si possible). */
export function retryDelaySeconds(attempt: number): number | null {
  if (attempt >= MAX_ATTEMPTS) return null;
  return [30, 120][attempt - 1] ?? 120;
}

/** Un message n'a de sens que si le ticket est toujours dans l'état attendu (sinon il est ignoré). */
export function isStillRelevant(event: NotifEvent, status: TicketStatus): boolean {
  return event === "your_turn" ? status === "called" : status === "waiting";
}

/** SMS de secours : le délai de garde est annulé si le message d'origine a été remis ou lu. */
export function guardSatisfied(originalStatus: string | null): boolean {
  return originalStatus === "delivered" || originalStatus === "read";
}
