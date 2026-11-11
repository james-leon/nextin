import type { ReactNode } from "react";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * État vide d'une liste (référentiel UX, U1) : icône dans une pastille, titre, phrase d'aide facultative et action
 * facultative (souvent l'action principale de l'écran). `card` : carte seule ; `inline` : dans une liste groupée.
 */
export function EmptyState({
  title,
  body,
  icon = <Inbox />,
  action,
  variant = "card",
  className,
}: {
  title: string;
  body?: string;
  icon?: ReactNode;
  action?: ReactNode;
  variant?: "card" | "inline";
  className?: string;
}) {
  const content = (
    <>
      <span
        aria-hidden
        className="flex size-12 items-center justify-center rounded-full bg-fill-tertiary text-label-secondary [&_svg]:size-6 [&_svg]:stroke-[1.5]"
      >
        {icon}
      </span>
      <p className="max-w-sm text-headline [text-wrap:balance]">{title}</p>
      {body ? <p className="max-w-sm text-subheadline text-label-secondary [text-wrap:pretty]">{body}</p> : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </>
  );
  return variant === "inline" ? (
    <li className={cn("flex flex-col items-center gap-2 px-6 py-8 text-center", className)}>{content}</li>
  ) : (
    <div className={cn("squircle flex flex-col items-center gap-2 rounded-[var(--radius-xl)] bg-grouped-secondary px-6 py-10 text-center shadow-card", className)}>
      {content}
    </div>
  );
}
