import { cn } from "@/lib/cn";

/*
 * Fichier à part, sans la géométrie du logo (`lib/brand/logo-data.ts`, ≈ 7 Ko de tracés) : importé par des
 * composants client des pages au budget serré, il ne doit rien ajouter à leur JavaScript.
 */

/**
 * Logo horizontal en image (fichiers de `public/brand`), chargé seulement s'il est affiché : pour les pages client
 * au budget serré, où il ne paraît qu'à partir de 1024 px (barre latérale). Une image par thème.
 */
export function LogoImage({ className, label = "NextIn by Wintek" }: { className?: string; label?: string }) {
  return (
    <span className={cn("block", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- SVG statique, aucune optimisation utile */}
      <img src="/brand/nextin-logo-light.svg" alt={label} width={539} height={160} loading="lazy" className="h-full w-auto dark:hidden" />
      {/* eslint-disable-next-line @next/next/no-img-element -- idem, version pour fond sombre */}
      <img src="/brand/nextin-logo-dark.svg" alt={label} width={539} height={160} loading="lazy" className="hidden h-full w-auto dark:block" />
    </span>
  );
}
