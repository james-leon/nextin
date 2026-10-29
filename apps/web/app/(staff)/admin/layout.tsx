import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PlatformNav } from "@/components/platform/platform-sidebar";
import { SidebarShell } from "@/components/shell/sidebar-shell";
import { requireStaffSession } from "@/lib/auth/session";

/** Console Wintek (super admin) : réservée aux administrateurs de la plateforme. */
export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const session = await requireStaffSession("/admin");
  if (!session.isPlatformAdmin) notFound();
  const t = await getTranslations("common");
  return (
    <SidebarShell
      labels={{ open: t("sidebarShow"), close: t("sidebarHide") }}
      sidebar={<PlatformNav variant="sidebar" hasOrgs={session.memberships.length > 0} />}
    >
      {children}
    </SidebarShell>
  );
}
