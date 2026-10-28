"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronLeft, CreditCard, Layers, SlidersHorizontal } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { cn } from "@/lib/cn";

const ITEMS = [
  { key: "subscriptions", href: "/admin", icon: CreditCard },
  { key: "plans", href: "/admin/plans", icon: Layers },
  { key: "settings", href: "/admin/settings", icon: SlidersHorizontal },
] as const;

/** Navigation de la console Wintek : barre latérale sur grand écran, liste en haut de page sur téléphone. */
export function PlatformNav({ variant }: { variant: "sidebar" | "inline" }) {
  const t = useTranslations("platform");
  const ta = useTranslations("admin");
  const pathname = usePathname();
  const active = [...ITEMS].reverse().find((i) => (i.href === "/admin" ? pathname === "/admin" || pathname.startsWith("/admin/subscriptions") : pathname.startsWith(i.href)))?.key;

  if (variant === "inline") {
    return (
      <nav aria-label={t("title")} className="lg:hidden">
        <ul role="list" className="flex gap-2 overflow-x-auto px-4 pb-1">
          {ITEMS.map((item) => (
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
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-6 overflow-y-auto bg-grouped-secondary px-3 py-5 shadow-[inset_-0.5px_0_0_var(--separator)] lg:flex">
      <div className="px-3">
        <Logo />
      </div>
      <div className="px-3">
        <p className="truncate text-headline">{t("title")}</p>
        <Link href="/app" className="inline-flex min-h-11 items-center gap-1 text-subheadline text-accent-text">
          <ChevronLeft aria-hidden className="size-4 stroke-[2.25]" />
          {ta("nav.organizations")}
        </Link>
      </div>
      <nav aria-label={t("title")}>
        <ul role="list" className="flex flex-col gap-1">
          {ITEMS.map((item) => {
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
    </aside>
  );
}
