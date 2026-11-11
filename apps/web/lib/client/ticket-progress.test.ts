import { describe, expect, it } from "vitest";
import type { BranchBoard } from "@nextin/shared/queue/live";
import { PROGRESS_NEXT, PROGRESS_START, queueProgress, ticketAvailability, waitingProgress } from "./ticket-progress";
import type { TicketView } from "./types";

const view = {
  display_code: "C-047",
  status: "waiting",
  service: { id: "s1" },
  position: 5,
  wait_seconds: 900,
} as unknown as TicketView;

const board = (waiting: string[]): BranchBoard => ({
  branch_id: "b1",
  generated_at: "2026-10-30T08:00:00.000Z",
  services: [
    {
      id: "s1",
      prefix: "C",
      name: "Consultation",
      name_en: null,
      color: "#1A6BB5",
      open: true,
      waiting,
      counters: [{ counter_id: "c1", duration_seconds: 300, busy_remaining_seconds: 0 }],
      wait_seconds: 0,
    },
  ],
  calls: [],
});

describe("waitingProgress", () => {
  it("sans tableau, reprend la position et l'attente du ticket", () => {
    const p = waitingProgress(view, null, 0);
    expect(p).toMatchObject({ ahead: 4, waitSeconds: 900, minutes: 15, imminent: false, maxAhead: 4 });
  });

  it("recalcule depuis le tableau diffusé et fait avancer la barre", () => {
    const now = new Date("2026-10-30T08:00:00.000Z");
    const first = waitingProgress(view, board(["C-045", "C-046", "C-047"]), 4, now);
    expect(first).toMatchObject({ ahead: 2, waitSeconds: 600, minutes: 10, maxAhead: 4 });
    const next = waitingProgress(view, board(["C-047"]), 4, now);
    expect(next).toMatchObject({ ahead: 0, imminent: true });
    expect(next.progress).toBeGreaterThan(first.progress);
    expect(next.progress).toBeLessThan(1);
  });

  it("n'annonce jamais moins que le retour prévu d'un praticien en retard", () => {
    const now = new Date("2026-10-30T08:00:00.000Z");
    const late = { ...view, practitioner_late_until: "2026-10-30T08:40:00.000Z" } as TicketView;
    const p = waitingProgress(late, board(["C-047"]), 0, now);
    expect(p).toMatchObject({ waitSeconds: 2400, minutes: 40, imminent: false });
  });
});

describe("queueProgress", () => {
  it("personne devant, même si personne n'a jamais été devant : barre presque pleine", () => {
    expect(queueProgress(0, 0)).toBe(PROGRESS_NEXT);
    expect(queueProgress(0, 0)).toBeGreaterThanOrEqual(0.9);
    expect(queueProgress(0, 6)).toBe(PROGRESS_NEXT);
  });

  it("au plus fort de la file : barre au départ, jamais vide", () => {
    expect(queueProgress(5, 5)).toBe(PROGRESS_START);
    expect(queueProgress(1, 1)).toBe(PROGRESS_START);
    expect(PROGRESS_START).toBeGreaterThan(0);
  });

  it("avance à chaque place gagnée, sans jamais atteindre la fin avant l'appel", () => {
    const steps = [4, 3, 2, 1, 0].map((ahead) => queueProgress(ahead, 4));
    for (let i = 1; i < steps.length; i++) expect(steps[i]).toBeGreaterThan(steps[i - 1]!);
    expect(steps[steps.length - 1]).toBeLessThan(1);
  });

  it("waitingProgress : premier de la file dès la prise du ticket → presque pleine (et plus 50 %)", () => {
    const first = { ...view, position: 1, wait_seconds: 0 } as TicketView;
    const p = waitingProgress(first, null, 0);
    expect(p).toMatchObject({ ahead: 0, maxAhead: 0, imminent: true });
    expect(p.progress).toBeGreaterThanOrEqual(0.9);
  });
});

describe("ticketAvailability", () => {
  const hours = [1, 2, 3, 4, 5].map((weekday) => ({ weekday, opens_at: "08:00:00", closes_at: "17:00:00" }));
  const at = (iso: string) => new Date(iso);
  const branch = (is_open: boolean) => ({ id: "b1", name: "Akwa", is_open, timezone: "Africa/Douala", hours });

  it("agence fermée le matin : ouverture le jour même à 08:00", () => {
    const v = { ...view, branch: branch(false) } as TicketView;
    // Lundi 2 novembre 2026, 06:30 à Douala (UTC+1).
    expect(ticketAvailability(v, null, at("2026-11-02T05:30:00Z"))).toEqual({
      kind: "closed",
      next: { inDays: 0, weekday: 1, opensAt: "08:00" },
    });
  });

  it("agence fermée le vendredi soir : prochaine ouverture lundi", () => {
    const v = { ...view, branch: branch(false) } as TicketView;
    const a = ticketAvailability(v, null, at("2026-11-06T19:00:00Z"));
    expect(a).toEqual({ kind: "closed", next: { inDays: 3, weekday: 1, opensAt: "08:00" } });
  });

  it("agence ouverte sans poste ouvert pour le service : d'après le tableau en direct, sinon la vue", () => {
    const v = { ...view, branch: branch(true), service: { id: "s1", open: true } } as unknown as TicketView;
    const closedBoard = board(["C-047"]);
    closedBoard.services[0]!.open = false;
    expect(ticketAvailability(v, closedBoard)).toEqual({ kind: "noCounter" });
    expect(ticketAvailability(v, board(["C-047"]))).toEqual({ kind: "open" });
    const noCounter = { ...v, service: { id: "s1", open: false } } as unknown as TicketView;
    expect(ticketAvailability(noCounter, null)).toEqual({ kind: "noCounter" });
  });

  it("vue sans état d'ouverture : ouverte", () => {
    const old = { ...view, branch: { id: "b1", name: "Akwa" } } as TicketView;
    expect(ticketAvailability(old, null)).toEqual({ kind: "open" });
  });
});
