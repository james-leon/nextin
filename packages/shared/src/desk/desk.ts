/**
 * Poste agent (M5) : logique pure partagée par le poste web et, plus tard, l'app native.
 * Copie locale de la file (snapshot), bouton principal qui change de rôle (§12.1) et
 * application optimiste des commandes hors ligne (§5.4), rejouées ensuite dans l'ordre.
 */
import type { PriorityReason, TicketStatus } from "../queue/live";

export type DeskTicket = {
  id: string;
  code: string;
  status: TicketStatus;
  serviceId: string;
  priorityLevel: number;
  priorityReason: PriorityReason | null;
  sortKey: number;
  number: number;
  preferredCounterId: string | null;
  source: "qr" | "short_code" | "remote" | "reception";
  createdAt: string;
  calledAt: string | null;
  servingStartedAt: string | null;
  recallCount: number;
};

export type CounterStatus = "open" | "paused" | "closed";

export type DeskSnapshot = {
  counterId: string;
  counterStatus: CounterStatus;
  current: DeskTicket | null;
  /** File du poste, dans l'ordre de passage. */
  waiting: DeskTicket[];
  servedToday: number;
  /** Somme des durées de service du jour (admission → fin), en secondes. */
  servedSeconds: number;
  syncedAt: string;
};

export type DeskOpKind = "call" | "admit" | "finish" | "recall" | "no_show" | "transfer";

/** Commande du poste, identifiée pour être rejouée une seule fois (`client_ops`). */
export type DeskOp = {
  id: string;
  kind: DeskOpKind;
  ticketId: string | null;
  /** Code affiché (bannières de conflit). */
  code: string | null;
  /** Service cible d'une réorientation. */
  targetServiceId?: string;
  at: string;
};

/** Ordre de passage du poste : attitré à ce poste d'abord, puis priorité, ancienneté, numéro (miroir de `pick_next_ticket`). */
export function orderWaiting(tickets: readonly DeskTicket[], counterId: string): DeskTicket[] {
  return [...tickets].sort(
    (a, b) =>
      Number(b.preferredCounterId === counterId) - Number(a.preferredCounterId === counterId) ||
      b.priorityLevel - a.priorityLevel ||
      a.sortKey - b.sortKey ||
      a.number - b.number,
  );
}

export type PrimaryAction = "open" | "resume" | "alert" | "admit" | "finish_and_alert" | "none";

/** Le bouton principal change de rôle : « Alerter le suivant » → « Admettre » → « Terminer et alerter le suivant ». */
export function primaryAction(s: Pick<DeskSnapshot, "counterStatus" | "current" | "waiting">): PrimaryAction {
  if (s.counterStatus === "closed") return "open";
  if (s.counterStatus === "paused") return "resume";
  if (s.current?.status === "called") return "admit";
  if (s.current?.status === "serving") return "finish_and_alert";
  return s.waiting.length > 0 ? "alert" : "none";
}

function servingSeconds(t: DeskTicket, at: string): number {
  return t.servingStartedAt ? Math.max(0, (new Date(at).getTime() - new Date(t.servingStartedAt).getTime()) / 1000) : 0;
}

/**
 * Effet local d'une commande (affichage immédiat, en ligne comme hors ligne).
 * Pour un appel, le ticket choisi est le premier de la file locale : l'opération retient son identifiant.
 */
export function applyOp(s: DeskSnapshot, op: DeskOp): DeskSnapshot {
  const cur = s.current;
  switch (op.kind) {
    case "call": {
      if (cur || s.counterStatus !== "open") return s;
      const next = s.waiting.find((t) => t.id === op.ticketId) ?? null;
      if (!next) return s;
      return {
        ...s,
        current: { ...next, status: "called", calledAt: op.at },
        waiting: s.waiting.filter((t) => t.id !== next.id),
      };
    }
    case "admit":
      return cur?.status === "called" && cur.id === op.ticketId
        ? { ...s, current: { ...cur, status: "serving", servingStartedAt: op.at } }
        : s;
    case "finish":
      return cur?.status === "serving" && cur.id === op.ticketId
        ? { ...s, current: null, servedToday: s.servedToday + 1, servedSeconds: s.servedSeconds + servingSeconds(cur, op.at) }
        : s;
    case "recall":
      return cur?.status === "called" && cur.id === op.ticketId ? { ...s, current: { ...cur, recallCount: cur.recallCount + 1 } } : s;
    case "no_show":
      return cur?.status === "called" && cur.id === op.ticketId ? { ...s, current: null } : s;
    case "transfer":
      return cur && cur.id === op.ticketId ? { ...s, current: null } : { ...s, waiting: s.waiting.filter((t) => t.id !== op.ticketId) };
  }
}

/** Prochaine commande d'appel : premier ticket de la file locale (null si vide). */
export function nextCallTarget(s: DeskSnapshot): DeskTicket | null {
  return s.waiting[0] ?? null;
}

/** Durée moyenne de service du jour (secondes), 0 sans passage. */
export function averageServiceSeconds(s: Pick<DeskSnapshot, "servedToday" | "servedSeconds">): number {
  return s.servedToday > 0 ? Math.round(s.servedSeconds / s.servedToday) : 0;
}

/** Réapplique les commandes en attente sur une copie fraîche du serveur (retour du réseau, rechargement). */
export function replayPending(s: DeskSnapshot, pending: readonly DeskOp[]): DeskSnapshot {
  return pending.reduce(applyOp, s);
}
