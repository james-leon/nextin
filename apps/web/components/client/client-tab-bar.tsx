"use client";

import { useLiteT } from "@/lib/i18n/lite";
import { Clock, ScanLine, UserRound } from "lucide-react";
import { TabBar } from "@/components/ui/tab-bar";

/** Onglets du client (maquette 01) : Scanner, Mon ticket, Profil. */
export function ClientTabBar({ active, className }: { active: "scan" | "ticket" | "profile"; className?: string }) {
  const t = useLiteT("client.tabs");
  return (
    <TabBar
      label={t("label")}
      active={active}
      className={className}
      items={[
        { key: "scan", label: t("scan"), icon: <ScanLine aria-hidden />, href: "/" },
        { key: "ticket", label: t("ticket"), icon: <Clock aria-hidden />, href: "/t" },
        { key: "profile", label: t("profile"), icon: <UserRound aria-hidden />, href: "/profile" },
      ]}
    />
  );
}
