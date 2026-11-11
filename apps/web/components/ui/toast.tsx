"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Action dans la bannière (ex. « Annuler » pendant 5 s après une suppression réversible). */
export type ToastAction = { label: string; onClick: () => void };
export type ToastOptions = { action?: ToastAction; durationMs?: number };
type Toast = { id: number; message: string; icon?: ReactNode; action?: ToastAction };
type Show = (message: string, icon?: ReactNode, options?: ToastOptions) => void;
const ToastContext = createContext<Show>(() => {});

/** Bannière de notification façon iOS, annoncée aux lecteurs d'écran (aria-live). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const show = useCallback<Show>((message, icon, options) => {
    const id = nextId.current++;
    setToasts((t) => [...t.slice(-2), { id, message, icon, action: options?.action }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), options?.durationMs ?? 3500);
  }, []);
  const dismiss = (id: number) => setToasts((t) => t.filter((x) => x.id !== id));

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 px-4 pt-[max(env(safe-area-inset-top),0.75rem)]"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "squircle pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-[var(--radius-xl)] px-4 py-3",
              "material-blur bg-sheet shadow-floating animate-banner-in",
            )}
          >
            {t.icon ? <span className="shrink-0 text-accent-text [&_svg]:size-5">{t.icon}</span> : null}
            <p className="flex-1 text-subheadline font-medium">{t.message}</p>
            {t.action ? (
              <button
                type="button"
                onClick={() => {
                  t.action!.onClick();
                  dismiss(t.id);
                }}
                className="pressable -my-2 -mr-2 inline-flex min-h-11 shrink-0 items-center rounded-[10px] px-3 text-subheadline font-semibold text-accent-text"
              >
                {t.action.label}
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
