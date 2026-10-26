import type { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const badgeVariants = cva(
  "inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-footnote font-semibold [&_svg]:size-3.5 [&_svg]:stroke-[2.25]",
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
    },
    defaultVariants: { tone: "neutral" },
  },
);

export function Badge({
  className,
  tone,
  ...props
}: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
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
