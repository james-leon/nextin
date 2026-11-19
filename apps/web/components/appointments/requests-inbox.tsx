"use client";

import { EmptyState } from "@/components/ui/empty-state";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CalendarCheck2, CalendarClock, CalendarDays, ChevronDown, Inbox, Mail, Phone } from "lucide-react";
import { formatCameroonPhone } from "@nextin/shared";
import { addDays, localDate } from "@nextin/shared/appointments";
import { staffTopic } from "@nextin/shared/queue/realtime";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { CalloutCard } from "@/components/ui/callout-card";
import { ListIcon, ListRow, ListSection } from "@/components/ui/list";
import { Sheet } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { TextField } from "@/components/ui/text-field";
import { useToast } from "@/components/ui/toast";
import { listRequests, personLine, type AppointmentRequest, type AppointmentsContext, type Slot } from "@/lib/desk/appointments";
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
 * créneau libre du moment demandé), proposer un autre créneau, ou refuser avec un motif. La réponse part
 * par e-mail ou sur WhatsApp. Ordinateur : liste et détail côte à côte ; téléphone : liste et feuille.
 */
export function RequestsInbox({
  ctx,
  onBooked,
  initialId = null,
}: {
  ctx: AppointmentsContext;
  onBooked: (date: string) => void;
  /** Demande à ouvrir d'emblée (bloc orange touché dans l'agenda). */
  initialId?: string | null;
}) {
  const t = useTranslations("appointments.requests");
  const tc = useTranslations("common");
  const supabase = getSupabaseBrowserClient();
  const desktop = useMediaQuery("(min-width: 1024px)");
  const [items, setItems] = useState<AppointmentRequest[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(initialId);

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
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
      <section aria-label={t("title")}>
        {items === null ? (
          <div role="status" className="flex flex-col gap-2">
            <span className="sr-only">{tc("loading")}</span>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-16 rounded-[var(--radius-md)]" />
            ))}
          </div>
        ) : items.length ? (
          <ListSection header={<span className="font-semibold normal-case text-orange-text">{t("count", { count: items.length })}</span>} footer={t("footer")}>
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
          <EmptyState title={t("empty")} icon={<Inbox />} />
        )}
      </section>

      {desktop ? (
        <aside aria-label={t("detail")} className="@container sticky top-24">
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

/** « reçue à 12:11 » (aujourd'hui), « reçue hier », sinon « reçue le 16 nov. ». */
function useReceived(ctx: AppointmentsContext) {
  const t = useTranslations("appointments.requests");
  const locale = useLocale();
  const tz = ctx.branch.timeZone;
  return (iso: string) => {
    const day = localDate(iso, tz);
    if (day === ctx.today) return t("receivedAt", { time: timeOf(iso, locale, tz) });
    if (day === addDays(ctx.today, -1)) return t("receivedYesterday");
    const d = shortDay(day, locale);
    return t("receivedOn", { date: `${d.day} ${d.month}` });
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
  const received = useReceived(ctx);
  // Maquette v2 20 : demande à traiter = orange (attention), « Mer. 18 · 14:00 », puis service, praticien et réception.
  return (
    <ListRow
      icon={
        <ListIcon color="var(--orange-fill)">
          <CalendarDays />
        </ListIcon>
      }
      title={<span className="font-semibold first-letter:uppercase">{when(r)}</span>}
      subtitle={`${locale === "en" && r.service.name_en ? r.service.name_en : r.service.name} · ${r.practitioner ?? t("anyPractitioner")} · ${received(r.created_at)}`}
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
  const ti = useTranslations("identity");
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
  // Autre créneau : choisi d'abord (pastille), puis proposé par un bouton qui dit exactement ce qui partira.
  const other = true;
  const [picked, setPicked] = useState<string | null>(null);
  const [dayPicker, setDayPicker] = useState(false);
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
  const received = useReceived(ctx);
  const dayShort = (d: string) => {
    const x = shortDay(d, locale);
    return `${x.weekday} ${x.day}`;
  };
  const pickedSlot = shownOther?.find((s) => s.starts_at === picked) ?? null;

  // Maquette v2 20 : en-tête « Demande · reçue à 12:11 » et créneau souhaité en grand ; à gauche le patient et
  // « Confirmer » (action principale), à droite « Proposer un autre créneau » (secondaire) et « Refuser ».
  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-footnote text-label-secondary uppercase">
          {t("detail")} · {received(r.created_at)}
        </p>
        <h2 className="text-title1 font-bold first-letter:uppercase [text-wrap:balance]">{when(r)}</h2>
      </div>

      <div className="grid grid-cols-1 gap-5 @3xl:grid-cols-2 @3xl:items-start">
        <div className="flex min-w-0 flex-col gap-3">
          <ListSection>
            {personLine(r, ti) ? <ListRow title={t("label")} detail={personLine(r, ti)} /> : null}
            {r.email ? (
              <ListRow
                title={t("email")}
                detail={<span className="break-all">{r.email}</span>}
                href={`mailto:${r.email}`}
                accessory={<Mail aria-hidden className="size-4 text-accent-text" />}
              />
            ) : null}
            {r.phone_e164 ? (
              <ListRow
                title={t("phone")}
                detail={<span className="tabular">{formatCameroonPhone(r.phone_e164)}</span>}
                href={`tel:${r.phone_e164}`}
                accessory={<Phone aria-hidden className="size-4 text-accent-text" />}
              />
            ) : null}
            <ListRow title={t("service")} detail={locale === "en" && r.service.name_en ? r.service.name_en : r.service.name} />
            <ListRow title={t("wantedPractitioner")} detail={r.practitioner ?? t("anyPractitioner")} />
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
              <p className="px-4 text-footnote text-label-secondary">{t("confirmHint", { channel: r.verify_channel ?? "whatsapp" })}</p>
            </div>
          ) : (
            <CalloutCard icon={<CalendarClock />} tone="orange" role="status">
              {t("taken")}
            </CalloutCard>
          )}
        </div>

        <section aria-label={t("other")} className="flex min-w-0 flex-col gap-3">
          <h3 className="px-4 text-footnote uppercase text-label-secondary">{t("other")}</h3>
          <div className="squircle flex flex-col rounded-[var(--radius-lg)] bg-grouped-secondary">
            {bookable.length > 1 ? (
              <div role="radiogroup" aria-label={ta("practitioner")} className="flex gap-2 scroll-fade-x px-3 pt-3">
                {bookable.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    role="radio"
                    aria-checked={otherPractitioner === p.id}
                    onClick={() => {
                      setOtherPractitioner(p.id);
                      setPicked(null);
                    }}
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
            <div className="p-3">
              {shownOther === null ? (
                <Skeleton className="h-11 rounded-[var(--radius-sm)]" />
              ) : shownOther.length ? (
                <div role="radiogroup" aria-label={t("other")} className="flex flex-wrap gap-2">
                  {shownOther.map((s) => (
                    <button
                      key={s.starts_at}
                      type="button"
                      role="radio"
                      aria-checked={picked === s.starts_at}
                      onClick={() => setPicked(s.starts_at)}
                      className={cn(
                        "pressable squircle h-11 min-w-16 rounded-[var(--radius-sm)] px-3 text-callout font-semibold tabular",
                        picked === s.starts_at ? "bg-primary text-on-accent" : "bg-fill-tertiary text-label",
                      )}
                    >
                      {timeOf(s.starts_at, locale, tz)}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="px-1 text-subheadline text-label-secondary">{ta("noSlots")}</p>
              )}
            </div>
            <button
              type="button"
              aria-expanded={dayPicker}
              onClick={() => setDayPicker((v) => !v)}
              className="pressable flex min-h-11 items-center gap-3 px-4 py-2.5 text-left hairline-t"
            >
              <span className="flex-1 text-body">{t("otherDay")}</span>
              <span className="text-body text-label-secondary first-letter:uppercase">{dayShort(otherDay)}</span>
              <ChevronDown aria-hidden className={cn("size-4 stroke-[2.25] text-label-tertiary transition-transform", dayPicker && "rotate-180")} />
            </button>
            {dayPicker ? (
              <div role="radiogroup" aria-label={ta("date")} className="flex gap-2 scroll-fade-x px-3 pb-3">
                {days.map((d) => {
                  const x = shortDay(d, locale);
                  return (
                    <button
                      key={d}
                      type="button"
                      role="radio"
                      aria-checked={otherDay === d}
                      aria-label={longDay(d, locale)}
                      onClick={() => {
                        setOtherDay(d);
                        setPicked(null);
                      }}
                      className={cn(
                        "pressable squircle flex min-h-11 min-w-12 shrink-0 flex-col items-center justify-center rounded-[var(--radius-sm)] px-2 py-1 tabular",
                        otherDay === d ? "bg-accent text-white" : "bg-fill-tertiary text-label",
                      )}
                    >
                      <span className="text-caption font-semibold uppercase">{x.weekday}</span>
                      <span className="text-callout font-bold">{x.day}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
          <Button
            block
            variant="tinted"
            disabled={!pickedSlot || pending !== null}
            loading={!!pickedSlot && pending === pickedSlot.starts_at}
            onClick={() => pickedSlot && accept(otherPractitioner, pickedSlot.starts_at)}
          >
            {pickedSlot ? t("offer", { day: dayShort(otherDay), time: timeOf(pickedSlot.starts_at, locale, tz), name: name(otherPractitioner) }) : t("pickSlot")}
          </Button>
          <p className="px-4 text-footnote text-label-secondary">{t("otherHint", { channel: r.verify_channel ?? "whatsapp" })}</p>
          <Button block variant="gray" className="bg-grouped-secondary text-red-text" onClick={() => setDeclineOpen(true)}>
            {t("decline")}
          </Button>
        </section>
      </div>

      {declineOpen ? (
        <AlertDialog
          open
          onOpenChange={setDeclineOpen}
          title={t("declineTitle")}
          description={t("declineBody", { channel: r.verify_channel ?? "whatsapp" })}
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
