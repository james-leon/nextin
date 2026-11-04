"use client";

import { useEffect } from "react";
import { useAfterFirstLoad } from "./lazy-mount";

/**
 * Pages client légères : Inter et Sora ne sont demandées qu'après le premier affichage (budget < 200 Ko en 3G).
 * Le marqueur `data-defer-fonts` garde la police système jusque-là ; `data-fonts-ready` sur <html> active ensuite
 * les polices de la marque (règle dans globals.css). Une fois posé, il reste pour la navigation suivante.
 */
export function FontsAfterLoad() {
  const ready = useAfterFirstLoad();
  useEffect(() => {
    if (ready) document.documentElement.setAttribute("data-fonts-ready", "");
  }, [ready]);
  return <span data-defer-fonts hidden />;
}
