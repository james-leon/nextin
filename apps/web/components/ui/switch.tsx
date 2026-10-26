"use client";

import { forwardRef, type ComponentPropsWithoutRef } from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/cn";

/** Interrupteur iOS 51 × 31 px, zone tactile 51 × 44 px. */
export const Switch = forwardRef<HTMLButtonElement, ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>>(
  function Switch({ className, ...props }, ref) {
    return (
      <SwitchPrimitive.Root
        ref={ref}
        className={cn(
          "group relative inline-flex h-11 w-[3.1875rem] shrink-0 cursor-pointer items-center disabled:cursor-not-allowed disabled:opacity-40",
          className,
        )}
        {...props}
      >
        <span
          aria-hidden
          className="absolute inset-x-0 h-[1.9375rem] rounded-full bg-fill transition-colors duration-200 group-data-[state=checked]:bg-green"
        />
        <SwitchPrimitive.Thumb
          className={cn(
            "relative block size-[1.6875rem] translate-x-[2px] rounded-full bg-white",
            "shadow-[0_3px_8px_rgb(0_0_0/0.15),0_3px_1px_rgb(0_0_0/0.06)]",
            "transition-transform duration-300 ease-[var(--ease-spring)] data-[state=checked]:translate-x-[1.375rem]",
          )}
        />
      </SwitchPrimitive.Root>
    );
  },
);
