import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Zone d'action principale collée en bas de l'écran (maquettes 02 et 04) :
 * un résumé facultatif puis le bouton principal — une seule action principale par écran.
 */
export function BottomBar({
  summary,
  children,
  position = "fixed",
  className,
}: {
  summary?: ReactNode;
  children: ReactNode;
  /** `absolute` : dans un conteneur positionné (aperçus, cadres). */
  position?: "fixed" | "sticky" | "absolute";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "safe-bottom z-20 bg-gradient-to-t from-grouped from-70% to-transparent px-4 pt-6 pb-4",
        position === "fixed" && "fixed inset-x-0 bottom-0",
        position === "absolute" && "absolute inset-x-0 bottom-0",
        position === "sticky" && "sticky bottom-0",
        className,
      )}
    >
      <div className="mx-auto flex max-w-lg flex-col gap-3">
        {summary ? <p className="text-center text-subheadline text-label-secondary">{summary}</p> : null}
        {children}
      </div>
    </div>
  );
}
