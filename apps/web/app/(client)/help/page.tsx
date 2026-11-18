import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ChevronDown, MapPin, Phone, ShieldCheck } from "lucide-react";
import { ListIcon } from "@/components/ui/list";
import { formatTime } from "@nextin/shared";
import { ClientTabs } from "@/components/client/client-tabs";
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
  const shortDay = (weekday: number) =>
    new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2024, 0, weekday)));
  const days = [1, 2, 3, 4, 5, 6, 7].map((d) => ({
    day: dayName(d),
    weekday: d,
    slots: (help?.hours ?? []).filter((h) => h.weekday === d).map((h) => `${formatTime(h.opens_at)}–${formatTime(h.closes_at)}`),
  }));
  // Horaires en une ligne (maquette v2 13) : jours consécutifs identiques regroupés (« lun.–ven. 07:30–18:00 »).
  const hoursLine = days
    .reduce<{ from: number; to: number; slots: string }[]>((acc, d) => {
      const slots = d.slots.join(", ") || t("closed");
      const last = acc[acc.length - 1];
      if (last && last.slots === slots && last.to === d.weekday - 1) last.to = d.weekday;
      else acc.push({ from: d.weekday, to: d.weekday, slots });
      return acc;
    }, [])
    .map((g) => `${g.from === g.to ? shortDay(g.from) : `${shortDay(g.from)}–${shortDay(g.to)}`} ${g.slots}`)
    .join(" · ");

  return (
    <main className="min-h-dvh pb-28">
      <NavigationBar
        title={t("title")}
        back={validToken ? { href: `/t/${validToken}`, label: t("back"), prefetch: false } : { href: "/profile", label: t("profileBack"), prefetch: false }}
        contentClassName="max-w-lg lg:max-w-[40rem]"
      />
      <div className="mx-auto flex max-w-lg flex-col gap-6 px-4 pt-3 lg:max-w-[40rem]">
        {help ? (
          <section aria-labelledby="help-contact" className="flex flex-col gap-1.5">
            <h2 id="help-contact" className="px-4 text-footnote uppercase text-label-secondary">
              {t("contactHeader")}
            </h2>
            <div className="squircle flex flex-col gap-3 rounded-[var(--radius-md)] bg-grouped-secondary px-3.5 py-3">
              <div className="flex items-center gap-3">
                <ListIcon color="var(--accent-fill)">
                  <MapPin />
                </ListIcon>
                <div className="flex min-w-0 flex-col">
                  <p className="text-headline [overflow-wrap:anywhere]">
                    {help.organization} · {help.branch}
                  </p>
                  <p className={help.is_open ? "text-footnote font-semibold text-green-text" : "text-footnote text-label-secondary"}>
                    {help.is_open ? t("openNow") : t("closedNow")}
                  </p>
                </div>
              </div>
              {help.phone_e164 ? (
                <Button asChild variant="tinted" block size="md">
                  <a href={`tel:${help.phone_e164}`} aria-label={t("callLabel", { name: help.organization })}>
                    <Phone aria-hidden className="size-[1.125rem]" />
                    {t("call")}
                  </a>
                </Button>
              ) : (
                <p className="text-subheadline text-label-secondary">{t("noPhone")}</p>
              )}
              <p className="text-footnote text-label-secondary first-letter:uppercase">
                <span className="sr-only">{t("hours")} : </span>
                {hoursLine}
              </p>
              {help.address || help.city ? <p className="text-footnote text-label-secondary">{[help.address, help.city].filter(Boolean).join(", ")}</p> : null}
            </div>
          </section>
        ) : (
          <CalloutCard icon={<Phone />}>{t("noTicket")}</CalloutCard>
        )}

        <section aria-labelledby="help-faq" className="flex flex-col gap-1.5">
          <h2 id="help-faq" className="px-4 text-footnote uppercase text-label-secondary">
            {t("faqHeader")}
          </h2>
          <ul role="list" className="squircle overflow-hidden rounded-[var(--radius-md)] bg-grouped-secondary">
            {FAQ.map((key) => (
              <li key={key} className="group/row">
                <details className="group/faq">
                  <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 pl-3.5 transition-colors hover:bg-fill-tertiary/50 [&::-webkit-details-marker]:hidden">
                    <span className="relative flex min-h-12 flex-1 items-center gap-3 py-3 pr-3.5 list-separator">
                      <span className="flex-1 text-subheadline">{t(`faq.${key}.q`)}</span>
                      <ChevronDown
                        aria-hidden
                        className="size-4 shrink-0 stroke-[2.25] text-label-tertiary transition-transform duration-200 ease-[var(--ease-spring)] group-open/faq:rotate-180 motion-reduce:transition-none"
                      />
                    </span>
                  </summary>
                  <p className="px-3.5 pb-3 text-subheadline text-label-secondary">{t(`faq.${key}.a`)}</p>
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
      <ClientTabs active="profile" />
    </main>
  );
}
