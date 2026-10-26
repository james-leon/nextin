"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ScanLine, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { forgetTicket, listSavedTickets } from "@/lib/client/my-tickets";
import { callRpc } from "@/lib/client/supabase-public";
import type { TicketView } from "@/lib/client/types";

const ACTIVE = new Set(["waiting", "called", "serving"]);

/** Onglet « Mon ticket » : ouvre le ticket en cours de cet appareil, sinon invite à scanner. */
export function MyTicketRedirect() {
  const t = useTranslations("client.myTickets");
  const tc = useTranslations("common");
  const router = useRouter();
  const [empty, setEmpty] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const saved of listSavedTickets()) {
        const { data, error } = await callRpc<TicketView | null>("get_ticket", { p_token: saved.token });
        if (cancelled) return;
        if (data && ACTIVE.has(data.status)) return router.replace(`/t/${saved.token}`);
        if (!error && !data) forgetTicket(saved.token);
      }
      setEmpty(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!empty) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner label={tc("loading")} className="text-label-secondary" />
      </div>
    );
  }
  return (
    <section className="flex flex-col items-center gap-4 rounded-[var(--radius-xl)] bg-grouped-secondary px-6 py-10 text-center">
      <span className="squircle flex size-16 items-center justify-center rounded-[18px] bg-accent-tint text-accent-on-tint">
        <Ticket aria-hidden className="size-8 stroke-[1.5]" />
      </span>
      <h2 className="text-title2 font-bold">{t("emptyTitle")}</h2>
      <p className="text-body text-label-secondary">{t("emptyBody")}</p>
      <Button asChild block className="mt-2">
        <Link href="/">
          <ScanLine aria-hidden className="size-5" />
          {t("scan")}
        </Link>
      </Button>
    </section>
  );
}
