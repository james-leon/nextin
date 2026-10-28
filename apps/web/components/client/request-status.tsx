"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { CalendarCheck2, CalendarClock, CalendarX2, Clock, MessageCircle, Navigation } from "lucide-react";
import { directionsUrl } from "@nextin/shared/remote";
import { BottomBar } from "@/components/ui/bottom-bar";
import { Button } from "@/components/ui/button";
import { CalloutCard } from "@/components/ui/callout-card";
import { ListRow, ListSection } from "@/components/ui/list";
import { NavigationBar } from "@/components/ui/navigation-bar";
import { TextField } from "@/components/ui/text-field";
import { resendRequestCode } from "@/lib/client/appointment-request";
import { callRpc } from "@/lib/client/supabase-public";
import type { RequestView } from "@/lib/client/types";
import { useLiteLocale, useLiteT } from "@/lib/i18n/lite";
import { cn } from "@/lib/cn";

const AlertDialog = dynamic(() => import("@/components/ui/alert-dialog").then((m) => m.AlertDialog), { ssr: false });

type VerifyResult = RequestView | { error: "code_invalid"; attempts_left: number };

/**
 * Suivi d'une demande de rendez-vous (M9) : saisie du code reçu sur WhatsApp, puis attente de la réponse de
 * l'accueil (actualisée toutes les 20 s), rendez-vous confirmé ou proposé, refus avec motif.
 */
export function RequestStatusView({ token, initial, captchaSiteKey }: { token: string; initial: RequestView; captchaSiteKey: string | null }) {
  const t = useLiteT("client.requestStatus");
  const tr = useLiteT("client.request");
  const te = useLiteT("errors");
  const locale = useLiteLocale();
  const captchaRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState(initial);
  const [code, setCode] = useState("");
  const [pending, setPending] = useState<"verify" | "resend" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  // En attente de l'accueil : la réponse arrive sur WhatsApp, la page se met à jour aussi.
  useEffect(() => {
    if (view.status !== "pending") return;
    const timer = setInterval(() => {
      void callRpc<RequestView | null>("get_appointment_request", { p_token: token }).then(({ data }) => data && setView(data));
    }, 20_000);
    return () => clearInterval(timer);
  }, [view.status, token]);

  const tz = view.branch.timezone;
  const fmt = (o: Intl.DateTimeFormatOptions, iso: string) => new Intl.DateTimeFormat(locale, { timeZone: tz, ...o }).format(new Date(iso));
  const dateLong = (iso: string) => fmt({ weekday: "long", day: "numeric", month: "long" }, iso);
  const hour = (iso: string) => fmt({ hour: "2-digit", minute: "2-digit" }, iso);
  const place = `${view.organization.name} – ${view.branch.name}`;
  const serviceName = locale === "en" && view.service.name_en ? view.service.name_en : view.service.name;
  const requested = view.preferred_starts_at
    ? `${dateLong(view.preferred_starts_at)} · ${hour(view.preferred_starts_at)}`
    : view.preferred_day
      ? `${fmt({ weekday: "long", day: "numeric", month: "long" }, `${view.preferred_day}T12:00:00Z`)} · ${tr(`periods.${view.preferred_period ?? "any"}`)}`
      : "";

  async function verify() {
    setPending("verify");
    setError(null);
    setNotice(null);
    const { data, error: rpcError } = await callRpc<VerifyResult>("verify_appointment_request", { p_token: token, p_code: code.replace(/\s/g, "") });
    setPending(null);
    if (data && "error" in data) {
      setError(t("codeInvalid", { count: data.attempts_left }));
      return;
    }
    if (data) {
      setView(data);
      return;
    }
    const message = rpcError?.message ?? "generic";
    setError(te.has(message) ? te(message) : te("generic"));
  }

  async function resend() {
    setPending("resend");
    setError(null);
    const r = await resendRequestCode(token, { siteKey: captchaSiteKey, container: captchaRef.current });
    setPending(null);
    if (r.ok) {
      setCode("");
      setNotice(t("resent"));
    } else {
      setError(te.has(r.error ?? "") ? te(r.error!) : te("generic"));
    }
  }

  async function cancel() {
    const { data } = await callRpc<RequestView>("cancel_my_appointment_request", { p_token: token });
    if (data) setView(data);
  }

  const hasLocation = view.branch.latitude != null && view.branch.longitude != null;
  const appointment = view.appointment;
  const hero = (() => {
    switch (view.status) {
      case "unverified":
        return null;
      case "pending":
        return { icon: <Clock />, tone: "accent", title: t("pendingTitle"), body: t("pendingBody", { place }) };
      case "accepted":
        return { icon: <CalendarCheck2 />, tone: "green", title: t("acceptedTitle"), body: null };
      case "modified":
        return { icon: <CalendarClock />, tone: "orange", title: t("modifiedTitle"), body: t("modifiedBody") };
      case "declined":
        return {
          icon: <CalendarX2 />,
          tone: "neutral",
          title: t("declinedTitle"),
          body: view.decline_reason ? t("declinedReason", { reason: view.decline_reason }) : null,
        };
      case "expired":
        return { icon: <CalendarX2 />, tone: "neutral", title: t("expiredTitle"), body: t("expiredBody") };
      default:
        return { icon: <CalendarX2 />, tone: "neutral", title: t("cancelledTitle"), body: null };
    }
  })();

  const details = (
    <ListSection>
      <ListRow title={t("service")} detail={serviceName} />
      {requested ? <ListRow title={t("requested")} detail={<span className="first-letter:uppercase">{requested}</span>} /> : null}
      {view.practitioner ? <ListRow title={tr("practitionerHeader")} detail={view.practitioner} /> : null}
      {view.phone_masked ? <ListRow title={t("phoneLabel")} detail={<span className="tabular">{view.phone_masked}</span>} /> : null}
    </ListSection>
  );

  return (
    <main className="min-h-dvh pb-40 lg:pb-16">
      <NavigationBar
        variant="inline"
        title={t("title")}
        back={{ href: `/b/${view.branch.id}`, label: t("back") }}
        contentClassName="max-w-lg lg:max-w-5xl lg:px-8"
      />
      <div className="mx-auto flex max-w-lg flex-col gap-5 px-4 pt-3 lg:grid lg:max-w-5xl lg:grid-cols-[1fr_22rem] lg:items-start lg:gap-8 lg:px-8">
        <div className="flex flex-col gap-5">
          {view.status === "unverified" ? (
            <section className="squircle flex flex-col gap-4 rounded-[var(--radius-xl)] bg-grouped-secondary p-5 shadow-card" aria-labelledby="verify-title">
              <span aria-hidden className="flex size-12 items-center justify-center rounded-full bg-green-tint text-green-text [&_svg]:size-6">
                <MessageCircle />
              </span>
              <div>
                <h1 id="verify-title" className="text-title2 font-bold">
                  {t("verifyTitle")}
                </h1>
                <p className="mt-1 text-callout text-label-secondary">{t("verifyBody", { phone: view.phone_masked ?? "" })}</p>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void verify();
                }}
                className="flex flex-col gap-3"
              >
                <TextField
                  label={t("code")}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9 ]*"
                  maxLength={7}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  error={error ?? undefined}
                  className="[&_input]:text-title2 [&_input]:tracking-[0.3em] [&_input]:tabular"
                />
                {notice ? (
                  <p role="status" className="px-4 text-footnote text-green-text">
                    {notice}
                  </p>
                ) : null}
                <Button type="submit" block loading={pending === "verify"} loadingLabel={t("verifying")} disabled={code.replace(/\s/g, "").length !== 6}>
                  {t("verify")}
                </Button>
                <Button variant="plain" block onClick={resend} loading={pending === "resend"} disabled={pending !== null}>
                  {t("resend")}
                </Button>
              </form>
              <div ref={captchaRef} className="flex justify-center empty:hidden" />
            </section>
          ) : hero ? (
            <section
              aria-live="polite"
              className="squircle flex flex-col items-center gap-2 rounded-[var(--radius-xl)] bg-grouped-secondary px-5 py-7 text-center shadow-card"
            >
              <span
                aria-hidden
                className={cn(
                  "flex size-14 items-center justify-center rounded-full [&_svg]:size-7 [&_svg]:stroke-[1.75]",
                  hero.tone === "green" && "bg-green-tint text-green-text",
                  hero.tone === "orange" && "bg-orange-tint text-orange-text",
                  hero.tone === "accent" && "bg-accent-tint text-accent-on-tint",
                  hero.tone === "neutral" && "bg-fill-tertiary text-label-secondary",
                )}
              >
                {hero.icon}
              </span>
              <h1 className="text-title2 font-bold">{hero.title}</h1>
              {appointment && (view.status === "accepted" || view.status === "modified") ? (
                <>
                  <p className="text-title1 font-bold text-ticket-number capitalize">{dateLong(appointment.starts_at)}</p>
                  <p className="text-hero leading-none font-extrabold text-ticket-number tabular">{hour(appointment.starts_at)}</p>
                  <p className="text-callout text-label-secondary">
                    {t("with", { name: appointment.practitioner })} · {place}
                  </p>
                </>
              ) : null}
              {hero.body ? <p className="text-body text-label-secondary">{hero.body}</p> : null}
            </section>
          ) : null}

          {appointment && (view.status === "accepted" || view.status === "modified") ? (
            <CalloutCard icon={<CalendarCheck2 />} tone="green">
              {t("arrival")}
            </CalloutCard>
          ) : null}
          {hasLocation && view.status !== "unverified" ? (
            <Button asChild block variant="tinted">
              <a href={directionsUrl(view.branch.latitude!, view.branch.longitude!)} target="_blank" rel="noopener">
                <Navigation aria-hidden className="size-5" />
                {t("directions")}
              </a>
            </Button>
          ) : null}
        </div>

        <div className="flex flex-col gap-5">{details}</div>
      </div>

      {view.status === "pending" || view.status === "unverified" ? (
        view.status === "pending" ? (
          <BottomBar>
            <Button block variant="destructive-plain" onClick={() => setConfirmCancel(true)}>
              {t("cancel")}
            </Button>
          </BottomBar>
        ) : null
      ) : view.status === "declined" || view.status === "expired" || view.status === "cancelled" ? (
        <BottomBar>
          <Button asChild block>
            <Link href={`/b/${view.branch.id}/rdv`}>{t("newRequest")}</Link>
          </Button>
        </BottomBar>
      ) : null}
      {confirmCancel ? (
        <AlertDialog
          open
          onOpenChange={setConfirmCancel}
          title={t("cancelTitle")}
          description={t("cancelBody")}
          cancelLabel={t("cancelKeep")}
          actionLabel={t("cancel")}
          destructive
          onAction={cancel}
        />
      ) : null}
    </main>
  );
}
