"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { QrCode, Ticket } from "lucide-react";
import { waitMinutes } from "@nextin/shared/queue/estimate";
import { useLiteLocale, useLiteT } from "@/lib/i18n/lite";
import { Button } from "@/components/ui/button";
import { DotsLoader } from "@/components/ui/queue-dots";
import { forgetTicket, listSavedTickets } from "@/lib/client/my-tickets";
import { callRpc } from "@/lib/client/supabase-public";
import type { TicketView } from "@/lib/client/types";
import { cn } from "@/lib/cn";

const ACTIVE = new Set(["waiting", "called", "serving"]);
type Item = { token: string; view: TicketView };

/**
 * Onglet « Tickets » (maquette v2 01) : tickets de cet appareil, « En cours » puis « Historique », comme une liste de
 * Réglages ; numéro en chiffres arrondis. Les tickets effacés (données purgées) disparaissent de la liste.
 */
export function MyTickets() {
  const t = useLiteT("client.myTickets");
  const tc = useLiteT("common");
  const locale = useLiteLocale();
  const [items, setItems] = useState<Item[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const saved = listSavedTickets();
      const views = await Promise.all(
        saved.map(async (s) => {
          const { data, error } = await callRpc<TicketView | null>("get_ticket", { p_token: s.token });
          if (!error && !data) forgetTicket(s.token);
          return data ? { token: s.token, view: data } : null;
        }),
      );
      if (!cancelled) setItems(views.filter((v): v is Item => !!v));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!items) {
    return (
      <div className="flex flex-1 items-center justify-center py-16">
        <DotsLoader label={tc("loading")} />
      </div>
    );
  }
  if (!items.length) {
    return (
      <section className="flex flex-col items-center gap-3 rounded-[var(--radius-md)] bg-grouped-secondary px-6 py-10 text-center">
        <span className="squircle flex size-14 items-center justify-center rounded-[14px] bg-accent-tint text-accent-on-tint">
          <Ticket aria-hidden className="size-7 stroke-[1.5]" />
        </span>
        <h2 className="text-title3 font-bold">{t("emptyTitle")}</h2>
        <p className="text-subheadline text-label-secondary">{t("emptyBody")}</p>
        <Button asChild block className="mt-2">
          <Link href="/scan" prefetch={false}>
            <QrCode aria-hidden className="size-5" />
            {t("scan")}
          </Link>
        </Button>
      </section>
    );
  }

  const date = (iso: string) =>
    new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Douala" }).format(
      new Date(iso),
    );
  const current = items.filter((i) => ACTIVE.has(i.view.status));
  const history = items.filter((i) => !ACTIVE.has(i.view.status));
  const subtitle = ({ view }: Item) => {
    if (view.status === "called") return t("called");
    if (view.status === "serving") return t("serving");
    if (view.status === "waiting") {
      const ahead = Math.max(0, (view.position ?? 1) - 1);
      return ahead === 0 ? t("next") : t("waiting", { count: ahead, minutes: waitMinutes(view.wait_seconds ?? 0) });
    }
    return `${t(`status.${view.status}`)} · ${date(view.finished_at ?? view.created_at)}`;
  };
  const group = (title: string, list: Item[], live: boolean) =>
    list.length ? (
      <section className="flex flex-col gap-1.5" aria-label={title}>
        <h2 className="px-4 text-footnote text-label-secondary uppercase">{title}</h2>
        <ul role="list" className="squircle overflow-hidden rounded-[var(--radius-md)] bg-grouped-secondary">
          {list.map((item) => (
            <li key={item.token} className="group/row">
              <Link
                href={`/t/${item.token}`}
                prefetch={false}
                className="flex min-h-12 items-center gap-3 pl-4 transition-colors hover:bg-fill-tertiary/50 active:bg-fill-tertiary"
              >
                <span className={cn("w-[4.5rem] shrink-0 font-rounded text-title2 font-bold", live ? "text-ticket-number" : "text-label-secondary")}>
                  {item.view.display_code}
                </span>
                <span className="flex min-w-0 flex-1 flex-col py-2.5 pr-4 list-separator">
                  <span className="truncate text-body">{item.view.organization.name}</span>
                  <span className="truncate text-footnote text-label-secondary">{subtitle(item)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    ) : null;
  return (
    <div className="flex flex-col gap-6">
      {group(t("current"), current, true)}
      {group(t("history"), history, false)}
    </div>
  );
}
