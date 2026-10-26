import type { HTMLAttributes, ReactNode } from "react";
import Link from "next/link";
import { Check, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

/** Section de liste groupée en encart (inset grouped) avec en-tête et pied facultatifs. */
export function ListSection({
  header,
  footer,
  children,
  className,
  radioGroupLabel,
  ...props
}: HTMLAttributes<HTMLElement> & {
  header?: ReactNode;
  footer?: ReactNode;
  /** Transforme la liste en groupe de choix exclusifs (lignes role="radio"). */
  radioGroupLabel?: string;
}) {
  return (
    <section className={cn("w-full", className)} {...props}>
      {header ? (
        <h3 className="px-4 pb-1.5 text-footnote uppercase text-label-secondary">{header}</h3>
      ) : null}
      <ul
        role={radioGroupLabel ? "radiogroup" : "list"}
        aria-label={radioGroupLabel}
        className="squircle overflow-hidden rounded-[var(--radius-md)] bg-grouped-secondary"
      >
        {children}
      </ul>
      {footer ? <p className="px-4 pt-1.5 text-footnote text-label-secondary">{footer}</p> : null}
    </section>
  );
}

/** Pictogramme carré coloré façon Réglages iOS. */
export function ListIcon({ children, color = "var(--accent-fill)" }: { children: ReactNode; color?: string }) {
  return (
    <span
      aria-hidden
      className="squircle flex size-[1.875rem] shrink-0 items-center justify-center rounded-[7px] text-white [&_svg]:size-[1.125rem] [&_svg]:stroke-2"
      style={{ background: color }}
    >
      {children}
    </span>
  );
}

type RowProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  detail?: ReactNode;
  icon?: ReactNode;
  accessory?: "chevron" | "check" | ReactNode;
  href?: string;
  onClick?: () => void;
  selected?: boolean;
  destructive?: boolean;
  className?: string;
  /** Rôle ARIA explicite (ex. "radio" dans une liste de choix). */
  role?: string;
};

export function ListRow({
  title,
  subtitle,
  detail,
  icon,
  accessory,
  href,
  onClick,
  selected,
  destructive,
  className,
  role,
}: RowProps) {
  const content = (
    <>
      {icon}
      <span className="relative flex min-h-11 flex-1 items-center gap-3 py-2.5 pr-4 after:absolute after:right-0 after:bottom-0 after:left-0 after:h-px after:origin-bottom after:scale-y-50 after:bg-separator group-last/row:after:hidden">
        <span className="flex min-w-0 flex-1 flex-col">
          <span className={cn("truncate text-body", destructive && "text-red-text")}>{title}</span>
          {subtitle ? <span className="truncate text-subheadline text-label-secondary">{subtitle}</span> : null}
        </span>
        {detail !== undefined ? <span className="shrink-0 text-body text-label-secondary">{detail}</span> : null}
        {accessory === "chevron" ? (
          <ChevronRight aria-hidden className="size-[1.125rem] shrink-0 stroke-[2.25] text-label-tertiary" />
        ) : accessory === "check" ? (
          <Check
            aria-hidden
            className={cn("size-5 shrink-0 stroke-[2.5] text-accent-text", !selected && "invisible")}
          />
        ) : (
          accessory
        )}
      </span>
    </>
  );

  const base = cn("group/row flex w-full items-center gap-3 pl-4 text-left", className);
  const interactive = "transition-colors active:bg-fill-tertiary hover:bg-fill-tertiary/50";

  if (href) {
    return (
      <li className="group/row">
        <Link href={href} className={cn(base, interactive)}>
          {content}
        </Link>
      </li>
    );
  }
  if (onClick) {
    return (
      <li className="group/row" role={role === "radio" ? "none" : undefined}>
        <button
          type="button"
          onClick={onClick}
          role={role}
          aria-checked={role === "radio" ? !!selected : undefined}
          className={cn(base, interactive)}
        >
          {content}
        </button>
      </li>
    );
  }
  return <li className={base}>{content}</li>;
}
