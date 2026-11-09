import type { ReactNode } from "react";
import { NavigationBar } from "@/components/ui/navigation-bar";
import { PageFrame } from "@/components/ui/page-frame";
import { isSidebarDestination } from "@/lib/admin/nav";
import { cn } from "@/lib/cn";

/** Marges latérales du contenu : 16 px sur téléphone, 32 px sur tablette, 40 px sur ordinateur (revue responsive R1). */
export const PAGE_GUTTER = "px-4 md:px-8 lg:px-10";

/**
 * Gabarit d'une page du back-office : grand titre iOS, retour en haut à gauche, action principale (`BottomBar`)
 * dans la barre de titre sur ordinateur. Pleine largeur disponible jusqu'à `max-w-7xl` (listes en maître-détail ou
 * en grille) ; `narrow` réserve une colonne centrée aux formulaires purs (création, édition).
 */
export function AdminPage({
  title,
  eyebrow,
  subtitle,
  back,
  trailing,
  children,
  className,
  narrow,
  inSplit,
}: {
  title: string;
  eyebrow?: string;
  subtitle?: string;
  back?: { href: string; label: string };
  trailing?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Formulaire pur : colonne centrée (max-w-3xl). */
  narrow?: boolean;
  /** Détail d'une vue maître-détail : retour masqué à partir de la tablette (la liste est à côté). */
  inSplit?: boolean;
}) {
  const width = narrow ? "max-w-3xl" : "max-w-7xl";
  return (
    <PageFrame>
      <NavigationBar
        title={title}
        eyebrow={eyebrow}
        back={back ? { ...back, inSidebar: isSidebarDestination(back.href), inSplit } : undefined}
        trailing={trailing}
        contentClassName={cn(width, "md:px-8 lg:px-10")}
      >
        {subtitle ? <p className="mt-1 text-subheadline text-label-secondary">{subtitle}</p> : null}
      </NavigationBar>
      <div className={cn("mx-auto flex flex-col gap-7 pt-3", PAGE_GUTTER, width, className)}>{children}</div>
    </PageFrame>
  );
}
