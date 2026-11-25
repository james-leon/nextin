"use client";

import { useEffect } from "react";
import { installNavFeedback } from "@/lib/ui/nav-feedback";

/**
 * Barre de progression des navigations (`#nx-nav`, gabarit racine) et installation des écouteurs : toute navigation
 * donne une réaction visible en moins de 100 ms (lien en cours), la barre au-delà de 150 ms.
 */
export function NavFeedback() {
  useEffect(installNavFeedback, []);
  return <div id="nx-nav" aria-hidden />;
}
