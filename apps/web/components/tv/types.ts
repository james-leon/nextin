import type { AdCandidate } from "@nextin/shared/ads";
import type { BranchBoard } from "@nextin/shared/queue/live";

export type TvSession = {
  display_id: string;
  name: string;
  show_ads: boolean;
  organization: { name: string; default_locale: string };
  branch: { id: string; name: string; timezone: string };
  service_ids: string[];
  entry: { token: string; short_code: string } | null;
  entry_url: string | null;
  /** QR code de l'écran : `entry_url` + code de présence tournant (`?p=`), renouvelé avec la session. */
  presence_url?: string | null;
  announcements: { languages: ("fr" | "en")[]; volume: number; repeat_count: number; chime_enabled: boolean; quiet_hours: { from: string; to: string }[] };
  board: BranchBoard;
  /** Publicité de l'écran (M10b) : visuels pondérés, vide si l'écran ne l'affiche pas. */
  ads?: AdCandidate[];
  /** Annonces vocales comprises dans la formule (M10a). */
  voice_enabled?: boolean;
  /** Établissement suspendu : message neutre, l'écran reste appairé. */
  unavailable?: boolean;
};
