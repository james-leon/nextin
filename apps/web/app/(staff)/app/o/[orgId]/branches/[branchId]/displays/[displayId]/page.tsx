import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AdminPage } from "@/components/admin/admin-page";
import { ConfirmAction } from "@/components/admin/confirm-action";
import { DisplayForm } from "@/components/admin/display-forms";
import { ReadOnlyNotice } from "@/components/admin/read-only-notice";
import { getBranch } from "@/lib/admin/branch";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { revokeDisplay, updateDisplay } from "../../../../_actions/displays";

type Props = { params: Promise<{ orgId: string; branchId: string; displayId: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("displays");
  return { title: t("edit") };
}

export default async function DisplayPage({ params }: Props) {
  const { orgId, branchId, displayId } = await params;
  const { branch, canManage } = await getBranch(orgId, branchId);
  if (!/^[0-9a-f-]{36}$/i.test(displayId)) notFound();
  const t = await getTranslations("displays");
  const supabase = await getSupabaseServerClient();
  const [{ data: display }, services] = await Promise.all([
    supabase
      .from("displays")
      .select("id, name, display_services(service_id)")
      .eq("id", displayId)
      .eq("branch_id", branchId)
      .eq("status", "active")
      .maybeSingle(),
    supabase.from("services").select("id, name, prefix, color").eq("branch_id", branchId).eq("active", true).order("sort_order"),
  ]);
  if (!display) notFound();
  const name = display.name ?? "";
  return (
    <AdminPage narrow title={name} eyebrow={t("title")} back={{ href: `/app/o/${orgId}/branches/${branchId}/displays`, label: t("title") }}>
      <ReadOnlyNotice show={!canManage} />
      <DisplayForm
        action={updateDisplay.bind(null, orgId, branchId, displayId)}
        services={services.data ?? []}
        initial={{ name, serviceIds: (display.display_services ?? []).map((s) => s.service_id) }}
        disabled={!canManage}
      />
      {canManage ? (
        <ConfirmAction
          action={revokeDisplay.bind(null, orgId, branchId, displayId)}
          label={t("revoke")}
          title={t("revokeTitle", { name })}
          body={t("revokeBody")}
          confirmLabel={t("revoke")}
        />
      ) : null}
      <p className="sr-only">{branch.name}</p>
    </AdminPage>
  );
}
