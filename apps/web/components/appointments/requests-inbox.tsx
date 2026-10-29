"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CalendarCheck2, CalendarClock, Inbox, Phone } from "lucide-react";
import { formatCameroonPhone } from "@nextin/shared";
import { addDays, localDate } from "@nextin/shared/appointments";
import { staffTopic } from "@nextin/shared/queue/realtime";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { CalloutCard } from "@/components/ui/callout-card";
import { ListRow, ListSection } from "@/components/ui/list";
import { Sheet } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { TextField } from "@/components/ui/text-field";
import { useToast } from "@/components/ui/toast";
import { listRequests, type AppointmentRequest, type AppointmentsContext, type Slot } from "@/lib/desk/appointments";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/cn";
import { longDay, shortDay, timeOf } from "./format";
import { useMediaQuery } from "@/components/ui/use-media-query";

type PractitionerSlot = Slot & { practitioner_id: string };

/** Le créneau tombe-t-il dans le moment demandé (matin avant 12 h, après-midi ensuite) ? */
function inPeriod(iso: string, period: AppointmentRequest["preferred_period"], tz: string): boolean {
  if (!period || period === "any") return true;
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: tz }).format(new Date(iso)));
  return period === "morning" ? hour < 12 : hour >= 12;
}

/**
 * Demandes de rendez-vous des patients (M9, accueil) : confirmer en un clic le créneau demandé (ou le premier
 * créneau libre du moment demandé), proposer un autre créneau, ou refuser avec un motif. La réponse part sur
 * WhatsApp. Ordinateur : liste et détail côte à côte ; téléphone : liste et feuille.
 */
export function RequestsInbox({ ctx, onBooked }: { ctx: AppointmentsContext; onBooked: (date: string) => void }) {
  const t = useTranslations("appointments.requests");
  const tc = useTranslations("common");
  const supabase = getSupabaseBrowserClient();
  const desktop = useMediaQuery("(min-width: 1024px)");
  const [items, setItems] = useState<AppointmentRequest[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const next = await listRequests(supabase, ctx.branch.id).catch(() => null);
    if (next) setItems(next);
  }, [supabase, ctx.branch.id]);

  useEffect(() => {
    let alive = true;
    listRequests(supabase, ctx.branch.id).then(
      (next) => alive && setItems(next),
      () => undefined,
    );
    let timer: ReturnType<typeof setTimeout> | null = null;
    const channel = supabase
      .channel(staffTopic(ctx.branch.id), { config: { private: true } })
      .on("broadcast", { event: "requests" }, () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => void load(), 300);
      })
      .subscribe();
    const poll = setInterval(() => void load(), 30_000);
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      clearInterval(poll);
      void supabase.removeChannel(channel);
    };
  }, [supabase, ctx.branch.id, load]);

  const selected = items?.find((r) => r.id === selectedId) ?? null;
  const handled = (date: string | null, message: string) => {
    setSelectedId(null);
    setItems((list) => list?.filter((r) => r.id !== selectedId) ?? null);
    void load();
    if (date) onBooked(date);
    return message;
  };

  const detail = selected ? <RequestDetail key={selected.id} request={selected} ctx={ctx} onHandled={handled} /> : null;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start xl:grid-cols-[minmax(0,30rem)_minmax(0,1fr)]">
      <section aria-label={t("title")}>
        {items === null ? (
          <div role="status" className="flex flex-col gap-2">
            <span className="sr-only">{tc("loading")}</span>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-16 rounded-[var(--radius-md)]" />
            ))}
          </div>
        ) : items.length ? (
          <ListSection header={t("count", { count: items.length })} footer={t("footer")}>
            {items.map((r) => (
              <RequestRow
                key={r.id}
                request={r}
                ctx={ctx}
                selected={desktop && selectedId === r.id}
                onSelect={() => setSelectedId(r.id)}
                chevron={!desktop}
              />
            ))}
          </ListSection>
        ) : (
          <div className="squircle flex flex-col items-center gap-2 rounded-[var(--radius-lg)] bg-grouped-secondary px-6 py-10 text-center">
            <Inbox aria-hidden className="size-9 stroke-[1.5] text-label-tertiary" />
            <p className="text-body text-label-secondary">{t("empty")}</p>
          </div>
        )}
      </section>

      {desktop ? (
        <aside aria-label={t("detail")} className="squircle sticky top-24 rounded-[var(--radius-xl)] bg-grouped-secondary p-5 shadow-card">
          {detail ?? (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <Inbox aria-hidden className="size-10 stroke-[1.5] text-label-tertiary" />
              <p className="text-body text-label-secondary">{t("selectHint")}</p>
            </div>
          )}
        </aside>
      ) : selected ? (
        <Sheet open onOpenChange={(o) => !o && setSelectedId(null)} title={t("detail")} closeLabel={tc("close")}>
          <div className="pt-2">{detail}</div>
        </Sheet>
      ) : null}
    </div>
  );
}

/** « jeu. 29 oct. · 10:00 » ou « jeu. 29 oct. · le matin ». */
function useWhen(ctx: AppointmentsContext) {
  const t = useTranslations("appointments.requests");
  const locale = useLocale();
  const tz = ctx.branch.timeZone;
  return (r: Pick<AppointmentRequest, "preferred_starts_at" | "preferred_day" | "preferred_period">) => {
    if (r.preferred_starts_at) {
      const d = shortDay(localDate(r.preferred_starts_at, tz), locale);
      return `${d.weekday} ${d.day} ${d.month} · ${timeOf(r.preferred_starts_at, locale, tz)}`;
    }
    if (!r.preferred_day) return "";
    const d = shortDay(r.preferred_day, locale);
    return `${d.weekday} ${d.day} ${d.month} · ${t(`periods.${r.preferred_period ?? "any"}`)}`;
  };
}

function RequestRow({
  request: r,
  ctx,
  selected,
  onSelect,
  chevron,
}: {
  request: AppointmentRequest;
  ctx: AppointmentsContext;
  selected: boolean;
  onSelect: () => void;
  chevron: boolean;
}) {
  const t = useTranslations("appointments.requests");
  const locale = useLocale();
  const when = useWhen(ctx);
  return (
    <ListRow
      icon={
        <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-tint text-accent-on-tint [&_svg]:size-5">
          <CalendarClock />
        </span>
      }
      title={<span className="first-letter:uppercase">{when(r)}</span>}
      subtitle={`${locale === "en" && r.service.name_en ? r.service.name_en : r.service.name} · ${r.practitioner ?? t("anyPractitioner")}${
        r.customer_label ? ` · ${r.customer_label}` : ""
      }`}
      accessory={chevron ? "chevron" : undefined}
      onClick={onSelect}
      className={cn(selected && "bg-fill-tertiary")}
    />
  );
}

/** Détail d'une demande : créneau proposé en un clic, autre créneau, refus. */
function RequestDetail({
  request: r,
  ctx,
  onHandled,
}: {
  request: AppointmentRequest;
  ctx: AppointmentsContext;
  onHandled: (date: string | null, message: string) => string;
}) {
  const t = useTranslations("appointments.requests");
  const ta = useTranslations("appointments");
  const te = useTranslations("errors");
  const locale = useLocale();
  const supabase = getSupabaseBrowserClient();
  const toast = useToast();
  const when = useWhen(ctx);
  const tz = ctx.branch.timeZone;
  const bookable = ctx.practitioners.filter((p) => p.hasSchedule);
  const candidates = r.practitioner_id ? bookable.filter((p) => p.id === r.practitioner_id) : bookable;
  const firstDay = r.preferred_starts_at ? localDate(r.preferred_starts_at, tz) : (r.preferred_day ?? ctx.today);
  const [slots, setSlots] = useState<PractitionerSlot[] | null>(null);
  const [other, setOther] = useState(false);
  const [otherPractitioner, setOtherPractitioner] = useState<string>(r.practitioner_id ?? bookable[0]?.id ?? "");
  const [otherDay, setOtherDay] = useState(firstDay < ctx.today ? ctx.today : firstDay);
  const [otherSlots, setOtherSlots] = useState<{ key: string; slots: Slot[] } | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [reason, setReason] = useState("");
  const name = (id: string) => ctx.practitioners.find((p) => p.id === id)?.name ?? "";

  // Créneaux libres du jour demandé, pour le praticien demandé (ou tous ceux du service).
  useEffect(() => {
    let alive = true;
    void Promise.all(
      candidates.map((p) =>
        supabase
          .rpc("available_slots", { p_practitioner: p.id, p_from: firstDay, p_days: 1 })
          .then(({ data }) => ((data ?? []) as unknown as Slot[]).map((s) => ({ ...s, practitioner_id: p.id }))),
      ),
    ).then((lists) => alive && setSlots(lists.flat().filter((s) => s.service_id === r.service.id).sort((a, b) => a.starts_at.localeCompare(b.starts_at))));
    return () => {
      alive = false;
    };
    // Une seule lecture par demande : les créneaux sont revérifiés par la base à la confirmation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r.id]);

  const suggestion = useMemo(() => {
    if (!slots) return null;
    if (r.preferred_starts_at) return slots.find((s) => s.starts_at === r.preferred_starts_at) ?? null;
    return slots.find((s) => inPeriod(s.starts_at, r.preferred_period, tz)) ?? null;
  }, [slots, r.preferred_starts_at, r.preferred_period, tz]);

  const otherKey = `${otherPractitioner}|${otherDay}`;
  useEffect(() => {
    if (!other || !otherPractitioner) return;
    let alive = true;
    void supabase
      .rpc("available_slots", { p_practitioner: otherPractitioner, p_from: otherDay, p_days: 1 })
      .then(({ data }) => alive && setOtherSlots({ key: `${otherPractitioner}|${otherDay}`, slots: (data ?? []) as unknown as Slot[] }));
    return () => {
      alive = false;
    };
  }, [supabase, other, otherPractitioner, otherDay]);
  const shownOther = otherSlots?.key === otherKey ? otherSlots.slots : null;

  async function accept(practitionerId: string, startsAt: string) {
    setPending(startsAt);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc("accept_appointment_request", {
      p_request: r.id,
      p_practitioner: practitionerId,
      p_starts_at: startsAt,
    });
    setPending(null);
    if (rpcError || !data) {
      setError(te.has(rpcError?.message as never) ? te(rpcError!.message as never) : te("generic"));
      return;
    }
    const status = (data as { request: { status: string } }).request.status;
    toast(onHandled(localDate(startsAt, tz), status === "accepted" ? t("accepted") : t("modified")), <CalendarCheck2 aria-hidden />);
  }

  async function decline() {
    const { error: rpcError } = await supabase.rpc("decline_appointment_request", { p_request: r.id, p_reason: reason.trim() || (null as unknown as string) });
    if (rpcError) {
      setError(te.has(rpcError.message as never) ? te(rpcError.message as never) : te("generic"));
      return;
    }
    toast(onHandled(null, t("declined")));
  }

  const days = Array.from({ length: 14 }, (_, i) => addDays(ctx.today, i));

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-footnote text-label-secondary uppercase">{t("requested")}</p>
        <h2 className="text-title2 font-bold first-letter:uppercase">{when(r)}</h2>
        <p className="text-subheadline text-label-secondary">
          {locale === "en" && r.service.name_en ? r.service.name_en : r.service.name} · {r.practitioner ?? t("anyPractitioner")}
        </p>
      </div>

      <ListSection>
        {r.customer_label ? <ListRow title={t("label")} detail={r.customer_label} /> : null}
        {r.phone_e164 ? (
          <ListRow
            title={t("phone")}
            detail={<span className="tabular">{formatCameroonPhone(r.phone_e164)}</span>}
            href={`tel:${r.phone_e164}`}
            accessory={<Phone aria-hidden className="size-4 text-accent-text" />}
          />
        ) : null}
        <ListRow
          title={t("received")}
          detail={<span className="tabular">{`${longDay(localDate(r.created_at, tz), locale)} · ${timeOf(r.created_at, locale, tz)}`}</span>}
        />
      </ListSection>

      {error ? (
        <CalloutCard icon={<CalendarClock />} tone="red" role="alert">
          {error}
        </CalloutCard>
      ) : null}

      {slots === null ? (
        <Skeleton className="h-[3.125rem] rounded-[14px]" />
      ) : suggestion ? (
        <div className="flex flex-col gap-1.5">
          <Button block onClick={() => accept(suggestion.practitioner_id, suggestion.starts_at)} loading={pending === suggestion.starts_at} loadingLabel={t("confirming")}>
            {t("confirm", { time: timeOf(suggestion.starts_at, locale, tz), name: name(suggestion.practitioner_id) })}
          </Button>
          <p className="px-4 text-center text-footnote text-label-secondary">{t("confirmHint")}</p>
        </div>
      ) : (
        <CalloutCard icon={<CalendarClock />} tone="orange" role="status">
          {t("taken")}
        </CalloutCard>
      )}

      <Button block variant="tinted" onClick={() => setOther((v) => !v)} aria-expanded={other}>
        {t("other")}
      </Button>
      {other ? (
        <section aria-label={t("other")} className="flex flex-col gap-3">
          {bookable.length > 1 ? (
            <div role="radiogroup" aria-label={ta("practitioner")} className="-mx-4 flex gap-2 scroll-fade-x px-4 pb-1">
              {bookable.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={otherPractitioner === p.id}
                  onClick={() => setOtherPractitioner(p.id)}
                  className={cn(
                    "pressable min-h-11 shrink-0 rounded-full px-4 text-subheadline font-semibold",
                    otherPractitioner === p.id ? "bg-accent text-white" : "bg-fill-tertiary text-label",
                  )}
                >
                  {p.name}
                </button>
              ))}
            </div>
          ) : null}
          <div role="radiogroup" aria-label={ta("date")} className="-mx-4 flex gap-2 scroll-fade-x px-4 pb-1">
            {days.map((d) => {
              const s = shortDay(d, locale);
              return (
                <button
                  key={d}
                  type="button"
                  role="radio"
                  aria-checked={otherDay === d}
                  aria-label={longDay(d, locale)}
                  onClick={() => setOtherDay(d)}
                  className={cn(
                    "pressable squircle flex min-h-11 min-w-12 shrink-0 flex-col items-center justify-center rounded-[var(--radius-sm)] px-2 py-1 tabular",
                    otherDay === d ? "bg-accent text-white" : "bg-fill-tertiary text-label",
                  )}
                >
                  <span className="text-caption font-semibold uppercase">{s.weekday}</span>
                  <span className="text-callout font-bold">{s.day}</span>
                </button>
              );
            })}
          </div>
          {shownOther === null ? (
            <Skeleton className="h-11 rounded-[var(--radius-sm)]" />
          ) : shownOther.length ? (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
              {shownOther.map((s) => (
                <button
                  key={s.starts_at}
                  type="button"
                  onClick={() => accept(otherPractitioner, s.starts_at)}
                  disabled={pending !== null}
                  aria-label={t("offer", { time: timeOf(s.starts_at, locale, tz), day: longDay(otherDay, locale), name: name(otherPractitioner) })}
                  className="pressable squircle h-11 rounded-[var(--radius-sm)] bg-fill-tertiary text-callout font-semibold text-accent-text tabular disabled:opacity-50"
                >
                  {timeOf(s.starts_at, locale, tz)}
                </button>
              ))}
            </div>
          ) : (
            <p className="px-4 text-subheadline text-label-secondary">{ta("noSlots")}</p>
          )}
          <p className="px-4 text-footnote text-label-secondary">{t("otherHint")}</p>
        </section>
      ) : null}

      <Button block variant="destructive-plain" onClick={() => setDeclineOpen(true)}>
        {t("decline")}
      </Button>
      {declineOpen ? (
        <AlertDialog
          open
          onOpenChange={setDeclineOpen}
          title={t("declineTitle")}
          description={t("declineBody")}
          cancelLabel={t("keep")}
          actionLabel={t("decline")}
          destructive
          onAction={decline}
        >
          <TextField label={t("reason")} hint={t("reasonHint")} maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} />
        </AlertDialog>
      ) : null}
    </div>
  );
}
