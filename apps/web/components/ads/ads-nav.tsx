"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Building2, Megaphone, ScanLine, Settings, Tag, UsersRound } from "lucide-react";
import { LogoMark } from "@/components/ui/logo";
import { cn } from "@/lib/cn";
import { SidebarPanel } from "@/components/shell/sidebar-shell";
import { initialsOf } from "@/lib/text/initials";

const ITEMS = [
  { key: "campaigns", href: "/ads/campaigns", icon: Megaphone },
  { key: "redeem", href: "/ads/redeem", icon: ScanLine },
  { key: "packages", href: "/ads/packages", icon: Tag },
  { key: "cashiers", href: "/ads/cashiers", icon: UsersRound },
] as const;

type ItemKey = (typeof ITEMS)[number]["key"];

/** Rubriques selon le rôle : le caissier ne valide que les bons ; les caissiers sont gérés par le propriétaire. */
export function adsNavItems(role: string | null | undefined) {
  if (role === "cashier") return ITEMS.filter((i) => i.key === "redeem");
  return ITEMS.filter((i) => i.key !== "cashiers" || role === "owner");
}

function activeKey(pathname: string): ItemKey {
  if (pathname.startsWith("/ads/redeem")) return "redeem";
  if (pathname.startsWith("/ads/packages")) return "packages";
  if (pathname.startsWith("/ads/cashiers")) return "cashiers";
  return "campaigns";
}

const rowClass = "pressable flex min-h-11 items-center gap-3 rounded-[10px] px-3 text-callout";

/**
 * Navigation de l'espace annonceur (maquette v2 24). Ordinateur : barre latérale bleu nuit (logo « NextIn · Espace
 * annonceur », carte de l'annonceur, rubriques, personne connectée en bas). Téléphone : pastilles en haut de page.
 */
export function AdsNav({
  variant,
  advertiser,
  role,
  user,
}: {
  variant: "sidebar" | "inline";
  /** Carte de l'annonceur : nom et « Secteur · Ville ». */
  advertiser?: { name: string; summary: string } | null;
  role?: string | null;
  user?: string | null;
}) {
  const t = useTranslations("ads");
  const ta = useTranslations("admin");
  const ts = useTranslations("settings");
  const pathname = usePathname();
  const active = activeKey(pathname);
  const items = adsNavItems(role);

  if (variant === "inline") {
    if (items.length < 2) return null;
    return (
      <nav aria-label={t("title")} className="md:hidden">
        <ul role="list" className="-mx-4 flex gap-2 scroll-fade-x px-4">
          {items.map((item) => (
            <li key={item.key}>
              <Link
                href={item.href}
                aria-current={active === item.key ? "page" : undefined}
                className={cn(
                  "pressable inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-subheadline whitespace-nowrap",
                  active === item.key ? "bg-accent-tint font-semibold text-accent-on-tint" : "bg-fill-tertiary text-label",
                )}
              >
                {t(`nav.${item.key}`)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    );
  }
  return (
    <SidebarPanel>
      <div className="flex items-center gap-2.5 px-2">
        <LogoMark className="size-8" />
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="text-headline font-bold">NextIn</span>
          <span className="text-caption text-label-secondary">{t("sidebarSubtitle")}</span>
        </span>
      </div>
      {advertiser ? (
        <div data-testid="advertiser-card" className="squircle flex min-h-14 items-center gap-2.5 rounded-[12px] bg-grouped-secondary px-2.5 py-2">
          <span aria-hidden className="squircle flex size-8 shrink-0 items-center justify-center rounded-[8px] bg-white font-rounded text-footnote font-bold text-navy">
            {initialsOf(advertiser.name)}
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-subheadline font-semibold">{advertiser.name}</span>
            <span className="truncate text-caption text-label-secondary">{advertiser.summary}</span>
          </span>
        </div>
      ) : null}
      <nav aria-label={t("title")} className="flex flex-col gap-4">
        <ul role="list" className="flex flex-col gap-0.5">
          {(advertiser ? items : []).map((item) => {
            const Icon = item.icon;
            const current = active === item.key;
            return (
              <li key={item.key}>
                <Link
                  href={item.href}
                  aria-current={current ? "page" : undefined}
                  className={cn(rowClass, current ? "bg-accent-tint font-semibold text-label" : "text-label-secondary hover:bg-fill-tertiary hover:text-label")}
                >
                  <Icon aria-hidden className="size-5 stroke-[1.75]" />
                  {t(`nav.${item.key}`)}
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="flex flex-col gap-1">
          <p className="px-3 text-caption font-medium tracking-wide text-label-secondary uppercase">{t("accountNav")}</p>
          <ul role="list" className="flex flex-col gap-0.5">
            <li>
              <Link href="/app" className={cn(rowClass, "text-label-secondary hover:bg-fill-tertiary hover:text-label")}>
                <Building2 aria-hidden className="size-5 stroke-[1.75]" />
                {ta("nav.organizations")}
              </Link>
            </li>
            <li>
              <Link href={`/app/settings?from=${encodeURIComponent(pathname)}`} className={cn(rowClass, "text-label-secondary hover:bg-fill-tertiary hover:text-label")}>
                <Settings aria-hidden className="size-5 stroke-[1.75]" />
                {ts("open")}
              </Link>
            </li>
          </ul>
        </div>
      </nav>
      {user ? (
        <div className="mt-auto flex items-center gap-2.5 px-2.5 py-2">
          <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-caption font-semibold text-on-accent">
            {initialsOf(user)}
          </span>
          <span className="min-w-0 truncate text-footnote text-label-secondary">{user}</span>
        </div>
      ) : null}
    </SidebarPanel>
  );
}
