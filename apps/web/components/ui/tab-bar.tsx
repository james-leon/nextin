"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

export type TabItem = { key: string; label: string; icon: ReactNode; href?: string; badge?: number };

/**
 * Barre d'onglets iOS translucide, fixée en bas (mobile), zone sûre incluse.
 * `sidebar` : à partir de 1024 px, la barre devient une barre latérale façon Mac (marque en tête, onglets en liste) ;
 * le contenu de la page se décale de sa largeur (`data-tab-sidebar`, règle dans `globals.css`).
 */
export function TabBar({
  items,
  active,
  onSelect,
  label,
  position = "fixed",
  prefetch,
  sidebar,
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
  className?: string;
}) {
  return (
    <nav
      aria-label={label}
      data-tab-sidebar={sidebar ? "" : undefined}
      className={cn(
        "safe-bottom material-blur z-30 bg-bar hairline-t",
        position === "fixed" && "fixed inset-x-0 bottom-0",
        position === "sticky" && "sticky bottom-0",
        sidebar &&
          "lg:top-0 lg:right-auto lg:w-60 lg:px-3 lg:py-5 lg:shadow-[inset_-0.5px_0_0_var(--separator)]",
        className,
      )}
    >
      {sidebar ? <div className="hidden px-3 pb-6 lg:block">{sidebar}</div> : null}
      <ul
        role="list"
        className={cn("mx-auto grid h-[3.0625rem] max-w-xl", sidebar && "lg:flex lg:h-auto lg:flex-col lg:gap-1")}
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
              <span className={cn("text-[0.625rem] leading-3 font-medium", sidebar && "lg:text-body lg:leading-normal")}>{item.label}</span>
            </>
          );
          const cls = cn(
            "flex h-full w-full flex-col items-center justify-center gap-0.5 transition-colors",
            selected ? "text-accent-text" : "text-label-secondary",
            sidebar && "lg:min-h-11 lg:flex-row lg:justify-start lg:gap-3 lg:rounded-[10px] lg:px-3",
            // Ligne choisie façon barre latérale du Mac : fond d'accent plein, texte blanc (contraste AA sur tout fond).
            sidebar && (selected ? "lg:bg-accent lg:font-semibold lg:text-on-accent" : "lg:text-label lg:hover:bg-fill-tertiary"),
          );
          return (
            <li key={item.key}>
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
