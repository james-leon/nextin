import type { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const badgeVariants = cva(
  "inline-flex shrink-0 items-center gap-1 font-semibold whitespace-nowrap [&_svg]:size-3.5 [&_svg]:stroke-[2.25]",
  {
    variants: {
      tone: {
        neutral: "bg-fill-tertiary text-label-secondary",
        accent: "bg-accent-tint text-accent-on-tint",
        orange: "bg-orange-tint text-orange-text",
        green: "bg-green-tint text-green-text",
        red: "bg-red-tint text-red-on-tint",
        navy: "bg-navy text-white",
      },
      /** pill : statut (« Ouvert », « En attente ») ; tag : étiquette compacte (« RDV », « Prioritaire »). */
      shape: {
        pill: "h-6 rounded-full px-2.5 text-caption",
        tag: "h-5 rounded-[6px] px-1.5 text-caption",
      },
    },
    defaultVariants: { tone: "neutral", shape: "tag" },
  },
);

const DOT: Record<NonNullable<VariantProps<typeof badgeVariants>["tone"]>, string> = {
  neutral: "bg-label-tertiary",
  accent: "bg-accent",
  orange: "bg-orange",
  green: "bg-green",
  red: "bg-red",
  navy: "bg-white",
};

/**
 * Pastille d'état en aplat (maquettes v2) : fond teinté uni et texte de la même couleur en version foncée (AA).
 * `dot` ajoute le point de couleur devant le libellé (« ● Ouvert »).
 */
export function Badge({
  className,
  tone,
  shape,
  dot,
  children,
  ...props
}: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants> & { dot?: boolean }) {
  return (
    <span className={cn(badgeVariants({ tone, shape }), dot && "gap-1.5", className)} {...props}>
      {dot ? <span aria-hidden className={cn("size-[7px] shrink-0 rounded-full", DOT[tone ?? "neutral"])} /> : null}
      {children}
    </span>
  );
}

/**
 * État d'un poste ou d'un service (tableaux du back-office) : point de couleur et libellé, sans fond.
 * blue = occupé, green = libre, orange = en attente d'action (patient appelé), neutral = fermé.
 */
export function StatusDot({ tone, label }: { tone: "green" | "orange" | "red" | "blue" | "neutral"; label: string }) {
  const color = {
    green: "bg-green",
    orange: "bg-orange",
    red: "bg-red",
    blue: "bg-accent",
    neutral: "bg-label-tertiary",
  }[tone];
  return (
    <span className="inline-flex items-center gap-1.5 text-footnote font-medium text-label">
      <span aria-hidden className={cn("size-[7px] shrink-0 rounded-full", color)} />
      {label}
    </span>
  );
}

/** « En direct » : point et libellé verts (mise à jour en temps réel), sans fond. */
export function LiveIndicator({ label, className }: { label: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-footnote font-semibold whitespace-nowrap text-green-text", className)}>
      <span aria-hidden className="size-[7px] shrink-0 rounded-full bg-green" />
      {label}
    </span>
  );
}
