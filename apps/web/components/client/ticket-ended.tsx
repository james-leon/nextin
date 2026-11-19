"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Check, CheckCircle2, Clock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CalloutCard } from "@/components/ui/callout-card";
import type { TicketView } from "@/lib/client/types";
import { LiteIntlProvider, useLiteLocale, useLiteT } from "@/lib/i18n/lite";

const TicketRating = dynamic(() => import("./ticket-rating").then((m) => m.TicketRating), { ssr: false });

/**
 * Ticket terminé, annulé ou clôturé (maquette v2 21) : un état = une icône, un titre, une phrase. Terminé : coche verte,
 * merci et note ; annulé ou clôturé : le numéro en gris, l'icône et la raison sans reproche, puis « Prendre un nouveau
 * ticket ». Chargé seulement pour un ticket fini (jamais dans le premier chargement d'un ticket en cours : budget).
 */
type Props = { view: TicketView; token: string; serviceName: string; entry: string | null; onRated: (view: TicketView) => void };

/**
 * Textes envoyés avec la page pour un ticket déjà fini ; s'il se termine pendant que la page est ouverte, ils sont
 * chargés à ce moment (`/api/i18n/ticket-ended`), comme ceux des jeux.
 */
export function TicketEnded(props: Props) {
  const t = useLiteT("client.ticketEnded");
  const locale = useLiteLocale();
  const ready = t.has("servedTitle");
  const [loaded, setLoaded] = useState<Record<string, string> | null>(null);
  useEffect(() => {
    if (ready) return;
    let alive = true;
    fetch("/api/i18n/ticket-ended")
      .then((r) => (r.ok ? r.json() : null))
      .then((m) => alive && m && setLoaded(m.ticketEnded))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [ready]);
  if (ready) return <Ended {...props} />;
  if (!loaded) return null;
  return (
    <LiteIntlProvider locale={locale} messages={{ client: { ticketEnded: loaded } }}>
      <Ended {...props} />
    </LiteIntlProvider>
  );
}

function Ended({ view, token, serviceName, entry, onRated }: Props) {
  const t = useLiteT("client.ticketEnded");
  const served = view.status === "served";
  return (
    <>
      <section aria-live="polite" className="flex flex-col items-center gap-3 text-center">
        {!served ? (
          <div className="squircle flex w-full flex-col items-center gap-1 rounded-[var(--radius-xl)] bg-grouped-secondary px-5 py-5">
            <p className="font-rounded text-display font-extrabold text-label-secondary">{view.display_code}</p>
            <p className="text-footnote text-label-secondary">{serviceName}</p>
          </div>
        ) : null}
        <span aria-hidden className={`mt-2 flex size-16 items-center justify-center rounded-full text-white ${served ? "bg-green" : "bg-label-secondary"}`}>
          {served ? <Check className="size-8 stroke-[2.5]" /> : view.status === "cancelled" ? <X className="size-8 stroke-[2.5]" /> : <Clock className="size-8 stroke-[2.25]" />}
        </span>
        <p className="text-title1 font-bold [text-wrap:balance]">
          {served ? t("servedTitle") : view.status === "cancelled" ? t("cancelledTitle") : t("noShowTitle")}
        </p>
        {served ? <p className="text-callout text-label-secondary">{t("servedSub", { code: view.display_code, service: serviceName })}</p> : null}
        {view.status === "cancelled" ? (
          <p className="text-body text-label-secondary">{view.remote?.cancelled_for_absence ? t("cancelledAbsence") : t("cancelledBody")}</p>
        ) : null}
        {view.status === "no_show" ? (
          <p className="text-body text-label-secondary">{(view.missed_calls ?? 0) >= 2 ? t("noShowMissedBody") : t("noShowBody")}</p>
        ) : null}
      </section>
      {served ? (
        view.rating_enabled && view.rating == null ? (
          <TicketRating token={token} onRated={onRated} />
        ) : view.rating != null ? (
          <CalloutCard icon={<CheckCircle2 />} tone="green" role="status">
            {t("rated")}
          </CalloutCard>
        ) : null
      ) : (
        <Button asChild block className="h-auto min-h-[3.125rem] whitespace-normal py-3 text-center text-balance">
          <Link href={entry ? `/q/${entry}` : "/"}>{t("newTicket")}</Link>
        </Button>
      )}
    </>
  );
}
