import { describe, expect, it } from "vitest";
import { branchHoursStatus } from "./branch-hours";

// Lun.–ven. 7 h 30–17 h, sam. 8 h–12 h (horaires par défaut d'une agence).
const hours = [1, 2, 3, 4, 5]
  .map((weekday) => ({ weekday, opens_at: "07:30:00", closes_at: "17:00:00" }))
  .concat([{ weekday: 6, opens_at: "08:00:00", closes_at: "12:00:00" }]);
const tz = "Africa/Douala";

describe("branchHoursStatus", () => {
  it("ouverte : heure de fermeture", () => {
    // Mercredi 28 octobre 2026, 10 h à Douala (9 h UTC).
    expect(branchHoursStatus(hours, tz, true, new Date("2026-10-28T09:00:00Z"))).toEqual({ open: true, closesAt: "17:00" });
  });
  it("fermée le soir : ouvre demain", () => {
    expect(branchHoursStatus(hours, tz, false, new Date("2026-10-28T19:00:00Z"))).toEqual({
      open: false,
      next: { inDays: 1, weekday: 4, opensAt: "07:30" },
    });
  });
  it("fermée tôt le matin : ouvre aujourd'hui", () => {
    expect(branchHoursStatus(hours, tz, false, new Date("2026-10-28T05:00:00Z"))).toMatchObject({ next: { inDays: 0, opensAt: "07:30" } });
  });
  it("samedi après-midi : lundi", () => {
    expect(branchHoursStatus(hours, tz, false, new Date("2026-10-31T14:00:00Z"))).toMatchObject({ next: { inDays: 2, weekday: 1 } });
  });
  it("sans horaires", () => {
    expect(branchHoursStatus([], tz, false, new Date())).toEqual({ open: false, next: null });
  });
});
