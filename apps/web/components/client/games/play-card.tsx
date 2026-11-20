"use client";

import { ChevronRight, Plane } from "lucide-react";
import { OptionList, OptionRow } from "@/components/client/option-row";
import { useLiteT } from "@/lib/i18n/lite";

/**
 * Ligne « Jouer en attendant » (maquette v2 01) : toujours proposée tant que le ticket attend (le jeu de paires ne
 * dépend d'aucun contenu ni réglage publicitaire) ; les jeux disponibles sont lus à l'ouverture de la feuille.
 */
export function PlayCard({ onOpen }: { onOpen: () => void }) {
  const t = useLiteT("games");
  return (
    <OptionList label={t("cardTitle")}>
      <OptionRow
        onClick={onOpen}
        color="var(--orange-fill)"
        icon={<Plane />}
        title={t("cardTitle")}
        subtitle={t("cardBody")}
        trailing={<ChevronRight aria-hidden className="size-[1.125rem] shrink-0 stroke-[2.25] text-label-tertiary" />}
      />
    </OptionList>
  );
}
