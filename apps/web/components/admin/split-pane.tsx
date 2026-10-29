import type { ReactNode } from "react";
import { NavigationBar } from "@/components/ui/navigation-bar";
import { StatCard } from "@/components/ui/stat-card";
import { isSidebarDestination } from "@/lib/admin/nav";

/**
 * Colonne « liste » d'une vue maître-détail : grand titre, retour, action « + » dans la barre, puis la liste.
 * Sur téléphone, c'est toute la page de liste.
 */
export function SplitListPane({
  title,
  eyebrow,
  subtitle,
  back,
  trailing,
  children,
}: {
  title: string;
  eyebrow?: string;
  subtitle?: string;
  back?: { href: string; label: string };
  trailing?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <NavigationBar
        title={title}
        eyebrow={eyebrow}
        back={back ? { ...back, inSidebar: isSidebarDestination(back.href) } : undefined}
        trailing={trailing}
        contentClassName="max-w-none md:px-4"
      >
        {subtitle ? <p className="mt-1 text-subheadline text-label-secondary">{subtitle}</p> : null}
      </NavigationBar>
      <div className="flex flex-col gap-5 px-4 pt-3">{children}</div>
    </>
  );
}

/**
 * Panneau de détail sans élément choisi (tablette et ordinateur) : jamais vide — résumé chiffré, consigne et action
 * principale (revue responsive R6).
 */
export function SplitPlaceholder({
  icon,
  title,
  text,
  stats,
  action,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  stats?: { label: string; value: ReactNode }[];
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-6 px-8 py-12 text-center">
      <span aria-hidden className="flex size-16 items-center justify-center rounded-[18px] bg-accent-tint text-accent-on-tint [&_svg]:size-8 [&_svg]:stroke-[1.75]">
        {icon}
      </span>
      <div className="flex max-w-md flex-col gap-1.5">
        <h2 className="text-title2 font-bold">{title}</h2>
        <p className="text-body text-label-secondary">{text}</p>
      </div>
      {stats?.length ? (
        <div className="grid w-full max-w-xl grid-cols-1 gap-3 text-left @md:grid-cols-3">
          {stats.map((s) => (
            <StatCard key={s.label} label={s.label} value={s.value} />
          ))}
        </div>
      ) : null}
      {action}
    </div>
  );
}
