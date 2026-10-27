"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { applyOp, nextCallTarget, replayPending, type DeskOp, type DeskOpKind, type DeskSnapshot } from "@nextin/shared/desk";
import { staffTopic } from "@nextin/shared/queue/realtime";
import { runDeskOp } from "@/lib/desk/commands";
import { loadDeskSnapshot } from "@/lib/desk/snapshot";
import { storeGet, storeSet } from "@/lib/desk/store";
import { uuidV4 } from "@/lib/desk/uuid";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type DeskCounter = { id: string; branchId: string; serviceIds: string[]; timeZone: string };
export type DeskNotice =
  | { kind: "conflict"; requested: string; called: string | null }
  | { kind: "ignored"; action: DeskOpKind; code: string }
  | { kind: "error"; code: string };

const RETRY_MS = 5_000;
const POLL_MS = 15_000;

/**
 * État du poste agent (§5.4) : copie de la file gardée en IndexedDB, commandes appliquées tout de suite
 * à l'écran et envoyées au serveur ; hors ligne, elles s'accumulent puis sont rejouées dans l'ordre
 * (idempotentes grâce à `client_op_id`). Conflits signalés par une bannière.
 */
export function useDesk(counter: DeskCounter, initial: DeskSnapshot) {
  const supabase = getSupabaseBrowserClient();
  const [server, setServer] = useState(initial);
  const [pending, setPending] = useState<DeskOp[]>([]);
  const [online, setOnline] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notices, setNotices] = useState<DeskNotice[]>([]);
  const pendingRef = useRef<DeskOp[]>([]);
  const flushing = useRef(false);

  const view = useMemo(() => replayPending(server, pending), [server, pending]);

  const savePending = useCallback(
    (ops: DeskOp[]) => {
      pendingRef.current = ops;
      setPending(ops);
      void storeSet(`outbox:${counter.id}`, ops);
    },
    [counter.id],
  );

  const refresh = useCallback(async () => {
    try {
      const snap = await loadDeskSnapshot(supabase, counter);
      setServer(snap);
      setOnline(true);
      void storeSet(`snapshot:${counter.id}`, snap);
    } catch {
      setOnline(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [counter.id]);

  /** Rejoue les commandes en attente, dans l'ordre ; s'arrête à la première coupure réseau. */
  const flush = useCallback(async () => {
    if (flushing.current || pendingRef.current.length === 0) return;
    flushing.current = true;
    try {
      while (pendingRef.current.length > 0) {
        const op = pendingRef.current[0]!;
        const outcome = await runDeskOp(supabase, counter.id, op);
        if (!outcome.ok && outcome.offline) {
          setOnline(false);
          return;
        }
        setOnline(true);
        if (outcome.ok && op.kind === "call" && outcome.result?.conflict === true) {
          setNotices((n) => [
            ...n,
            { kind: "conflict", requested: String(outcome.result!.requested_code ?? op.code ?? ""), called: (outcome.result!.display_code as string) ?? null },
          ]);
        }
        if (!outcome.ok) setNotices((n) => [...n, { kind: "ignored", action: op.kind, code: op.code ?? "" }]);
        savePending(pendingRef.current.slice(1));
      }
      await refresh();
    } finally {
      flushing.current = false;
    }
  }, [counter.id, refresh, savePending, supabase]);

  // Commandes restées en attente (page rechargée hors ligne) puis synchronisation.
  useEffect(() => {
    let alive = true;
    (async () => {
      const saved = (await storeGet<DeskOp[]>(`outbox:${counter.id}`)) ?? [];
      if (!alive) return;
      if (saved.length) {
        pendingRef.current = saved;
        setPending(saved);
        await flush();
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [counter.id]);

  // Temps réel (canal privé du personnel), filet de sécurité par interrogation, retour du réseau.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const debounced = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => (pendingRef.current.length ? void flush() : void refresh()), 250);
    };
    const channel = supabase
      .channel(staffTopic(counter.branchId), { config: { private: true } })
      .on("broadcast", { event: "board" }, debounced)
      .subscribe();
    const poll = setInterval(() => (pendingRef.current.length ? void flush() : void refresh()), POLL_MS);
    const retry = setInterval(() => pendingRef.current.length && void flush(), RETRY_MS);
    const onOnline = () => void flush().then(refresh);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
      clearInterval(poll);
      clearInterval(retry);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [counter.branchId, flush, refresh, supabase]);

  /**
   * Commande du poste. En ligne : envoyée directement (le serveur choisit le ticket à alerter).
   * Hors ligne, ou s'il reste des commandes en attente : appliquée localement et mise en file.
   */
  const perform = useCallback(
    async (kind: DeskOpKind, opts: { ticketId?: string | null; code?: string | null; targetServiceId?: string; finishCurrent?: boolean } = {}) => {
      const at = new Date().toISOString();
      const ops: DeskOp[] = [];
      let local = replayPending(server, pendingRef.current);
      if (kind === "call" && opts.finishCurrent && local.current) {
        ops.push({ id: uuidV4(), kind: "finish", ticketId: local.current.id, code: local.current.code, at });
        local = applyOp(local, ops[0]!);
      }
      const target = kind === "call" ? nextCallTarget(local) : null;
      ops.push({
        id: uuidV4(),
        kind,
        ticketId: kind === "call" ? (target?.id ?? null) : (opts.ticketId ?? null),
        code: kind === "call" ? (target?.code ?? null) : (opts.code ?? null),
        targetServiceId: opts.targetServiceId,
        at,
      });

      if (online && pendingRef.current.length === 0) {
        setBusy(true);
        try {
          // En ligne, un seul appel au serveur : « Terminer et alerter » = call_next(finish_current).
          const single: DeskOp = kind === "call" ? { ...ops[ops.length - 1]!, ticketId: null } : ops[0]!;
          const outcome = await runDeskOp(supabase, counter.id, single, !!opts.finishCurrent);
          if (outcome.ok) {
            await refresh();
            return;
          }
          if (!outcome.offline) {
            setNotices((n) => [...n, { kind: "error", code: outcome.code }]);
            await refresh();
            return;
          }
          setOnline(false);
        } finally {
          setBusy(false);
        }
      }
      if (kind === "call" && !target) return;
      savePending([...pendingRef.current, ...ops]);
      if (online) void flush();
    },
    [counter.id, flush, online, refresh, savePending, server, supabase],
  );

  /** Ouverture, pause, fermeture : commandes en ligne uniquement (état partagé du poste). */
  const setStatus = useCallback(
    async (status: "open" | "paused" | "closed") => {
      setBusy(true);
      try {
        const fn = status === "open" ? "open_counter" : status === "paused" ? "pause_counter" : "close_counter";
        const { error } = await supabase.rpc(fn, { p_counter: counter.id });
        if (error) setNotices((n) => [...n, { kind: "error", code: error.message ? error.message : "network" }]);
        await refresh();
      } finally {
        setBusy(false);
      }
    },
    [counter.id, refresh, supabase],
  );

  const dismiss = useCallback((index: number) => setNotices((n) => n.filter((_, i) => i !== index)), []);

  return { view, pending, online, busy, notices, perform, setStatus, dismiss, refresh };
}
