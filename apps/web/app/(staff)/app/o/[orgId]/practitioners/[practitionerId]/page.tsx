import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { formatTime } from "@nextin/shared";
import { localDate } from "@nextin/shared/appointments";
import { CalendarClock, Plus, Trash2 } from "lucide-react";
import { AdminPage } from "@/components/admin/admin-page";
import { ConfirmAction } from "@/components/admin/confirm-action";
import { PractitionerForm } from "@/components/admin/practitioner-form";
import { ReadOnlyNotice } from "@/components/admin/read-only-notice";
import { ListIcon, ListRow, ListSection } from "@/components/ui/list";
import { manageableBranches } from "@/lib/admin/branches";
import { getOrgContext } from "@/lib/admin/context";
import { listSpecialties } from "@/lib/admin/specialties";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { deletePractitioner, savePractitioner } from "../../_actions/people";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("practitioners");
  return { title: t("editTitle") };
}

export default async function EditPractitionerPage({ params }: { params: Promise<{ orgId: string; practitionerId: string }> }) {
  const { orgId, practitionerId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(practitionerId)) notFound();
  const ctx = await getOrgContext(orgId);
  const supabase = await getSupabaseServerClient();
  const [{ data: p }, branches, specialties, { data: slots }, { data: leaves }] = await Promise.all([
    supabase.from("practitioners").select("*, branch:branches(id, name, timezone), specialty:specialties(name)").eq("id", practitionerId).eq("organization_id", orgId).maybeSingle(),
    manageableBranches(ctx),
    listSpecialties(orgId),
    supabase.from("practitioner_schedules").select("weekday, starts_at, ends_at").eq("practitioner_id", practitionerId).order("weekday").order("starts_at"),
    supabase.from("practitioner_leaves").select("id, starts_on, ends_on, reason").eq("practitioner_id", practitionerId).order("starts_on"),
  ]);
  if (!p) notFound();
  const canManage = ctx.canManageBranch(p.branch_id);
  const t = await getTranslations("practitioners");
  const ta = await getTranslations("admin");
  const ts = await getTranslations("schedule");
  const tw = await getTranslations("weekdaysShort");
  const format = await getFormatter();
  const branchOptions = canManage ? branches : p.branch ? [p.branch] : [];
  const scheduleHref = `/app/o/${orgId}/practitioners/${practitionerId}/schedule`;
  const today = localDate(new Date(), p.branch?.timezone ?? "Africa/Douala");
  const upcoming = (leaves ?? []).filter((l) => l.ends_on >= today);
  const days = [1, 2, 3, 4, 5, 6, 7].filter((d) => d <= 6 || (slots ?? []).some((x) => x.weekday === 7));
  const range = (from: string, to: string) =>
    format.dateTimeRange(new Date(`${from}T12:00:00`), new Date(`${to}T12:00:00`), { day: "numeric", month: "long" });
  return (
    <AdminPage
      inSplit
      title={[p.title, p.display_name].filter(Boolean).join(" ")}
      eyebrow={[p.specialty?.name, p.branch?.name].filter(Boolean).join(" · ") || t("editTitle")}
      back={{ href: `/app/o/${orgId}/practitioners`, label: t("title") }}
    >
      <ReadOnlyNotice show={!canManage} />
      <div className="grid grid-cols-1 gap-6 @3xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] @3xl:items-start">
        {/* Maquette v2 18 : la semaine de consultation en colonnes, les plages se modifient dans « Horaires et congés ». */}
        <section aria-labelledby="week-title" className="flex min-w-0 flex-col gap-1.5">
          <h2 id="week-title" className="px-4 text-footnote text-label-secondary uppercase">
            {t("weekTitle")}
          </h2>
          <div className="squircle overflow-hidden rounded-[var(--radius-lg)] bg-grouped-secondary">
            <div className="grid gap-1.5 p-3" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
              {days.map((d) => {
                const daySlots = (slots ?? []).filter((x) => x.weekday === d);
                return (
                  <div key={d} className="flex min-w-0 flex-col gap-1.5">
                    <p className="text-center text-caption font-medium text-label-secondary">{tw(String(d) as "1")}</p>
                    <div className="flex min-h-24 flex-col gap-1 rounded-[8px] bg-fill-tertiary p-1">
                      {daySlots.map((x) => (
                        <p key={x.starts_at} className="rounded-[6px] bg-accent-tint px-1 py-1.5 text-center text-caption leading-tight text-accent-on-tint tabular">
                          {formatTime(x.starts_at)}
                          <br />
                          {formatTime(x.ends_at)}
                        </p>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <ul role="list" className="hairline-t">
              <ListRow
                href={scheduleHref}
                icon={<Plus aria-hidden className="size-5 text-accent-text" />}
                title={<span className="text-accent-text">{canManage ? t("editSchedule") : ts("open")}</span>}
              />
            </ul>
          </div>
        </section>
        <div className="flex min-w-0 flex-col gap-6">
          <ListSection header={t("leavesTitle")} footer={t("leavesHint")}>
            {upcoming.map((l) => (
              <ListRow
                key={l.id}
                icon={
                  <ListIcon color="var(--orange-fill)">
                    <CalendarClock />
                  </ListIcon>
                }
                title={range(l.starts_on, l.ends_on)}
                subtitle={l.reason ?? undefined}
              />
            ))}
            <ListRow href={scheduleHref} icon={<Plus aria-hidden className="size-5 text-accent-text" />} title={<span className="text-accent-text">{t("addLeave")}</span>} />
          </ListSection>
          <div className="flex flex-col gap-1.5">
            <h2 className="px-4 text-footnote text-label-secondary uppercase">{t("sheetTitle")}</h2>
      <PractitionerForm
        action={savePractitioner.bind(null, orgId, practitionerId)}
        specialties={specialties}
        branches={branchOptions}
        disabled={!canManage}
        initial={{ title: p.title, displayName: p.display_name, specialtyId: p.specialty_id, branchId: p.branch_id, active: p.active }}
      />
          </div>
        </div>
      </div>
      {canManage ? (
        <ConfirmAction
          action={deletePractitioner.bind(null, orgId, practitionerId)}
          label={ta("delete")}
          title={t("deleteConfirmTitle")}
          body={t("deleteConfirmBody")}
          confirmLabel={ta("delete")}
          icon={<Trash2 aria-hidden className="size-5" />}
        />
      ) : null}
    </AdminPage>
  );
}
