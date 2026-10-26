import type { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const badgeVariants = cva(
  "inline-flex shrink-0 items-center gap-1 font-semibold whitespace-nowrap [&_svg]:size-3.5 [&_svg]:stroke-[2.25]",
  {
    variants: {
      tone: {
        neutral: "bg-fill-tertiary text-label",
        accent: "bg-accent-tint text-accent-on-tint",
        orange: "bg-orange-tint text-orange-text",
        green: "bg-green-tint text-green-text",
        red: "bg-red-tint text-red-text",
        navy: "bg-navy text-white",
      },
      /** pill : statut (« Ouvert ») ; tag : étiquette compacte (« RDV », « En pause »). */
      shape: {
        pill: "h-7 rounded-full px-3 text-subheadline",
        tag: "h-6 rounded-[6px] px-2 text-footnote",
      },
    },
    defaultVariants: { tone: "neutral", shape: "tag" },
  },
);

export function Badge({
  className,
  tone,
  shape,
  ...props
}: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone, shape }), className)} {...props} />;
}

/** Pastille d'état (en ligne / hors ligne…). */
export function StatusDot({ tone, label }: { tone: "green" | "orange" | "red" | "neutral"; label: string }) {
  const color = {
    green: "bg-green",
    orange: "bg-orange",
    red: "bg-red",
    neutral: "bg-label-tertiary",
  }[tone];
  return (
    <span className="inline-flex items-center gap-1.5 text-footnote text-label-secondary">
      <span aria-hidden className={cn("size-2 rounded-full", color)} />
      {label}
    </span>
  );
}
