import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { formatTime } from "@nextin/shared";
import { AdminPage } from "@/components/admin/admin-page";
import { HoursForm } from "@/components/admin/hours-form";
import { ReadOnlyNotice } from "@/components/admin/read-only-notice";
import { getBranch } from "@/lib/admin/branch";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { saveOpeningHours } from "../../../_actions/structure";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("hours");
  return { title: t("title") };
}

export default async function HoursPage({ params }: { params: Promise<{ orgId: string; branchId: string }> }) {
  const { orgId, branchId } = await params;
  const { branch, canManage } = await getBranch(orgId, branchId);
  const t = await getTranslations("hours");
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase.from("opening_hours").select("weekday, opens_at, closes_at").eq("branch_id", branchId);
  const byDay = new Map((data ?? []).map((r) => [r.weekday, r]));
  const initial = [1, 2, 3, 4, 5, 6, 7].map((weekday) => {
    const row = byDay.get(weekday);
    return {
      weekday,
      open: !!row,
      opensAt: row ? formatTime(row.opens_at) : "08:00",
      closesAt: row ? formatTime(row.closes_at) : "17:00",
    };
  });
  return (
    <AdminPage title={t("title")} subtitle={t("subtitle")} eyebrow={branch.name} back={{ href: `/app/o/${orgId}/branches/${branchId}`, label: branch.name }}>
      <ReadOnlyNotice show={!canManage} />
      <HoursForm action={saveOpeningHours.bind(null, orgId, branchId)} initial={initial} disabled={!canManage} />
    </AdminPage>
  );
}
