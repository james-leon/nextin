"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { AlertTriangle, CalendarClock, CheckCircle2, Printer } from "lucide-react";
import { localDate } from "@nextin/shared/appointments";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { CalloutCard } from "@/components/ui/callout-card";
import { ListRow, ListSection } from "@/components/ui/list";
import { useToast } from "@/components/ui/toast";
import { personLine, type Appointment, type AppointmentsContext } from "@/lib/desk/appointments";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { longDay, timeOf } from "./format";
import { AppointmentStatusBadge } from "./status-badge";

type CheckIn = { code: string; ticketId: string; late: boolean };

/**
 * Détail d'un rendez-vous et ses actions : arrivée du patient (action principale, le jour même),
 * reprogrammation, absence, annulation. Aucune donnée du patient au-delà du repère et du numéro saisis à l'accueil.
 */
export function AppointmentDetail({
  appointment: a,
  ctx,
  onChanged,
  onReschedule,
}: {
  appointment: Appointment;
  ctx: AppointmentsContext;
  onChanged: (next: Appointment) => void;
  onReschedule: () => void;
}) {
  const t = useTranslations("appointments");
  const ta = t;
  const ti = useTranslations("identity");
  const te = useTranslations("errors");
  const locale = useLocale();
  const toast = useToast();
  const supabase = getSupabaseBrowserClient();
  const [pending, setPending] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [checkIn, setCheckIn] = useState<CheckIn | null>(null);
  const tz = ctx.branch.timeZone;
  const day = localDate(a.starts_at, tz);
  const isToday = day === ctx.today;
  const [openedAt] = useState(() => Date.now());
  const started = new Date(a.starts_at).getTime() <= openedAt;
  const serviceName = locale === "en" && a.service.name_en ? a.service.name_en : a.service.name;

  async function run(name: string, fn: () => PromiseLike<{ data: unknown; error: { message: string } | null }>) {
    setPending(name);
    const { data, error } = await fn();
    setPending(null);
    if (error) {
      toast(te.has(error.message as never) ? te(error.message as never) : te("generic"));
      return null;
    }
    return data;
  }

  async function arrive() {
    const r = (await run("checkIn", () => supabase.rpc("check_in_appointment", { p_appointment: a.id }))) as {
      appointment: Appointment;
      ticket: { id: string; display_code: string };
      late: boolean;
    } | null;
    if (!r) return;
    setCheckIn({ code: r.ticket.display_code, ticketId: r.ticket.id, late: r.late });
    onChanged(r.appointment);
  }

  async function noShow() {
    const r = await run("noShow", () => supabase.rpc("mark_appointment_no_show", { p_appointment: a.id }));
    if (r) onChanged(r as Appointment);
  }

  async function cancel() {
    const r = await run("cancel", () => supabase.rpc("cancel_appointment", { p_appointment: a.id }));
    if (r) onChanged(r as Appointment);
  }

  // Maquette v2 20 : « Rendez-vous » puis « 10:30 · Mme Eyenga », praticien, service et rappels en lignes ; une seule
  // action principale (« Marquer arrivé », le jour même), les autres en liens dessous (annulation en rouge).
  const person = personLine(a, ti);
  const reminders = a.email ? ta("email") : a.phone_e164 ? ta("phone") : ta("remindersNone");
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1 px-1">
        <p className="text-footnote uppercase text-label-secondary">{ta("title")}</p>
        <p className="text-title2 font-bold [text-wrap:balance]">
          <span className="tabular">{timeOf(a.starts_at, locale, tz)}</span>
          {person ? ` · ${person}` : ""}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <AppointmentStatusBadge status={a.display_status} shape="pill" />
          <span className="text-subheadline text-label-secondary first-letter:uppercase">
            {longDay(day, locale)} · {t("time", { start: timeOf(a.starts_at, locale, tz), end: timeOf(a.ends_at, locale, tz) })}
          </span>
          {a.conflict ? (
            <span className="inline-flex items-center gap-1 text-subheadline font-semibold text-orange-text">
              <AlertTriangle aria-hidden className="size-4" />
              {t("conflict")}
            </span>
          ) : null}
        </div>
      </div>

      {a.conflict ? (
        <CalloutCard icon={<CalendarClock />} tone="orange">
          {t("conflictBody")}
        </CalloutCard>
      ) : null}

      {checkIn ? (
        <CalloutCard icon={<CheckCircle2 />} tone={checkIn.late ? "orange" : "green"} role="status">
          {checkIn.late ? t("checkedInLate", { code: checkIn.code }) : t("checkedIn", { code: checkIn.code })}
        </CalloutCard>
      ) : null}

      <ListSection>
        <ListRow title={t("practitioner")} detail={a.practitioner.name} />
        <ListRow title={t("service")} detail={serviceName} />
        <ListRow title={t("remindersLabel")} detail={reminders} />
        {a.email ? <ListRow title={t("email")} detail={<span className="break-all">{a.email}</span>} /> : null}
        {a.phone_e164 ? <ListRow title={a.email ? t("phoneOnly") : t("phone")} detail={<span className="tabular">{a.phone_e164}</span>} /> : null}
        {a.ticket ? (
          <ListRow
            title={t("ticket", { code: a.ticket.display_code })}
            href={`/desk/print/${a.ticket.id}`}
            accessory={<Printer aria-hidden className="size-5 text-label-tertiary" />}
          />
        ) : null}
        {a.rescheduled_from_id ? <ListRow title={t("rescheduledFrom")} /> : null}
      </ListSection>

      {a.status === "confirmed" ? (
        <>
          {isToday ? (
            <Button block onClick={arrive} loading={pending === "checkIn"}>
              {t("checkIn")}
            </Button>
          ) : null}
          <div className="flex flex-col gap-1.5">
            <ListSection>
              <ListRow onClick={pending ? undefined : onReschedule} title={<span className="text-accent-text">{t("reschedule")}</span>} />
              {started ? <ListRow onClick={pending ? undefined : noShow} title={<span className="text-accent-text">{t("noShow")}</span>} /> : null}
              <ListRow onClick={pending ? undefined : () => setConfirmCancel(true)} title={t("cancel")} destructive />
            </ListSection>
            {isToday ? <p className="px-4 text-footnote text-label-secondary">{t("checkInFooter")}</p> : null}
          </div>
        </>
      ) : checkIn ? (
        <Button asChild block variant="tinted">
          <a href={`/desk/print/${checkIn.ticketId}`} target="_blank" rel="noopener">
            <Printer aria-hidden className="size-5" />
            {t("print")}
          </a>
        </Button>
      ) : null}

      {confirmCancel ? (
        <AlertDialog
          open
          onOpenChange={setConfirmCancel}
          title={t("cancelTitle")}
          description={t("cancelBody")}
          cancelLabel={t("keep")}
          actionLabel={t("cancel")}
          destructive
          onAction={cancel}
        />
      ) : null}
    </div>
  );
}
