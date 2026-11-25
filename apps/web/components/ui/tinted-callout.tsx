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
 * Encadré entièrement teinté, pictogramme sans carré (maquette v2 24 : phrase de statut d'une campagne). Composant à
 * part de `CalloutCard` : il n'entre pas dans le JS des pages client (budget de 200 Ko).
 */
export function TintedCallout({
  icon,
  tone = "neutral",
  role,
  children,
  className,
  ...rest
}: {
  icon: ReactNode;
  tone?: keyof typeof TINT;
  role?: "alert" | "status";
  children: ReactNode;
  className?: string;
  "data-testid"?: string;
}) {
  return (
    <div role={role} data-testid={rest["data-testid"]} className={cn("squircle flex items-start gap-3 rounded-[var(--radius-lg)] px-4 py-3", TINT[tone], className)}>
      <span aria-hidden className="mt-0.5 shrink-0 [&_svg]:size-5 [&_svg]:stroke-2">
        {icon}
      </span>
      <p className="text-callout text-label">{children}</p>
    </div>
  );
}
