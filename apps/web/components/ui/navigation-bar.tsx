"use client";

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Barre de navigation iOS : grand titre qui se réduit dans une barre translucide au défilement,
 * bouton retour en haut à gauche, actions à droite.
 * `scrollRoot` permet de l'utiliser dans un conteneur défilant (sinon : la fenêtre).
 */
export function NavigationBar({
  title,
  back,
  trailing,
  scrollRoot,
  sticky = true,
  className,
  contentClassName = "max-w-3xl",
  children,
}: {
  title: string;
  back?: { href?: string; onClick?: () => void; label: string };
  trailing?: ReactNode;
  scrollRoot?: RefObject<HTMLElement | null>;
  sticky?: boolean;
  className?: string;
  /** Largeur maximale du contenu (alignement avec la page). */
  contentClassName?: string;
  children?: ReactNode;
}) {
  const sentinel = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setCollapsed(!entry?.isIntersecting), {
      root: scrollRoot?.current ?? null,
      rootMargin: "-44px 0px 0px 0px",
      threshold: 0,
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [scrollRoot]);

  const backButton = back ? (
    back.href ? (
      <Link href={back.href} className="pressable -ml-2 flex h-11 items-center pr-2 text-body text-accent-text">
        <ChevronLeft aria-hidden className="size-7 stroke-[2.25]" />
        <span>{back.label}</span>
      </Link>
    ) : (
      <button
        type="button"
        onClick={back.onClick}
        className="pressable -ml-2 flex h-11 items-center pr-2 text-body text-accent-text"
      >
        <ChevronLeft aria-hidden className="size-7 stroke-[2.25]" />
        <span>{back.label}</span>
      </button>
    )
  ) : null;

  return (
    <>
      <div
        className={cn(
          "safe-top z-30 transition-[background-color,box-shadow] duration-200",
          sticky && "sticky top-0",
          collapsed ? "material-blur bg-bar hairline-b" : "bg-transparent",
          className,
        )}
      >
        <div className={cn("mx-auto grid h-11 grid-cols-[1fr_auto_1fr] items-center px-4", contentClassName)}>
          <div className="flex min-w-0 justify-start">{backButton}</div>
          <p
            aria-hidden={!collapsed}
            className={cn(
              "truncate text-headline transition-all duration-200",
              collapsed ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0",
            )}
          >
            {title}
          </p>
          <div className="flex min-w-0 items-center justify-end gap-1">{trailing}</div>
        </div>
      </div>
      <div className={cn("mx-auto px-4 pt-1 pb-2", contentClassName)}>
        <h1 className="text-large-title font-bold">{title}</h1>
        {children}
        <div ref={sentinel} aria-hidden className="h-px" />
      </div>
    </>
  );
}
