import Link from "next/link";
import { canSignalOnMyWay, type TicketSource } from "@nextin/shared";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/**
 * Actions du bas de « Mon ticket » (maquette 03), **à la fin du contenu**, jamais fixées sur l'écran (rien ne
 * masque le ticket ni l'attente). Ticket pris à distance (`canSignalOnMyWay`) : « Je suis en route », puis
 * « Je suis arrivé » (lien vers le scanner, `onMyWayHref`) ; rien une fois la présence confirmée (`hideRemote`).
 * « Annuler le ticket » : lien discret (gris, souligné), toujours suivi d'une confirmation.
 */
export function TicketBottomActions({
  source,
  onMyWayLabel,
  cancelLabel,
  onMyWay,
  onMyWayHref,
  hideRemote,
  onCancel,
  className,
}: {
  source: TicketSource;
  onMyWayLabel: string;
  cancelLabel: string;
  onMyWay?: () => void;
  onMyWayHref?: string;
  hideRemote?: boolean;
  onCancel?: () => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-2 pt-2", className)}>
      {canSignalOnMyWay(source) && !hideRemote ? (
        onMyWayHref ? (
          <Button asChild block variant="tinted" className="h-auto min-h-[3.125rem] whitespace-normal py-3 text-center text-balance">
            <Link href={onMyWayHref}>{onMyWayLabel}</Link>
          </Button>
        ) : (
          <Button block variant="tinted" onClick={onMyWay} className="h-auto min-h-[3.125rem] whitespace-normal py-3 text-center text-balance">
            {onMyWayLabel}
          </Button>
        )
      ) : null}
      <Button
        variant="plain"
        size="md"
        onClick={onCancel}
        className="font-normal text-label-secondary underline decoration-separator-opaque underline-offset-4"
      >
        {cancelLabel}
      </Button>
    </div>
  );
}
