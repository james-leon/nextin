import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Coins de visée bleus (maquettes 01, 07, 08) autour d'un contenu : caméra, QR code imprimé… */
export function ScannerFrame({
  children,
  scanning,
  className,
}: {
  children?: ReactNode;
  /** Affiche la ligne de balayage animée. */
  scanning?: boolean;
  className?: string;
}) {
  const corner = "absolute size-[22%] border-accent border-[3px]";
  return (
    <div className={cn("relative aspect-square w-full", className)}>
      <span aria-hidden className={cn(corner, "top-0 left-0 rounded-tl-[22%] border-r-0 border-b-0")} />
      <span aria-hidden className={cn(corner, "top-0 right-0 rounded-tr-[22%] border-b-0 border-l-0")} />
      <span aria-hidden className={cn(corner, "bottom-0 left-0 rounded-bl-[22%] border-t-0 border-r-0")} />
      <span aria-hidden className={cn(corner, "right-0 bottom-0 rounded-br-[22%] border-t-0 border-l-0")} />
      <div className="absolute inset-[3px] overflow-hidden rounded-[18%]">
        {children}
        {scanning ? (
          <span
            aria-hidden
            className="absolute inset-x-[10%] top-1/2 h-0.5 rounded-full bg-accent shadow-[0_0_16px_4px_rgb(26_107_181/0.45)] motion-safe:animate-[scan-line_2.4s_ease-in-out_infinite]"
          />
        ) : null}
      </div>
      <style>{`@keyframes scan-line{0%,100%{transform:translateY(-120px)}50%{transform:translateY(120px)}}`}</style>
    </div>
  );
}
