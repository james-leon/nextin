import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Tableau du back-office sur ordinateur (façon liste à colonnes de macOS) : carte groupée, en-têtes discrets,
 * séparateurs fins entre les lignes. Sur téléphone, préférer une `ListSection`.
 */
export function DataTable({ label, head, children, className }: { label: string; head: ReactNode; children: ReactNode; className?: string }) {
  return (
    // Région focalisable : si la fenêtre est étroite, le tableau défile au clavier.
    <div role="region" aria-label={label} tabIndex={0} className={cn("squircle overflow-x-auto rounded-[var(--radius-md)] bg-grouped-secondary", className)}>
      <table aria-label={label} className="w-full border-collapse text-left">
        <thead>
          <tr className="hairline-b">{head}</tr>
        </thead>
        <tbody className="[&>tr+tr]:hairline-t">{children}</tbody>
      </table>
    </div>
  );
}

export const th = "px-4 py-2.5 text-footnote font-normal uppercase whitespace-nowrap text-label-secondary";
export const td = "px-4 py-3 align-middle text-body";
