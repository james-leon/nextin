"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

export type TabItem = { key: string; label: string; icon: ReactNode; href?: string; badge?: number };

/** Barre d'onglets iOS translucide, fixée en bas (mobile), zone sûre incluse. */
export function TabBar({
  items,
  active,
  onSelect,
  label,
  position = "fixed",
  prefetch,
  className,
}: {
  items: readonly TabItem[];
  active: string;
  onSelect?: (key: string) => void;
  label: string;
  position?: "fixed" | "sticky" | "static";
  /** Faux sur les pages client (budget 3G) : les onglets ne préchargent pas leur page. */
  prefetch?: boolean;
  className?: string;
}) {
  return (
    <nav
      aria-label={label}
      className={cn(
        "safe-bottom material-blur z-30 bg-bar hairline-t",
        position === "fixed" && "fixed inset-x-0 bottom-0",
        position === "sticky" && "sticky bottom-0",
        className,
      )}
    >
      <ul role="list" className="mx-auto grid h-[3.0625rem] max-w-xl" style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>
        {items.map((item) => {
          const selected = item.key === active;
          const inner = (
            <>
              <span className="relative [&_svg]:size-6 [&_svg]:stroke-[1.75]">
                {item.icon}
                {item.badge ? (
                  <span className="absolute -top-1 -right-2.5 flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-red px-1 text-caption font-semibold text-white">
                    {item.badge}
                  </span>
                ) : null}
              </span>
              <span className="text-[0.625rem] leading-3 font-medium">{item.label}</span>
            </>
          );
          const cls = cn(
            "flex h-full w-full flex-col items-center justify-center gap-0.5 transition-colors",
            selected ? "text-accent-text" : "text-label-secondary",
          );
          return (
            <li key={item.key}>
              {item.href ? (
                <Link href={item.href} prefetch={prefetch} aria-current={selected ? "page" : undefined} className={cls}>
                  {inner}
                </Link>
              ) : (
                <button
                  type="button"
                  aria-current={selected ? "page" : undefined}
                  onClick={() => onSelect?.(item.key)}
                  className={cls}
                >
                  {inner}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
