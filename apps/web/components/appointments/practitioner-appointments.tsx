"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CalendarDays } from "lucide-react";
import { localDate } from "@nextin/shared/appointments";
import { ListIcon, ListRow, ListSection } from "@/components/ui/list";
import { Sheet } from "@/components/ui/sheet";
import { listAppointments, type Appointment } from "@/lib/desk/appointments";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { timeOf } from "./format";
import { AppointmentStatusBadge } from "./status-badge";

/**
 * Poste du praticien : ligne « Rendez-vous du jour · N » et feuille de consultation (heure, repère, statut, ticket).
 * Lecture seule : l'arrivée se fait à l'accueil.
 */
export function PractitionerAppointments({ branchId, practitionerId, timeZone }: { branchId: string; practitionerId: string; timeZone: string }) {
  const t = useTranslations("appointments");
  const tc = useTranslations("common");
  const locale = useLocale();
  const supabase = getSupabaseBrowserClient();
  const [items, setItems] = useState<Appointment[]>([]);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    const today = localDate(new Date(), timeZone);
    const next = await listAppointments(supabase, branchId, today, today, practitionerId).catch(() => null);
    if (next) setItems(next.filter((a) => a.status !== "rescheduled" && a.status !== "cancelled"));
  }, [supabase, branchId, practitionerId, timeZone]);

  useEffect(() => {
    const first = setTimeout(() => void load(), 0);
    const poll = setInterval(() => void load(), 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(poll);
    };
  }, [load]);

  return (
    <>
      <ListRow
        onClick={() => {
          setOpen(true);
          void load();
        }}
        icon={
          <ListIcon>
            <CalendarDays />
          </ListIcon>
        }
        title={t("deskOpen", { count: items.length })}
        accessory="chevron"
      />
      <Sheet open={open} onOpenChange={setOpen} title={t("deskTitle")} closeLabel={tc("close")}>
        {items.length ? (
          <ListSection>
            {items.map((a) => (
              <ListRow
                key={a.id}
                icon={<span className="w-12 shrink-0 py-2.5 text-right text-callout font-semibold tabular">{timeOf(a.starts_at, locale, timeZone)}</span>}
                title={a.customer_label ?? t("noLabel")}
                subtitle={a.ticket ? t("ticket", { code: a.ticket.display_code }) : undefined}
                detail={<AppointmentStatusBadge status={a.display_status} />}
              />
            ))}
          </ListSection>
        ) : (
          <p className="px-4 py-8 text-center text-body text-label-secondary">{t("deskEmpty")}</p>
        )}
      </Sheet>
    </>
  );
}
