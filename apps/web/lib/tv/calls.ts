import { isActiveCall, type BoardCall, type BranchBoard } from "@nextin/shared/queue/live";

/** Lignes d'appels en cours affichées au plus (lisibles à 3 m de 720p à la 4K). */
export const TV_MAX_CALLS = 4;
/** Numéros « À suivre » et « Appels précédents » affichés au plus. */
export const TV_MAX_NEXT = 6;

export type TvView = {
  /** Appels en cours (patient alerté ou admis), du plus récent au plus ancien. */
  current: BoardCall[];
  /** Dernier appel (patient alerté, pas encore admis) : marqué d'un trait et de l'étiquette « Appel ». */
  latest: BoardCall | null;
  /** Appels terminés depuis moins de 30 minutes (écran sans appel en cours). */
  previous: BoardCall[];
  /** Prochains numéros, pris à tour de rôle dans chaque service (ordre de passage de chaque file). */
  next: string[];
  /** Personnes en attente dans les services de l'écran. */
  waiting: number;
};

/**
 * Contenu de l'écran TV (maquette v2 09) pour les services de l'écran : appels en cours (`isActiveCall`), dernier appel
 * marqué, appels précédents, numéros à suivre et nombre de personnes en attente. Aucun nom : seulement des numéros.
 */
export function tvView(board: BranchBoard, serviceIds: readonly string[]): TvView {
  const shown = (id: string) => serviceIds.length === 0 || serviceIds.includes(id);
  const calls = board.calls.filter((c) => shown(c.service_id));
  const current = calls.filter(isActiveCall).slice(0, TV_MAX_CALLS);
  const latest = current[0]?.status === "called" ? current[0] : null;
  const previous = calls.filter((c) => !isActiveCall(c)).slice(0, TV_MAX_NEXT);
  const queues = board.services.filter((s) => shown(s.id)).map((s) => s.waiting);
  const next: string[] = [];
  for (let i = 0; next.length < TV_MAX_NEXT && queues.some((q) => i < q.length); i++) {
    for (const q of queues) if (i < q.length && next.length < TV_MAX_NEXT) next.push(q[i]!);
  }
  return { current, latest, previous, next, waiting: queues.reduce((n, q) => n + q.length, 0) };
}

/** Code de présence tournant de l'écran (paramètre `p` de l'URL du QR code), s'il existe. */
export function presenceCodeOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).searchParams.get("p");
  } catch {
    return null;
  }
}
