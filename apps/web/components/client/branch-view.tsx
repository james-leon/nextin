"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Clock, MapPinned, Navigation, Phone, QrCode, Route, ScanLine } from "lucide-react";
import { waitMinutes } from "@nextin/shared/queue/estimate";
import type { BoardService, BranchBoard } from "@nextin/shared/queue/live";
import { directionsUrl } from "@nextin/shared/remote";
import { Badge } from "@/components/ui/badge";
import { BottomBar } from "@/components/ui/bottom-bar";
import { Button } from "@/components/ui/button";
import { CalloutCard } from "@/components/ui/callout-card";
import { ListIcon, ListRow, ListSection } from "@/components/ui/list";
import { NavigationBar } from "@/components/ui/navigation-bar";
import { ServiceTile } from "@/components/ui/service-tile";
import { subscribeBoard } from "@/lib/client/board-feed";
import { getPosition } from "@/lib/client/geolocation";
import { saveTicket } from "@/lib/client/my-tickets";
import { takeTicket } from "@/lib/client/take-ticket";
import type { BranchPublic } from "@/lib/client/types";
import { useLiteLocale, useLiteT } from "@/lib/i18n/lite";
import { branchHoursStatus } from "@/lib/client/branch-hours";

/**
 * Page publique d'une agence (M9) : état d'ouverture, itinéraire, files en direct ; ticket à distance si l'agence
 * le propose (une seule action principale), sinon demande de rendez-vous. Téléphone : une colonne, action en bas ;
 * ordinateur : files à gauche, carte d'action à droite.
 */
export function BranchView({ branch, captchaSiteKey }: { branch: BranchPublic; captchaSiteKey: string | null }) {
  const t = useLiteT("client.branch");
  const ts = useLiteT("client.service");
  const tw = useLiteT("weekdays");
  const te = useLiteT("errors");
  const locale = useLiteLocale();
  const router = useRouter();
  const captchaRef = useRef<HTMLDivElement>(null);
  const [board, setBoard] = useState<BranchBoard>(branch.board);
  const remoteIds = branch.remote.enabled ? branch.remote.service_ids : [];
  const [selected, setSelected] = useState<string | null>(
    () => branch.board.services.find((s) => remoteIds.includes(s.id))?.id ?? null,
  );
  const [pending, setPending] = useState<"locating" | "taking" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => subscribeBoard(branch.id, setBoard), [branch.id]);

  const name = (s: BoardService) => (locale === "en" && s.name_en ? s.name_en : s.name);
  const summary = (s: BoardService) => {
    const minutes = waitMinutes(s.wait_seconds);
    return s.waiting.length === 0 && minutes === 0 ? ts("noWait") : ts("people", { count: s.waiting.length, minutes });
  };
  const hours = useMemo(() => branchHoursStatus(branch.hours, branch.timezone, branch.is_open, new Date()), [branch]);
  const time = (hhmm: string) =>
    new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }).format(new Date(`1970-01-01T${hhmm}Z`));
  const hoursText = hours.open
    ? t("openNow", { time: time(hours.closesAt) })
    : hours.next
      ? t("opensAt", {
          day: hours.next.inDays === 0 ? t("today") : hours.next.inDays === 1 ? t("tomorrow") : tw(String(hours.next.weekday)),
          time: time(hours.next.opensAt),
        })
      : t("closedNow");
  const remoteOn = branch.remote.enabled && remoteIds.length > 0;
  const current = board.services.find((s) => s.id === selected) ?? null;
  const hasLocation = branch.latitude != null && branch.longitude != null;

  async function takeRemote() {
    if (!current) return;
    setError(null);
    setPending("locating");
    // Position facultative (trajet estimé), sauf si l'agence fixe une distance maximale.
    const geo = await getPosition(branch.remote.max_distance_km ? 15_000 : 6_000);
    if (!geo.ok && branch.remote.max_distance_km) {
      setPending(null);
      setError(t("locationNeeded"));
      return;
    }
    setPending("taking");
    const outcome = await takeTicket(
      { serviceId: current.id, source: "remote", position: geo.ok ? geo.position : null },
      { siteKey: captchaSiteKey, container: captchaRef.current },
    );
    if (outcome.ok) {
      saveTicket({ token: outcome.token, code: outcome.code, entry: null, branchId: branch.id, remote: true });
      router.push(`/t/${outcome.token}`);
      return;
    }
    if (outcome.existingPath) {
      router.push(outcome.existingPath);
      return;
    }
    setPending(null);
    setError(te.has(outcome.error) ? te(outcome.error) : te("generic"));
  }

  const takeButton = (
    <Button
      block
      onClick={takeRemote}
      loading={pending !== null}
      loadingLabel={pending === "locating" ? t("locating") : t("taking")}
      disabled={!current || !branch.is_open}
    >
      {t("take")}
    </Button>
  );
  const requestButton = (
    <Button asChild block variant={remoteOn ? "tinted" : "filled"}>
      <a href={`/b/${branch.id}/rdv`}>
        <CalendarPlus aria-hidden className="size-5" />
        {t("requestTitle")}
      </a>
    </Button>
  );
  const errorText = error ? (
    <span role="alert" className="text-red-text">
      {error}
    </span>
  ) : null;

  return (
    <main className="min-h-dvh pb-48 lg:pb-16">
      <NavigationBar
        title={branch.organization.name}
        eyebrow={branch.name}
        back={{ href: "/nearby", label: t("back") }}
        contentClassName="max-w-lg lg:max-w-6xl lg:px-8"
      >
        <p className="mt-1 text-subheadline text-label-secondary">{[branch.address, branch.city].filter(Boolean).join(", ")}</p>
      </NavigationBar>

      <div className="mx-auto flex max-w-lg flex-col gap-6 px-4 pt-3 lg:grid lg:max-w-6xl lg:grid-cols-[1fr_22rem] lg:items-start lg:gap-8 lg:px-8">
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center gap-2" role="status">
            <Badge shape="pill" tone={hours.open ? "green" : "neutral"}>
              <Clock aria-hidden />
              {hoursText}
            </Badge>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {hasLocation ? (
              <Button asChild variant="tinted">
                <a href={directionsUrl(branch.latitude!, branch.longitude!)} target="_blank" rel="noopener">
                  <Navigation aria-hidden className="size-5" />
                  {t("directions")}
                </a>
              </Button>
            ) : null}
            {branch.phone_e164 ? (
              <Button asChild variant="gray">
                <a href={`tel:${branch.phone_e164}`}>
                  <Phone aria-hidden className="size-5" />
                  {t("call")}
                </a>
              </Button>
            ) : null}
          </div>

          {remoteOn ? (
            <ListSection header={t("remoteChoose")} footer={t("queuesFooter")} radioGroupLabel={t("remoteChoose")}>
              {board.services.map((s) =>
                remoteIds.includes(s.id) ? (
                  <ListRow
                    key={s.id}
                    role="radio"
                    selected={selected === s.id}
                    onClick={() => setSelected(s.id)}
                    icon={<ServiceTile letter={s.prefix} color={s.color} />}
                    title={name(s)}
                    subtitle={<span className="tabular">{summary(s)}</span>}
                    accessory="check"
                  />
                ) : (
                  <ListRow
                    key={s.id}
                    icon={<ServiceTile letter={s.prefix} color={s.color} />}
                    title={name(s)}
                    subtitle={<span className="tabular">{summary(s)}</span>}
                    detail={<span className="text-footnote">{t("serviceNotRemote")}</span>}
                  />
                ),
              )}
            </ListSection>
          ) : (
            <ListSection header={t("queues")} footer={t("queuesFooter")}>
              {board.services.map((s) => (
                <ListRow
                  key={s.id}
                  icon={<ServiceTile letter={s.prefix} color={s.color} />}
                  title={name(s)}
                  subtitle={<span className="tabular">{summary(s)}</span>}
                />
              ))}
            </ListSection>
          )}

          {remoteOn ? (
            <section aria-labelledby="remote-how" className="flex flex-col gap-1.5">
              <h2 id="remote-how" className="px-4 text-footnote text-label-secondary uppercase">
                {t("remoteHow")}
              </h2>
              <ol className="squircle flex flex-col gap-4 rounded-[var(--radius-md)] bg-grouped-secondary p-4">
                {[
                  { icon: <MapPinned />, text: t("remoteStep1") },
                  { icon: <Route />, text: t("remoteStep2") },
                  { icon: <ScanLine />, text: t("remoteStep3") },
                ].map((step, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <ListIcon color={i === 2 ? "var(--orange-fill)" : "var(--accent-fill)"}>{step.icon}</ListIcon>
                    <span className="pt-1 text-callout">{step.text}</span>
                  </li>
                ))}
              </ol>
              <p className="px-4 text-footnote text-label-secondary">
                {t("remoteRule", { places: branch.remote.penalty_places })}{" "}
                {branch.remote.max_distance_km ? t("remoteMax", { km: branch.remote.max_distance_km }) : t("remotePosition")}
              </p>
            </section>
          ) : (
            <CalloutCard icon={<QrCode />}>{t("remoteOff")}</CalloutCard>
          )}

          {branch.requests_enabled && remoteOn ? (
            <ListSection header={t("requestHeader")} className="lg:hidden">
              <ListRow
                href={`/b/${branch.id}/rdv`}
                icon={
                  <ListIcon>
                    <CalendarPlus />
                  </ListIcon>
                }
                title={t("requestTitle")}
                subtitle={t("requestBody")}
                accessory="chevron"
              />
            </ListSection>
          ) : null}

          {branch.hours.length ? (
            <ListSection header={t("hours")}>
              {[1, 2, 3, 4, 5, 6, 7].map((d) => {
                const day = branch.hours.filter((h) => h.weekday === d);
                return (
                  <ListRow
                    key={d}
                    title={tw(String(d))}
                    detail={
                      <span className="tabular">
                        {day.length ? day.map((h) => `${time(h.opens_at)} – ${time(h.closes_at)}`).join(", ") : t("hoursClosed")}
                      </span>
                    }
                  />
                );
              })}
            </ListSection>
          ) : null}
          <div ref={captchaRef} className="flex justify-center empty:hidden" />
        </div>

        {/* Ordinateur : carte d'action à droite, toujours visible. */}
        {remoteOn || branch.requests_enabled ? (
          <aside className="squircle hidden flex-col gap-3 rounded-[var(--radius-lg)] bg-grouped-secondary p-5 shadow-card lg:sticky lg:top-6 lg:flex">
            {remoteOn ? (
              <>
                <h2 className="text-headline">{t("remoteHeader")}</h2>
                {current ? (
                  <p className="text-subheadline text-label-secondary tabular">
                    {name(current)} · {summary(current)}
                  </p>
                ) : null}
                {errorText}
                {takeButton}
              </>
            ) : null}
            {branch.requests_enabled ? (
              <>
                {remoteOn ? <div className="my-1 h-px bg-separator" aria-hidden /> : <h2 className="text-headline">{t("requestHeader")}</h2>}
                <p className="text-subheadline text-label-secondary">{t("requestBody")}</p>
                {requestButton}
              </>
            ) : null}
          </aside>
        ) : null}
      </div>

      {remoteOn ? (
        <BottomBar
          className="lg:hidden"
          summary={errorText ?? (current ? <span className="tabular">{`${name(current)} · ${summary(current)}`}</span> : undefined)}
        >
          {takeButton}
        </BottomBar>
      ) : branch.requests_enabled ? (
        <BottomBar className="lg:hidden">{requestButton}</BottomBar>
      ) : null}
    </main>
  );
}
