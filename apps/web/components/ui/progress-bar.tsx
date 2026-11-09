import { cn } from "@/lib/cn";

/** Barre de progression fine (maquettes 03 et 06). `tone="orange"` signale une file chargée. */
export function ProgressBar({
  value,
  label,
  tone = "accent",
  className,
}: {
  /** De 0 à 1. */
  value: number;
  label: string;
  tone?: "accent" | "orange" | "green";
  className?: string;
}) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-fill-tertiary", className)}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-500 ease-[var(--ease-spring)]",
          tone === "accent" && "bg-accent",
          tone === "orange" && "bg-orange",
          tone === "green" && "bg-green",
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
