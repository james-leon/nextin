import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AdminPage } from "@/components/admin/admin-page";
import { BranchSettingsForm } from "@/components/admin/branch-settings-form";
import { ReadOnlyNotice } from "@/components/admin/read-only-notice";
import { getBranch } from "@/lib/admin/branch";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { saveBranchSettings } from "../../../_actions/structure";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("branchSettings");
  return { title: t("title") };
}

export default async function BranchSettingsPage({ params }: { params: Promise<{ orgId: string; branchId: string }> }) {
  const { orgId, branchId } = await params;
  const { branch, canManage } = await getBranch(orgId, branchId);
  const t = await getTranslations("branchSettings");
  const supabase = await getSupabaseServerClient();
  const { data: s } = await supabase.from("branch_settings").select("*").eq("branch_id", branchId).maybeSingle();
  if (!s) notFound();
  return (
    <AdminPage title={t("title")} eyebrow={branch.name} back={{ href: `/app/o/${orgId}/branches/${branchId}`, label: branch.name }}>
      <ReadOnlyNotice show={!canManage} />
      <BranchSettingsForm
        action={saveBranchSettings.bind(null, orgId, branchId)}
        disabled={!canManage}
        initial={{
          remote: s.remote_tickets_enabled,
          priorities: s.priorities_enabled,
          rating: s.rating_enabled,
          almostTurn: s.almost_turn_threshold,
          appointmentMode: s.appointment_mode as "ratio" | "strict",
          walkinRatio: s.appointment_walkin_ratio,
          early: s.appointment_early_minutes,
          grace: s.appointment_late_grace_minutes,
          noShow: s.appointment_no_show_minutes,
          publicListing: s.public_listing_enabled,
          maxDistanceKm: s.remote_max_distance_km == null ? null : Number(s.remote_max_distance_km),
          confirmThreshold: s.remote_confirm_threshold,
          penaltyPlaces: s.remote_penalty_places,
          maxDelays: s.remote_max_delays,
          travelKmh: s.remote_travel_kmh,
          leaveMargin: s.remote_leave_margin_minutes,
          requests: s.appointment_requests_enabled,
          requestDays: s.appointment_request_days,
        }}
      />
    </AdminPage>
  );
}
