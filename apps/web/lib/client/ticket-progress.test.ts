import { describe, expect, it } from "vitest";
import type { BranchBoard } from "@nextin/shared/queue/live";
import { waitingProgress } from "./ticket-progress";
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
});
