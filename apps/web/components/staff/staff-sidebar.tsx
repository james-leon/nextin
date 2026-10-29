"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Building2, DoorOpen, Megaphone, Settings, ShieldCheck } from "lucide-react";
import { SidebarPanel } from "@/components/shell/sidebar-shell";
import { Logo } from "@/components/ui/logo";
import { cn } from "@/lib/cn";

const ITEMS = [
  { key: "organizations", href: "/app", icon: Building2 },
  { key: "desks", href: "/desk", icon: DoorOpen },
  { key: "advertiser", href: "/ads", icon: Megaphone },
] as const;

/**
 * Barre latérale des pages du personnel hors établissement (choix du poste) : mêmes repères que le back-office
 * (logo, rubriques, réglages en bas), pour que le contenu s'aligne sur les autres pages.
 */
export function StaffSidebar({ isPlatformAdmin }: { isPlatformAdmin: boolean }) {
  const t = useTranslations("admin");
  const td = useTranslations("desk");
  const ts = useTranslations("settings");
  const pathname = usePathname();
  const link = "pressable flex min-h-11 items-center gap-3 rounded-[10px] px-3 text-body";

  return (
    <SidebarPanel>
      <div className="px-3">
        <Logo />
      </div>
      <nav aria-label={t("staffNavLabel")}>
        <ul role="list" className="flex flex-col gap-1">
          {ITEMS.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <li key={item.key}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(link, active ? "bg-accent-tint font-semibold text-accent-on-tint" : "text-label hover:bg-fill-tertiary")}
                >
                  <Icon aria-hidden className="size-5 stroke-[1.75]" />
                  {item.key === "desks" ? td("title") : t(`nav.${item.key}`)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      {isPlatformAdmin ? (
        <Link href="/admin" className={cn(link, "mt-auto text-label hover:bg-fill-tertiary")}>
          <ShieldCheck aria-hidden className="size-5 stroke-[1.75]" />
          {t("nav.platform")}
        </Link>
      ) : null}
      <Link href={`/app/settings?from=${encodeURIComponent(pathname)}`} className={cn(link, "text-label hover:bg-fill-tertiary", !isPlatformAdmin && "mt-auto")}>
        <Settings aria-hidden className="size-5 stroke-[1.75]" />
        {ts("open")}
      </Link>
    </SidebarPanel>
  );
}
