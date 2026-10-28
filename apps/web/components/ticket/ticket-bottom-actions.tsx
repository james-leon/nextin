import Link from "next/link";
import { canSignalOnMyWay, type TicketSource } from "@nextin/shared";
import { BottomBar } from "@/components/ui/bottom-bar";
import { Button } from "@/components/ui/button";

/**
 * Actions du bas de « Mon ticket » (maquette 03), toujours visibles dans une BottomBar.
 * Ticket pris à distance (`canSignalOnMyWay`) : « Je suis en route », puis « Je suis arrivé » (lien vers le
 * scanner, `onMyWayHref`) ; rien une fois la présence confirmée (`hideRemote`).
 */
export function TicketBottomActions({
  source,
  onMyWayLabel,
  cancelLabel,
  onMyWay,
  onMyWayHref,
  hideRemote,
  onCancel,
  position,
  className,
}: {
  source: TicketSource;
  onMyWayLabel: string;
  cancelLabel: string;
  onMyWay?: () => void;
  onMyWayHref?: string;
  hideRemote?: boolean;
  onCancel?: () => void;
  position?: "fixed" | "sticky" | "absolute";
  className?: string;
}) {
  return (
    <BottomBar position={position} className={className}>
      {canSignalOnMyWay(source) && !hideRemote ? (
        onMyWayHref ? (
          <Button asChild block variant="tinted">
            <Link href={onMyWayHref}>{onMyWayLabel}</Link>
          </Button>
        ) : (
          <Button block variant="tinted" onClick={onMyWay}>
            {onMyWayLabel}
          </Button>
        )
      ) : null}
      <Button block variant="destructive-plain" onClick={onCancel} className="-mt-2">
        {cancelLabel}
      </Button>
    </BottomBar>
  );
}
