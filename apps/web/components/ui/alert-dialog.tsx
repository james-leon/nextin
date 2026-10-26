"use client";

import type { ReactNode } from "react";
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import { cn } from "@/lib/cn";

/** Alerte iOS centrée (270 px), deux actions séparées par des filets fins. */
export function AlertDialog({
  trigger,
  title,
  description,
  cancelLabel,
  actionLabel,
  destructive,
  onAction,
  open,
  onOpenChange,
}: {
  trigger?: ReactNode;
  title: string;
  description?: string;
  cancelLabel: string;
  actionLabel: string;
  destructive?: boolean;
  onAction: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  return (
    <AlertDialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      {trigger ? <AlertDialogPrimitive.Trigger asChild>{trigger}</AlertDialogPrimitive.Trigger> : null}
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Overlay className="fixed inset-0 z-50 bg-overlay animate-fade-in" />
        <AlertDialogPrimitive.Content
          className={cn(
            "fixed top-1/2 left-1/2 z-50 w-[17rem] -translate-x-1/2 -translate-y-1/2 overflow-hidden text-center",
            "squircle rounded-[14px] bg-sheet material-blur shadow-floating animate-pop-in",
          )}
        >
          <div className="px-4 pt-5 pb-4">
            <AlertDialogPrimitive.Title className="text-headline">{title}</AlertDialogPrimitive.Title>
            {description ? (
              <AlertDialogPrimitive.Description className="mt-1 text-footnote">{description}</AlertDialogPrimitive.Description>
            ) : null}
          </div>
          <div className="grid grid-cols-2 hairline-t">
            <AlertDialogPrimitive.Cancel className="h-11 text-body text-accent-text transition-colors active:bg-fill-tertiary">
              {cancelLabel}
            </AlertDialogPrimitive.Cancel>
            <AlertDialogPrimitive.Action
              onClick={onAction}
              className={cn(
                "h-11 text-body font-semibold shadow-[inset_0.5px_0_0_var(--separator)] transition-colors active:bg-fill-tertiary",
                destructive ? "text-red-text" : "text-accent-text",
              )}
            >
              {actionLabel}
            </AlertDialogPrimitive.Action>
          </div>
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  );
}
