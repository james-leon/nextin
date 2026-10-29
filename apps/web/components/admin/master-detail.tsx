"use client";

import type { ReactNode } from "react";
import { useSearchParams, useSelectedLayoutSegment, useSelectedLayoutSegments } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { CalloutCard } from "@/components/ui/callout-card";
import { ListRow } from "@/components/ui/list";
import { cn } from "@/lib/cn";

/**
 * Vue maître-détail façon Réglages d'iPad (revue responsive R1, R2), posée par un `layout.tsx` :
 * - à partir de la tablette (≥ 768 px) : liste à gauche (≈ 300 à 380 px, défilement propre), détail à droite ;
 * - téléphone : la liste seule sur la page de liste, le détail seul sur la page d'un élément (navigation iPhone) ;
 * - pages plus profondes (`depth` segments au-delà) : pleine largeur, sans la liste.
 */
export function MasterDetail({ list, children, depth = 1 }: { list: ReactNode; children: ReactNode; depth?: number }) {
  const segments = useSelectedLayoutSegments();
  if (segments.length > depth) return <>{children}</>;
  const hasDetail = segments.length > 0;
  return (
    <div className="mx-auto max-w-7xl md:flex md:items-start md:px-4 lg:px-6">
      <div
        data-split="list"
        className={cn(
          "md:sticky md:top-0 md:max-h-dvh md:w-72 md:shrink-0 md:overflow-y-auto md:pb-8 lg:w-80 xl:w-[23.75rem]",
          hasDetail && "hidden md:block",
        )}
      >
        {list}
      </div>
      <div data-split="detail" className={cn("@container min-w-0 flex-1", !hasDetail && "hidden md:block")}>
        {children}
      </div>
    </div>
  );
}

/** Ligne de la liste : surlignée quand son élément est affiché à droite. */
export function SplitRow(props: Omit<React.ComponentProps<typeof ListRow>, "current"> & { segment: string }) {
  const { segment, ...row } = props;
  const selected = useSelectedLayoutSegment();
  return <ListRow {...row} current={selected === segment} />;
}

/** « Modifications enregistrées » après une redirection `?saved=1` vers la liste (un gabarit ne lit pas l'URL). */
export function SavedFromQuery({ message }: { message: string }) {
  const params = useSearchParams();
  if (params.get("saved") !== "1") return null;
  return (
    <CalloutCard tone="green" role="status" icon={<CheckCircle2 />}>
      {message}
    </CalloutCard>
  );
}
