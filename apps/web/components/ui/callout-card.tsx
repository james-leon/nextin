import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

const TINT = {
  orange: "bg-orange-tint [&>span]:text-orange-text",
  accent: "bg-accent-tint [&>span]:text-accent-on-tint",
  green: "bg-green-tint [&>span]:text-green-text",
  red: "bg-red-tint [&>span]:text-red-text",
  neutral: "bg-fill-tertiary [&>span]:text-label-secondary",
} as const;

/**
 * Carte d'information avec pictogramme teinté (maquette 03 : « Vous pouvez sortir… »). `tinted` : encadré entièrement
 * teinté, pictogramme sans carré (maquette v2 24 : phrase de statut d'une campagne).
 */
export function CalloutCard({
  icon,
  tone = "orange",
  tinted,
  children,
  className,
  role,
  ...rest
}: {
  icon: ReactNode;
  tone?: "orange" | "accent" | "green" | "red" | "neutral";
  tinted?: boolean;
  /** `alert` pour une erreur à annoncer immédiatement aux lecteurs d'écran. */
  role?: "alert" | "status";
  children: ReactNode;
  className?: string;
  "data-testid"?: string;
}) {
  if (tinted) {
    return (
      <div role={role} data-testid={rest["data-testid"]} className={cn("squircle flex items-start gap-3 rounded-[var(--radius-lg)] px-4 py-3", TINT[tone], className)}>
        <span aria-hidden className="mt-0.5 shrink-0 [&_svg]:size-5 [&_svg]:stroke-2">
          {icon}
        </span>
        <p className="text-callout text-label">{children}</p>
      </div>
    );
  }
  return (
    <div role={role} data-testid={rest["data-testid"]} className={cn("squircle flex items-start gap-3 rounded-[var(--radius-xl)] bg-grouped-secondary p-4", className)}>
      <span
        aria-hidden
        className={cn(
          "squircle flex size-8 shrink-0 items-center justify-center rounded-[8px] [&_svg]:size-[1.125rem] [&_svg]:stroke-2",
          tone === "orange" && "bg-orange-tint text-orange-text",
          tone === "accent" && "bg-accent-tint text-accent-on-tint",
          tone === "green" && "bg-green-tint text-green-text",
          tone === "red" && "bg-red-tint text-red-text",
          tone === "neutral" && "bg-fill-tertiary text-label-secondary",
        )}
      >
        {icon}
      </span>
      <p className="text-body">{children}</p>
    </div>
  );
}
