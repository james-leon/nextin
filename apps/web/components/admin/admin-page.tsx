import type { ReactNode } from "react";
import { NavigationBar } from "@/components/ui/navigation-bar";
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
}: {
  title: string;
  eyebrow?: string;
  subtitle?: string;
  back?: { href: string; label: string };
  trailing?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <>
      <NavigationBar title={title} eyebrow={eyebrow} back={back} trailing={trailing} contentClassName="max-w-3xl">
        {subtitle ? <p className="mt-1 text-subheadline text-label-secondary">{subtitle}</p> : null}
      </NavigationBar>
      <div className={cn("mx-auto flex max-w-3xl flex-col gap-7 px-4 pt-3", className)}>{children}</div>
    </>
  );
}
