import { canSignalOnMyWay, type TicketSource } from "@nextin/shared";
import { BottomBar } from "@/components/ui/bottom-bar";
import { Button } from "@/components/ui/button";

/**
 * Actions du bas de « Mon ticket » (maquette 03), toujours visibles dans une BottomBar.
 * « Je suis en route » n'apparaît que pour un ticket pris à distance (`canSignalOnMyWay`).
 */
export function TicketBottomActions({
  source,
  onMyWayLabel,
  cancelLabel,
  onMyWay,
  onCancel,
  position,
  className,
}: {
  source: TicketSource;
  onMyWayLabel: string;
  cancelLabel: string;
  onMyWay?: () => void;
  onCancel?: () => void;
  position?: "fixed" | "sticky" | "absolute";
  className?: string;
}) {
  return (
    <BottomBar position={position} className={className}>
      {canSignalOnMyWay(source) ? (
        <Button block variant="tinted" onClick={onMyWay}>
          {onMyWayLabel}
        </Button>
      ) : null}
      <Button block variant="destructive-plain" onClick={onCancel} className="-mt-2">
        {cancelLabel}
      </Button>
    </BottomBar>
  );
}
