"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { PanelLeft } from "lucide-react";
import { cn } from "@/lib/cn";

type Shell = {
  open: boolean;
  setOpen: (open: boolean) => void;
  labels: { open: string; close: string };
  /** Bouton d'ouverture (rendu par la barre de navigation) : le focus y revient à la fermeture. */
  toggle: HTMLButtonElement | null;
  setToggle: (el: HTMLButtonElement | null) => void;
};

const ShellContext = createContext<Shell | null>(null);

/**
 * Gabarit à barre latérale (back-office, espace annonceur, console Wintek), façon iPadOS :
 * - ordinateur et tablette paysage (≥ 1024 px) : barre latérale toujours visible ;
 * - tablette portrait (768–1023 px) : barre latérale repliable, ouverte par le bouton en haut à gauche de la barre
 *   de navigation, par-dessus le contenu ;
 * - téléphone : pas de barre latérale (navigation par listes, comme sur iPhone).
 */
export function SidebarShell({
  sidebar,
  labels,
  children,
}: {
  sidebar: ReactNode;
  labels: { open: string; close: string };
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [toggle, setToggle] = useState<HTMLButtonElement | null>(null);
  const value = useMemo(() => ({ open, setOpen, labels, toggle, setToggle }), [open, labels, toggle]);
  return (
    <ShellContext.Provider value={value}>
      <div data-shell="sidebar" className="flex min-h-dvh lg:[--shell-sidebar:16rem]">
        {sidebar}
        <main className="min-w-0 flex-1 pb-36">{children}</main>
      </div>
    </ShellContext.Provider>
  );
}

/**
 * Colonne de la barre latérale : pleine hauteur, contenu collant à la fenêtre (défilement propre).
 * Sur tablette portrait, panneau par-dessus le contenu quand il est ouvert (voile, Échap, fermeture en naviguant).
 */
export function SidebarPanel({ children }: { children: ReactNode }) {
  const shell = useContext(ShellContext);
  const open = !!shell?.open;
  const panel = useRef<HTMLElement>(null);
  const close = useCallback(() => {
    shell?.setOpen(false);
    shell?.toggle?.focus();
  }, [shell]);

  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLElement>("a, button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  return (
    <>
      {open ? (
        <button
          type="button"
          aria-label={shell?.labels.close}
          onClick={close}
          className="fixed inset-0 z-40 bg-black/30 lg:hidden motion-safe:animate-fade-in"
        />
      ) : null}
      <aside
        ref={panel}
        // Un lien suivi dans le panneau le referme (la page change sous le panneau).
        onClick={(e) => {
          if (open && (e.target as HTMLElement).closest("a")) shell?.setOpen(false);
        }}
        className={cn(
          "w-64 shrink-0 bg-grouped-secondary shadow-[inset_-0.5px_0_0_var(--separator)] lg:block",
          open
            ? "fixed inset-y-0 left-0 z-50 block overflow-y-auto shadow-[0_0_40px_rgb(0_0_0/0.25)] motion-safe:animate-slide-in-left lg:static lg:z-auto lg:shadow-[inset_-0.5px_0_0_var(--separator)]"
            : "hidden",
        )}
      >
        <div className={cn("flex flex-col gap-6 overflow-y-auto px-3 py-5", open ? "min-h-full" : "sticky top-0 h-dvh")}>{children}</div>
      </aside>
    </>
  );
}

/** Bouton « afficher la barre latérale » (tablette portrait), à gauche de la barre de navigation. */
export function SidebarToggle() {
  const shell = useContext(ShellContext);
  if (!shell) return null;
  const { open, setOpen, labels, setToggle } = shell;
  return (
    <button
      ref={setToggle}
      type="button"
      aria-label={open ? labels.close : labels.open}
      aria-expanded={open}
      onClick={() => setOpen(!open)}
      className="pressable -ml-1 hidden size-11 shrink-0 items-center justify-center rounded-full text-accent-text md:flex lg:hidden"
    >
      <PanelLeft aria-hidden className="size-6 stroke-[1.75]" />
    </button>
  );
}
