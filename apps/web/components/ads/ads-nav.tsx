"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronLeft, Megaphone, ScanLine } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { cn } from "@/lib/cn";

const ITEMS = [
  { key: "campaigns", href: "/ads", icon: Megaphone },
  { key: "redeem", href: "/ads/redeem", icon: ScanLine },
] as const;

/** Navigation de l'espace annonceur : barre latérale sur grand écran, pastilles en haut de page sur téléphone. */
export function AdsNav({ variant, advertiser }: { variant: "sidebar" | "inline"; advertiser?: string }) {
  const t = useTranslations("ads");
  const ta = useTranslations("admin");
  const pathname = usePathname();
  const active = pathname.startsWith("/ads/redeem") ? "redeem" : "campaigns";

  if (variant === "inline") {
    return (
      <nav aria-label={t("title")} className="lg:hidden">
        <ul role="list" className="flex gap-2 overflow-x-auto">
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
        <p className="truncate text-headline">{advertiser ?? t("title")}</p>
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
