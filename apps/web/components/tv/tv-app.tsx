"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { BranchBoard } from "@nextin/shared/queue/live";
import { subscribeBoard } from "@/lib/client/board-feed";
import { onRealtimeStatus } from "@/lib/client/realtime";
import { SUPABASE_URL } from "@/lib/client/supabase-public";
import { Announcer } from "@/lib/tv/announcer";
import { Pause } from "lucide-react";
import type { BoardCall } from "@nextin/shared/queue/live";
import { useLiteT } from "@/lib/i18n/lite";
import { TV_UNIT_STYLE, TvBoard, TvSoundGate, useServiceName } from "./tv-board";
import { TV_FLASH_MS, TvFlash } from "./tv-flash";
import { TvPairing } from "./tv-pairing";
import { tvAdKey } from "@/lib/client/ad-events";
import type { TvSession } from "./types";

const TOKEN_KEY = "nextin-tv-token";
const SESSION_KEY = "nextin-tv-session";
const SESSION_REFRESH_MS = 60_000;
export const TV_APP_VERSION = "v2-lot5b";
/** Écran révoqué pendant cette visite : message rouge sur l'appairage (maquette v2 23). */
const REVOKED_KEY = "nextin-tv-revoked";

// Jeton d'appareil (localStorage) : seule son empreinte est connue du serveur.
const tokenListeners = new Set<() => void>();
const tokenStore = {
  get: (): string | null => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (value: string | null, revoked = false) => {
    try {
      if (value) {
        localStorage.setItem(TOKEN_KEY, value);
        sessionStorage.removeItem(REVOKED_KEY);
      } else {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(SESSION_KEY);
        if (revoked) sessionStorage.setItem(REVOKED_KEY, "1");
      }
    } catch {
      // Stockage indisponible : l'appairage vaut pour la session du navigateur.
    }
    tokenListeners.forEach((l) => l());
  },
  subscribe: (l: () => void) => {
    tokenListeners.add(l);
    return () => tokenListeners.delete(l);
  },
};

function wasRevoked(): boolean {
  try {
    return sessionStorage.getItem(REVOKED_KEY) === "1";
  } catch {
    return false;
  }
}

function cachedSession(): TvSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as TvSession) : null;
  } catch {
    return null;
  }
}

/**
 * Écran TV (/tv) : appairage par code, puis affichage en temps réel et annonces vocales.
 * Sans réseau, le dernier état reste affiché et l'écran se reconnecte seul ; un écran révoqué
 * revient à l'appairage.
 */
export function TvApp() {
  const token = useSyncExternalStore(tokenStore.subscribe, tokenStore.get, () => undefined);
  const [session, setSession] = useState<TvSession | null>(null);
  const [board, setBoard] = useState<BranchBoard | null>(null);
  const [offline, setOffline] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  // Flash d'appel : un appel à la fois, 4 secondes chacun, dans l'ordre d'arrivée.
  const [flashes, setFlashes] = useState<BoardCall[]>([]);
  const announcer = useRef<Announcer | null>(null);
  const announced = useRef<Set<string> | null>(null);

  // Session : au démarrage puis chaque minute (révocation, services, réglages).
  useEffect(() => {
    if (!token) return;
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/tv/session", { headers: { Authorization: `Bearer ${token}`, "x-app-version": TV_APP_VERSION }, cache: "no-store" });
        if (res.status === 401) return tokenStore.set(null, true);
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as { session: TvSession };
        if (!alive) return;
        setSession(body.session);
        setBoard((b) => b ?? body.session.board);
        try {
          localStorage.setItem(SESSION_KEY, JSON.stringify(body.session));
        } catch {
          // Pas de copie locale : l'écran attendra le réseau au prochain démarrage.
        }
      } catch {
        if (!alive) return;
        setOffline(true);
        setSession((s) => s ?? cachedSession());
        setBoard((b) => b ?? cachedSession()?.board ?? null);
      }
    };
    void load();
    const id = setInterval(load, SESSION_REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [token]);

  const branchId = session?.branch.id;
  useEffect(() => {
    if (!branchId) return;
    const off = subscribeBoard(branchId, setBoard);
    const offStatus = onRealtimeStatus((s) => setOffline(s === "offline"));
    return () => {
      off();
      offStatus();
    };
  }, [branchId]);

  // Lecteur d'annonces, réglé selon l'agence.
  useEffect(() => {
    if (!session) return;
    announcer.current ??= new Announcer(SUPABASE_URL ? `${SUPABASE_URL}/storage/v1/object/public/voices` : null);
    const a = session.announcements;
    announcer.current.configure({
      languages: a.languages.length ? a.languages : ["fr"],
      volume: a.volume,
      repeatCount: a.repeat_count,
      chimeEnabled: a.chime_enabled,
      quietHours: a.quiet_hours,
      timeZone: session.branch.timezone,
      voice: session.voice_enabled !== false,
    });
    void announcer.current.loadManifest();
    // Certains navigateurs d'écran autorisent le son sans geste.
    void announcer.current.unlock().then((ok) => ok && setSoundOn(true));
  }, [session]);

  // Annonce chaque nouvel appel (et chaque rappel) des services de l'écran, jamais l'état initial.
  useEffect(() => {
    if (!board || !session) return;
    const calls = board.calls.filter(
      (c) => c.status === "called" && (session.service_ids.length === 0 || session.service_ids.includes(c.service_id)),
    );
    const keys = calls.map((c) => `${c.code}|${c.called_at}|${c.recall_count}`);
    if (!announced.current) {
      announced.current = new Set(keys);
      return;
    }
    const fresh = calls.filter((_, i) => !announced.current!.has(keys[i]!)).reverse();
    fresh.forEach((c) => announcer.current?.announce({ code: c.code, counterKind: c.counter_kind, counterNumber: c.counter_number, counterLabel: c.counter_label }));
    keys.forEach((k) => announced.current!.add(k));
    if (fresh.length) setFlashes((f) => [...f, ...fresh]);
  }, [board, session]);

  const flash = flashes[0] ?? null;
  useEffect(() => {
    if (!flash) return;
    const id = setTimeout(() => setFlashes((f) => f.slice(1)), TV_FLASH_MS);
    return () => clearTimeout(id);
  }, [flash]);

  // Écran toujours allumé (si le navigateur le permet).
  useEffect(() => {
    if (!session || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    const acquire = () =>
      navigator.wakeLock
        .request("screen")
        .then((l) => (lock = l))
        .catch(() => undefined);
    void acquire();
    const onVisible = () => document.visibilityState === "visible" && void acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release();
    };
  }, [session]);

  const enableSound = useCallback(async () => {
    announcer.current ??= new Announcer(SUPABASE_URL ? `${SUPABASE_URL}/storage/v1/object/public/voices` : null);
    setSoundOn(await announcer.current.unlock());
  }, []);

  if (token === undefined) return <main className="min-h-dvh bg-grouped" />;
  if (token === null) return <TvPairing onPaired={onPaired} revoked={wasRevoked()} />;
  if (session?.unavailable) return <TvUnavailable />;
  if (!session || !board) return <main className="min-h-dvh bg-grouped" aria-busy />;
  return (
    <>
      <TvBoard session={session} board={board} offline={offline} adKey={tvAdKey(token)} />
      {flash ? <FlashFor key={`${flash.code}|${flash.called_at}|${flash.recall_count}`} call={flash} board={board} /> : null}
      <TvSoundGate soundOn={soundOn} onEnable={enableSound} />
    </>
  );
}

const onPaired = (deviceToken: string) => tokenStore.set(deviceToken);

function FlashFor({ call, board }: { call: BoardCall; board: NonNullable<TvSession["board"]> }) {
  const serviceName = useServiceName(board);
  return <TvFlash call={call} service={serviceName(call.service_id)} />;
}

/** Établissement suspendu ou en lecture seule (maquette v2 23) : message neutre, jamais le motif ; l'écran reste appairé. */
function TvUnavailable() {
  const t = useLiteT("tv");
  return (
    <main style={TV_UNIT_STYLE} className="flex min-h-dvh flex-col items-center justify-center u-gap-1_4 bg-grouped u-p-4 text-center leading-snug text-label">
      <span aria-hidden className="grid u-size-9 place-items-center u-rounded-2_4 bg-grouped-secondary">
        <Pause className="u-size-4_6 stroke-[1.8] text-label-secondary" />
      </span>
      <h1 className="u-text-3_6 font-bold text-balance">{t("unavailableTitle")}</h1>
      <p className="u-text-2 text-label-secondary">{t("unavailableBody")}</p>
    </main>
  );
}
