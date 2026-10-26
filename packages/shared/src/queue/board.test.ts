import { describe, expect, it } from "vitest";
import { branchBoardSchema, ticketProgressFromBoard, type BranchBoard } from "./index";

const SERVICE = "6f1c1d2e-8a3b-4c5d-9e6f-7a8b9c0d1e2f";
const board: BranchBoard = {
  branch_id: "1f1c1d2e-8a3b-4c5d-9e6f-7a8b9c0d1e2f",
  generated_at: "2026-10-28T09:00:00.000Z",
  services: [
    {
      id: SERVICE,
      prefix: "C",
      name: "Consultation",
      name_en: null,
      color: "#1A6BB5",
      open: true,
      waiting: ["C-012", "C-009", "C-013"],
      counters: [
        { counter_id: null, duration_seconds: 600, busy_remaining_seconds: 300 },
        { counter_id: null, duration_seconds: 600, busy_remaining_seconds: 0 },
      ],
      wait_seconds: 900,
    },
  ],
  calls: [
    { code: "C-008", service_id: SERVICE, status: "serving", counter_kind: "cabinet", counter_number: 2, counter_label: null, called_at: "2026-10-28T08:55:00Z", recall_count: 0 },
  ],
};

describe("ticketProgressFromBoard", () => {
  it("valide le format diffusé", () => {
    expect(branchBoardSchema.safeParse(board).success).toBe(true);
  });
  it("position et attente selon l'ordre de passage (une priorité peut précéder un ticket plus ancien)", () => {
    expect(ticketProgressFromBoard(board, SERVICE, "C-012", new Date(board.generated_at))).toEqual({ position: 1, ahead: 0, waitSeconds: 0 });
    expect(ticketProgressFromBoard(board, SERVICE, "C-013", new Date(board.generated_at))).toEqual({ position: 3, ahead: 2, waitSeconds: 600 });
  });
  it("déduit le temps écoulé depuis la diffusion", () => {
    const later = new Date(new Date(board.generated_at).getTime() + 120_000);
    expect(ticketProgressFromBoard(board, SERVICE, "C-009", later)?.waitSeconds).toBe(180);
  });
  it("ticket absent de la file : null", () => {
    expect(ticketProgressFromBoard(board, SERVICE, "C-008")).toBeNull();
  });
});
