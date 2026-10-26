import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/cn";

/** Marque NextIn (maquettes 05 à 08) : tuile bleue à flèche + mot-symbole. */
export function LogoMark({ className, label }: { className?: string; label?: string }) {
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("squircle inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-accent text-white", className)}
    >
      <ArrowRight aria-hidden className="size-[55%] stroke-[2.5]" />
    </span>
  );
}

export function Logo({ className, tone = "default" }: { className?: string; tone?: "default" | "inverse" }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className={cn("text-title3 font-bold tracking-tight", tone === "inverse" ? "text-white" : "text-ticket-number")}>
        NextIn
      </span>
    </span>
  );
}
