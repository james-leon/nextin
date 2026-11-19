"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Heure courante des postes (chrono du client en cours, minutes d'attente), arrondie à `intervalMs` et avancée à ce
 * rythme. null pendant le rendu serveur et l'hydratation : le texte calculé ne diffère jamais entre le serveur et le
 * navigateur (erreur d'hydratation React n° 418 signalée par `/api/client-log`), puis l'heure du navigateur prend le relais.
 */
export function useNow(intervalMs: number, ticking = true): number | null {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!ticking) return () => {};
      const id = setInterval(onChange, intervalMs);
      return () => clearInterval(id);
    },
    [intervalMs, ticking],
  );
  return useSyncExternalStore(
    subscribe,
    () => Math.floor(Date.now() / intervalMs) * intervalMs,
    () => null,
  );
}
