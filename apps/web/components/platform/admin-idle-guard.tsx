"use client";

import { useEffect } from "react";

const IDLE_MS = 30 * 60 * 1000;
const EVENTS = ["pointerdown", "keydown", "scroll", "touchstart"] as const;

/**
 * Console Wintek (B5) : après 30 minutes sans interaction, la page est rechargée ; le proxy constate l'inactivité
 * (dernière requête trop ancienne), ferme la session et renvoie vers la connexion. Rien n'est affiché.
 */
export function AdminIdleGuard() {
  useEffect(() => {
    let timer = window.setTimeout(expire, IDLE_MS);
    function expire() {
      window.location.reload();
    }
    function reset() {
      window.clearTimeout(timer);
      timer = window.setTimeout(expire, IDLE_MS);
    }
    for (const e of EVENTS) window.addEventListener(e, reset, { passive: true });
    return () => {
      window.clearTimeout(timer);
      for (const e of EVENTS) window.removeEventListener(e, reset);
    };
  }, []);
  return null;
}
