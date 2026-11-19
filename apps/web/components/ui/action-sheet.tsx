"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Drawer } from "vaul";
import { cn } from "@/lib/cn";
import { NoPageFrame } from "./page-frame";

export type ActionSheetItem = {
  key: string;
  label: string;
  icon: ReactNode;
  onSelect?: () => void;
  href?: string;
  destructive?: boolean;
};

/**
 * Feuille d'actions iOS (maquette v2 20, « Actions sur un ticket ») : titre et sous-titre centrés, actions en lignes
 * (icône et texte en bleu, action destructive en rouge), puis « Fermer » dans un bloc séparé. Une seule couleur
 * d'accent ; chaque ligne est une cible de 44 px au moins.
 */
export function ActionSheet({
  open,
  onOpenChange,
  title,
  subtitle,
  items,
  closeLabel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  items: ActionSheetItem[];
  closeLabel: string;
}) {
  const row = (item: ActionSheetItem) =>
    cn(
      "pressable flex min-h-12 w-full items-center gap-3 px-4 py-2.5 text-left text-body",
      "[&_svg]:size-5 [&_svg]:shrink-0 [&_svg]:stroke-[1.75]",
      item.destructive ? "text-red-text" : "text-accent-text",
    );
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} shouldScaleBackground={false}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-overlay" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92dvh] w-full max-w-md flex-col gap-2 px-2 outline-none">
          <NoPageFrame>
            <div className="squircle overflow-y-auto rounded-[var(--radius-xl)] bg-grouped-secondary shadow-floating">
              <div className="flex flex-col items-center gap-0.5 px-5 pt-3 pb-2.5 text-center hairline-b">
                <Drawer.Title className="text-headline [text-wrap:balance]">{title}</Drawer.Title>
                {subtitle ? (
                  <Drawer.Description className="text-footnote text-label-secondary">{subtitle}</Drawer.Description>
                ) : (
                  <Drawer.Description className="sr-only">{title}</Drawer.Description>
                )}
              </div>
              <ul role="list">
                {items.map((item) => (
                  <li key={item.key} className="list-separator group/row">
                    {item.href ? (
                      <Link href={item.href} className={row(item)} onClick={() => onOpenChange(false)}>
                        <span aria-hidden>{item.icon}</span>
                        {item.label}
                      </Link>
                    ) : (
                      <button type="button" className={row(item)} onClick={item.onSelect}>
                        <span aria-hidden>{item.icon}</span>
                        {item.label}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
            <Drawer.Close className="pressable safe-bottom mb-2 min-h-12 w-full rounded-[var(--radius-xl)] bg-grouped-secondary text-body font-semibold text-accent-text shadow-floating">
              {closeLabel}
            </Drawer.Close>
          </NoPageFrame>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
