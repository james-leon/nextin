import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Carte de statistique (maquettes 04 et 06) : libellé, valeur, évolution facultative en badge. */
export function StatCard({
  label,
  value,
  trend,
  trendTone = "neutral",
  className,
}: {
  label: string;
  value: ReactNode;
  trend?: ReactNode;
  trendTone?: "neutral" | "good" | "bad";
  className?: string;
}) {
  return (
    <div className={cn("squircle rounded-[var(--radius-xl)] bg-grouped-secondary px-5 py-4 shadow-card", className)}>
      <p className="text-subheadline text-label-secondary">{label}</p>
      <p className="mt-0.5 text-title1 font-bold tabular">{value}</p>
      {trend ? (
        // Évolution en badge (style A) : vert = mieux, orange = moins bien, gris = stable.
        <p
          className={cn(
            "mt-2 inline-flex min-h-6 max-w-full items-center rounded-full px-2.5 py-0.5 text-footnote font-semibold",
            trendTone === "good" && "bg-green-tint text-green-text",
            trendTone === "bad" && "bg-orange-tint text-orange-text",
            trendTone === "neutral" && "bg-fill-tertiary text-label-secondary",
          )}
        >
          <span className="truncate">{trend}</span>
        </p>
      ) : null}
    </div>
  );
}
