import { getTranslations } from "next-intl/server";
import { AdsNav } from "@/components/ads/ads-nav";
import { SidebarShell } from "@/components/shell/sidebar-shell";
import { getAdvertiserContext } from "@/lib/ads/context";

/** Espace annonceur (M10b) : compte connecté ; barre latérale sur grand écran, repliable sur tablette portrait. */
export default async function AdsLayout({ children }: { children: React.ReactNode }) {
  const [{ advertiser, role }, t] = await Promise.all([getAdvertiserContext(), getTranslations("common")]);
  return (
    <SidebarShell labels={{ open: t("sidebarShow"), close: t("sidebarHide") }} sidebar={<AdsNav variant="sidebar" advertiser={advertiser?.name} role={role} />}>
      {children}
    </SidebarShell>
  );
}
