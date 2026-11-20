import { describe, expect, it } from "vitest";
import type { BoardCall, BoardService, BranchBoard } from "@nextin/shared/queue/live";
import { presenceCodeOf, tvView } from "./calls";

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
const service = (id: string, prefix: string, waiting: string[]): BoardService => ({
  id,
  prefix,
  name: prefix,
  name_en: null,
  color: "#1A6BB5",
  open: true,
  waiting,
  counters: [],
  wait_seconds: 0,
});
const board = (calls: BoardCall[], services: BoardService[] = []): BranchBoard => ({
  branch_id: C,
  generated_at: "2026-10-28T09:00:00.000Z",
  services,
  calls,
});

describe("tvView", () => {
  it("appels en cours seulement, le dernier patient alerté marqué", () => {
    const v = tvView(board([call("C-004", "called", 0), call("L-002", "serving", 2, L), call("C-003", "served", 3), call("C-002", "no_show", 6)]), []);
    expect(v.current.map((c) => c.code)).toEqual(["C-004", "L-002"]);
    expect(v.latest?.code).toBe("C-004");
    expect(v.previous.map((c) => c.code)).toEqual(["C-003", "C-002"]);
  });
  it("aucun marquage si le plus récent est déjà admis", () => {
    expect(tvView(board([call("C-005", "serving", 0), call("C-004", "called", 2)]), []).latest).toBeNull();
  });
  it("au plus quatre appels en cours", () => {
    const calls = ["C-006", "C-005", "C-004", "C-003", "C-002"].map((c, i) => call(c, "called", i));
    expect(tvView(board(calls), []).current).toHaveLength(4);
  });
  it("services de l'écran uniquement", () => {
    const v = tvView(board([call("L-001", "called", 0, L), call("C-001", "served", 3)], [service(C, "C", ["C-002"]), service(L, "L", ["L-002", "L-003"])]), [C]);
    expect(v.current).toEqual([]);
    expect(v.previous.map((c) => c.code)).toEqual(["C-001"]);
    expect(v.next).toEqual(["C-002"]);
    expect(v.waiting).toBe(1);
  });
  it("à suivre : à tour de rôle dans chaque file, six au plus", () => {
    const v = tvView(board([], [service(C, "C", ["C-052", "C-053", "C-054", "C-055"]), service(L, "L", ["L-023", "L-024"])]), []);
    expect(v.next).toEqual(["C-052", "L-023", "C-053", "L-024", "C-054", "C-055"]);
    expect(v.waiting).toBe(6);
  });
  it("tableau vide", () => {
    expect(tvView(board([]), [])).toEqual({ current: [], latest: null, previous: [], next: [], waiting: 0 });
  });
});

describe("presenceCodeOf", () => {
  it("lit le paramètre p de l'URL du QR code", () => {
    expect(presenceCodeOf("https://example.test/q/AB12CD?p=7K3Q")).toBe("7K3Q");
    expect(presenceCodeOf("https://example.test/q/AB12CD")).toBeNull();
    expect(presenceCodeOf(null)).toBeNull();
    expect(presenceCodeOf("pas une url")).toBeNull();
  });
});
