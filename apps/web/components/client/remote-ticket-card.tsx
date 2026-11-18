"use client";

import { useState } from "react";
import { Car, Footprints, Info, Navigation, ScanLine } from "lucide-react";
import { TRAVEL_CHOICES, directionsUrl, leaveAdvice } from "@nextin/shared/remote";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalloutCard } from "@/components/ui/callout-card";
import { callRpc } from "@/lib/client/supabase-public";
import type { TicketView } from "@/lib/client/types";
import { useLiteLocale, useLiteT } from "@/lib/i18n/lite";
import { cn } from "@/lib/cn";

/**
 * Ticket à distance en attente (M9) : « quand partir » (attente − trajet − marge), trajet modifiable,
 * itinéraire, rappel de la confirmation de présence et des reculs.
 */
export function RemoteTicketCard({
  token,
  view,
  waitSeconds,
  now,
  onChange,
}: {
  token: string;
  view: TicketView;
  /** Attente estimée à jour (secondes). */
  waitSeconds: number | null;
  /** Heure actuelle (rafraîchie par « Mon ticket ») : base de « Partez vers 10:05 ». */
  now: Date;
  onChange: (view: TicketView) => void;
}) {
  const t = useLiteT("client.ticketRemote");
  const locale = useLiteLocale();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState<number | null>(null);
  const remote = view.remote!;
  const confirmed = !!remote.presence_confirmed_at;
  const advice = leaveAdvice(waitSeconds, remote.travel_seconds, remote.leave_margin_seconds);
  const travelMinutes = remote.travel_seconds != null ? Math.max(1, Math.round(remote.travel_seconds / 60)) : null;
  const hasLocation = view.branch.latitude != null && view.branch.longitude != null;

  async function setTravel(minutes: number) {
    setSaving(minutes);
    const { data } = await callRpc<TicketView>("set_remote_travel", { p_token: token, p_minutes: minutes });
    setSaving(null);
    if (data) {
      onChange(data);
      setEditing(false);
    }
  }

  if (confirmed) {
    return (
      <CalloutCard icon={<ScanLine />} tone="green" role="status">
        {t("confirmed")}
      </CalloutCard>
    );
  }

  return (
    <>
      <section aria-labelledby="leave-title" className="squircle flex flex-col gap-3 rounded-[var(--radius-md)] bg-grouped-secondary p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 id="leave-title" className="text-footnote text-label-secondary uppercase">
            {t("leaveHeader")}
          </h2>
          {remote.on_my_way_at ? (
            <Badge tone="accent">
              <Car aria-hidden />
              {t("onTheWay")}
            </Badge>
          ) : null}
        </div>
        {/* « Partez vers 10:05 » (maquette v2 03) : heure de départ calculée avec le trajet, sur fond teinté. */}
        <div aria-live="polite" className="squircle flex items-center gap-3 rounded-[var(--radius-md)] bg-accent-tint px-3 py-2.5">
          <Footprints aria-hidden className="size-6 shrink-0 stroke-2 text-accent-on-tint" />
          <div className="min-w-0">
            <p className={cn("text-headline tabular", advice.state === "late" ? "text-red-text" : advice.state === "now" ? "text-orange-text" : "text-label")}>
              {advice.state === "later"
                ? t("leaveAt", {
                    time: new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Douala" }).format(
                      new Date(now.getTime() + advice.minutes * 60_000),
                    ),
                  })
                : advice.state === "now"
                  ? t("leaveNow")
                  : advice.state === "late"
                    ? t("leaveLate")
                    : t("leaveUnknown")}
            </p>
            <p className="text-footnote text-label-secondary">
              {t("leaveHint", { margin: Math.round(remote.leave_margin_seconds / 60) })}
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 hairline-t pt-3">
          <span className="text-callout tabular">{travelMinutes ? t("travel", { minutes: travelMinutes }) : t("travelUnknown")}</span>
          <Button variant="plain" size="md" onClick={() => setEditing((v) => !v)} aria-expanded={editing}>
            {t("travelEdit")}
          </Button>
        </div>
        {editing ? (
          <div role="radiogroup" aria-label={t("travelHeader")} className="grid grid-cols-3 gap-2">
            {TRAVEL_CHOICES.map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={travelMinutes === m}
                onClick={() => setTravel(m)}
                disabled={saving !== null}
                className={cn(
                  "pressable squircle h-11 rounded-[var(--radius-sm)] text-callout font-semibold tabular",
                  travelMinutes === m ? "bg-accent text-on-accent" : "bg-fill-tertiary text-label",
                  saving === m && "opacity-60",
                )}
              >
                {t("travelChoice", { minutes: m })}
              </button>
            ))}
          </div>
        ) : null}
        {hasLocation ? (
          <Button asChild block variant="tinted">
            <a href={directionsUrl(view.branch.latitude!, view.branch.longitude!)} target="_blank" rel="noopener">
              <Navigation aria-hidden className="size-5" />
              {t("directions")}
            </a>
          </Button>
        ) : null}
      </section>

      <CalloutCard icon={<Info />}>
        <strong className="font-semibold">{t("presenceTitle")}.</strong> {t("presenceBody", { places: remote.penalty_places })}
      </CalloutCard>
      {remote.delay_count > 0 ? (
        <Badge shape="pill" tone="orange" className="self-center" role="status">
          {t("delayed", { count: remote.delay_count, max: remote.max_delays })}
        </Badge>
      ) : null}
    </>
  );
}
