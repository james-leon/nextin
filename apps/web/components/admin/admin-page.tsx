import type { ReactNode } from "react";
import { NavigationBar } from "@/components/ui/navigation-bar";
import { isSidebarDestination } from "@/lib/admin/nav";
import { cn } from "@/lib/cn";

/** Gabarit d'une page du back-office : grand titre iOS, retour en haut à gauche, contenu centré. */
export function AdminPage({
  title,
  eyebrow,
  subtitle,
  back,
  trailing,
  children,
  className,
  wide,
}: {
  title: string;
  eyebrow?: string;
  subtitle?: string;
  back?: { href: string; label: string };
  trailing?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Page en colonnes sur grand écran (listes et détails côte à côte) au lieu d'une colonne centrée. */
  wide?: boolean;
}) {
  return (
    <>
      <NavigationBar title={title} eyebrow={eyebrow} back={back ? { ...back, inSidebar: isSidebarDestination(back.href) } : undefined} trailing={trailing} contentClassName={wide ? "max-w-6xl" : "max-w-3xl"}>
        {subtitle ? <p className="mt-1 text-subheadline text-label-secondary">{subtitle}</p> : null}
      </NavigationBar>
      <div className={cn("mx-auto flex flex-col gap-7 px-4 pt-3", wide ? "max-w-6xl" : "max-w-3xl", className)}>{children}</div>
    </>
  );
}
