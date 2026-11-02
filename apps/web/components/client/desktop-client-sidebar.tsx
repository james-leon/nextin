"use client";

import dynamic from "next/dynamic";
import { useMediaQuery } from "@/components/ui/use-media-query";

// Chargée seulement sur ordinateur : rien de plus au premier chargement sur téléphone (budget < 200 Ko).
const ClientTabBar = dynamic(() => import("./client-tab-bar").then((m) => m.ClientTabBar), { ssr: false });

/**
 * Menu latéral client des pages sans barre d'onglets sur téléphone (« Choisir un service », « Mon ticket »).
 * À partir de 1024 px, même gabarit que les autres pages client ; la place est réservée dès le rendu serveur
 * (`data-reserve-tab-sidebar`, règle dans `globals.css`) pour que le contenu ne se décale pas au chargement.
 */
export function DesktopClientSidebar({ active }: { active: "scan" | "nearby" | "ticket" | "profile" }) {
  const desktop = useMediaQuery("(min-width: 1024px)");
  return (
    <>
      <span data-reserve-tab-sidebar hidden />
      {desktop ? <ClientTabBar active={active} /> : null}
    </>
  );
}
