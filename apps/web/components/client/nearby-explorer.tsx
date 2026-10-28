"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Building2, ChevronRight, LocateFixed, MapPin } from "lucide-react";
import { waitMinutes } from "@nextin/shared/queue/estimate";
import { formatDistance } from "@nextin/shared/remote";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalloutCard } from "@/components/ui/callout-card";
import { NavigationBar } from "@/components/ui/navigation-bar";
import { SearchField } from "@/components/ui/text-field";
import { getPosition, positionGranted, type GeoPosition } from "@/lib/client/geolocation";
import { callRpc } from "@/lib/client/supabase-public";
import type { NearbyBranch } from "@/lib/client/types";
import { useMediaQuery } from "@/components/appointments/use-media-query";
import { useLiteLocale, useLiteT } from "@/lib/i18n/lite";
import { cn } from "@/lib/cn";

// Carte chargée seulement quand elle s'affiche (onglet Carte sur téléphone, colonne de droite sur ordinateur).
const NearbyMap = dynamic(() => import("./nearby-map").then((m) => m.NearbyMap), {
  ssr: false,
  loading: () => <div className="squircle h-full min-h-80 animate-pulse rounded-[var(--radius-lg)] bg-fill-tertiary" />,
});

const RADIUS_KM = 25;
type Locate = "idle" | "locating" | "located" | "denied" | "unavailable";

/**
 * « Établissements à proximité » : liste (et carte) des agences visibles, attente en direct, recherche.
 * Position demandée à l'utilisateur (ou reprise si déjà autorisée), jamais envoyée pour être enregistrée.
 * Téléphone : liste ou carte au choix ; ordinateur et tablette paysage : liste et carte côte à côte.
 */
export function NearbyExplorer({
  initial,
  tilesUrl,
  attribution,
}: {
  initial: NearbyBranch[];
  tilesUrl: string | null;
  attribution: string | null;
}) {
  const t = useLiteT("client.nearby");
  const locale = useLiteLocale();
  const wide = useMediaQuery("(min-width: 1024px)");
  const [branches, setBranches] = useState(initial);
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState<GeoPosition | null>(null);
  const [locate, setLocate] = useState<Locate>("idle");
  const [view, setView] = useState<"list" | "map">("list");
  const [selected, setSelected] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState(() => new Date());
  const rows = useRef<Map<string, HTMLLIElement>>(new Map());

  async function locateMe() {
    setLocate("locating");
    const r = await getPosition();
    if (r.ok) {
      setPosition(r.position);
      setLocate("located");
    } else {
      setLocate(r.reason);
    }
  }

  // Localisation déjà autorisée : position reprise sans invite.
  useEffect(() => {
    let cancelled = false;
    void positionGranted().then((granted) => {
      if (granted && !cancelled) void locateMe();
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Recherche (avec un court délai pendant la saisie) et rafraîchissement des attentes chaque minute.
  useEffect(() => {
    const controller = new AbortController();
    const load = () =>
      callRpc<NearbyBranch[]>(
        "nearby_branches",
        { p_lat: position?.lat ?? null, p_lng: position?.lng ?? null, p_radius_km: RADIUS_KM, p_query: query.trim() || null },
        { signal: controller.signal },
      ).then(({ data }) => {
        if (data) {
          setBranches(data);
          setUpdatedAt(new Date());
        }
      });
    const first = setTimeout(load, query ? 300 : 0);
    const every = setInterval(load, 60_000);
    return () => {
      controller.abort();
      clearTimeout(first);
      clearInterval(every);
    };
  }, [query, position]);

  function select(id: string) {
    setSelected(id);
    rows.current.get(id)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  const name = (s: NearbyBranch["services"][number]) => (locale === "en" && s.name_en ? s.name_en : s.name);
  const time = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Douala" }).format(updatedAt);
  const showMap = wide || view === "map";
  const chosen = branches.find((b) => b.id === selected) ?? null;

  const list = (
    <section aria-label={t("results", { count: branches.length })} className="flex flex-col gap-2">
      <p className="px-4 text-footnote text-label-secondary uppercase" aria-live="polite">
        {position ? t("located") : t("results", { count: branches.length })}
      </p>
      {branches.length === 0 ? (
        <CalloutCard icon={<MapPin />}>{position && !query ? t("emptyNear", { km: RADIUS_KM }) : t("empty")}</CalloutCard>
      ) : (
        <ul role="list" className="squircle overflow-hidden rounded-[var(--radius-md)] bg-grouped-secondary">
          {branches.map((b) => {
            const minutes = b.min_wait_seconds != null ? waitMinutes(b.min_wait_seconds) : null;
            return (
              <li
                key={b.id}
                ref={(el) => {
                  if (el) rows.current.set(b.id, el);
                  else rows.current.delete(b.id);
                }}
                className="group/row"
              >
                <Link
                  href={`/b/${b.id}`}
                  onFocus={() => setSelected(b.id)}
                  onMouseEnter={() => wide && setSelected(b.id)}
                  className={cn(
                    "flex w-full items-start gap-3 pl-4 text-left transition-colors hover:bg-fill-tertiary/50 active:bg-fill-tertiary",
                    selected === b.id && wide && "bg-accent-tint/60",
                  )}
                >
                  <span
                    aria-hidden
                    className="squircle mt-3 flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-navy text-white [&_svg]:size-5 [&_svg]:stroke-[1.75]"
                  >
                    <Building2 />
                  </span>
                  <span className="relative flex min-w-0 flex-1 items-center gap-2 py-3 pr-3 list-separator">
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-headline">{b.organization.name}</span>
                      <span className="truncate text-subheadline text-label-secondary">
                        {[b.name, b.city, b.distance_m != null ? t("distance", { distance: formatDistance(b.distance_m, locale) }) : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-1.5">
                        <Badge tone={b.is_open ? "green" : "neutral"}>{b.is_open ? t("open") : t("closed")}</Badge>
                        {b.is_open ? (
                          <span className="text-footnote text-label-secondary tabular">
                            {t("waiting", { count: b.waiting })}
                            {minutes != null ? ` · ${minutes === 0 ? t("noWait") : t("wait", { minutes })}` : ""}
                          </span>
                        ) : null}
                        {b.remote_enabled ? <Badge tone="accent">{t("remote")}</Badge> : null}
                        {b.requests_enabled ? <Badge tone="accent">{t("requests")}</Badge> : null}
                      </span>
                    </span>
                    <ChevronRight aria-hidden className="size-[1.125rem] shrink-0 stroke-[2.25] text-label-tertiary" />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <p className="px-4 text-footnote text-label-secondary tabular">{t("refreshed", { time })}</p>
    </section>
  );

  return (
    <main className="min-h-dvh pb-28">
      <NavigationBar title={t("title")} eyebrow={t("eyebrow")} contentClassName="max-w-lg lg:max-w-none lg:px-8" />
      <div className="mx-auto flex max-w-lg flex-col gap-4 px-4 pt-3 lg:max-w-none lg:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:max-w-[26rem]">
          <SearchField label={t("search")} clearLabel={t("clear")} value={query} onValueChange={setQuery} className="flex-1" />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:max-w-[26rem]">
          {locate !== "located" ? (
            <Button
              variant="tinted"
              onClick={locateMe}
              loading={locate === "locating"}
              loadingLabel={t("locating")}
              leadingIcon={<LocateFixed />}
              className="sm:flex-1"
            >
              {t("locate")}
            </Button>
          ) : null}
          {!wide ? (
            <div role="group" aria-label={t("view")} className="grid h-11 grid-cols-2 rounded-[10px] bg-fill-tertiary p-[3px] sm:flex-1">
              {(["list", "map"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={view === v}
                  onClick={() => setView(v)}
                  className={cn(
                    "rounded-[8px] text-subheadline font-semibold transition-colors",
                    view === v ? "bg-grouped-secondary text-label shadow-card" : "text-label-secondary",
                  )}
                >
                  {v === "list" ? t("list") : t("map")}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        {locate === "denied" || locate === "unavailable" ? (
          <CalloutCard icon={<MapPin />} role="status">
            {locate === "denied" ? t("locationDenied") : t("locationUnavailable")}
          </CalloutCard>
        ) : null}

        <div className="lg:grid lg:grid-cols-[minmax(22rem,26rem)_1fr] lg:items-start lg:gap-6">
          <div className={cn(!wide && view === "map" && "hidden")}>{list}</div>
          {showMap ? (
            <div className="flex flex-col gap-3 lg:sticky lg:top-4">
              <NearbyMap
                branches={branches}
                position={position}
                selected={selected}
                onSelect={select}
                tilesUrl={tilesUrl}
                attribution={attribution}
                className="h-[60dvh] min-h-80 lg:h-[calc(100dvh-8rem)]"
              />
              {!wide && chosen ? (
                <Link
                  href={`/b/${chosen.id}`}
                  className="pressable squircle flex min-h-14 items-center gap-3 rounded-[var(--radius-lg)] bg-grouped-secondary px-4 py-3 shadow-card"
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-headline">{chosen.organization.name}</span>
                    <span className="truncate text-subheadline text-label-secondary tabular">
                      {chosen.name} · {t("waiting", { count: chosen.waiting })}
                      {chosen.services[0] ? ` · ${name(chosen.services[0])}` : ""}
                    </span>
                  </span>
                  <ChevronRight aria-hidden className="size-[1.125rem] shrink-0 stroke-[2.25] text-label-tertiary" />
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
