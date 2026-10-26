import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Carte d'information avec pictogramme teinté (maquette 03 : « Vous pouvez sortir… »). */
export function CalloutCard({
  icon,
  tone = "orange",
  children,
  className,
}: {
  icon: ReactNode;
  tone?: "orange" | "accent" | "green";
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("squircle flex items-start gap-3 rounded-[var(--radius-xl)] bg-grouped-secondary p-4", className)}>
      <span
        aria-hidden
        className={cn(
          "squircle flex size-8 shrink-0 items-center justify-center rounded-[8px] [&_svg]:size-[1.125rem] [&_svg]:stroke-2",
          tone === "orange" && "bg-orange-tint text-orange-text",
          tone === "accent" && "bg-accent-tint text-accent-on-tint",
          tone === "green" && "bg-green-tint text-green-text",
        )}
      >
        {icon}
      </span>
      <p className="text-body">{children}</p>
    </div>
  );
}
