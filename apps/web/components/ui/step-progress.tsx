import { cn } from "@/lib/cn";

/**
 * Progression d'un parcours en étapes (maquette v2 04, inscription) : un trait par étape, bleu nuit jusqu'à
 * l'étape en cours, puis le sur-titre « Étape 2 sur 3 ». Les traits sont décoratifs : le texte porte l'information.
 */
export function StepProgress({ step, total, label, className }: { step: number; total: number; label: string; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div aria-hidden className="flex gap-1.5">
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={cn("h-1 flex-1 rounded-full", i < step ? "bg-primary" : "bg-fill-secondary")} />
        ))}
      </div>
      <p className="text-footnote font-medium tracking-wide text-label-secondary uppercase">{label}</p>
    </div>
  );
}
