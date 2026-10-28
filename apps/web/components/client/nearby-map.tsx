"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LocateFixed, Minus, Plus } from "lucide-react";
import { formatDistance } from "@nextin/shared/remote";
import { useLiteLocale, useLiteT } from "@/lib/i18n/lite";
import type { GeoPosition } from "@/lib/client/geolocation";
import type { NearbyBranch } from "@/lib/client/types";
import { cn } from "@/lib/cn";

const TILE = 256;
const MIN_ZOOM = 3;
const MAX_ZOOM = 17;

/** Projection Web Mercator : coordonnées monde (pixels) au niveau de zoom `z`. */
function project(lat: number, lng: number, z: number) {
  const scale = TILE * 2 ** z;
  const s = Math.sin((Math.max(-85, Math.min(85, lat)) * Math.PI) / 180);
  return { x: ((lng + 180) / 360) * scale, y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * scale };
}

/** Niveau de zoom qui montre tous les points avec une marge. */
function fitZoom(points: GeoPosition[], width: number, height: number): number {
  if (points.length < 2) return 14;
  for (let z = MAX_ZOOM - 2; z >= MIN_ZOOM; z--) {
    const p = points.map((q) => project(q.lat, q.lng, z));
    const w = Math.max(...p.map((q) => q.x)) - Math.min(...p.map((q) => q.x));
    const h = Math.max(...p.map((q) => q.y)) - Math.min(...p.map((q) => q.y));
    if (w <= width - 96 && h <= height - 112) return z;
  }
  return MIN_ZOOM;
}

/**
 * Carte des établissements, sans bibliothèque : projection Web Mercator, déplacement au doigt ou à la souris,
 * boutons de zoom. Fond de carte seulement si un fournisseur de tuiles est configuré
 * (`NEXT_PUBLIC_MAP_TILES_URL`, modèle `{z}/{x}/{y}`) ; sinon plan schématique avec cercles de distance.
 */
export function NearbyMap({
  branches,
  position,
  selected,
  onSelect,
  tilesUrl,
  attribution,
  className,
}: {
  branches: NearbyBranch[];
  position: GeoPosition | null;
  selected: string | null;
  onSelect: (id: string) => void;
  tilesUrl: string | null;
  attribution: string | null;
  className?: string;
}) {
  const t = useLiteT("client.nearby");
  const locale = useLiteLocale();
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const points = useMemo(
    () =>
      branches
        .filter((b) => b.latitude != null && b.longitude != null)
        .map((b) => ({ id: b.id, lat: b.latitude!, lng: b.longitude!, branch: b })),
    [branches],
  );
  const all = useMemo(() => [...points, ...(position ? [position] : [])], [points, position]);
  // Vue calculée sur les résultats ; l'utilisateur la déplace ensuite (décalage et zoom relatifs).
  const fitted = useMemo(() => {
    if (!all.length || !size.width) return null;
    const z = fitZoom(all, size.width, size.height);
    const p = all.map((q) => project(q.lat, q.lng, z));
    const cx = (Math.min(...p.map((q) => q.x)) + Math.max(...p.map((q) => q.x))) / 2;
    const cy = (Math.min(...p.map((q) => q.y)) + Math.max(...p.map((q) => q.y))) / 2;
    return { z, cx, cy };
  }, [all, size]);
  const [view, setView] = useState<{ key: string; dz: number; dx: number; dy: number }>({ key: "", dz: 0, dy: 0, dx: 0 });
  const fitKey = fitted ? `${fitted.z}:${Math.round(fitted.cx)}:${Math.round(fitted.cy)}` : "";
  // Nouveaux résultats : la vue repart de l'ajustement (décalage ignoré s'il appartient à une autre vue).
  const own = view.key === fitKey ? view : { key: fitKey, dz: 0, dx: 0, dy: 0 };
  const drag = useRef<{ x: number; y: number; dx: number; dy: number } | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const r = entry!.contentRect;
      setSize({ width: Math.round(r.width), height: Math.round(r.height) });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const z = fitted ? Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, fitted.z + own.dz)) : 14;
  const factor = fitted ? 2 ** (z - fitted.z) : 1;
  const center = fitted ? { x: fitted.cx * factor - own.dx, y: fitted.cy * factor - own.dy } : { x: 0, y: 0 };
  const toScreen = (lat: number, lng: number) => {
    const p = project(lat, lng, z);
    return { left: p.x - center.x + size.width / 2, top: p.y - center.y + size.height / 2 };
  };

  function zoom(delta: number) {
    if (!fitted) return;
    const nz = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z + delta));
    const k = 2 ** (nz - z);
    // Zoom autour du centre de l'écran : le décalage suit l'échelle.
    setView({ key: fitKey, dz: nz - fitted.z, dx: own.dx * k, dy: own.dy * k });
  }

  const tiles = useMemo(() => {
    if (!tilesUrl || !fitted || !size.width) return [];
    const n = 2 ** z;
    const x0 = Math.floor((center.x - size.width / 2) / TILE);
    const x1 = Math.floor((center.x + size.width / 2) / TILE);
    const y0 = Math.max(0, Math.floor((center.y - size.height / 2) / TILE));
    const y1 = Math.min(n - 1, Math.floor((center.y + size.height / 2) / TILE));
    const out: { key: string; src: string; left: number; top: number }[] = [];
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        const wx = ((x % n) + n) % n;
        out.push({
          key: `${z}/${x}/${y}`,
          src: tilesUrl.replace("{z}", String(z)).replace("{x}", String(wx)).replace("{y}", String(y)),
          left: x * TILE - center.x + size.width / 2,
          top: y * TILE - center.y + size.height / 2,
        });
      }
    }
    return out;
  }, [tilesUrl, fitted, z, center.x, center.y, size]);

  // Cercles de distance autour du client (plan schématique) : 1, 2, 5 km… selon l'échelle.
  const rings = useMemo(() => {
    if (!position || tilesUrl || !fitted) return [];
    const metersPerPixel = (156_543.03 * Math.cos((position.lat * Math.PI) / 180)) / 2 ** z;
    return [500, 1000, 2000, 5000, 10_000, 20_000, 50_000]
      .map((m) => ({ m, r: m / metersPerPixel }))
      .filter((c) => c.r > 36 && c.r < Math.max(size.width, size.height))
      .slice(0, 3);
  }, [position, tilesUrl, fitted, z, size]);

  const me = position && fitted ? toScreen(position.lat, position.lng) : null;

  return (
    <div
      ref={box}
      role="region"
      aria-label={t("mapLabel")}
      className={cn(
        "squircle relative touch-none overflow-hidden rounded-[var(--radius-lg)] bg-grouped-secondary select-none",
        !tilesUrl && "map-plan",
        className,
      )}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest("button,a")) return;
        drag.current = { x: e.clientX, y: e.clientY, dx: own.dx, dy: own.dy };
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        setView({ key: fitKey, dz: own.dz, dx: d.dx + e.clientX - d.x, dy: d.dy + e.clientY - d.y });
      }}
      onPointerUp={() => (drag.current = null)}
      onPointerCancel={() => (drag.current = null)}
    >
      {tiles.map((tile) => (
        // Tuiles du fournisseur configuré : décoratives, la liste porte l'information.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={tile.key}
          src={tile.src}
          alt=""
          aria-hidden
          draggable={false}
          loading="lazy"
          className="pointer-events-none absolute size-64 max-w-none dark:brightness-[0.7] dark:contrast-125 dark:invert dark:hue-rotate-180"
          style={{ left: tile.left, top: tile.top }}
        />
      ))}

      {me
        ? rings.map((c) => (
            <span key={c.m} aria-hidden className="pointer-events-none absolute">
              <span
                className="absolute rounded-full border border-dashed border-separator-opaque"
                style={{ left: me.left - c.r, top: me.top - c.r, width: c.r * 2, height: c.r * 2 }}
              />
              <span
                className="absolute -translate-x-1/2 rounded-full bg-grouped-secondary px-1.5 text-caption text-label-secondary tabular"
                style={{ left: me.left, top: me.top - c.r - 9 }}
              >
                {formatDistance(c.m, locale)}
              </span>
            </span>
          ))
        : null}

      {me ? (
        <span
          role="img"
          aria-label={t("you")}
          className="absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-accent shadow-[0_0_0_8px_var(--accent-tint)]"
          style={{ left: me.left, top: me.top }}
        />
      ) : null}

      {fitted
        ? points.map((p) => {
            const at = toScreen(p.lat, p.lng);
            const isSelected = selected === p.id;
            const b = p.branch;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onSelect(p.id)}
                aria-pressed={isSelected}
                aria-label={`${b.organization.name} · ${b.name} · ${b.is_open ? t("open") : t("closed")} · ${t("waiting", { count: b.waiting })}`}
                className={cn(
                  "pressable absolute flex min-h-11 min-w-11 -translate-x-1/2 -translate-y-full items-end justify-center pb-1 transition-transform duration-200 ease-[var(--ease-spring)]",
                  isSelected ? "z-20 scale-110" : "z-10",
                )}
                style={{ left: at.left, top: at.top }}
              >
                <span
                  className={cn(
                    "squircle flex h-8 min-w-8 items-center justify-center gap-1 rounded-full border-2 border-white px-2 text-footnote font-semibold text-white shadow-floating tabular",
                    b.is_open ? (isSelected ? "bg-navy" : "bg-accent") : "bg-label-secondary",
                  )}
                >
                  {b.is_open ? b.waiting : "–"}
                </span>
              </button>
            );
          })
        : null}

      <div className="absolute top-3 right-3 flex flex-col overflow-hidden rounded-[10px] bg-bar shadow-card material-blur">
        <button type="button" aria-label={t("zoomIn")} onClick={() => zoom(1)} className="flex size-11 items-center justify-center text-label hairline-b">
          <Plus aria-hidden className="size-5" />
        </button>
        <button type="button" aria-label={t("zoomOut")} onClick={() => zoom(-1)} className="flex size-11 items-center justify-center text-label hairline-b">
          <Minus aria-hidden className="size-5" />
        </button>
        <button
          type="button"
          aria-label={t("recenter")}
          onClick={() => setView({ key: fitKey, dz: 0, dx: 0, dy: 0 })}
          className="flex size-11 items-center justify-center text-accent-text"
        >
          <LocateFixed aria-hidden className="size-5" />
        </button>
      </div>

      <p className="absolute bottom-2 left-3 max-w-[70%] truncate rounded-full bg-bar px-2 text-caption text-label-secondary material-blur">
        {tilesUrl ? attribution : t("plan")}
      </p>
    </div>
  );
}
