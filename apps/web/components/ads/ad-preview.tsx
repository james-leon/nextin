import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Aperçu d'une annonce telle qu'elle passe sur l'écran TV (maquette v2 24) : format 16:9, étiquette « Publicité » (ou
 * nom de l'établissement pour une annonce Maison) en haut à gauche, titre et offre en bas sur un bandeau sombre uni
 * (lisible sur toute image, sans dégradé). Sans visuel : fond teinté et consigne.
 */
export function AdPreview({
  src,
  video,
  tag,
  headline,
  offer,
  empty,
  className,
}: {
  src?: string | null;
  video?: boolean;
  tag: string;
  headline?: string | null;
  offer?: string | null;
  /** Texte montré sans visuel. */
  empty?: ReactNode;
  className?: string;
}) {
  return (
    <figure
      data-testid="ad-preview"
      className={cn("squircle relative isolate aspect-video w-full overflow-hidden rounded-[var(--radius-lg)] bg-accent-tint text-white", className)}
    >
      {src ? (
        video ? (
          <video src={src} muted playsInline preload="metadata" aria-hidden className="absolute inset-0 -z-10 size-full object-cover" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- fichier du stockage public ou aperçu local (objet Blob)
          <img src={src} alt="" className="absolute inset-0 -z-10 size-full object-cover" />
        )
      ) : (
        <span className="absolute inset-0 -z-10 flex items-center justify-center px-6 text-center text-subheadline text-accent-on-tint">{empty}</span>
      )}
      <span className="absolute top-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-caption font-semibold">{tag}</span>
      {headline || offer ? (
        <figcaption className="absolute inset-x-0 bottom-0 flex flex-col gap-0.5 bg-black/60 px-3 py-2">
          {headline ? <span className="truncate text-headline">{headline}</span> : null}
          {offer ? <span className="truncate text-footnote">{offer}</span> : null}
        </figcaption>
      ) : null}
    </figure>
  );
}
