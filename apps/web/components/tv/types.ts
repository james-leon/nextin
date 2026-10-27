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
  announcements: { languages: ("fr" | "en")[]; volume: number; repeat_count: number; chime_enabled: boolean; quiet_hours: { from: string; to: string }[] };
  board: BranchBoard;
};
