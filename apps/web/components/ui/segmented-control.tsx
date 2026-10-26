"use client";

import * as ToggleGroup from "@radix-ui/react-toggle-group";
import { cn } from "@/lib/cn";

export type SegmentedOption<T extends string> = { value: T; label: string };

/** Segmented control iOS : un seul choix, curseur qui glisse avec un ressort. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onValueChange,
  label,
  className,
}: {
  options: readonly SegmentedOption<T>[];
  value: T;
  onValueChange: (value: T) => void;
  /** Libellé du groupe pour les lecteurs d'écran. */
  label: string;
  className?: string;
}) {
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={(v) => v && onValueChange(v as T)}
      aria-label={label}
      className={cn("relative grid h-11 rounded-[10px] bg-fill-tertiary p-[3px]", className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      <span
        aria-hidden
        className="absolute top-[3px] bottom-[3px] left-[3px] rounded-[8px] bg-white shadow-[0_3px_8px_rgb(0_0_0/0.12),0_3px_1px_rgb(0_0_0/0.04)] transition-transform duration-300 ease-[var(--ease-spring)] dark:bg-[#636366]"
        style={{
          width: `calc((100% - 6px) / ${options.length})`,
          transform: `translateX(${index * 100}%)`,
        }}
      />
      {options.map((o) => (
        <ToggleGroup.Item
          key={o.value}
          value={o.value}
          className="relative z-10 rounded-[8px] px-3 text-subheadline font-medium text-label data-[state=on]:font-semibold before:absolute before:inset-x-0 before:-inset-y-[3px] before:content-['']"
        >
          {o.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
