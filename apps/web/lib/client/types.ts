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
  branch: { id: string; name: string; address?: string | null; city?: string | null; latitude?: number | null; longitude?: number | null };
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
  /** Ticket à distance (M9) : présence, trajet, reculs ; null pour un ticket pris sur place. */
  remote?: RemoteState | null;
};

export type RemoteState = {
  presence_confirmed_at: string | null;
  on_my_way_at: string | null;
  travel_seconds: number | null;
  leave_margin_seconds: number;
  delay_count: number;
  max_delays: number;
  confirm_threshold: number;
  penalty_places: number;
  cancelled_for_absence: boolean;
};

/* ─── M9 : établissements à proximité, page d'agence, demandes de rendez-vous ─── */

export type NearbyService = {
  id: string;
  prefix: string;
  name: string;
  name_en: string | null;
  color: string;
  open: boolean;
  waiting: number;
  wait_seconds: number;
};

/** Résumé public d'une agence (`nearby_branches`, sans le détail des services : page légère) : aucune donnée personnelle. */
export type NearbyBranch = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  distance_m: number | null;
  organization: { name: string; type: string };
  is_open: boolean;
  remote_enabled: boolean;
  requests_enabled: boolean;
  waiting: number;
  min_wait_seconds: number | null;
  /** Détail par service : seulement dans `branch_public`. */
  services?: NearbyService[];
};

/** Page publique d'une agence (`branch_public`). */
export type BranchPublic = Omit<NearbyBranch, "organization"> & {
  phone_e164: string | null;
  timezone: string;
  organization: { name: string; type: string; default_locale: string };
  hours: { weekday: number; opens_at: string; closes_at: string }[];
  priorities_enabled: boolean;
  priority_service_ids: string[];
  remote: {
    enabled: boolean;
    service_ids: string[];
    max_distance_km: number | null;
    confirm_threshold: number;
    penalty_places: number;
    max_delays: number;
  };
  board: BranchBoard;
};

/** Formulaire de demande de rendez-vous (`request_options`). */
export type RequestOptions = {
  branch: Omit<NearbyBranch, "services">;
  timezone: string;
  days: number;
  services: {
    id: string;
    name: string;
    name_en: string | null;
    prefix: string;
    color: string;
    practitioners: { id: string; name: string }[];
  }[];
  slots: { starts_at: string; practitioner_id: string; service_id: string }[];
};

export type RequestStatus = "unverified" | "pending" | "accepted" | "modified" | "declined" | "expired" | "cancelled";

/** Vue publique d'une demande (`get_appointment_request`) : numéro masqué. */
export type RequestView = {
  id: string;
  status: RequestStatus;
  service: { id: string; name: string; name_en: string | null; prefix: string; color: string };
  practitioner: string | null;
  preferred_starts_at: string | null;
  preferred_day: string | null;
  preferred_period: "morning" | "afternoon" | "any" | null;
  phone_masked: string | null;
  locale: "fr" | "en";
  code_expires_at: string | null;
  decline_reason: string | null;
  created_at: string;
  branch: {
    id: string;
    name: string;
    address: string | null;
    city: string | null;
    timezone: string;
    latitude: number | null;
    longitude: number | null;
    phone_e164: string | null;
  };
  organization: { name: string };
  appointment: { starts_at: string; status: string; practitioner: string } | null;
};
