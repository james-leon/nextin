import { cn } from "@/lib/cn";

/**
 * Motif des points du logo (maquettes v2) appliqué à la file : un point par personne, les passages déjà terminés en
 * gris, les personnes qui attendent en gris clair, et le client lui-même en point orange plus gros, à la fin.
 * Au-delà de `max` personnes devant, la file est résumée (les premiers points seulement). Purement décoratif pour les
 * lecteurs d'écran : la phrase « 4 personnes devant vous » est toujours affichée à côté.
 */
export function QueueDots({
  ahead,
  done = 0,
  max = 8,
  className,
}: {
  /** Personnes devant le client. */
  ahead: number;
  /** Passages terminés affichés avant la file (contexte), 0 par défaut. */
  done?: number;
  /** Nombre maximal de points (client compris). */
  max?: number;
  className?: string;
}) {
  const waiting = Math.max(0, Math.min(ahead, max - 1));
  const served = Math.max(0, Math.min(done, max - 1 - waiting));
  return (
    <span aria-hidden className={cn("flex items-end gap-1.5", className)} data-testid="queue-dots">
      {Array.from({ length: served }, (_, i) => (
        <i key={`d${i}`} className="size-2.5 rounded-full bg-label-tertiary" />
      ))}
      {Array.from({ length: waiting }, (_, i) => (
        <i key={`w${i}`} className="size-2.5 rounded-full bg-fill" />
      ))}
      <i className="size-3.5 rounded-full bg-orange" data-me="" />
    </span>
  );
}

/**
 * Chargement : les trois points du logo qui sautent l'un après l'autre (écran de démarrage, attente d'une réponse).
 * Immobiles si l'utilisateur réduit les animations. Le libellé est annoncé aux lecteurs d'écran.
 */
export function DotsLoader({ label, className }: { label: string; className?: string }) {
  return (
    <span role="status" aria-label={label} className={cn("inline-flex h-4 items-end gap-[7px] text-accent-text", className)}>
      <i aria-hidden className="size-[9px] rounded-full bg-current motion-safe:animate-hop" />
      <i aria-hidden className="size-2 rounded-full bg-current motion-safe:animate-hop [animation-delay:150ms]" />
      <i aria-hidden className="size-[7px] rounded-full bg-current motion-safe:animate-hop [animation-delay:300ms]" />
    </span>
  );
}
