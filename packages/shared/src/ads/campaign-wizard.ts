/**
 * Espace annonceur (maquette v2 24) : logique pure de la campagne en cinq étapes, du récapitulatif et des phrases de
 * statut. Aucune règle métier nouvelle : la base reste juge (`save_campaign`, `submit_campaign`).
 */

export const CAMPAIGN_STEPS = ["package", "targeting", "creatives", "games", "submit"] as const;
export type CampaignStep = (typeof CAMPAIGN_STEPS)[number];

/** Étape à partir de son numéro (1 à 5) ; toute autre valeur → `null`. */
export function stepFromNumber(value: unknown): CampaignStep | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= CAMPAIGN_STEPS.length ? CAMPAIGN_STEPS[n - 1]! : null;
}

export function stepNumber(step: CampaignStep): number {
  return CAMPAIGN_STEPS.indexOf(step) + 1;
}

export function previousStep(step: CampaignStep): CampaignStep | null {
  const i = CAMPAIGN_STEPS.indexOf(step);
  return i > 0 ? CAMPAIGN_STEPS[i - 1]! : null;
}

export function nextStep(step: CampaignStep): CampaignStep | null {
  const i = CAMPAIGN_STEPS.indexOf(step);
  return i < CAMPAIGN_STEPS.length - 1 ? CAMPAIGN_STEPS[i + 1]! : null;
}

export type WizardProgress = {
  /** Campagne enregistrée (nom, formule et date de début : étape 1 franchie). */
  saved: boolean;
  /** Nombre de visuels. */
  creatives: number;
};

/**
 * Étape où reprendre une campagne quittée en cours de route : la première encore incomplète. Le ciblage et les jeux
 * sont facultatifs (« partout », pas de quiz) : seuls l'enregistrement et un visuel sont exigés avant l'envoi.
 */
export function firstIncompleteStep(p: WizardProgress): CampaignStep {
  if (!p.saved) return "package";
  if (p.creatives < 1) return "creatives";
  return "submit";
}

/** Étape accessible depuis la frise : la formule toujours ; la suite une fois la campagne enregistrée ; l'envoi avec un visuel. */
export function canOpenStep(step: CampaignStep, p: WizardProgress): boolean {
  if (step === "package") return true;
  if (!p.saved) return false;
  return step !== "submit" || p.creatives > 0;
}

/** Dernier jour de diffusion (inclus) : début + durée de la formule − 1 (comme `save_campaign`). */
export function campaignEndsOn(startsOn: string, durationDays: number): string {
  const start = Date.parse(`${startsOn}T00:00:00Z`);
  if (Number.isNaN(start)) return startsOn;
  return new Date(start + (Math.max(durationDays, 1) - 1) * 86_400_000).toISOString().slice(0, 10);
}

export type CampaignStatus = "draft" | "pending_review" | "rejected" | "awaiting_payment" | "active" | "paused" | "ended";
export type StatusTone = "green" | "orange" | "accent" | "neutral" | "red";

/**
 * Couleur d'un statut (liste et pastille) : Diffusée vert, À payer orange (attente d'une action), En validation bleu,
 * Refusée rouge, Brouillon, En pause et Terminée gris.
 */
export const CAMPAIGN_STATUS_TONE: Record<CampaignStatus, StatusTone> = {
  draft: "neutral",
  pending_review: "accent",
  rejected: "red",
  awaiting_payment: "orange",
  active: "green",
  paused: "neutral",
  ended: "neutral",
};

/**
 * Seconde ligne d'une campagne dans la liste : « Argent · jusqu'au 28 nov. » (diffusée ou en pause),
 * « Terminée le 31 oct. » (terminée), sinon « Bronze · 7 jours » (la diffusion n'a pas commencé).
 */
export function campaignListLine(status: CampaignStatus): "until" | "ended" | "duration" {
  if (status === "active" || status === "paused") return "until";
  if (status === "ended") return "ended";
  return "duration";
}

/**
 * Phrase de statut en tête du détail (une seule) : couleur, et titre éventuel (« Campagne validée » au-dessus de
 * « Payez pour lancer la diffusion le 23 novembre. »).
 */
export function campaignNotice(status: CampaignStatus): { key: CampaignStatus; tone: StatusTone; title: boolean } {
  const neutral = status === "paused" || status === "ended" || status === "draft";
  return { key: status, tone: neutral ? "neutral" : CAMPAIGN_STATUS_TONE[status], title: status === "awaiting_payment" };
}

/** Une campagne d'annonceur se modifie en brouillon ou après un refus. */
export function campaignEditable(status: CampaignStatus): boolean {
  return status === "draft" || status === "rejected";
}

export type PackageSurfaces = { surfaces: readonly string[]; quiz_allowed: boolean; game_skin_allowed: boolean };

/** Pastilles des surfaces d'une formule : surfaces de diffusion, puis « Quiz » et « Sky Catch » si inclus. */
export function packageBadges(p: PackageSurfaces): string[] {
  const surfaces = ["tv", "app", "game"].filter((s) => p.surfaces.includes(s));
  return [...surfaces, ...(p.quiz_allowed ? ["quiz"] : []), ...(p.game_skin_allowed ? ["skin"] : [])];
}

/** Ce que proposent les jeux (étape 4) : quiz (Argent, Or), habillage de Sky Catch (Or), ou rien (Bronze). */
export function gamesOffer(p: Pick<PackageSurfaces, "quiz_allowed" | "game_skin_allowed">): "none" | "quiz" | "quiz_skin" {
  if (p.game_skin_allowed) return "quiz_skin";
  return p.quiz_allowed ? "quiz" : "none";
}

export type CampaignSummaryInput = {
  package: { price_xaf: number; duration_days: number; max_branches: number | null } | null;
  startsOn: string;
  cities: readonly string[];
  orgTypes: readonly string[];
  creatives?: readonly { kind: "image" | "video" }[];
  quizQuestions?: number;
};

export type CampaignSummary = {
  /** Début et fin (inclus) de la diffusion. */
  period: { from: string; to: string } | null;
  /** Villes ciblées ; vide = tout le pays. */
  cities: readonly string[];
  /** Nombre de types d'établissement ; 0 = tous. */
  orgTypes: number;
  /** Plafond d'agences de la formule ; null = toutes. */
  maxBranches: number | null;
  images: number;
  videos: number;
  quizQuestions: number;
  total: number | null;
};

/** Récapitulatif d'une campagne (colonne de droite sur ordinateur, étape 5 sur téléphone). */
export function campaignSummary(input: CampaignSummaryInput): CampaignSummary {
  const p = input.package;
  return {
    period: p ? { from: input.startsOn, to: campaignEndsOn(input.startsOn, p.duration_days) } : null,
    cities: input.cities,
    orgTypes: input.orgTypes.length,
    maxBranches: p ? p.max_branches : null,
    images: (input.creatives ?? []).filter((c) => c.kind === "image").length,
    videos: (input.creatives ?? []).filter((c) => c.kind === "video").length,
    quizQuestions: input.quizQuestions ?? 0,
    total: p ? p.price_xaf : null,
  };
}

/** Villes en pastilles : les cochées d'abord, puis les autres, `visible` au plus tant que la liste est repliée. */
export function visibleCities(all: readonly string[], selected: readonly string[], expanded: boolean, visible = 4): { shown: string[]; hidden: number } {
  const ordered = [...selected.filter((c) => all.includes(c)), ...all.filter((c) => !selected.includes(c))];
  if (expanded || ordered.length <= visible) return { shown: ordered, hidden: 0 };
  const count = Math.max(visible, selected.length);
  return { shown: ordered.slice(0, count), hidden: ordered.length - count };
}
