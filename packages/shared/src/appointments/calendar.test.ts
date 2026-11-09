import { describe, expect, it } from "vitest";
import { addDays, isoWeekday, localDate, nextDays, weekDays, weekStart } from "./calendar";

describe("calendrier des rendez-vous", () => {
  it("jour local de l'agence (Douala, UTC+1)", () => {
    expect(localDate("2026-10-28T23:30:00Z", "Africa/Douala")).toBe("2026-10-29");
    expect(localDate("2026-10-28T22:59:00Z", "Africa/Douala")).toBe("2026-10-28");
  });
  it("jours et changements de mois / d'année", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("semaine du lundi au dimanche", () => {
    expect(isoWeekday("2026-11-02")).toBe(1);
    expect(isoWeekday("2026-11-08")).toBe(7);
    expect(weekStart("2026-11-08")).toBe("2026-11-02");
    expect(weekDays("2026-11-04")).toEqual(["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08"]);
    expect(nextDays("2026-10-30", 3)).toEqual(["2026-10-30", "2026-10-31", "2026-11-01"]);
  });
});
