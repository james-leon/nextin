"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ChevronRight, History, LocateFixed, MapPin } from "lucide-react";
import { waitMinutes } from "@nextin/shared/queue/estimate";
import { formatDistance } from "@nextin/shared/remote";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalloutCard } from "@/components/ui/callout-card";
import { NavigationBar } from "@/components/ui/navigation-bar";
import { SearchField } from "@/components/ui/text-field";
import { getPosition, positionGranted, type GeoPosition } from "@/lib/client/geolocation";
import { clearRecentBranches, recentBranchesStore } from "@/lib/client/recent-branches";
import { branchPhotoUrl, callRpc } from "@/lib/client/supabase-public";
import type { NearbyBranch } from "@/lib/client/types";
import { useMediaQuery } from "@/components/ui/use-media-query";
import { useLiteLocale, useLiteT } from "@/lib/i18n/lite";
import { OrgTypeIcon } from "@/components/ui/org-type-icon";
import { useAfterFirstLoad } from "./lazy-mount";
import { cn } from "@/lib/cn";

// Carte chargée seulement quand elle s'affiche (onglet Carte sur téléphone, colonne de droite sur ordinateur).
const NearbyMap = dynamic(() => import("./nearby-map").then((m) => m.NearbyMap), {
  ssr: false,
  loading: () => <div className="squircle h-full min-h-80 animate-pulse rounded-[var(--radius-lg)] bg-fill-tertiary" />,
});

const RADIUS_KM = 25;

/** Catégories de la liste (secteur de l'établissement) ; les autres secteurs restent sous « Tous ». */
const CATEGORIES = ["all", "clinics", "banks", "energy", "telecom"] as const;
type Category = (typeof CATEGORIES)[number];
function categoryOf(type: string): Category | null {
  if (type === "clinic" || type === "hospital") return "clinics";
  if (type === "bank") return "banks";
  if (type === "utility") return "energy";
  if (type === "telecom") return "telecom";
  return null;
}

/** Photo de l'établissement (16:9 ou carrée), sinon icône du secteur sur fond teinté. */
function BranchVisual({ branch, variant, photos }: { branch: NearbyBranch; variant: "cover" | "thumb"; photos: boolean }) {
  // Photos chargées après le premier affichage (comme les publicités) : l'icône du secteur s'affiche d'abord.
  if (branch.photo && photos) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={branchPhotoUrl(variant === "cover" ? branch.photo.cover : branch.photo.thumb, branch.photo.version)}
        alt=""
        loading="lazy"
        decoding="async"
        className="absolute inset-0 size-full object-cover"
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        "absolute inset-0 flex items-center justify-center bg-accent-tint text-accent-on-tint",
        variant === "cover" ? "[&_svg]:size-14 [&_svg]:stroke-[1.25]" : "[&_svg]:size-7 [&_svg]:stroke-[1.5]",
      )}
    >
      <OrgTypeIcon type={branch.organization.type} />
    </span>
  );
}
/** Agences rechargées autour du client ou pour une recherche : 10 au plus (grande carte + 9 lignes, réponse légère en 3G). */
const LIMIT = 10;
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
  const to = useLiteT("orgTypes");
  const locale = useLiteLocale();
  const wide = useMediaQuery("(min-width: 1024px)");
  const [branches, setBranches] = useState(initial);
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState<GeoPosition | null>(null);
  const [locate, setLocate] = useState<Locate>("idle");
  const [view, setView] = useState<"list" | "map">("list");
  const [selected, setSelected] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState(() => new Date());
  const [category, setCategory] = useState<Category>("all");
  const photos = useAfterFirstLoad();
  const rows = useRef<Map<string, HTMLLIElement>>(new Map());
  // Agences consultées sur cet appareil (P3) : lues après l'hydratation, rien côté serveur.
  const recents = useSyncExternalStore(recentBranchesStore.subscribe, recentBranchesStore.getSnapshot, recentBranchesStore.getServerSnapshot);

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
        { p_lat: position?.lat ?? null, p_lng: position?.lng ?? null, p_radius_km: RADIUS_KM, p_query: query.trim() || null, p_limit: LIMIT },
        { signal: controller.signal },
      ).then(({ data }) => {
        if (data) {
          setBranches(data);
          setUpdatedAt(new Date());
        }
      });
    // Premier affichage sans position ni recherche : la liste du serveur suffit (pas de second chargement).
    const first = query || position ? setTimeout(load, query ? 300 : 0) : null;
    const every = setInterval(load, 60_000);
    return () => {
      controller.abort();
      if (first) clearTimeout(first);
      clearInterval(every);
    };
  }, [query, position]);

  function select(id: string) {
    setSelected(id);
    rows.current.get(id)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  const time = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Douala" }).format(updatedAt);
  // Ordinateur : carte à droite sur toute la hauteur seulement avec un fournisseur de tuiles ; sans tuiles, le plan
  // schématique ressemblerait à une grille vide : liste élargie en grille de cartes (revue responsive R5).
  const mapOnDesktop = !!tilesUrl;
  const showMap = wide ? mapOnDesktop : view === "map";
  const chosen = branches.find((b) => b.id === selected) ?? null;

  // Catégories (style A) déduites du secteur de l'établissement ; « Tous » par défaut.
  const shownBranches = category === "all" ? branches : branches.filter((b) => categoryOf(b.organization.type) === category);
  const [featured, ...others] = shownBranches;
  const waitText = (b: NearbyBranch) => {
    const minutes = b.min_wait_seconds != null ? waitMinutes(b.min_wait_seconds) : null;
    return minutes == null ? "—" : minutes === 0 ? t("noWait") : t("wait", { minutes });
  };
  const distanceText = (b: NearbyBranch) => (b.distance_m != null ? formatDistance(b.distance_m, locale) : null);
  const linkProps = (b: NearbyBranch) => ({
    href: `/b/${b.id}`,
    // Pas de préchargement des pages d'agence : premier chargement léger (3G, < 200 Ko).
    prefetch: false,
    onFocus: () => setSelected(b.id),
    onMouseEnter: () => wide && setSelected(b.id),
  });

  const list = (
    <section aria-label={t("results", { count: shownBranches.length })} className="flex flex-col gap-4">
      {recents.length && !query ? (
        <section aria-labelledby="nearby-recent" className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-3 pl-4">
            <h2 id="nearby-recent" className="flex items-center gap-1.5 text-footnote uppercase text-label-secondary">
              <History aria-hidden className="size-3.5 stroke-[2]" />
              {t("recent")}
            </h2>
            <Button variant="plain" size="md" onClick={clearRecentBranches} aria-label={t("recentClearLabel")}>
              {t("recentClear")}
            </Button>
          </div>
          <ul role="list" className="squircle overflow-hidden rounded-[var(--radius-xl)] bg-grouped-secondary shadow-card">
            {recents.slice(0, 4).map((r) => (
              <li key={r.id} className="group/row">
                <Link
                  href={`/b/${r.id}`}
                  prefetch={false}
                  className="flex w-full items-center gap-3 pl-4 text-left transition-colors hover:bg-fill-tertiary/50 active:bg-fill-tertiary"
                >
                  <span
                    aria-hidden
                    className="squircle flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-accent-tint text-accent-on-tint [&_svg]:size-5 [&_svg]:stroke-[1.75]"
                  >
                    <OrgTypeIcon type={r.type} />
                  </span>
                  <span className="relative flex min-h-14 min-w-0 flex-1 items-center gap-2 py-2.5 pr-3 list-separator">
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-body">{r.organization}</span>
                      <span className="truncate text-subheadline text-label-secondary">{[r.name, r.city].filter(Boolean).join(" · ")}</span>
                    </span>
                    <ChevronRight aria-hidden className="size-[1.125rem] shrink-0 stroke-[2.25] text-label-tertiary" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <div role="radiogroup" aria-label={t("categoriesLabel")} className="-mx-4 flex gap-2 scroll-fade-x px-4 pb-1">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={category === c}
            onClick={() => setCategory(c)}
            className={cn(
              "pressable h-11 shrink-0 rounded-full px-4 text-subheadline font-semibold whitespace-nowrap transition-colors",
              category === c ? "bg-accent text-on-accent" : "bg-grouped-secondary text-label shadow-card",
            )}
          >
            {t(`categories.${c}`)}
          </button>
        ))}
      </div>
      <p className="sr-only" aria-live="polite">
        {position ? t("located") : t("results", { count: shownBranches.length })}
      </p>
      {!featured ? (
        <CalloutCard icon={<MapPin />}>{position && !query ? t("emptyNear", { km: RADIUS_KM }) : t("empty")}</CalloutCard>
      ) : (
        <ul role="list" className={cn("flex flex-col gap-4", !mapOnDesktop && "lg:grid lg:grid-cols-2 lg:items-start xl:grid-cols-3")}>
          {/* L'établissement le plus proche (ou le premier) en grande carte avec sa photo. */}
          <li ref={(el) => {
            if (el) rows.current.set(featured.id, el);
            else rows.current.delete(featured.id);
          }} className={cn(!mapOnDesktop && "lg:row-span-2")}>
            <Link
              {...linkProps(featured)}
              className={cn(
                "pressable squircle block overflow-hidden rounded-[var(--radius-2xl)] bg-grouped-secondary shadow-card",
                selected === featured.id && wide && "ring-2 ring-accent",
              )}
            >
              <span className="relative block aspect-[16/9]">
                <BranchVisual branch={featured} variant="cover" photos={photos} />
                <span className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
                  <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-grouped-secondary/95 px-3 text-footnote font-semibold text-label shadow-card">
                    <span aria-hidden className={cn("size-2 rounded-full", featured.is_open ? "bg-green" : "bg-label-tertiary")} />
                    {featured.is_open ? t("open") : t("closed")}
                  </span>
                  {distanceText(featured) ? (
                    <span className="inline-flex h-7 items-center rounded-full bg-grouped-secondary/95 px-3 text-footnote font-semibold text-label tabular shadow-card">
                      {distanceText(featured)}
                    </span>
                  ) : null}
                </span>
              </span>
              <span className="block p-5">
                {position ? <span className="block text-footnote font-semibold text-accent-text uppercase">{t("nearest")}</span> : null}
                <span className="relative block truncate text-title3 font-semibold">
                  {featured.organization.name}
                  <span className="sr-only"> · {to(featured.organization.type)}</span>
                </span>
                <span className="block truncate text-subheadline text-label-secondary">{[featured.name, featured.city].filter(Boolean).join(" · ")}</span>
                <span className="mt-4 grid grid-cols-3 gap-2">
                  {[
                    { label: t("tileWaiting"), value: featured.is_open ? String(featured.waiting) : "—" },
                    { label: t("tileWait"), value: featured.is_open ? waitText(featured) : "—" },
                    { label: t("tileRemote"), value: featured.remote_enabled ? t("remoteYes") : t("remoteNo") },
                  ].map((tile) => (
                    <span key={tile.label} className="squircle flex min-w-0 flex-col rounded-[var(--radius-lg)] bg-fill-tertiary px-3 py-2.5">
                      <span className="truncate text-footnote text-label-secondary">{tile.label}</span>
                      <span className="truncate text-headline tabular">{tile.value}</span>
                    </span>
                  ))}
                </span>
              </span>
            </Link>
          </li>
          {/* Les suivants en lignes compactes avec vignette. */}
          {others.length ? (
            <li className={cn(!mapOnDesktop && "lg:col-span-1 xl:col-span-2")}>
              <ul role="list" className="squircle overflow-hidden rounded-[var(--radius-xl)] bg-grouped-secondary shadow-card">
                {others.map((b) => (
                  <li key={b.id} ref={(el) => {
                      if (el) rows.current.set(b.id, el);
                      else rows.current.delete(b.id);
                    }} className="group/row">
                    <Link
                      {...linkProps(b)}
                      className={cn(
                        "flex w-full items-center gap-3 pl-4 text-left transition-colors hover:bg-fill-tertiary/50 active:bg-fill-tertiary",
                        selected === b.id && wide && "bg-accent-tint/60",
                      )}
                    >
                      <span className="relative my-3 block size-14 shrink-0 overflow-hidden rounded-[14px]">
                        <BranchVisual branch={b} variant="thumb" photos={photos} />
                      </span>
                      <span className="relative flex min-w-0 flex-1 items-center gap-2 py-3 pr-3 list-separator">
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="relative truncate text-headline">
                            {b.organization.name}
                            <span className="sr-only"> · {to(b.organization.type)}</span>
                          </span>
                          <span className="truncate text-subheadline text-label-secondary">
                            {[b.name, distanceText(b) ? t("distance", { distance: distanceText(b)! }) : b.city].filter(Boolean).join(" · ")}
                          </span>
                          <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
                            <Badge tone={b.is_open ? "green" : "neutral"}>{b.is_open ? t("open") : t("closed")}</Badge>
                            {b.is_open ? (
                              <span className="text-footnote text-label-secondary tabular">
                                {t("waiting", { count: b.waiting })} · {waitText(b)}
                              </span>
                            ) : null}
                          </span>
                        </span>
                        <ChevronRight aria-hidden className="size-[1.125rem] shrink-0 stroke-[2.25] text-label-tertiary" />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          ) : null}
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
        {locate === "idle" || locate === "locating" ? (
          // Invitation à activer la position (P3) : expliquée avant que le navigateur ne la demande.
          <section aria-labelledby="nearby-locate" className="squircle flex items-start gap-3 rounded-[var(--radius-xl)] bg-grouped-secondary p-4 shadow-card lg:max-w-[26rem]">
            <span aria-hidden className="squircle flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-accent-tint text-accent-on-tint">
              <LocateFixed className="size-5 stroke-[1.75]" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <div className="flex flex-col gap-0.5">
                <h2 id="nearby-locate" className="text-headline [text-wrap:balance]">
                  {t("locateTitle")}
                </h2>
                <p className="text-subheadline text-label-secondary">{t("locateBody")}</p>
              </div>
              <Button variant="tinted" size="md" onClick={locateMe} loading={locate === "locating"} loadingLabel={t("locating")} className="self-start">
                {t("locate")}
              </Button>
            </div>
          </section>
        ) : null}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:max-w-[26rem]">
          {!wide ? (
            <div role="group" aria-label={t("view")} className="grid h-11 grid-cols-2 rounded-[10px] bg-fill-tertiary p-[3px] sm:flex-1">
              {(["list", "map"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={view === v}
                  onClick={() => setView(v)}
                  className={cn(
                    // Cible tactile de 44 px : la zone cliquable déborde de 3 px (comme le SegmentedControl).
                    "relative rounded-[8px] text-subheadline font-semibold text-label transition-colors before:absolute before:inset-x-0 before:-inset-y-[3px] before:content-['']",
                    view === v ? "bg-grouped-secondary shadow-card" : "",
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

        <div className={cn(mapOnDesktop && "lg:grid lg:grid-cols-[minmax(22rem,26rem)_1fr] lg:items-start lg:gap-6")}>
          <div className={cn(!wide && view === "map" && "hidden")}>{list}</div>
          {showMap ? (
            <div className="flex flex-col gap-3 lg:sticky lg:top-14">
              <NearbyMap
                branches={branches}
                position={position}
                selected={selected}
                onSelect={select}
                tilesUrl={tilesUrl}
                attribution={attribution}
                className="h-[55dvh] min-h-80 lg:h-[calc(100dvh-4.5rem)]"
              />
              {!wide && chosen ? (
                <Link
                  href={`/b/${chosen.id}`}
                  prefetch={false}
                  className="pressable squircle flex min-h-14 items-center gap-3 rounded-[var(--radius-lg)] bg-grouped-secondary px-4 py-3 shadow-card"
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-headline">{chosen.organization.name}</span>
                    <span className="truncate text-subheadline text-label-secondary tabular">
                      {chosen.name} · {t("waiting", { count: chosen.waiting })}
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
