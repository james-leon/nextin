import type { ReactNode } from "react";
import { LogoMark } from "@/components/ui/logo";
import { cn } from "@/lib/cn";

/**
 * En-tête des écrans de connexion (maquette v2 04) : grand titre aligné à gauche et sous-titre gris.
 * Sur téléphone et tablette (pas de panneau de marque), l'icône de l'application le précède. `icon` remplace cette
 * icône par un symbole dans un carré teinté et centre l'en-tête (double authentification, invitation).
 */
export function AuthHeader({
  title,
  subtitle,
  eyebrow,
  icon,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  eyebrow?: ReactNode;
  icon?: ReactNode;
  children?: ReactNode;
}) {
  const centered = Boolean(icon);
  return (
    <header className={cn("flex flex-col gap-2", centered && "items-center text-center")}>
      {icon ?? <LogoMark className="mb-3 size-12 lg:hidden" />}
      {eyebrow}
      <h1 className="text-large-title font-bold tracking-tight text-balance">{title}</h1>
      {subtitle ? <p className="text-body text-label-secondary">{subtitle}</p> : null}
      {children}
    </header>
  );
}

/** Symbole d'en-tête : carré teinté de 56 px (bouclier, enveloppe…). */
export function AuthIcon({ children }: { children: ReactNode }) {
  return (
    <span className="squircle mb-3 flex size-14 items-center justify-center rounded-[16px] bg-accent-tint text-accent-on-tint [&_svg]:size-7 [&_svg]:stroke-[1.75]">
      {children}
    </span>
  );
}
