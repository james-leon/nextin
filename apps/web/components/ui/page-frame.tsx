"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type Frame = { slot: HTMLElement | null; setSlot: (el: HTMLElement | null) => void };

const FrameContext = createContext<Frame | null>(null);

/**
 * Cadre d'une page du personnel : relie la barre de navigation et l'action principale de la page.
 * Sur ordinateur (≥ 1024 px), la `BottomBar` de la page remonte dans la barre de titre, à droite du grand titre
 * (revue responsive R3) ; sur téléphone et tablette, elle reste en bas, à la largeur du contenu.
 */
export function PageFrame({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const value = useMemo(() => ({ slot, setSlot }), [slot]);
  return <FrameContext.Provider value={value}>{children}</FrameContext.Provider>;
}

export function usePageFrame(): Frame | null {
  return useContext(FrameContext);
}

/** Emplacement de l'action principale dans la barre de navigation (`ref` de rappel), ou rien hors d'un cadre. */
export function usePageSlotSetter(): ((el: HTMLElement | null) => void) | undefined {
  return useContext(FrameContext)?.setSlot;
}
