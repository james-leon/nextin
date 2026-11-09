"use client";

import { useCallback, useEffect, useState } from "react";

/** Délai sans activité avant de masquer les noms (l'écran du poste peut être vu du public). */
export const NAME_MASK_IDLE_MS = 2 * 60_000;

const ACTIVITY = ["pointerdown", "keydown", "wheel", "touchstart"] as const;

/**
 * Masquage des noms au poste et à l'accueil : bouton « Masquer le nom » / « Afficher le nom », et masquage
 * automatique après 2 minutes sans activité. Les noms restent masqués jusqu'à ce que le personnel les réaffiche.
 */
export function useNameMask(idleMs = NAME_MASK_IDLE_MS) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (hidden) return;
    let timer = window.setTimeout(() => setHidden(true), idleMs);
    const reset = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setHidden(true), idleMs);
    };
    for (const e of ACTIVITY) window.addEventListener(e, reset, { passive: true });
    return () => {
      window.clearTimeout(timer);
      for (const e of ACTIVITY) window.removeEventListener(e, reset);
    };
  }, [hidden, idleMs]);

  const hide = useCallback(() => setHidden(true), []);
  const show = useCallback(() => setHidden(false), []);
  return { hidden, hide, show, toggle: hidden ? show : hide };
}
