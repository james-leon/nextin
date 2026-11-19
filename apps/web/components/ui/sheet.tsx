"use client";

import type { ReactNode } from "react";
import { Drawer } from "vaul";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { NoPageFrame } from "./page-frame";

/**
 * Feuille modale iOS (sheet) : glisse depuis le bas avec un ressort, poignée, fermeture par geste,
 * Échap ou bouton. Sur grand écran, elle reste centrée en bas avec une largeur maximale.
 * Avec `cancelLabel`, l'en-tête devient une barre de navigation iOS (maquette v2 20) : « Annuler » à gauche, titre
 * centré, action de la feuille à droite (`action`, ex. « OK », « Enregistrer »).
 */
export function Sheet({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  closeLabel,
  children,
  footer,
  cancelLabel,
  action,
  titleHidden,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactNode;
  title: string;
  description?: string;
  closeLabel: string;
  children: ReactNode;
  footer?: ReactNode;
  /** En-tête façon barre de navigation : libellé du bouton de gauche (« Annuler »). */
  cancelLabel?: string;
  /** Action à droite de l'en-tête (avec `cancelLabel`) : un bouton texte, voir `SheetAction`. */
  action?: ReactNode;
  /** Titre lu par les lecteurs d'écran seulement (le contenu porte déjà son propre titre). */
  titleHidden?: boolean;
}) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} shouldScaleBackground={false}>
      {trigger ? <Drawer.Trigger asChild>{trigger}</Drawer.Trigger> : null}
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-overlay" />
        <Drawer.Content
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92dvh] w-full max-w-lg flex-col outline-none",
            "squircle rounded-t-[var(--radius-xl)] bg-grouped shadow-floating",
          )}
        >
          <div aria-hidden className="mx-auto mt-1.5 h-[5px] w-9 shrink-0 rounded-full bg-label-tertiary" />
          {cancelLabel || action ? (
            <div className="grid items-center gap-2 px-2 pt-1 pb-1" style={{ gridTemplateColumns: "1fr auto 1fr" }}>
              {cancelLabel ? (
                <Drawer.Close className="pressable min-h-11 justify-self-start rounded-[var(--radius-md)] px-3 text-body text-accent-text">
                  {cancelLabel}
                </Drawer.Close>
              ) : (
                <span />
              )}
              <div className="min-w-0 text-center" style={{ maxWidth: "16rem" }}>
                <Drawer.Title className={titleHidden ? "sr-only" : "line-clamp-2 text-headline [text-wrap:balance]"}>{title}</Drawer.Title>
                {description ? <Drawer.Description className="sr-only">{description}</Drawer.Description> : null}
              </div>
              <div className="justify-self-end">{action}</div>
            </div>
          ) : (
            <div className="flex items-start gap-3 px-5 pt-3 pb-2">
              <div className="min-w-0 flex-1">
                <Drawer.Title className="text-title3 font-semibold">{title}</Drawer.Title>
                {description ? (
                  <Drawer.Description className="mt-1 text-subheadline text-label-secondary">{description}</Drawer.Description>
                ) : null}
              </div>
              <Drawer.Close
                aria-label={closeLabel}
                className="pressable -mt-1 -mr-2 flex size-11 shrink-0 items-center justify-center rounded-full"
              >
                <span className="flex size-[1.875rem] items-center justify-center rounded-full bg-fill-tertiary text-label-secondary">
                  <X aria-hidden className="size-4 stroke-[2.5]" />
                </span>
              </Drawer.Close>
            </div>
          )}
          <div className="overflow-y-auto px-4 pb-4">
            <NoPageFrame>{children}</NoPageFrame>
          </div>
          {footer ? <div className="safe-bottom px-4 pt-2 pb-4">{footer}</div> : <div className="safe-bottom" />}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

export const SheetClose = Drawer.Close;

/** Action texte de l'en-tête d'une feuille (« OK », « Enregistrer ») : en gras, bleu, grisée si indisponible. */
export function SheetAction({
  children,
  onClick,
  disabled,
  type = "button",
  form,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  form?: string;
}) {
  return (
    <button
      type={type}
      form={form}
      onClick={onClick}
      disabled={disabled}
      className="pressable min-h-11 rounded-[var(--radius-md)] px-3 text-body font-semibold text-accent-text disabled:text-label-tertiary"
    >
      {children}
    </button>
  );
}
