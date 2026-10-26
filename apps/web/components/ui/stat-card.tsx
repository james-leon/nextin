import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Carte de statistique (maquettes 04 et 06) : libellé, valeur, tendance facultative. */
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
    <div className={cn("squircle rounded-[var(--radius-xl)] bg-grouped-secondary px-4 py-3.5", className)}>
      <p className="text-subheadline text-label-secondary">{label}</p>
      <p className="mt-0.5 text-title1 font-bold tabular">{value}</p>
      {trend ? (
        <p
          className={cn(
            "mt-0.5 text-footnote",
            trendTone === "good" && "text-green-text",
            trendTone === "bad" && "text-red-text",
            trendTone === "neutral" && "text-label-secondary",
          )}
        >
          {trend}
        </p>
      ) : null}
    </div>
  );
}
