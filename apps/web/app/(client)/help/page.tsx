import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ChevronDown, MapPin, Phone, ShieldCheck } from "lucide-react";
import { formatCameroonPhone, formatTime } from "@nextin/shared";
import { ClientTabBar } from "@/components/client/client-tab-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalloutCard } from "@/components/ui/callout-card";
import { NavigationBar } from "@/components/ui/navigation-bar";
import { callRpc } from "@/lib/client/supabase-public";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("client.help");
  return { title: t("title"), robots: { index: false } };
}

type TicketHelp = {
  organization: string;
  branch: string;
  address: string | null;
  city: string | null;
  phone_e164: string | null;
  is_open: boolean;
  hours: { weekday: number; opens_at: string; closes_at: string }[];
};

const FAQ = ["take", "app", "alerts", "away", "missed", "cancel", "wait", "data"] as const;
const TOKEN = /^[A-Za-z0-9_-]{16,64}$/;

/**
 * C2 — page Aide du patient : questions fréquentes (FR/EN) et, ouverte depuis un ticket, les coordonnées publiques
 * de son établissement (téléphone de l'agence, horaires). Aucune donnée du patient. Rendue par le serveur, sans JS
 * (questions dépliables en `<details>`), comme les autres pages client (< 200 Ko).
 */
export default async function HelpPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { t: token } = await searchParams;
  const t = await getTranslations("client.help");
  const locale = await getLocale();
  const validToken = token && TOKEN.test(token) ? token : null;
  const help = validToken ? (await callRpc<TicketHelp | null>("ticket_help", { p_token: validToken })).data : null;
  // Jours ISO : 1 = lundi … 7 = dimanche (2024-01-01 est un lundi).
  const dayName = (weekday: number) =>
    new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2024, 0, weekday)));
  const days = [1, 2, 3, 4, 5, 6, 7].map((d) => ({
    day: dayName(d),
    slots: (help?.hours ?? []).filter((h) => h.weekday === d).map((h) => `${formatTime(h.opens_at)}–${formatTime(h.closes_at)}`),
  }));

  return (
    <main className="min-h-dvh pb-28">
      <NavigationBar
        title={t("title")}
        eyebrow={t("eyebrow")}
        back={validToken ? { href: `/t/${validToken}`, label: t("back"), prefetch: false } : { href: "/profile", label: t("profileBack"), prefetch: false }}
        contentClassName="max-w-lg"
      />
      <div className="mx-auto flex max-w-lg flex-col gap-7 px-4 pt-3 lg:max-w-[40rem]">
        {help ? (
          <section aria-labelledby="help-contact" className="flex flex-col gap-1.5">
            <h2 id="help-contact" className="px-4 text-footnote uppercase text-label-secondary">
              {t("contactHeader")}
            </h2>
            <div className="squircle flex flex-col gap-4 rounded-[var(--radius-xl)] bg-grouped-secondary p-5 shadow-card">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col">
                  <p className="text-title3 font-semibold [overflow-wrap:anywhere]">{help.organization}</p>
                  <p className="text-subheadline text-label-secondary">{help.branch}</p>
                </div>
                <Badge shape="pill" tone={help.is_open ? "green" : "neutral"}>
                  {help.is_open ? t("openNow") : t("closedNow")}
                </Badge>
              </div>
              {help.address || help.city ? (
                <p className="flex items-start gap-2 text-subheadline text-label-secondary">
                  <MapPin aria-hidden className="mt-0.5 size-4 shrink-0 stroke-[1.75]" />
                  {[help.address, help.city].filter(Boolean).join(", ")}
                </p>
              ) : null}
              {help.phone_e164 ? (
                <Button asChild variant="tinted" block>
                  <a href={`tel:${help.phone_e164}`} aria-label={t("callLabel", { name: help.organization })}>
                    <Phone aria-hidden className="size-5" />
                    {t("call")} · <span className="tabular">{formatCameroonPhone(help.phone_e164)}</span>
                  </a>
                </Button>
              ) : (
                <p className="text-subheadline text-label-secondary">{t("noPhone")}</p>
              )}
              <div className="flex flex-col gap-1.5">
                <h3 className="text-headline">{t("hours")}</h3>
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-subheadline">
                  {days.map((d) => (
                    <div key={d.day} className="contents">
                      <dt className="text-label-secondary first-letter:uppercase">{d.day}</dt>
                      <dd className="tabular">{d.slots.length ? d.slots.join(" · ") : t("closed")}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </section>
        ) : (
          <CalloutCard icon={<Phone />}>{t("noTicket")}</CalloutCard>
        )}

        <section aria-labelledby="help-faq" className="flex flex-col gap-1.5">
          <h2 id="help-faq" className="px-4 text-footnote uppercase text-label-secondary">
            {t("faqHeader")}
          </h2>
          <ul role="list" className="squircle overflow-hidden rounded-[var(--radius-xl)] bg-grouped-secondary shadow-card">
            {FAQ.map((key) => (
              <li key={key} className="group/row">
                <details className="group/faq">
                  <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 pl-4 transition-colors hover:bg-fill-tertiary/50 [&::-webkit-details-marker]:hidden">
                    <span className="relative flex min-h-14 flex-1 items-center gap-3 py-3 pr-4 list-separator">
                      <span className="flex-1 text-body font-semibold">{t(`faq.${key}.q`)}</span>
                      <ChevronDown
                        aria-hidden
                        className="size-[1.125rem] shrink-0 stroke-[2.25] text-label-tertiary transition-transform duration-200 ease-[var(--ease-spring)] group-open/faq:rotate-180 motion-reduce:transition-none"
                      />
                    </span>
                  </summary>
                  <p className="px-4 pt-1 pb-4 text-body text-label-secondary">{t(`faq.${key}.a`)}</p>
                </details>
              </li>
            ))}
          </ul>
        </section>

        <Link
          href="/confidentialite"
          prefetch={false}
          className="inline-flex min-h-11 items-center gap-2 self-start px-4 text-subheadline font-semibold text-accent-text"
        >
          <ShieldCheck aria-hidden className="size-4" />
          {t("privacyLink")}
        </Link>
      </div>
      <ClientTabBar active="profile" />
    </main>
  );
}
