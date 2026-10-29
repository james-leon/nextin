import { notFound } from "next/navigation";
import { PlatformNav } from "@/components/platform/platform-sidebar";
import { requireStaffSession } from "@/lib/auth/session";

/** Console Wintek (super admin) : réservée aux administrateurs de la plateforme. */
export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const session = await requireStaffSession("/admin");
  if (!session.isPlatformAdmin) notFound();
  return (
    <div data-shell="sidebar" className="flex min-h-dvh lg:[--shell-sidebar:16rem]">
      <PlatformNav variant="sidebar" hasOrgs={session.memberships.length > 0} />
      <main className="min-w-0 flex-1 pb-36">{children}</main>
    </div>
  );
}
