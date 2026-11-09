import { describe, expect, it } from "vitest";
import { applyOp, averageServiceSeconds, orderWaiting, primaryAction, replayPending, type DeskOp, type DeskSnapshot, type DeskTicket } from "./desk";

const ticket = (n: number, extra: Partial<DeskTicket> = {}): DeskTicket => ({
  id: `t${n}`,
  code: `C-00${n}`,
  status: "waiting",
  serviceId: "s1",
  priorityLevel: 0,
  priorityReason: null,
  sortKey: n * 1000,
  number: n,
  preferredCounterId: null,
  source: "qr",
  createdAt: "2026-10-27T08:00:00.000Z",
  calledAt: null,
  servingStartedAt: null,
  recallCount: 0,
  ...extra,
});

const snap = (extra: Partial<DeskSnapshot> = {}): DeskSnapshot => ({
  counterId: "c1",
  counterStatus: "open",
  current: null,
  waiting: [ticket(1), ticket(2)],
  servedToday: 0,
  servedSeconds: 0,
  syncedAt: "2026-10-27T08:00:00.000Z",
  ...extra,
});

const op = (kind: DeskOp["kind"], ticketId: string, at = "2026-10-27T09:00:00.000Z"): DeskOp => ({ id: `${kind}-${ticketId}`, kind, ticketId, code: null, at });

describe("orderWaiting", () => {
  it("attitré au poste, puis priorité, ancienneté et numéro", () => {
    const list = orderWaiting(
      [ticket(1), ticket(2, { priorityLevel: 1 }), ticket(3, { preferredCounterId: "c1" }), ticket(4, { sortKey: 500 })],
      "c1",
    );
    expect(list.map((t) => t.id)).toEqual(["t3", "t2", "t4", "t1"]);
  });
});

describe("primaryAction", () => {
  it("le bouton principal change de rôle", () => {
    expect(primaryAction(snap({ counterStatus: "closed" }))).toBe("open");
    expect(primaryAction(snap({ counterStatus: "paused" }))).toBe("resume");
    expect(primaryAction(snap())).toBe("alert");
    expect(primaryAction(snap({ waiting: [] }))).toBe("none");
    expect(primaryAction(snap({ current: ticket(1, { status: "called" }) }))).toBe("admit");
    expect(primaryAction(snap({ current: ticket(1, { status: "serving" }) }))).toBe("finish_and_alert");
  });
});

describe("applyOp (hors ligne)", () => {
  it("appel en deux temps : alerter, admettre (chrono), terminer", () => {
    let s = applyOp(snap(), op("call", "t1"));
    expect(s.current).toMatchObject({ id: "t1", status: "called", servingStartedAt: null });
    expect(s.waiting.map((t) => t.id)).toEqual(["t2"]);
    s = applyOp(s, op("admit", "t1", "2026-10-27T09:01:00.000Z"));
    expect(s.current).toMatchObject({ status: "serving", servingStartedAt: "2026-10-27T09:01:00.000Z" });
    s = applyOp(s, op("finish", "t1", "2026-10-27T09:07:00.000Z"));
    expect(s.current).toBeNull();
    expect(s.servedToday).toBe(1);
    expect(averageServiceSeconds(s)).toBe(360);
  });

  it("rappel, absent et transfert", () => {
    let s = applyOp(snap(), op("call", "t1"));
    s = applyOp(s, op("recall", "t1"));
    expect(s.current?.recallCount).toBe(1);
    expect(applyOp(s, op("no_show", "t1")).current).toBeNull();
    expect(applyOp(s, op("transfer", "t1")).current).toBeNull();
    expect(applyOp(snap(), op("transfer", "t2")).waiting.map((t) => t.id)).toEqual(["t1"]);
  });

  it("ignore une commande incohérente (jamais d'état impossible)", () => {
    const s = snap();
    expect(applyOp(s, op("admit", "t1"))).toBe(s);
    expect(applyOp(snap({ current: ticket(9, { status: "called" }) }), op("call", "t1")).current?.id).toBe("t9");
    expect(applyOp(snap({ counterStatus: "paused" }), op("call", "t1")).current).toBeNull();
  });

  it("rejoue les commandes en attente sur une copie fraîche", () => {
    const pending = [op("call", "t2"), op("admit", "t2")];
    const s = replayPending(snap({ waiting: [ticket(2), ticket(3)] }), pending);
    expect(s.current).toMatchObject({ id: "t2", status: "serving" });
    expect(s.waiting.map((t) => t.id)).toEqual(["t3"]);
  });
});
