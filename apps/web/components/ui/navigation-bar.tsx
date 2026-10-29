"use client";

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/cn";
import { useMediaQuery } from "./use-media-query";

type Back = {
  href?: string;
  onClick?: () => void;
  label: string;
  /** Rubrique déjà présente dans la barre latérale : masqué sur ordinateur quand la page en a une. */
  inSidebar?: boolean;
};

function BackButton({ back }: { back: Back }) {
  const cls = cn(
    "pressable -ml-2 flex h-11 min-w-11 max-w-full items-center pr-2 text-body text-accent-text",
    back.inSidebar && "lg:in-data-[shell=sidebar]:hidden",
  );
  const inner = (
    <>
      <ChevronLeft aria-hidden className="size-7 shrink-0 stroke-[2.25]" />
      <span className="truncate">{back.label}</span>
    </>
  );
  return back.href ? (
    <Link href={back.href} className={cls}>
      {inner}
    </Link>
  ) : (
    <button type="button" onClick={back.onClick} className={cls}>
      {inner}
    </button>
  );
}

/**
 * Barre de navigation iOS.
 * - `large` (défaut) : sur-titre facultatif (ex. nom de l'établissement), grand titre et sous-titre ;
 *   le grand titre se réduit dans une barre translucide au défilement (maquettes 02 et 04).
 * - `inline` : titre centré compact dès le départ (maquette 03 « Mon ticket »).
 * Bouton retour en haut à gauche, actions à droite. `scrollRoot` : conteneur défilant (sinon la fenêtre).
 * Sur ordinateur (grand titre), les actions s'alignent avec le grand titre, puis remontent dans la barre compacte
 * quand le titre se réduit : jamais collées au bord haut de l'écran.
 */
export function NavigationBar({
  title,
  eyebrow,
  back,
  trailing,
  variant = "large",
  scrollRoot,
  sticky = true,
  className,
  contentClassName = "max-w-3xl",
  children,
}: {
  title: string;
  eyebrow?: ReactNode;
  back?: Back;
  trailing?: ReactNode;
  variant?: "large" | "inline";
  scrollRoot?: RefObject<HTMLElement | null>;
  sticky?: boolean;
  className?: string;
  /** Largeur maximale du contenu (alignement avec la page). */
  contentClassName?: string;
  children?: ReactNode;
}) {
  const sentinel = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const inline = variant === "inline";

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setScrolled(!entry?.isIntersecting), {
      root: scrollRoot?.current ?? null,
      rootMargin: "-44px 0px 0px 0px",
      threshold: 0,
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [scrollRoot]);

  const showBarTitle = inline || scrolled;
  const desktop = useMediaQuery("(min-width: 1024px)");
  const trailingInHeader = !inline && desktop && !scrolled && !!trailing;

  return (
    <>
      <div
        className={cn(
          "safe-top z-30 transition-[background-color,box-shadow] duration-200",
          sticky && "sticky top-0",
          scrolled ? "material-blur bg-bar hairline-b" : "bg-transparent",
          className,
        )}
      >
        {/* Retour et actions à leur largeur naturelle (une action longue n'est jamais tronquée) ; le titre réduit se rétrécit. */}
        <div className={cn("mx-auto grid h-11 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-4", contentClassName)}>
          <div className="flex min-w-0 max-w-[40vw] justify-start">{back ? <BackButton back={back} /> : null}</div>
          {inline ? (
            <h1 className="truncate text-center text-headline">{title}</h1>
          ) : (
            <p
              aria-hidden={!showBarTitle}
              className={cn(
                "truncate text-center text-headline transition-all duration-200",
                showBarTitle ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0",
              )}
            >
              {title}
            </p>
          )}
          <div className="flex min-w-0 items-center justify-end gap-1">{trailingInHeader ? null : trailing}</div>
        </div>
      </div>
      {inline ? (
        <div ref={sentinel} aria-hidden className="h-px" />
      ) : (
        <div className={cn("mx-auto px-4 pt-2 pb-2", contentClassName)}>
          {eyebrow ? (
            <p className="text-footnote font-semibold tracking-[0.06em] text-label-secondary uppercase">{eyebrow}</p>
          ) : null}
          {trailingInHeader ? (
            <div className="flex items-end justify-between gap-4">
              <h1 className="min-w-0 text-large-title font-bold">{title}</h1>
              <div className="flex shrink-0 items-center gap-2 pb-0.5">{trailing}</div>
            </div>
          ) : (
            <h1 className="text-large-title font-bold">{title}</h1>
          )}
          {children}
          <div ref={sentinel} aria-hidden className="h-px" />
        </div>
      )}
    </>
  );
}
