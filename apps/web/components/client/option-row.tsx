import type { ReactNode } from "react";

/**
 * Liste d'options de « Mon ticket » (maquette v2 21) : même rendu que `ListSection` / `ListRow` (cellules groupées,
 * pictogramme dans un carré de couleur, filets alignés sur le texte), en version minimale — sans `next/link` ni
 * accessoires — pour tenir le budget de 200 Ko de la page.
 */
export function OptionList({ label, children }: { label: string; children: ReactNode }) {
  return (
    <ul aria-label={label} className="squircle overflow-hidden rounded-[var(--radius-lg)] bg-grouped-secondary">
      {children}
    </ul>
  );
}

const ROW = "pressable flex min-h-11 w-full items-center gap-3 px-4 py-2.5 text-left";

export function OptionRow({
  icon,
  color,
  title,
  subtitle,
  trailing,
  onClick,
  href,
  external,
  status,
}: {
  icon: ReactNode;
  color: string;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  onClick?: () => void;
  href?: string;
  external?: boolean;
  /** Ligne d'état (annoncée par les lecteurs d'écran), sans action. */
  status?: boolean;
}) {
  const body = (
    <>
      <span
        aria-hidden
        className="squircle flex size-[1.875rem] shrink-0 items-center justify-center rounded-[8px] text-white [&_svg]:size-[1.125rem] [&_svg]:stroke-2"
        style={{ background: color }}
      >
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-body">{title}</span>
        {subtitle ? <span className="text-footnote text-label-secondary">{subtitle}</span> : null}
      </span>
      {trailing}
    </>
  );
  return (
    <li className="list-separator group/row">
      {href ? (
        <a href={href} className={ROW} {...(external ? { target: "_blank", rel: "noopener" } : {})}>
          {body}
        </a>
      ) : onClick ? (
        <button type="button" onClick={onClick} className={ROW}>
          {body}
        </button>
      ) : (
        <div role={status ? "status" : undefined} className={ROW}>
          {body}
        </div>
      )}
    </li>
  );
}
