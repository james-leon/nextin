import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import Link from "next/link";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";
import { Spinner } from "./spinner";

export const buttonVariants = cva(
  [
    "pressable relative inline-flex items-center justify-center gap-2 font-semibold select-none whitespace-nowrap",
    "squircle disabled:cursor-not-allowed disabled:opacity-40 aria-disabled:opacity-40",
    // Zone tactile ≥ 44 px même pour les petites tailles.
    "before:absolute before:left-0 before:right-0 before:top-1/2 before:h-11 before:min-h-full before:-translate-y-1/2 before:content-['']",
  ],
  {
    variants: {
      variant: {
        filled: "bg-accent text-on-accent hover:bg-accent-pressed",
        tinted: "bg-accent-tint text-accent-on-tint",
        gray: "bg-fill-tertiary text-accent-on-tint",
        plain: "bg-transparent text-accent-text",
        destructive: "bg-red-tint text-red-text",
        "destructive-plain": "bg-transparent text-red-text",
        "destructive-filled": "bg-red text-on-accent",
        navy: "bg-navy text-white",
      },
      size: {
        lg: "h-[3.125rem] min-w-[3.125rem] rounded-[14px] px-5 text-headline",
        md: "h-11 min-w-11 rounded-[12px] px-4 text-callout",
        sm: "h-[1.875rem] min-w-[1.875rem] rounded-full px-3 text-subheadline",
      },
      block: { true: "w-full" },
    },
    compoundVariants: [
      { variant: "plain", class: "px-2" },
      { variant: "destructive-plain", class: "px-2" },
    ],
    defaultVariants: { variant: "filled", size: "lg" },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    loading?: boolean;
    loadingLabel?: string;
    leadingIcon?: ReactNode;
    trailingIcon?: ReactNode;
  };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, block, asChild, loading, loadingLabel, leadingIcon, trailingIcon, children, disabled, ...props },
  ref,
) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      ref={ref}
      className={cn(buttonVariants({ variant, size, block }), className)}
      disabled={asChild ? undefined : disabled || loading}
      aria-busy={loading || undefined}
      {...(asChild ? {} : { type: props.type ?? "button" })}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {loading ? <Spinner className="size-[1.1em]" label={loadingLabel} /> : leadingIcon}
          {loading && loadingLabel ? loadingLabel : children}
          {loading ? null : trailingIcon}
        </>
      )}
    </Comp>
  );
});

type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label" | "children"> & {
  /** Obligatoire : décrit l'action pour les lecteurs d'écran. */
  label: string;
  icon: ReactNode;
  variant?: "gray" | "plain" | "tinted" | "filled" | "scanner";
};

/** Bouton icône circulaire 44 × 44 px. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, icon, variant = "gray", className, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "pressable inline-flex size-11 shrink-0 items-center justify-center rounded-full disabled:opacity-40",
        "[&_svg]:size-[1.25rem] [&_svg]:stroke-[1.75]",
        variant === "gray" && "bg-fill-tertiary text-accent-on-tint",
        variant === "plain" && "text-accent-text",
        variant === "tinted" && "bg-accent-tint text-accent-on-tint",
        variant === "filled" && "bg-accent text-on-accent",
        variant === "scanner" && "bg-scanner-control text-white",
        className,
      )}
      {...props}
    >
      {icon}
    </button>
  );
});

/** Lien icône circulaire 44 × 44 px (ex. « + » d'une liste dans la barre de navigation). Libellé obligatoire. */
export function IconLink({ href, label, icon, variant = "plain", className }: { href: string; label: string; icon: ReactNode; variant?: "gray" | "plain" | "tinted"; className?: string }) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className={cn(
        "pressable inline-flex size-11 shrink-0 items-center justify-center rounded-full",
        "[&_svg]:size-6 [&_svg]:stroke-[2]",
        variant === "gray" && "bg-fill-tertiary text-accent-on-tint",
        variant === "plain" && "text-accent-text",
        variant === "tinted" && "bg-accent-tint text-accent-on-tint",
        className,
      )}
    >
      {icon}
    </Link>
  );
}
