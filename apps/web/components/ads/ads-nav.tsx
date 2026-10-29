"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronLeft, Megaphone, ScanLine, UsersRound } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { cn } from "@/lib/cn";

const ITEMS = [
  { key: "campaigns", href: "/ads", icon: Megaphone },
  { key: "redeem", href: "/ads/redeem", icon: ScanLine },
  { key: "cashiers", href: "/ads/cashiers", icon: UsersRound },
] as const;

/** Rubriques selon le rôle : le caissier ne valide que les bons ; les caissiers sont gérés par le propriétaire. */
function itemsFor(role: string | null | undefined) {
  if (role === "cashier") return ITEMS.filter((i) => i.key === "redeem");
  return ITEMS.filter((i) => i.key !== "cashiers" || role === "owner");
}

/** Navigation de l'espace annonceur : barre latérale sur grand écran, pastilles en haut de page sur téléphone. */
export function AdsNav({ variant, advertiser, role }: { variant: "sidebar" | "inline"; advertiser?: string; role?: string | null }) {
  const t = useTranslations("ads");
  const ta = useTranslations("admin");
  const pathname = usePathname();
  const active = pathname.startsWith("/ads/redeem") ? "redeem" : pathname.startsWith("/ads/cashiers") ? "cashiers" : "campaigns";
  const items = itemsFor(role);

  if (variant === "inline") {
    return (
      <nav aria-label={t("title")} className="lg:hidden">
        <ul role="list" className="flex gap-2 overflow-x-auto">
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
    <aside className="hidden w-64 shrink-0 bg-grouped-secondary shadow-[inset_-0.5px_0_0_var(--separator)] lg:block">
      {/* Colonne sur toute la hauteur de la page (fond, séparateur) ; contenu collant à la fenêtre au défilement. */}
      <div className="sticky top-0 flex h-dvh flex-col gap-6 overflow-y-auto px-3 py-5">
        <div className="px-3">
          <Logo />
        </div>
        <div className="px-3">
          <p className="truncate text-headline">{advertiser ?? t("title")}</p>
          <Link href="/app" className="inline-flex min-h-11 items-center gap-1 text-subheadline text-accent-text">
            <ChevronLeft aria-hidden className="size-4 stroke-[2.25]" />
            {ta("nav.organizations")}
          </Link>
        </div>
        <nav aria-label={t("title")}>
          <ul role="list" className="flex flex-col gap-1">
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    aria-current={active === item.key ? "page" : undefined}
                    className={cn(
                      "pressable flex min-h-11 items-center gap-3 rounded-[10px] px-3 text-body",
                      active === item.key ? "bg-accent-tint font-semibold text-accent-on-tint" : "text-label hover:bg-fill-tertiary",
                    )}
                  >
                    <Icon aria-hidden className="size-5 stroke-[1.75]" />
                    {t(`nav.${item.key}`)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </aside>
  );
}
