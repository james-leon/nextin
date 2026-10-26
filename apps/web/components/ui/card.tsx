import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("squircle rounded-[var(--radius-xl)] bg-grouped-secondary p-4 shadow-card", className)}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-subheadline font-semibold text-label-secondary", className)} {...props} />;
}
