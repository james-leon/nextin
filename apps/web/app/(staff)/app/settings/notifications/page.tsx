import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AdminPage } from "@/components/admin/admin-page";
import { StaffAlerts } from "@/components/settings/staff-alerts";
import { requireStaffSession } from "@/lib/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings");
  return { title: t("notifications") };
}

/** Notifications du membre du personnel (maquette v2 07) : réglages propres à cet appareil. */
export default async function NotificationsPage() {
  await requireStaffSession("/app/settings/notifications");
  const t = await getTranslations("settings");
  return (
    <main className="pb-24">
      <AdminPage narrow title={t("notifications")} back={{ href: "/app/settings", label: t("myAccount") }}>
        <StaffAlerts />
      </AdminPage>
    </main>
  );
}
