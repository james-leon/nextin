/** Réponses des fonctions des jeux (M10b) : aucun nom ni identifiant du client. */
import type { AdCandidate } from "@nextin/shared/ads";

export type GamesAvailable = { quiz: boolean; sky_catch: boolean } | null;

export type GameSkin = {
  id: string;
  campaign_id: string;
  plane_primary: string;
  plane_secondary: string;
  coin_logo_path: string | null;
  end_title: string;
  end_title_en: string | null;
  reward: string;
  reward_en: string | null;
  min_levels: number;
  advertiser: string;
};

export type GameSession = {
  quiz: { id: string; title: string; title_en: string | null; reward: string; reward_en: string | null; advertiser: string; played: boolean } | null;
  sky_catch: { skin: GameSkin | null } | null;
  interstitial: { skip_after: number; min_gap: number };
  ads: AdCandidate[];
  /** Visuels déjà tirés au sort par la base (ordre des interstitielles). */
  sequence: string[];
  branch_id: string;
};

export type Coupon = { code: string; qr_token: string; reward: string; reward_en: string | null; expires_at: string; already: boolean };

export type QuizStart = {
  play_id: string;
  finished: boolean;
  score: number | null;
  total: number;
  questions: { id: string; question: string; question_en: string | null; answers: { text: string; text_en: string | null }[] }[];
};

export type QuizResult = { score: number; total: number; correct: number[]; coupon: Coupon | null };
export type SkyCatchResult = { levels: number; score: number; coupon: Coupon | null };
