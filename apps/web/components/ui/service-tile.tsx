import { cn } from "@/lib/cn";

/**
 * Pastille de service : lettre du préfixe sur la couleur du service (maquette 02).
 * La couleur vient de la configuration du service (palette SERVICE_COLORS, texte blanc lisible).
 */
export function ServiceTile({ letter, color, className }: { letter: string; color: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "squircle flex size-9 shrink-0 items-center justify-center rounded-[9px] text-headline font-bold text-white",
        className,
      )}
      style={{ background: color }}
    >
      {letter}
    </span>
  );
}
