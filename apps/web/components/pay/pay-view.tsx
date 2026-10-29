"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Link2Off, ShieldCheck, Smartphone } from "lucide-react";
import { guessChannel, type PaymentChannel } from "@nextin/shared/billing/pricing";
import { formatXaf } from "@nextin/shared/money";
import { normalizeCameroonPhone } from "@nextin/shared/phone";
import { Button } from "@/components/ui/button";
import { BottomBar } from "@/components/ui/bottom-bar";
import { CalloutCard } from "@/components/ui/callout-card";
import { ListRow, ListSection } from "@/components/ui/list";
import { Logo } from "@/components/ui/logo";
import { Spinner } from "@/components/ui/spinner";
import { TextField } from "@/components/ui/text-field";
import { requestTurnstileToken } from "@/lib/client/turnstile";
import { useLiteLocale, useLiteT } from "@/lib/i18n/lite";
import type { PayInvoiceView } from "@/lib/payments/types";

const POLL_MS = 3000;
const CHANNELS: PaymentChannel[] = ["mtn_momo", "orange_money"];

function day(iso: string, locale: string) {
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Douala" }).format(
    new Date(iso),
  );
}

/** Paiement d'une facture : formulaire, attente de la validation sur le téléphone, puis résultat. */
export function PayView({ token, initial, captchaSiteKey, demo }: { token: string; initial: PayInvoiceView | null; captchaSiteKey: string | null; demo: boolean }) {
  const t = useLiteT("pay");
  const tc = useLiteT("channels");
  const te = useLiteT("errors");
  const locale = useLiteLocale();
  const [view, setView] = useState(initial);
  const [channel, setChannel] = useState<PaymentChannel>("mtn_momo");
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [waiting, setWaiting] = useState(initial?.payment?.status === "pending");
  // Facture réglée pendant cette visite (message de réussite) ou déjà réglée à l'ouverture du lien.
  const [openedUnpaid] = useState(initial?.status !== "paid");
  const captchaRef = useRef<HTMLDivElement>(null);
  const xaf = (n: number) => formatXaf(n, locale === "en" ? "en" : "fr");

  // Validation sur le téléphone : la page interroge l'état (le serveur revérifie auprès du fournisseur).
  useEffect(() => {
    if (!waiting) return;
    let stop = false;
    const tick = async () => {
      const res = await fetch("/api/payments/status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) }).catch(
        () => null,
      );
      const body = (await res?.json().catch(() => null)) as { ok: boolean; view?: PayInvoiceView } | null;
      if (stop) return;
      if (body?.view) {
        setView(body.view);
        if (body.view.payment?.status !== "pending") setWaiting(false);
      }
    };
    const id = setInterval(tick, POLL_MS);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [waiting, token]);

  if (!view) return <Message icon={<Link2Off />} title={t("notFoundTitle")} body={t("notFoundBody")} tone="red" />;
  if (view.status === "paid") {
    return openedUnpaid ? (
      <Message
        icon={<CheckCircle2 />}
        title={t("successTitle")}
        body={view.campaign ? t("successCampaign", { campaign: view.campaign.name }) : t("successBody", { organization: view.organization })}
        tone="green"
        action={{ href: view.campaign ? "/ads" : "/app", label: t("open") }}
      />
    ) : (
      <Message icon={<CheckCircle2 />} title={t("paidTitle")} body={t("paidBody", { date: day(view.paid_at ?? view.period_start, locale) })} tone="green" />
    );
  }
  if (view.status === "void" || view.expired) return <Message icon={<Link2Off />} title={t("expiredTitle")} body={t("expiredBody")} tone="orange" />;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const msisdn = normalizeCameroonPhone(phone);
    if (!msisdn) {
      setPhoneError(te("phone_invalid"));
      return;
    }
    setPhoneError(null);
    setSending(true);
    try {
      const captchaToken = captchaSiteKey && captchaRef.current ? await requestTurnstileToken(captchaSiteKey, "pay_invoice", captchaRef.current) : undefined;
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, channel, msisdn, captchaToken }),
      });
      const body = (await res.json().catch(() => null)) as { ok: boolean; error?: string; redirectUrl?: string | null } | null;
      if (!body?.ok) {
        setError(te.has(body?.error ?? "") ? te(body!.error!) : te("generic"));
        return;
      }
      if (body.redirectUrl) {
        window.location.assign(body.redirectUrl);
        return;
      }
      setView((v) => (v ? { ...v, payment: { status: "pending", channel, external_id: "", failure_reason: null } } : v));
      setWaiting(true);
    } catch {
      setError(te("network"));
    } finally {
      setSending(false);
    }
  }

  // Campagne publicitaire (M10b) : formule de la campagne ; sinon formule d'abonnement.
  const planName = view.campaign
    ? locale === "en"
      ? view.campaign.package_en
      : view.campaign.package
    : view.plan
      ? locale === "en"
        ? (view.plan.name_en ?? view.plan.name)
        : view.plan.name
      : "";
  const failed = !waiting && (view.payment?.status === "failed" || view.payment?.status === "expired");

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-44">
      <div className="flex h-11 items-center">
        <Logo />
      </div>
      <header className="flex flex-col items-center gap-1 pt-8 pb-6 text-center">
        <p className="text-subheadline text-label-secondary">{t("invoice", { number: view.number })}</p>
        <p className="tabular text-large-title font-bold text-ticket-number">{xaf(view.total_xaf)}</p>
        <p className="text-body">
          {view.campaign ? t("forCampaign", { campaign: view.campaign.name, organization: view.organization }) : t("for", { organization: view.organization })}
        </p>
        <p className="text-subheadline text-label-secondary">
          {planName} · {t("period", { from: day(view.period_start, locale), to: day(view.period_end, locale) })}
        </p>
      </header>

      {waiting ? (
        <section aria-live="polite" className="squircle flex flex-col items-center gap-3 rounded-[var(--radius-xl)] bg-grouped-secondary px-6 py-8 text-center shadow-card">
          <span className="squircle flex size-14 items-center justify-center rounded-[16px] bg-accent-tint text-accent-on-tint">
            <Smartphone aria-hidden className="size-7 stroke-[1.75]" />
          </span>
          <h1 className="text-title3 font-bold">{t("waitingTitle")}</h1>
          <p className="text-body text-label-secondary">
            {t("waitingBody", { amount: xaf(view.total_xaf), phone: phone || "•••", channel: tc(view.payment?.channel ?? channel) })}
          </p>
          <Spinner label={t("waitingHint")} />
          <p className="text-footnote text-label-secondary">{t("waitingHint")}</p>
        </section>
      ) : (
        <form id="pay-form" onSubmit={submit} noValidate className="flex flex-col gap-6">
          {failed ? (
            <CalloutCard icon={<AlertTriangle />} tone="orange" role="alert">
              <strong className="font-semibold">{t("failedTitle")}.</strong> {t("failedBody")}
            </CalloutCard>
          ) : null}
          {error ? (
            <CalloutCard icon={<AlertTriangle />} tone="red" role="alert">
              {error}
            </CalloutCard>
          ) : null}
          <ListSection header={t("details")}>
            {view.lines
              .filter((l) => l.amount_xaf !== 0)
              .map((l, i) => (
                <ListRow key={i} title={locale === "en" ? l.label_en : l.label} detail={<span className="tabular">{xaf(l.amount_xaf)}</span>} />
              ))}
            <ListRow title={<span className="font-semibold">{t("total")}</span>} detail={<span className="tabular font-semibold text-label">{xaf(view.total_xaf)}</span>} />
          </ListSection>
          <ListSection header={t("channel")} radioGroupLabel={t("channel")}>
            {CHANNELS.map((c) => (
              <ListRow key={c} role="radio" selected={channel === c} onClick={() => setChannel(c)} title={tc(c)} accessory="check" />
            ))}
          </ListSection>
          <TextField
            label={t("phone")}
            hint={t("phoneHint")}
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="6 77 12 34 56"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              const guess = normalizeCameroonPhone(e.target.value);
              const op = guess ? guessChannel(guess) : null;
              if (op) setChannel(op);
            }}
            error={phoneError ?? undefined}
            required
          />
          <div ref={captchaRef} className="flex justify-center empty:hidden" />
          <p className="flex items-start gap-2 px-4 text-footnote text-label-secondary">
            <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span>{t("secure")}</span>
          </p>
          {demo ? <p className="px-4 text-footnote text-label-secondary">{t("fake")}</p> : null}
        </form>
      )}

      {!waiting ? (
        <BottomBar>
          <Button type="submit" form="pay-form" block loading={sending} loadingLabel={t("submitting")}>
            {failed ? t("retry") : t("submit", { amount: xaf(view.total_xaf) })}
          </Button>
        </BottomBar>
      ) : null}
    </main>
  );
}

function Message({
  icon,
  title,
  body,
  tone,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  tone: "green" | "orange" | "red";
  action?: { href: string; label: string };
}) {
  const colors = { green: "bg-green-tint text-green-text", orange: "bg-orange-tint text-orange-text", red: "bg-red-tint text-red-on-tint" };
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-12">
      <div className="flex h-11 items-center">
        <Logo />
      </div>
      <section className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <span className={`squircle flex size-16 items-center justify-center rounded-[18px] [&_svg]:size-8 [&_svg]:stroke-[1.75] ${colors[tone]}`} aria-hidden>
          {icon}
        </span>
        <h1 className="text-title1 font-bold">{title}</h1>
        <p className="text-body text-label-secondary">{body}</p>
        {action ? (
          <Button asChild variant="tinted" className="mt-2">
            <a href={action.href}>{action.label}</a>
          </Button>
        ) : null}
      </section>
    </main>
  );
}
