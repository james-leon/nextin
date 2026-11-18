"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Building2, ChevronsUpDown, CreditCard, LayoutGrid, Megaphone, Settings, ShieldCheck, Stethoscope, UsersRound } from "lucide-react";
import { cn } from "@/lib/cn";
import { SidebarPanel } from "@/components/shell/sidebar-shell";
import { Logo } from "@/components/ui/logo";
import { initialsOf } from "@/lib/text/initials";

export type AdminNavKey = "overview" | "branches" | "practitioners" | "staff" | "ads" | "billing";

const ITEMS: { key: AdminNavKey; path: string; icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }> }[] = [
  { key: "overview", path: "", icon: LayoutGrid },
  { key: "branches", path: "/branches", icon: Building2 },
  { key: "practitioners", path: "/practitioners", icon: Stethoscope },
  { key: "staff", path: "/staff", icon: UsersRound },
  { key: "ads", path: "/ads", icon: Megaphone },
  { key: "billing", path: "/billing", icon: CreditCard },
];

/** Entrées de navigation ; « Publicité » et « Abonnement » réservés aux administrateurs de l'établissement. */
export function adminNavItems(orgId: string, canManageOrg = true) {
  return ITEMS.filter((i) => (i.key !== "billing" && i.key !== "ads") || canManageOrg).map((i) => ({ ...i, href: `/app/o/${orgId}${i.path}` }));
}

const rowClass = "pressable flex min-h-11 items-center gap-3 rounded-[10px] px-3 text-callout";

/**
 * Barre latérale du back-office (maquette v2 05), bleu nuit unie : logo, carte de l'établissement (retour à « Mes
 * établissements »), rubriques « Organisation » et « Compte », puis la personne connectée en bas.
 */
export function AdminSidebar({
  orgId,
  orgName,
  orgSummary,
  user,
  canManageOrg,
  isPlatformAdmin,
}: {
  orgId: string;
  orgName: string;
  /** « 2 agences · Business ». */
  orgSummary: string;
  user: { name: string; role: string };
  canManageOrg: boolean;
  isPlatformAdmin: boolean;
}) {
  const t = useTranslations("admin");
  const ts = useTranslations("settings");
  const pathname = usePathname();
  const items = adminNavItems(orgId, canManageOrg);
  const activeKey =
    [...items].reverse().find((i) => (i.path ? pathname.startsWith(i.href) : pathname === i.href))?.key ?? "overview";
  const organization = items.filter((i) => i.key !== "billing");
  const account = items.filter((i) => i.key === "billing");

  const link = (item: (typeof items)[number]) => {
    const active = item.key === activeKey;
    const Icon = item.icon;
    return (
      <li key={item.key}>
        <Link
          href={item.href}
          aria-current={active ? "page" : undefined}
          className={cn(rowClass, active ? "bg-accent-tint font-semibold text-label" : "text-label-secondary hover:bg-fill-tertiary hover:text-label")}
        >
          <Icon aria-hidden className="size-5 stroke-[1.75]" />
          {t(`nav.${item.key}`)}
        </Link>
      </li>
    );
  };

  return (
    <SidebarPanel>
      <div className="px-2">
        <Logo className="h-9" />
      </div>
      <Link
        href="/app"
        aria-label={`${orgName} · ${t("nav.organizations")}`}
        className="pressable squircle flex min-h-14 items-center gap-2.5 rounded-[12px] bg-grouped-secondary px-2.5 py-2"
      >
        <span
          aria-hidden
          className="squircle flex size-8 shrink-0 items-center justify-center rounded-[8px] bg-white text-footnote font-bold text-navy"
        >
          {initialsOf(orgName)}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-subheadline font-semibold">{orgName}</span>
          <span className="truncate text-caption text-label-secondary">{orgSummary}</span>
        </span>
        <ChevronsUpDown aria-hidden className="size-4 shrink-0 text-label-tertiary" />
      </Link>
      <nav aria-label={t("navLabel")} className="flex flex-col gap-4">
        <ul role="list" className="flex flex-col gap-0.5">
          {organization.filter((i) => i.key === "overview").map(link)}
        </ul>
        <div className="flex flex-col gap-1">
          <p className="px-3 text-caption font-medium tracking-wide text-label-secondary uppercase">{t("sidebar.organization")}</p>
          <ul role="list" className="flex flex-col gap-0.5">
            {organization.filter((i) => i.key !== "overview").map(link)}
          </ul>
        </div>
        <div className="flex flex-col gap-1">
          <p className="px-3 text-caption font-medium tracking-wide text-label-secondary uppercase">{t("sidebar.account")}</p>
          <ul role="list" className="flex flex-col gap-0.5">
            {account.map(link)}
            <li>
              <Link
                href={`/app/settings?from=${encodeURIComponent(pathname)}`}
                className={cn(rowClass, "text-label-secondary hover:bg-fill-tertiary hover:text-label")}
              >
                <Settings aria-hidden className="size-5 stroke-[1.75]" />
                {ts("open")}
              </Link>
            </li>
            {isPlatformAdmin ? (
              <li>
                <Link href="/admin" className={cn(rowClass, "text-label-secondary hover:bg-fill-tertiary hover:text-label")}>
                  <ShieldCheck aria-hidden className="size-5 stroke-[1.75]" />
                  {t("nav.platform")}
                </Link>
              </li>
            ) : null}
          </ul>
        </div>
      </nav>
      {user.name ? (
        <div className="mt-auto flex items-center gap-2.5 px-2.5 py-2">
          <span
            aria-hidden
            className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-caption font-semibold text-on-accent"
          >
            {initialsOf(user.name)}
          </span>
          <span className="min-w-0 truncate text-footnote text-label-secondary">
            {user.name}
            {user.role ? ` · ${user.role}` : ""}
          </span>
        </div>
      ) : null}
    </SidebarPanel>
  );
}
