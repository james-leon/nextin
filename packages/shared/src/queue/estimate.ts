/**
 * Estimation de l'attente (PLAN §3.4). Miroir exact des fonctions SQL
 * `effective_duration_seconds` et `estimate_wait_seconds` : mêmes cas de test des deux côtés
 * (`estimate.fixtures.json`, vérifié par Vitest et pgTAP).
 */

/** En dessous de ce nombre de passages mesurés, la durée saisie par le directeur fait foi. */
export const MIN_SAMPLES = 10;
/** Nombre de passages supplémentaires pour basculer entièrement sur la moyenne mesurée. */
export const BLEND_SAMPLES = 20;
/** Lissage exponentiel de la durée moyenne mesurée. */
export const EWMA_ALPHA = 0.2;

/**
 * Durée de service retenue : durée par défaut tant que l'historique est insuffisant,
 * puis mélange progressif vers la moyenne mesurée (EWMA).
 */
export function effectiveDurationSeconds(defaultSeconds: number, ewmaSeconds: number | null, samples: number): number {
  if (ewmaSeconds == null || samples < MIN_SAMPLES) return defaultSeconds;
  const w = Math.min(1, (samples - MIN_SAMPLES) / BLEND_SAMPLES);
  return w * ewmaSeconds + (1 - w) * defaultSeconds;
}

/** Nouvelle moyenne lissée après un passage mesuré ; null si la mesure est aberrante (ignorée). */
export function nextEwma(currentEwma: number | null, samples: number, measuredSeconds: number): number | null {
  if (measuredSeconds < 20) return null;
  if (currentEwma != null && samples >= MIN_SAMPLES && measuredSeconds > 4 * currentEwma) return null;
  if (currentEwma == null || samples === 0) return measuredSeconds;
  return EWMA_ALPHA * measuredSeconds + (1 - EWMA_ALPHA) * currentEwma;
}

export type CounterLoad = {
  /** Durée de service retenue pour ce poste (secondes). */
  durationSeconds: number;
  /** Temps restant avant que le poste soit libre (client en cours), 0 s'il est libre. */
  busyRemainingSeconds: number;
};

/**
 * Attente estimée (secondes) d'un client précédé de `ahead` personnes, servies par des postes en parallèle.
 * Simulation : chaque personne devant est prise par le poste qui se libère le premier.
 * Sans poste ouvert, l'appelant fournit un poste virtuel (durée du service) pour une estimation indicative.
 */
export function estimateWaitSeconds(ahead: number, counters: readonly CounterLoad[]): number {
  if (counters.length === 0) return 0;
  const free = counters.map((c) => Math.max(0, c.busyRemainingSeconds));
  for (let k = 0; k < Math.max(0, ahead); k++) {
    let best = 0;
    for (let i = 1; i < free.length; i++) if (free[i]! < free[best]!) best = i;
    free[best]! += counters[best]!.durationSeconds;
  }
  return Math.round(Math.min(...free));
}

/** Minutes affichées : arrondi au-dessus, au moins 1 dès qu'il reste du temps. */
export function waitMinutes(seconds: number): number {
  return seconds <= 0 ? 0 : Math.max(1, Math.ceil(seconds / 60));
}
