import { describe, expect, it } from "vitest";
import type { BoardCall, BranchBoard } from "@nextin/shared/queue/live";
import { tvCalls } from "./calls";

const C = "6f1c1d2e-8a3b-4c5d-9e6f-7a8b9c0d1e2f";
const L = "7f1c1d2e-8a3b-4c5d-9e6f-7a8b9c0d1e2f";
const call = (code: string, status: BoardCall["status"], minutesAgo: number, service = C): BoardCall => ({
  code,
  service_id: service,
  status,
  counter_kind: "cabinet",
  counter_number: 1,
  counter_label: null,
  called_at: new Date(Date.UTC(2026, 9, 28, 9, 0) - minutesAgo * 60_000).toISOString(),
  recall_count: 0,
});
const board = (calls: BoardCall[]): BranchBoard => ({ branch_id: C, generated_at: "2026-10-28T09:00:00.000Z", services: [], calls });

describe("tvCalls", () => {
  it("un seul poste qui termine ses patients : les trois précédents remplissent les tuiles", () => {
    const { hero, others } = tvCalls(
      board([call("C-004", "called", 0), call("C-003", "served", 3), call("C-002", "no_show", 6), call("C-001", "served", 9)]),
      [],
    );
    expect(hero?.code).toBe("C-004");
    expect(others.map((c) => c.code)).toEqual(["C-003", "C-002", "C-001"]);
  });
  it("héros : le dernier patient alerté, même si un appel plus récent est déjà admis", () => {
    const { hero, others } = tvCalls(board([call("C-005", "serving", 0), call("C-004", "called", 2), call("C-003", "served", 5)]), []);
    expect(hero?.code).toBe("C-004");
    expect(others.map((c) => c.code)).toEqual(["C-005", "C-003"]);
  });
  it("sans patient alerté : l'appel le plus récent", () => {
    expect(tvCalls(board([call("C-002", "served", 1), call("C-001", "served", 4)]), []).hero?.code).toBe("C-002");
  });
  it("services de l'écran uniquement ; aucun appel : rien à afficher", () => {
    expect(tvCalls(board([call("L-001", "called", 0, L), call("C-001", "served", 3)]), [C])).toMatchObject({ hero: { code: "C-001" }, others: [] });
    expect(tvCalls(board([]), [])).toEqual({ hero: null, others: [] });
  });
});
