"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { AlertTriangle, CalendarClock, CheckCircle2, MessageCircle, Printer, Repeat2, Ticket, UserRound } from "lucide-react";
import { localDate } from "@nextin/shared/appointments";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { CalloutCard } from "@/components/ui/callout-card";
import { ListIcon, ListRow, ListSection } from "@/components/ui/list";
import { ServiceTile } from "@/components/ui/service-tile";
import { useToast } from "@/components/ui/toast";
import type { Appointment, AppointmentsContext } from "@/lib/desk/appointments";
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 px-1">
        <div className="flex flex-wrap items-center gap-2">
          <AppointmentStatusBadge status={a.display_status} shape="pill" />
          {a.conflict ? (
            <span className="inline-flex items-center gap-1 text-subheadline font-semibold text-orange-text">
              <AlertTriangle aria-hidden className="size-4" />
              {t("conflict")}
            </span>
          ) : null}
        </div>
        <p className="text-title1 font-bold tabular">{t("time", { start: timeOf(a.starts_at, locale, tz), end: timeOf(a.ends_at, locale, tz) })}</p>
        <p className="text-callout text-label-secondary first-letter:uppercase">{longDay(day, locale)}</p>
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
        <ListRow
          icon={
            <ListIcon color="var(--fill-secondary)">
              <UserRound className="text-label" />
            </ListIcon>
          }
          title={a.customer_label ?? t("noLabel")}
          subtitle={t("with", { name: a.practitioner.name })}
        />
        <ListRow icon={<ServiceTile letter={a.service.prefix} color={a.service.color} className="size-[1.875rem] rounded-[7px] text-subheadline" />} title={serviceName} />
        <ListRow
          icon={
            <ListIcon color="var(--green-fill)">
              <MessageCircle />
            </ListIcon>
          }
          title={t("phone")}
          detail={<span className="tabular">{a.phone_e164 ?? t("noPhoneValue")}</span>}
        />
        {a.ticket ? (
          <ListRow
            icon={
              <ListIcon color="var(--navy)">
                <Ticket />
              </ListIcon>
            }
            title={t("ticket", { code: a.ticket.display_code })}
            href={`/desk/print/${a.ticket.id}`}
            accessory={<Printer aria-hidden className="size-5 text-label-tertiary" />}
          />
        ) : null}
        {a.rescheduled_from_id ? (
          <ListRow
            icon={
              <ListIcon color="var(--fill-secondary)">
                <Repeat2 className="text-label" />
              </ListIcon>
            }
            title={t("rescheduledFrom")}
          />
        ) : null}
      </ListSection>

      {a.status === "confirmed" ? (
        <div className="flex flex-col gap-2">
          {isToday ? (
            <Button block onClick={arrive} loading={pending === "checkIn"}>
              {t("checkIn")}
            </Button>
          ) : null}
          <Button block variant="tinted" onClick={onReschedule} disabled={!!pending}>
            {t("reschedule")}
          </Button>
          {started ? (
            <Button block variant="gray" onClick={noShow} loading={pending === "noShow"}>
              {t("noShow")}
            </Button>
          ) : null}
          <Button block variant="destructive-plain" onClick={() => setConfirmCancel(true)} disabled={!!pending}>
            {t("cancel")}
          </Button>
        </div>
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
