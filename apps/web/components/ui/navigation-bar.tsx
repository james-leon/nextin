"use client";

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/cn";

type Back = { href?: string; onClick?: () => void; label: string };

function BackButton({ back }: { back: Back }) {
  const cls = "pressable -ml-2 flex h-11 min-w-11 max-w-full items-center pr-2 text-body text-accent-text";
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
        <div className={cn("mx-auto grid h-11 grid-cols-[1fr_auto_1fr] items-center gap-2 px-4", contentClassName)}>
          <div className="flex min-w-0 justify-start">{back ? <BackButton back={back} /> : null}</div>
          {inline ? (
            <h1 className="truncate text-headline">{title}</h1>
          ) : (
            <p
              aria-hidden={!showBarTitle}
              className={cn(
                "truncate text-headline transition-all duration-200",
                showBarTitle ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0",
              )}
            >
              {title}
            </p>
          )}
          <div className="flex min-w-0 items-center justify-end gap-1">{trailing}</div>
        </div>
      </div>
      {inline ? (
        <div ref={sentinel} aria-hidden className="h-px" />
      ) : (
        <div className={cn("mx-auto px-4 pt-2 pb-2", contentClassName)}>
          {eyebrow ? (
            <p className="text-footnote font-semibold tracking-[0.06em] text-label-secondary uppercase">{eyebrow}</p>
          ) : null}
          <h1 className="text-large-title font-bold">{title}</h1>
          {children}
          <div ref={sentinel} aria-hidden className="h-px" />
        </div>
      )}
    </>
  );
}
