"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

type Toast = { id: number; message: string; icon?: ReactNode };
const ToastContext = createContext<(message: string, icon?: ReactNode) => void>(() => {});

/** Bannière de notification façon iOS, annoncée aux lecteurs d'écran (aria-live). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const show = useCallback((message: string, icon?: ReactNode) => {
    const id = nextId.current++;
    setToasts((t) => [...t.slice(-2), { id, message, icon }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

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
            <p className="text-subheadline font-medium">{t.message}</p>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
