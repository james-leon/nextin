"use client";

import { useContext, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/cn";
import { SidebarToggleSlot } from "@/components/shell/shell-context";
import { usePageSlotSetter } from "./page-frame";
import { useMediaQuery } from "./use-media-query";

type Back = {
  href?: string;
  onClick?: () => void;
  label: string;
  /** Rubrique déjà présente dans la barre latérale : masqué sur ordinateur quand la page en a une. */
  inSidebar?: boolean;
  /** Détail d'une vue maître-détail : la liste est visible à côté à partir de la tablette, retour masqué. */
  inSplit?: boolean;
  /** Faux sur les pages client (budget 3G) : pas de préchargement de la page de retour. */
  prefetch?: boolean;
};

function BackButton({ back }: { back: Back }) {
  const label = useRef<HTMLSpanElement>(null);
  const [iconOnly, setIconOnly] = useState(false);

  // Règle iOS : si le libellé ne tient pas en entier, seul le chevron reste (libellé gardé pour les lecteurs d'écran) ;
  // jamais un mot coupé. Place disponible : 40 % de la fenêtre au plus, moins les actions de droite.
  useEffect(() => {
    const span = label.current;
    const grid = span?.closest<HTMLElement>("[data-nav-grid]");
    if (!span || !grid) return;
    const measure = () => {
      const style = getComputedStyle(grid);
      const inner = grid.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const trailing = grid.querySelector<HTMLElement>("[data-nav-trailing]")?.offsetWidth ?? 0;
      const toggle = grid.querySelector<HTMLElement>("[data-nav-toggle] > button")?.offsetWidth ?? 0;
      const available = Math.min(window.innerWidth * 0.4, inner - trailing - 16) - toggle - 28;
      setIconOnly(span.scrollWidth > available);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(grid);
    const trailing = grid.querySelector("[data-nav-trailing]");
    if (trailing) observer.observe(trailing);
    return () => observer.disconnect();
  }, [back.label]);

  const cls = cn(
    "pressable flex h-11 min-w-11 max-w-full items-center pr-2 text-body text-accent-text",
    back.inSidebar && "lg:in-data-[shell=sidebar]:hidden",
    back.inSplit && "md:hidden",
  );
  const inner = (
    <>
      <ChevronLeft aria-hidden className="size-7 shrink-0 stroke-[2.25]" />
      <span ref={label} className={iconOnly ? "sr-only" : "whitespace-nowrap"}>
        {back.label}
      </span>
    </>
  );
  return back.href ? (
    <Link href={back.href} prefetch={back.prefetch} className={cls}>
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
  const setSlot = usePageSlotSetter();
  const toggle = useContext(SidebarToggleSlot);
  // Action principale de la page (BottomBar) remontée ici sur ordinateur, à la suite des actions de la barre.
  const actions =
    trailing || setSlot ? (
      <>
        {trailing}
        {setSlot ? <span ref={setSlot} className="contents" /> : null}
      </>
    ) : null;
  const trailingInHeader = !inline && desktop && !scrolled && !!actions;

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
        <div data-nav-grid className={cn("mx-auto grid h-11 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-4", contentClassName)}>
          <div className="-ml-2 flex min-w-0 items-center justify-start">
            {toggle ? (
              <span data-nav-toggle className="contents">
                {toggle}
              </span>
            ) : null}
            {back ? (
              <div className="min-w-0 max-w-[40vw]">
                <BackButton back={back} />
              </div>
            ) : null}
          </div>
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
          <div data-nav-trailing className="flex min-w-0 items-center justify-end gap-1">
            {trailingInHeader ? null : actions}
          </div>
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
              <div className="flex shrink-0 items-center gap-2 pb-0.5">{actions}</div>
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
