import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { getOrgContext } from "@/lib/admin/context";

/** Back-office d'un établissement : barre latérale (grand écran) + contenu. */
export default async function OrgLayout({ children, params }: { children: React.ReactNode; params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const ctx = await getOrgContext(orgId);
  return (
    <div className="flex min-h-dvh lg:[--shell-sidebar:16rem]">
      <AdminSidebar orgId={ctx.org.id} orgName={ctx.org.name} />
      <main className="min-w-0 flex-1 pb-36">{children}</main>
    </div>
  );
}
