"use client";

import { useEffect } from "react";

/**
 * Enregistre le service worker (production uniquement, pour ne pas mettre en cache le dev). Interrupteur
 * `NEXT_PUBLIC_SW_ENABLED` (lu par le serveur à l'exécution, `true` par défaut) : à `false`, le service worker déjà
 * installé est désinstallé et ses caches effacés (diagnostic de l'écran blanc sur iPhone, LOT 5a E).
 */
export function ServiceWorkerRegister({ enabled = true }: { enabled?: boolean }) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    if (!enabled) {
      void navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => Promise.all(registrations.map((r) => r.unregister())))
        .then(() => (typeof caches === "undefined" ? undefined : caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith("nextin-")).map((k) => caches.delete(k))))))
        .catch(() => {});
      return;
    }
    const register = () => navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, [enabled]);
  return null;
}
