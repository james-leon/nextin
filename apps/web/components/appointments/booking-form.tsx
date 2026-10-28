"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CalendarCheck2, CalendarX2 } from "lucide-react";
import { normalizeCameroonPhone } from "@nextin/shared";
import { localDate, nextDays } from "@nextin/shared/appointments";
import { Button } from "@/components/ui/button";
import { CalloutCard } from "@/components/ui/callout-card";
import { ListRow, ListSection } from "@/components/ui/list";
import { ListSwitchRow } from "@/components/ui/list-switch-row";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Skeleton } from "@/components/ui/skeleton";
import { TextField } from "@/components/ui/text-field";
import type { Appointment, AppointmentsContext, Slot } from "@/lib/desk/appointments";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/cn";
import { longDay, shortDay, timeOf } from "./format";

const DAYS_AHEAD = 21;

/** Choix exclusif sous forme de pastilles (jours, créneaux) : boutons radio accessibles, cibles de 44 px. */
function Chip({ selected, onSelect, children, label }: { selected: boolean; onSelect: () => void; children: React.ReactNode; label?: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={label}
      onClick={onSelect}
      className={cn(
        "pressable squircle flex min-h-11 shrink-0 flex-col items-center justify-center rounded-[var(--radius-sm)] px-3 py-1.5 text-callout tabular",
        selected ? "bg-accent text-white" : "bg-grouped-secondary text-label",
      )}
    >
      {children}
    </button>
  );
}

/**
 * Prise (ou reprogrammation) d'un rendez-vous : praticien, jour, créneau libre, repère du patient,
 * numéro WhatsApp avec son accord (confirmation et rappels). Utilisé en feuille sur téléphone et en panneau
 * sur grand écran.
 */
export function BookingForm({
  ctx,
  reschedule,
  onDone,
}: {
  ctx: AppointmentsContext;
  reschedule?: Appointment | null;
  onDone: (appointment: Appointment) => void;
}) {
  const t = useTranslations("appointments");
  const tr = useTranslations("reception");
  const te = useTranslations("errors");
  const locale = useLocale();
  const supabase = getSupabaseBrowserClient();
  const bookable = ctx.practitioners.filter((p) => p.hasSchedule);
  const [practitionerId, setPractitionerId] = useState<string | null>(reschedule?.practitioner.id ?? bookable[0]?.id ?? null);
  const [date, setDate] = useState(ctx.today);
  const [slotData, setSlotData] = useState<{ key: string; slots: Slot[] } | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [messagesLocale, setMessagesLocale] = useState<"fr" | "en">(locale === "en" ? "en" : "fr");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Appointment | null>(null);
  const days = useMemo(() => nextDays(ctx.today, DAYS_AHEAD), [ctx.today]);
  const phoneE164 = phone.trim() ? normalizeCameroonPhone(phone) : null;

  const slotKey = `${practitionerId}|${date}`;
  const slots = slotData?.key === slotKey ? slotData.slots : null;
  const setSlots = (update: (s: Slot[] | null) => Slot[] | null) =>
    setSlotData((d) => (d ? { ...d, slots: update(d.slots) ?? [] } : d));

  useEffect(() => {
    if (!practitionerId) return;
    let alive = true;
    void supabase.rpc("available_slots", { p_practitioner: practitionerId, p_from: date, p_days: 1 }).then(({ data }) => {
      if (alive) {
        setSlotData({
          key: `${practitionerId}|${date}`,
          slots: ((data ?? []) as unknown as Slot[]).filter((s) => !reschedule || s.starts_at !== reschedule.starts_at),
        });
      }
    });
    return () => {
      alive = false;
    };
  }, [practitionerId, date, supabase, reschedule]);

  async function submit() {
    if (!practitionerId || !slot) return;
    if (!reschedule && phone.trim() && !phoneE164) return setError(te("phone_invalid"));
    if (!reschedule && phoneE164 && !consent) return setError(te("consent_required"));
    setPending(true);
    setError(null);
    const { data, error: e } = reschedule
      ? await supabase.rpc("reschedule_appointment", { p_appointment: reschedule.id, p_starts_at: slot, p_practitioner: practitionerId })
      : await supabase.rpc("book_appointment", {
          p_practitioner: practitionerId,
          p_starts_at: slot,
          p_customer_label: label.trim() || (null as unknown as string),
          p_phone_e164: phoneE164 as string,
          p_consent: !!phoneE164 && consent,
          p_locale: messagesLocale,
        });
    setPending(false);
    if (e) {
      if (e.message === "slot_unavailable") setSlots((s) => s?.filter((x) => x.starts_at !== slot) ?? null);
      return setError(te.has(e.message as never) ? te(e.message as never) : te("generic"));
    }
    setDone(data as unknown as Appointment);
  }

  if (done) {
    const tz = ctx.branch.timeZone;
    return (
      <div className="flex flex-col gap-5 py-2">
        <CalloutCard icon={<CalendarCheck2 />} tone="green" role="status">
          <strong className="font-semibold">{reschedule ? t("rescheduled") : t("booked")}.</strong>{" "}
          {t("bookedBody", {
            date: longDay(localDate(done.starts_at, tz), locale),
            time: timeOf(done.starts_at, locale, tz),
            practitioner: done.practitioner.name,
          })}
        </CalloutCard>
        <p className="px-4 text-subheadline text-label-secondary">{done.phone_e164 ? t("reminders") : t("noPhone")}</p>
        <Button block onClick={() => onDone(done)}>
          {tr("done")}
        </Button>
      </div>
    );
  }

  if (!bookable.length) {
    return (
      <CalloutCard icon={<CalendarX2 />} tone="orange">
        {t("noSchedule")}
      </CalloutCard>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <ListSection header={t("practitioner")} radioGroupLabel={t("practitioner")}>
        {bookable.map((p) => (
          <ListRow key={p.id} role="radio" selected={practitionerId === p.id} onClick={() => {
              setPractitionerId(p.id);
              setSlot(null);
            }} title={p.name} accessory="check" />
        ))}
      </ListSection>

      <div className="flex flex-col gap-2">
        <h3 id="booking-day" className="px-4 text-footnote uppercase text-label-secondary">
          {t("date")} · {longDay(date, locale)}
        </h3>
        <div role="radiogroup" aria-labelledby="booking-day" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {days.map((d) => {
            const s = shortDay(d, locale);
            return (
              <Chip key={d} selected={d === date} onSelect={() => {
                  setDate(d);
                  setSlot(null);
                }} label={longDay(d, locale)}>
                <span className="text-caption uppercase opacity-80">{s.weekday}</span>
                <span className="text-headline">{s.day}</span>
              </Chip>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h3 id="booking-slots" className="px-4 text-footnote uppercase text-label-secondary">
          {t("slots")}
        </h3>
        {slots === null ? (
          <div role="status" className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            <span className="sr-only">{t("slotsLoading")}</span>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-11 rounded-[var(--radius-sm)]" />
            ))}
          </div>
        ) : slots.length ? (
          <div role="radiogroup" aria-labelledby="booking-slots" className="grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-5">
            {slots.map((s) => (
              <Chip key={s.starts_at} selected={slot === s.starts_at} onSelect={() => setSlot(s.starts_at)}>
                {timeOf(s.starts_at, locale, ctx.branch.timeZone)}
              </Chip>
            ))}
          </div>
        ) : (
          <p className="px-4 text-subheadline text-label-secondary">{t("noSlots")}</p>
        )}
      </div>

      {reschedule ? null : (
        <>
          <TextField
            label={t("label")}
            hint={t("labelHint")}
            placeholder={t("labelPlaceholder")}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={40}
            autoComplete="off"
          />
          <div className="flex flex-col gap-3">
            <TextField
              label={tr("phone")}
              hint={tr("phoneHint")}
              type="tel"
              inputMode="tel"
              autoComplete="off"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            {phone.trim() ? (
              <>
                <ListSection footer={tr("consentHint")}>
                  <ListSwitchRow title={tr("consent")} checked={consent} onCheckedChange={setConsent} />
                </ListSection>
                <SegmentedControl
                  label={tr("messagesLanguage")}
                  value={messagesLocale}
                  onValueChange={setMessagesLocale}
                  options={[
                    { value: "fr", label: "Français" },
                    { value: "en", label: "English" },
                  ]}
                />
              </>
            ) : null}
          </div>
        </>
      )}

      <div className="flex flex-col gap-2">
        {error ? (
          <p role="alert" className="text-center text-subheadline text-red-text">
            {error}
          </p>
        ) : null}
        <Button block onClick={submit} loading={pending} disabled={!slot}>
          {reschedule ? t("reschedule") : t("book")}
        </Button>
      </div>
    </div>
  );
}
