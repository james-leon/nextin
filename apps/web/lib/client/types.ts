import type { BranchBoard } from "@nextin/shared/queue/live";
import type { PriorityReason, TicketStatus } from "@nextin/shared/queue/live";
import type { TicketSource } from "@nextin/shared/ticket";

/** Réponse de `resolve_entry` (QR code ou code court). */
export type EntryInfo = {
  entry_code: string;
  source: "qr" | "short_code";
  service_id: string | null;
  organization: { name: string; default_locale: string; type: string };
  branch: { id: string; name: string; city: string | null; is_open: boolean };
  priorities_enabled: boolean;
  priority_service_ids: string[];
  board: BranchBoard;
};

export type { TicketStatus };
export type CounterRef = { kind: "cabinet" | "guichet" | "caisse" | "laboratoire" | "accueil"; number: number; label: string | null };

/** Réponse de `get_ticket` / diffusion `ticket:<jeton>` : aucune donnée personnelle. */
export type TicketView = {
  id: string;
  display_code: string;
  status: TicketStatus;
  source: TicketSource;
  priority_reason: PriorityReason | null;
  service: { id: string; name: string; name_en: string | null; prefix: string; color: string };
  branch: { id: string; name: string };
  organization: { name: string; default_locale: string };
  position: number | null;
  wait_seconds: number | null;
  /** Retour prévu du praticien attitré s'il est en retard (M5). */
  practitioner_late_until?: string | null;
  counter: CounterRef | null;
  called_at: string | null;
  serving_started_at: string | null;
  finished_at: string | null;
  rating: number | null;
  rating_enabled: boolean;
  created_at: string;
  /** Canaux d'alerte actifs (M7). */
  alerts?: { whatsapp: boolean; push: boolean };
};
