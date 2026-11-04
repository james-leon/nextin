"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

export type TabItem = { key: string; label: string; icon: ReactNode; href?: string; badge?: number };

/**
 * Barre d'onglets iOS translucide, fixée en bas (mobile), zone sûre incluse.
 * `sidebar` : à partir de 1024 px, la barre devient une barre latérale façon Mac (marque en tête, onglets en liste) ;
 * le contenu de la page se décale de sa largeur (`data-tab-sidebar`, règle dans `globals.css`).
 * `floating` (style A, pages client) : sur téléphone et tablette, pilule flottante (64 px, marges 20 px, blanc
 * translucide) ; l'onglet actif est une pilule bleue avec icône et libellé, les autres une icône seule (libellé
 * gardé pour les lecteurs d'écran).
 */
export function TabBar({
  items,
  active,
  onSelect,
  label,
  position = "fixed",
  prefetch,
  sidebar,
  floating,
  className,
}: {
  items: readonly TabItem[];
  active: string;
  onSelect?: (key: string) => void;
  label: string;
  position?: "fixed" | "sticky" | "static";
  /** Faux sur les pages client (budget 3G) : les onglets ne préchargent pas leur page. */
  prefetch?: boolean;
  /** Barre latérale sur ordinateur, avec cet en-tête (marque). */
  sidebar?: ReactNode;
  floating?: boolean;
  className?: string;
}) {
  return (
    <nav
      aria-label={label}
      data-tab-sidebar={sidebar ? "" : undefined}
      className={cn(
        "material-blur z-30",
        floating
          ? "fixed inset-x-5 bottom-[calc(env(safe-area-inset-bottom)+1.25rem)] h-16 rounded-[2rem] bg-pill px-2 shadow-floating lg:inset-x-0 lg:bottom-0 lg:h-auto lg:rounded-none lg:bg-bar lg:shadow-none"
          : "safe-bottom bg-bar hairline-t",
        !floating && position === "fixed" && "fixed inset-x-0 bottom-0",
        !floating && position === "sticky" && "sticky bottom-0",
        sidebar &&
          "lg:top-0 lg:right-auto lg:w-60 lg:px-3 lg:py-5 lg:shadow-[inset_-0.5px_0_0_var(--separator)]",
        className,
      )}
    >
      {sidebar ? <div className="hidden px-3 pb-6 lg:block">{sidebar}</div> : null}
      <ul
        role="list"
        className={cn(
          "mx-auto grid h-[3.0625rem] max-w-xl",
          floating && "max-lg:flex max-lg:h-full max-lg:items-center max-lg:justify-around",
          sidebar && "lg:flex lg:h-auto lg:flex-col lg:gap-1",
        )}
        style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}
      >
        {items.map((item) => {
          const selected = item.key === active;
          const inner = (
            <>
              <span className="relative [&_svg]:size-6 [&_svg]:stroke-[1.75]">
                {item.icon}
                {item.badge ? (
                  <span className="absolute -top-1 -right-2.5 flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-red px-1 text-caption font-semibold text-white">
                    {item.badge}
                  </span>
                ) : null}
              </span>
              <span
                className={cn(
                  "text-[0.625rem] leading-3 font-medium",
                  floating && (selected ? "max-lg:text-subheadline max-lg:font-semibold" : "max-lg:sr-only"),
                  sidebar && "lg:text-body lg:leading-normal",
                )}
              >
                {item.label}
              </span>
            </>
          );
          const cls = cn(
            "flex h-full w-full flex-col items-center justify-center gap-0.5 transition-colors",
            selected ? "text-accent-text" : "text-label-secondary",
            // Pilule flottante : onglet actif en pilule bleue (icône + libellé), les autres en icône seule (≥ 44 px).
            floating &&
              (selected
                ? "max-lg:h-12 max-lg:w-auto max-lg:flex-row max-lg:gap-2 max-lg:rounded-full max-lg:bg-accent max-lg:px-4 max-lg:text-on-accent"
                : "max-lg:size-12 max-lg:rounded-full"),
            sidebar && "lg:min-h-11 lg:flex-row lg:justify-start lg:gap-3 lg:rounded-[10px] lg:px-3",
            // Ligne choisie façon barre latérale du Mac : fond d'accent plein, texte blanc (contraste AA sur tout fond).
            sidebar && (selected ? "lg:bg-accent lg:font-semibold lg:text-on-accent" : "lg:text-label lg:hover:bg-fill-tertiary"),
          );
          return (
            <li key={item.key} className={floating ? "max-lg:flex" : undefined}>
              {item.href ? (
                <Link href={item.href} prefetch={prefetch} aria-current={selected ? "page" : undefined} className={cls}>
                  {inner}
                </Link>
              ) : (
                <button
                  type="button"
                  aria-current={selected ? "page" : undefined}
                  onClick={() => onSelect?.(item.key)}
                  className={cls}
                >
                  {inner}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
