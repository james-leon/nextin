"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Monte un bloc secondaire (jeux, pub sponsorisée) après le premier affichage : 3 s après le chargement de la page,
 * quand le navigateur est inactif, et seulement si l'emplacement est à l'écran. Son code, ses données et ses images restent
 * hors du premier chargement des pages client (budget < 200 Ko, 3G) ; le ticket s'affiche toujours en premier.
 */
export function LazyMount({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || mounted) return;
    let io: IntersectionObserver | null = null;
    let idle = 0;
    const watch = () => {
      io = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setMounted(true);
          io?.disconnect();
        }
      });
      io.observe(el);
    };
    const afterLoad = () => {
      // Après l'événement « load » : délai d'inactivité (2 s au plus), sans gêner l'affichage du ticket.
      idle = typeof window.requestIdleCallback === "function" ? window.requestIdleCallback(watch, { timeout: 2000 }) : window.setTimeout(watch, 1500);
    };
    let delay = 0;
    const start = () => (delay = window.setTimeout(afterLoad, 3000));
    if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });
    return () => {
      window.removeEventListener("load", start);
      window.clearTimeout(delay);
      if (typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(idle);
      window.clearTimeout(idle);
      io?.disconnect();
    };
  }, [mounted]);
  return <div ref={ref}>{mounted ? children : null}</div>;
}
