"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Building2, ChevronLeft, LayoutGrid, Stethoscope, UsersRound } from "lucide-react";
import { cn } from "@/lib/cn";
import { Logo } from "@/components/ui/logo";

export type AdminNavKey = "overview" | "branches" | "practitioners" | "staff";

const ITEMS: { key: AdminNavKey; path: string; icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }> }[] = [
  { key: "overview", path: "", icon: LayoutGrid },
  { key: "branches", path: "/branches", icon: Building2 },
  { key: "practitioners", path: "/practitioners", icon: Stethoscope },
  { key: "staff", path: "/staff", icon: UsersRound },
];

export function adminNavItems(orgId: string) {
  return ITEMS.map((i) => ({ ...i, href: `/app/o/${orgId}${i.path}` }));
}

/** Barre latérale du back-office (maquette 06), visible à partir de la largeur tablette paysage. */
export function AdminSidebar({ orgId, orgName }: { orgId: string; orgName: string }) {
  const t = useTranslations("admin");
  const pathname = usePathname();
  const items = adminNavItems(orgId);
  const activeKey =
    [...items].reverse().find((i) => (i.path ? pathname.startsWith(i.href) : pathname === i.href))?.key ?? "overview";

  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-6 overflow-y-auto bg-grouped-secondary px-3 py-5 shadow-[inset_-0.5px_0_0_var(--separator)] lg:flex">
      <div className="px-3">
        <Logo />
      </div>
      <div className="px-3">
        <p className="truncate text-headline">{orgName}</p>
        <Link
          href="/app"
          className="inline-flex min-h-11 items-center gap-1 text-subheadline text-accent-text"
        >
          <ChevronLeft aria-hidden className="size-4 stroke-[2.25]" />
          {t("nav.organizations")}
        </Link>
      </div>
      <nav aria-label={t("navLabel")}>
        <ul role="list" className="flex flex-col gap-1">
          {items.map((item) => {
            const active = item.key === activeKey;
            const Icon = item.icon;
            return (
              <li key={item.key}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "pressable flex min-h-11 items-center gap-3 rounded-[10px] px-3 text-body",
                    active ? "bg-accent-tint font-semibold text-accent-on-tint" : "text-label hover:bg-fill-tertiary",
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
