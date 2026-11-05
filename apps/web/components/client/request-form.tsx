"use client";

import { useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { CalendarClock, Phone, ShieldCheck } from "lucide-react";
import { BottomBar } from "@/components/ui/bottom-bar";
import { Button } from "@/components/ui/button";
import { CalloutCard } from "@/components/ui/callout-card";
import { ListRow, ListSection } from "@/components/ui/list";
import { NavigationBar } from "@/components/ui/navigation-bar";
import { ServiceTile } from "@/components/ui/service-tile";
import { parseIdentity, type IdentityRules } from "@nextin/shared/identity";
import { CustomerIdentityFields, saveIdentity, useIdentityValue } from "./customer-identity-fields";
import { TextField } from "@/components/ui/text-field";
import { sendAppointmentRequest } from "@/lib/client/appointment-request";
import type { RequestChannel, RequestOptions } from "@/lib/client/types";
import { useLiteLocale, useLiteT } from "@/lib/i18n/lite";
import { cn } from "@/lib/cn";

// Choix du canal : affiché seulement si la console en active plusieurs (chargé à la demande, budget de la page).
const SegmentedControl = dynamic(() => import("@/components/ui/segmented-control").then((m) => m.SegmentedControl), { ssr: false }) as typeof import("@/components/ui/segmented-control").SegmentedControl;

type Period = "morning" | "afternoon" | "any";
const PERIODS: Period[] = ["morning", "afternoon", "any"];

/** Jour local (AAAA-MM-JJ) d'un instant dans le fuseau de l'agence. */
const localDay = (d: Date, timeZone: string) => new Intl.DateTimeFormat("en-CA", { timeZone }).format(d);
const addDays = (day: string, n: number) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/**
 * Demande de rendez-vous (M9, §12.6) : service, praticien ou « peu importe », jour, créneau libre (ou moment de la
 * journée si le patient est flexible), adresse e-mail (téléphone facultatif, pour l'accueil) ou numéro WhatsApp / SMS
 * selon les canaux activés dans la console. Téléphone : une colonne et envoi en bas ; ordinateur : choix à gauche,
 * récapitulatif et coordonnées à droite.
 */
export function RequestForm({
  options,
  branchId,
  captchaSiteKey,
  identityRules = { mode: "off", extra: "none" },
}: {
  options: RequestOptions;
  branchId: string;
  captchaSiteKey: string | null;
  /** Nom du patient demandé par l'agence (remplace les initiales). */
  identityRules?: IdentityRules;
}) {
  const t = useLiteT("client.request");
  const te = useLiteT("errors");
  const locale = useLiteLocale();
  const router = useRouter();
  const captchaRef = useRef<HTMLDivElement>(null);
  const tz = options.timezone;
  const [serviceId, setServiceId] = useState(options.services[0]?.id ?? null);
  const [practitionerId, setPractitionerId] = useState<string>("any");
  const service = options.services.find((s) => s.id === serviceId) ?? null;
  const days = useMemo(() => {
    const today = localDay(new Date(), tz);
    return Array.from({ length: options.days + 1 }, (_, i) => addDays(today, i));
  }, [options.days, tz]);
  const matching = useMemo(
    () =>
      options.slots.filter(
        (s) => s.service_id === serviceId && (practitionerId === "any" || s.practitioner_id === practitionerId),
      ),
    [options.slots, serviceId, practitionerId],
  );
  const perDay = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const s of matching) {
      const d = localDay(new Date(s.starts_at), tz);
      const list = map.get(d) ?? [];
      if (!list.includes(s.starts_at)) list.push(s.starts_at);
      map.set(d, list);
    }
    return map;
  }, [matching, tz]);
  const [day, setDay] = useState<string>(() => days.find((d) => perDay.get(d)?.length) ?? days[0]!);
  const [slot, setSlot] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period | null>(null);
  const channels: RequestChannel[] = options.channels?.length ? options.channels : ["email"];
  const [channel, setChannel] = useState<RequestChannel>(channels[0]!);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [identity, setIdentity] = useIdentityValue(identityRules.mode !== "off");
  const [nameError, setNameError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const slots = (perDay.get(day) ?? []).slice().sort();
  const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale, { timeZone: tz, ...o });
  const dayLabel = (d: string) => fmt({ weekday: "short", day: "numeric", month: "short" }).format(new Date(`${d}T12:00:00Z`));
  const timeLabel = (iso: string) => fmt({ hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
  const serviceName = (s: RequestOptions["services"][number]) => (locale === "en" && s.name_en ? s.name_en : s.name);
  const when = slot
    ? `${fmt({ weekday: "long", day: "numeric", month: "long" }).format(new Date(slot))} · ${timeLabel(slot)}`
    : period
      ? `${dayLabel(day)} · ${t(`periods.${period}`)}`
      : null;
  const ready = !!service && !!when && (channel === "email" ? email.trim().length > 0 : phone.trim().length > 0);

  function pickService(id: string) {
    setServiceId(id);
    setPractitionerId("any");
    setSlot(null);
  }

  async function submit() {
    if (!service || !when) return;
    const parsed = parseIdentity(identityRules, identity);
    if (!parsed.ok) {
      setNameError(te(parsed.error));
      document.querySelector<HTMLInputElement>('input[name="customerName"]')?.focus();
      return;
    }
    setNameError(null);
    setPending(true);
    setError(null);
    setPhoneError(null);
    setEmailError(null);
    const outcome = await sendAppointmentRequest(
      {
        branchId,
        serviceId: service.id,
        practitionerId: practitionerId === "any" ? null : practitionerId,
        startsAt: slot,
        day: slot ? null : day,
        period: slot ? null : period,
        channel,
        email: channel === "email" ? email : undefined,
        phone: phone.trim() || undefined,
        label: parsed.identity.name ?? undefined,
        age: parsed.identity.age,
        fileNumber: parsed.identity.fileNumber ?? undefined,
        locale: locale === "en" ? "en" : "fr",
      },
      { siteKey: captchaSiteKey, container: captchaRef.current },
    );
    if (outcome.ok) {
      if (identityRules.mode !== "off") saveIdentity(identity);
      router.push(`/r/${outcome.token}`);
      return;
    }
    setPending(false);
    const message = te.has(outcome.error) ? te(outcome.error) : te("generic");
    if (outcome.error === "phone_invalid") setPhoneError(message);
    else if (outcome.error === "email_invalid") setEmailError(message);
    else setError(message);
  }

  if (!options.services.length) {
    return (
      <main className="min-h-dvh pb-40">
        <NavigationBar title={t("title")} back={{ href: `/b/${branchId}`, label: t("back") }} contentClassName="max-w-lg" />
        <div className="mx-auto max-w-lg px-4 pt-3">
          <CalloutCard icon={<CalendarClock />}>{t("emptyBody")}</CalloutCard>
        </div>
      </main>
    );
  }

  const sendButton = (
    <Button block onClick={submit} loading={pending} loadingLabel={t("sending")} disabled={!ready}>
      {t("send")}
    </Button>
  );
  const summary = error ? (
    <span role="alert" className="text-red-text">
      {error}
    </span>
  ) : (
    <span className="tabular">{service && when ? t("summary", { service: serviceName(service), when }) : t("summaryEmpty")}</span>
  );

  const branchPhone = options.branch.phone_e164 ?? null;
  const contact = (
    <section className="flex flex-col gap-3" aria-labelledby="request-contact">
      <h2 id="request-contact" className="sr-only">
        {t("contactHeader")}
      </h2>
      {channels.length > 1 ? (
        <div className="flex flex-col gap-1.5">
          <p className="px-4 text-footnote text-label-secondary uppercase" aria-hidden>
            {t("channelHeader")}
          </p>
          <SegmentedControl
            label={t("channelHeader")}
            options={channels.map((c) => ({ value: c, label: t(`channels.${c}`) }))}
            value={channel}
            onValueChange={(c) => {
              setChannel(c);
              setPhoneError(null);
              setEmailError(null);
            }}
          />
        </div>
      ) : null}
      {channel === "email" ? (
        <>
          <TextField
            label={t("email")}
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder={t("emailPlaceholder")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={emailError ?? undefined}
            hint={t("emailFooter")}
          />
          {branchPhone ? (
            <Button asChild variant="plain" className="self-start">
              <a href={`tel:${branchPhone}`}>
                <Phone aria-hidden className="size-5" />
                {t("callBranch")}
              </a>
            </Button>
          ) : null}
          <TextField
            label={t("phoneOptional")}
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder={t("phonePlaceholder")}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            error={phoneError ?? undefined}
            hint={t("phoneOptionalHint")}
          />
        </>
      ) : (
        <TextField
          label={channel === "sms" ? t("phoneSms") : t("phone")}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder={t("phonePlaceholder")}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          error={phoneError ?? undefined}
          hint={channel === "sms" ? t("smsFooter") : t("contactFooter")}
        />
      )}
      <CustomerIdentityFields
        rules={identityRules}
        value={identity}
        onChange={(v) => {
          setIdentity(v);
          if (nameError) setNameError(null);
        }}
        nameError={nameError ?? undefined}
      />
      <CalloutCard icon={<ShieldCheck />} tone="green">
        {channel === "email" ? t("privacyEmail") : t("privacy")}
      </CalloutCard>
    </section>
  );

  return (
    <main className="min-h-dvh pb-48 lg:pb-16">
      <NavigationBar
        title={t("title")}
        eyebrow={options.branch.organization.name}
        back={{ href: `/b/${branchId}`, label: t("back") }}
        contentClassName="max-w-lg lg:max-w-6xl lg:px-8"
      >
        <p className="mt-1 text-subheadline text-label-secondary">{options.branch.name}</p>
      </NavigationBar>

      <div className="mx-auto flex max-w-lg flex-col gap-6 px-4 pt-3 lg:grid lg:max-w-6xl lg:grid-cols-[1fr_24rem] lg:items-start lg:gap-8 lg:px-8">
        <div className="flex min-w-0 flex-col gap-6">
          <ListSection header={t("serviceHeader")} radioGroupLabel={t("serviceHeader")}>
            {options.services.map((s) => (
              <ListRow
                key={s.id}
                role="radio"
                selected={serviceId === s.id}
                onClick={() => pickService(s.id)}
                icon={<ServiceTile letter={s.prefix} color={s.color} />}
                title={serviceName(s)}
                accessory="check"
              />
            ))}
          </ListSection>

          {service ? (
            <ListSection header={t("practitionerHeader")} radioGroupLabel={t("practitionerHeader")}>
              <ListRow
                role="radio"
                selected={practitionerId === "any"}
                onClick={() => {
                  setPractitionerId("any");
                  setSlot(null);
                }}
                title={t("anyPractitioner")}
                subtitle={t("anyPractitionerHint")}
                accessory="check"
              />
              {service.practitioners.map((p) => (
                <ListRow
                  key={p.id}
                  role="radio"
                  selected={practitionerId === p.id}
                  onClick={() => {
                    setPractitionerId(p.id);
                    setSlot(null);
                  }}
                  title={p.name}
                  accessory="check"
                />
              ))}
            </ListSection>
          ) : null}

          <section aria-labelledby="request-day" className="flex flex-col gap-1.5">
            <h2 id="request-day" className="px-4 text-footnote text-label-secondary uppercase">
              {t("dayHeader")}
            </h2>
            <div role="radiogroup" aria-labelledby="request-day" className="-mx-4 flex gap-2 scroll-fade-x px-4 pb-1 lg:mx-0 lg:flex-wrap lg:px-0">
              {days.map((d) => {
                const count = perDay.get(d)?.length ?? 0;
                const active = d === day;
                return (
                  <button
                    key={d}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => {
                      setDay(d);
                      setSlot(null);
                    }}
                    className={cn(
                      "pressable squircle flex min-h-14 min-w-[4.75rem] shrink-0 flex-col items-center justify-center rounded-[var(--radius-md)] px-2 py-1.5",
                      active ? "bg-accent text-on-accent" : "bg-grouped-secondary text-label",
                    )}
                  >
                    <span className="text-subheadline font-semibold first-letter:uppercase">{dayLabel(d)}</span>
                    <span className={cn("text-caption tabular", active ? "text-on-accent" : "text-label-secondary")}>
                      {count ? t("daySlots", { count }) : t("dayFull")}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section aria-labelledby="request-slot" className="flex flex-col gap-1.5">
            <h2 id="request-slot" className="px-4 text-footnote text-label-secondary uppercase">
              {t("slotHeader")}
            </h2>
            {slots.length ? (
              <div role="radiogroup" aria-labelledby="request-slot" className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                {slots.map((s) => (
                  <button
                    key={s}
                    type="button"
                    role="radio"
                    aria-checked={slot === s}
                    onClick={() => {
                      setSlot(s);
                      setPeriod(null);
                    }}
                    className={cn(
                      "pressable squircle h-11 rounded-[var(--radius-sm)] text-callout font-semibold tabular",
                      slot === s ? "bg-accent text-on-accent" : "bg-grouped-secondary text-accent-text",
                    )}
                  >
                    {timeLabel(s)}
                  </button>
                ))}
              </div>
            ) : (
              <p className="px-4 text-subheadline text-label-secondary">{t("noSlots")}</p>
            )}
            <p className="px-4 text-footnote text-label-secondary">{t("slotFooter")}</p>
          </section>

          <ListSection header={t("flexible")} footer={t("flexibleHint")} radioGroupLabel={t("flexible")}>
            {PERIODS.map((p) => (
              <ListRow
                key={p}
                role="radio"
                selected={!slot && period === p}
                onClick={() => {
                  setPeriod(p);
                  setSlot(null);
                }}
                title={t(`periods.${p}`)}
                accessory="check"
              />
            ))}
          </ListSection>

          <div ref={captchaRef} className="flex justify-center empty:hidden" />
        </div>

        {/* Coordonnées : sous les choix sur téléphone, à droite avec le récapitulatif sur ordinateur. */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-6">
          <div className="squircle hidden flex-col gap-1 rounded-[var(--radius-lg)] bg-grouped-secondary p-5 shadow-card lg:flex">
            <p className="text-footnote text-label-secondary uppercase">{t("title")}</p>
            <p className="text-headline">{service ? serviceName(service) : ""}</p>
            <p className="text-subheadline text-label-secondary">{when ?? t("summaryEmpty")}</p>
          </div>
          {contact}
          <div className="hidden flex-col gap-3 lg:flex">
            {error ? (
              <p role="alert" className="px-4 text-subheadline text-red-text">
                {error}
              </p>
            ) : null}
            {sendButton}
          </div>
        </aside>
      </div>

      <BottomBar className="lg:hidden" summary={summary}>
        {sendButton}
      </BottomBar>
    </main>
  );
}
