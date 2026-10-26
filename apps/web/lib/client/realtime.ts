import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./supabase-public";

/**
 * Client Realtime Broadcast minimal (protocole Phoenix, vsn 1.0.0) pour les pages client :
 * quelques Ko au lieu de supabase-js. Une seule connexion par page, plusieurs canaux publics,
 * reconnexion automatique (réseau instable, mise en veille) et rappel `onJoin` pour recharger l'état.
 */
type Listener = { event: string; onMessage: (payload: unknown) => void; onJoin?: () => void };
export type RealtimeStatus = "connecting" | "live" | "offline";

const HEARTBEAT_MS = 25_000;
const BACKOFF_MS = [1_000, 2_000, 5_000, 10_000];

const topics = new Map<string, Set<Listener>>();
const joined = new Set<string>();
const statusListeners = new Set<(s: RealtimeStatus) => void>();
let socket: WebSocket | null = null;
let ref = 0;
let heartbeat: ReturnType<typeof setInterval> | null = null;
let retry: ReturnType<typeof setTimeout> | null = null;
let attempts = 0;
let status: RealtimeStatus = "connecting";
let watching = false;

function setStatus(s: RealtimeStatus) {
  status = s;
  statusListeners.forEach((l) => l(s));
}

function send(msg: Record<string, unknown>) {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(msg));
}

function join(topic: string) {
  const r = String(++ref);
  send({
    topic: `realtime:${topic}`,
    event: "phx_join",
    payload: { config: { broadcast: { self: false, ack: false }, presence: { key: "" }, private: false } },
    ref: r,
    join_ref: r,
  });
}

function scheduleReconnect() {
  if (retry || topics.size === 0) return;
  const delay = BACKOFF_MS[Math.min(attempts, BACKOFF_MS.length - 1)]!;
  attempts++;
  retry = setTimeout(() => {
    retry = null;
    connect();
  }, delay);
}

function connect() {
  if (typeof WebSocket === "undefined" || !SUPABASE_URL) return;
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;
  const url = `${SUPABASE_URL.replace(/^http/, "ws")}/realtime/v1/websocket?apikey=${encodeURIComponent(SUPABASE_ANON_KEY)}&vsn=1.0.0`;
  setStatus("connecting");
  const ws = new WebSocket(url);
  socket = ws;
  ws.onopen = () => {
    attempts = 0;
    joined.clear();
    topics.forEach((_, topic) => join(topic));
    heartbeat = setInterval(() => send({ topic: "phoenix", event: "heartbeat", payload: {}, ref: String(++ref) }), HEARTBEAT_MS);
  };
  ws.onmessage = (e) => {
    let msg: { topic?: string; event?: string; payload?: { status?: string; event?: string; payload?: unknown } };
    try {
      msg = JSON.parse(String(e.data));
    } catch {
      return;
    }
    const topic = msg.topic?.startsWith("realtime:") ? msg.topic.slice(9) : null;
    if (!topic) return;
    const listeners = topics.get(topic);
    if (!listeners) return;
    if (msg.event === "phx_reply" && msg.payload?.status === "ok" && !joined.has(topic)) {
      joined.add(topic);
      if (joined.size >= topics.size) setStatus("live");
      listeners.forEach((l) => l.onJoin?.());
    } else if (msg.event === "broadcast" && msg.payload) {
      listeners.forEach((l) => {
        if (l.event === msg.payload!.event) l.onMessage(msg.payload!.payload);
      });
    } else if (msg.event === "phx_error" || msg.event === "phx_close") {
      joined.delete(topic);
      setTimeout(() => topics.has(topic) && join(topic), 2_000);
    }
  };
  ws.onclose = () => {
    if (heartbeat) clearInterval(heartbeat);
    heartbeat = null;
    joined.clear();
    if (socket === ws) socket = null;
    if (topics.size) {
      setStatus("offline");
      scheduleReconnect();
    }
  };
  ws.onerror = () => ws.close();
}

function reconnectNow() {
  if (retry) clearTimeout(retry);
  retry = null;
  attempts = 0;
  connect();
}

function watchNetwork() {
  if (watching || typeof window === "undefined") return;
  watching = true;
  window.addEventListener("online", reconnectNow);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && topics.size) reconnectNow();
  });
}

/** Abonnement à un événement d'un canal public ; renvoie la fonction de désabonnement. */
export function subscribeBroadcast(topic: string, event: string, onMessage: (payload: unknown) => void, onJoin?: () => void): () => void {
  watchNetwork();
  const listener: Listener = { event, onMessage, onJoin };
  let set = topics.get(topic);
  if (!set) {
    set = new Set();
    topics.set(topic, set);
    if (socket?.readyState === WebSocket.OPEN) join(topic);
  } else if (joined.has(topic)) {
    onJoin?.();
  }
  set.add(listener);
  connect();
  return () => {
    set!.delete(listener);
    if (set!.size === 0) {
      topics.delete(topic);
      joined.delete(topic);
      send({ topic: `realtime:${topic}`, event: "phx_leave", payload: {}, ref: String(++ref) });
      if (topics.size === 0) socket?.close();
    }
  };
}

export function onRealtimeStatus(listener: (s: RealtimeStatus) => void): () => void {
  statusListeners.add(listener);
  listener(status);
  return () => statusListeners.delete(listener);
}
