import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { AdminPage } from "@/components/admin/admin-page";
import { ReadOnlyNotice } from "@/components/admin/read-only-notice";
import { SavedNotice } from "@/components/admin/saved-notice";
import { ScheduleEditor } from "@/components/admin/schedule-editor";
import { getOrgContext } from "@/lib/admin/context";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { addLeave, addScheduleRange, deleteLeave, deleteScheduleRange } from "../../../_actions/schedule";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("schedule");
  return { title: t("title") };
}

/** Horaires de consultation et congés d'un praticien (créneaux de rendez-vous, M5b). */
export default async function PractitionerSchedulePage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string; practitionerId: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { orgId, practitionerId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(practitionerId)) notFound();
  const ctx = await getOrgContext(orgId);
  const supabase = await getSupabaseServerClient();
  const { data: p } = await supabase
    .from("practitioners")
    .select("id, title, display_name, branch_id")
    .eq("id", practitionerId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!p) notFound();
  const today = new Date().toISOString().slice(0, 10);
  const [{ data: ranges }, { data: leaves }, { data: services }] = await Promise.all([
    supabase
      .from("practitioner_schedules")
      .select("id, weekday, starts_at, ends_at, slot_minutes, service:services(name)")
      .eq("practitioner_id", practitionerId)
      .order("weekday")
      .order("starts_at"),
    supabase
      .from("practitioner_leaves")
      .select("id, starts_on, ends_on, reason")
      .eq("practitioner_id", practitionerId)
      .gte("ends_on", today)
      .order("starts_on"),
    supabase.from("services").select("id, name").eq("branch_id", p.branch_id).eq("active", true).order("sort_order"),
  ]);
  const canManage = ctx.canManageBranch(p.branch_id);
  const t = await getTranslations("schedule");
  const name = [p.title, p.display_name].filter(Boolean).join(" ");
  return (
    <AdminPage
      title={t("title")}
      eyebrow={name}
      subtitle={t("subtitle")}
      back={{ href: `/app/o/${orgId}/practitioners/${practitionerId}`, label: name }}
    >
      <SavedNotice show={(await searchParams).saved === "1"} />
      <ReadOnlyNotice show={!canManage} />
      <ScheduleEditor
        locale={await getLocale()}
        disabled={!canManage}
        services={services ?? []}
        ranges={(ranges ?? []).map((r) => ({
          id: r.id,
          weekday: r.weekday,
          startsAt: r.starts_at.slice(0, 5),
          endsAt: r.ends_at.slice(0, 5),
          slotMinutes: r.slot_minutes,
          serviceName: r.service?.name ?? "",
        }))}
        leaves={(leaves ?? []).map((l) => ({ id: l.id, startsOn: l.starts_on, endsOn: l.ends_on, reason: l.reason }))}
        addRange={addScheduleRange.bind(null, orgId, practitionerId)}
        deleteRange={deleteScheduleRange.bind(null, orgId, practitionerId)}
        addLeave={addLeave.bind(null, orgId, practitionerId)}
        deleteLeave={deleteLeave.bind(null, orgId, practitionerId)}
      />
    </AdminPage>
  );
}
