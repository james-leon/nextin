"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, Link2Off, X } from "lucide-react";
import { guessChannel, type PaymentChannel } from "@nextin/shared/billing/pricing";
import { formatXaf } from "@nextin/shared/money";
import { normalizeCameroonPhone } from "@nextin/shared/phone";
import { Button } from "@/components/ui/button";
import { BottomBar } from "@/components/ui/bottom-bar";
import { CalloutCard } from "@/components/ui/callout-card";
import { ListRow, ListSection } from "@/components/ui/list";
import { LogoImage } from "@/components/ui/logo-image";
import { Spinner } from "@/components/ui/spinner";
import { FormGroup, TextField } from "@/components/ui/text-field";
import { cn } from "@/lib/cn";
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
  // Échec : écran rouge (« Aucun montant n'a été débité »), puis « Réessayer » ramène au formulaire.
  const [retrying, setRetrying] = useState(false);
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

  if (!view) return <Message icon={<Link2Off />} title={t("notFoundTitle")} body={t("notFoundBody")} tone="gray" />;
  if (view.status === "paid") {
    return openedUnpaid ? (
      <Message
        icon={<Check />}
        title={t("successTitle")}
        body={view.campaign ? t("successCampaign", { campaign: view.campaign.name }) : t("successBody", { organization: view.organization })}
        tone="green"
        action={{ href: view.campaign ? "/ads" : "/app", label: t("open") }}
      />
    ) : (
      <Message icon={<Check />} title={t("paidTitle")} body={t("paidBody", { date: day(view.paid_at ?? view.period_start, locale) })} tone="green" />
    );
  }
  if (view.status === "void" || view.expired) return <Message icon={<Link2Off />} title={t("expiredTitle")} body={t("expiredBody")} tone="gray" />;
  const failedNow = !waiting && !retrying && (view.payment?.status === "failed" || view.payment?.status === "expired");
  if (failedNow) {
    return <Message icon={<X />} title={t("failedTitle")} body={t("failedBody")} tone="red" action={{ label: t("retry"), onClick: () => setRetrying(true) }} />;
  }

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
      setRetrying(false);
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
    : view.extension
      ? locale === "en"
        ? (view.extension.name_en ?? view.extension.name)
        : view.extension.name
      : view.plan
      ? locale === "en"
        ? (view.plan.name_en ?? view.plan.name)
        : view.plan.name
      : "";

  // Maquette v2 21 : logo et numéro de facture en tête, montant en premier, détail, opérateur, numéro à débiter ;
  // le bouton répète le montant. En attente : le cercle tourne, rien d'autre à faire.
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-44">
      <div className="flex min-h-11 items-center justify-between gap-3">
        <LogoImage className="h-9" />
        <p className="text-footnote text-label-secondary tabular">{t("invoice", { number: view.number })}</p>
      </div>

      {waiting ? (
        <section aria-live="polite" className="flex flex-1 flex-col items-center justify-center gap-4 py-10 text-center">
          <Spinner label={t("waitingHint")} className="size-12 text-label-secondary" />
          <h1 className="text-title1 font-bold [text-wrap:balance]">{t("waitingTitle")}</h1>
          <p className="text-body text-label-secondary">
            {t("waitingBody", { amount: xaf(view.total_xaf), phone: phone || "•••", channel: tc(view.payment?.channel ?? channel) })}
          </p>
          <p className="text-footnote text-label-secondary">{t("waitingHint")}</p>
        </section>
      ) : (
        <>
          <header className="flex flex-col gap-1 pt-6 pb-5">
            <p className="text-footnote uppercase text-label-secondary">{t("title")}</p>
            <h1 className="tabular text-large-title font-bold">{xaf(view.total_xaf)}</h1>
            <p className="text-body text-label-secondary">
              {view.campaign ? t("forCampaign", { campaign: view.campaign.name, organization: view.organization }) : t("for", { organization: view.organization })}
            </p>
          </header>
          <form id="pay-form" onSubmit={submit} noValidate className="flex flex-col gap-6">
            {error ? (
              <CalloutCard icon={<AlertTriangle />} tone="red" role="alert">
                {error}
              </CalloutCard>
            ) : null}
            <ListSection footer={`${planName} · ${t("period", { from: day(view.period_start, locale), to: day(view.period_end, locale) })}`}>
              {view.lines
                .filter((l) => l.amount_xaf !== 0)
                .map((l, i) => (
                  <ListRow key={i} title={locale === "en" ? l.label_en : l.label} detail={<span className="tabular">{xaf(l.amount_xaf)}</span>} />
                ))}
              <ListRow title={<span className="font-semibold">{t("total")}</span>} detail={<span className="tabular font-semibold text-label">{xaf(view.total_xaf)}</span>} />
            </ListSection>
            <section className="flex flex-col gap-1.5">
              <h2 className="px-4 text-footnote uppercase text-label-secondary">{t("channel")}</h2>
              <div role="radiogroup" aria-label={t("channel")} className="grid grid-cols-2 gap-3">
                {CHANNELS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={channel === c}
                    onClick={() => setChannel(c)}
                    className={cn(
                      "pressable squircle flex min-h-14 items-center gap-2.5 rounded-[var(--radius-lg)] bg-grouped-secondary px-3 text-left",
                      channel === c ? "ring-2 ring-accent" : "ring-1 ring-separator",
                    )}
                  >
                    <span
                      aria-hidden
                      className="flex size-8 shrink-0 items-center justify-center rounded-[8px] text-caption font-bold text-black"
                      style={{ background: c === "mtn_momo" ? "var(--brand-mtn)" : "var(--brand-orange-money)" }}
                    >
                      {c === "mtn_momo" ? "MoMo" : "OM"}
                    </span>
                    <span className="min-w-0 text-subheadline font-semibold [text-wrap:balance]">{tc(c)}</span>
                  </button>
                ))}
              </div>
            </section>
            <div className="flex flex-col gap-1.5">
              <FormGroup>
                <TextField
                  grouped
                  label={t("phone")}
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
              </FormGroup>
              <p className="px-4 text-footnote text-label-secondary">{t("phoneHint")}</p>
            </div>
            <div ref={captchaRef} className="flex justify-center empty:hidden" />
            {demo ? <p className="px-4 text-footnote text-label-secondary">{t("fake")}</p> : null}
          </form>
        </>
      )}

      {!waiting ? (
        <BottomBar>
          <div className="flex flex-col gap-1.5">
            <Button type="submit" form="pay-form" block loading={sending} loadingLabel={t("submitting")}>
              {t("submit", { amount: xaf(view.total_xaf) })}
            </Button>
            <p className="text-center text-caption text-label-secondary">{t("secureShort")}</p>
          </div>
        </BottomBar>
      ) : null}
    </main>
  );
}

/** Écran de résultat (maquette v2 21) : grand cercle plein (vert réussi, rouge échec, gris lien), titre, phrase, action. */
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
  tone: "green" | "red" | "gray";
  action?: { label: string; href?: string; onClick?: () => void };
}) {
  const colors = { green: "bg-green", red: "bg-red", gray: "bg-label-secondary" };
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-12">
      <div className="flex min-h-11 items-center">
        <LogoImage className="h-9" />
      </div>
      <section role={tone === "red" ? "alert" : "status"} className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <span className={`flex size-16 items-center justify-center rounded-full text-white [&_svg]:size-8 [&_svg]:stroke-[2.5] ${colors[tone]}`} aria-hidden>
          {icon}
        </span>
        <h1 className="text-title1 font-bold [text-wrap:balance]">{title}</h1>
        <p className="text-body text-label-secondary">{body}</p>
      </section>
      {action ? (
        action.href ? (
          <Button asChild block>
            <a href={action.href}>{action.label}</a>
          </Button>
        ) : (
          <Button block onClick={action.onClick}>
            {action.label}
          </Button>
        )
      ) : null}
    </main>
  );
}
