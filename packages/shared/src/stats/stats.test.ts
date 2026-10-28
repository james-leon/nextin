import { describe, expect, it } from "vitest";
import { comparisonRange, delta, peakIndex, periodRange, shiftPeriod, toCsv, toMinutes } from "./index";

describe("périodes du tableau de bord", () => {
  it("jour, semaine (lundi → dimanche), mois", () => {
    expect(periodRange("day", "2026-10-28")).toEqual({ from: "2026-10-28", to: "2026-10-28" });
    expect(periodRange("week", "2026-10-28")).toEqual({ from: "2026-10-26", to: "2026-11-01" });
    expect(periodRange("month", "2026-02-10")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
  });
  it("comparaison : même jour la semaine dernière, semaine et mois précédents à durée égale", () => {
    expect(comparisonRange("day", periodRange("day", "2026-10-28"), "2026-10-28")).toEqual({ from: "2026-10-21", to: "2026-10-21" });
    expect(comparisonRange("week", periodRange("week", "2026-10-28"), "2026-10-28")).toEqual({ from: "2026-10-19", to: "2026-10-21" });
    expect(comparisonRange("month", periodRange("month", "2026-10-28"), "2026-10-28")).toEqual({ from: "2026-09-01", to: "2026-09-28" });
    expect(comparisonRange("month", periodRange("month", "2026-03-31"), "2026-03-31")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(comparisonRange("week", periodRange("week", "2026-10-14"), "2026-10-28")).toEqual({ from: "2026-10-05", to: "2026-10-11" });
  });
  it("navigation", () => {
    expect(shiftPeriod("day", "2026-10-31", 1)).toBe("2026-11-01");
    expect(shiftPeriod("week", "2026-10-28", -1)).toBe("2026-10-21");
    expect(shiftPeriod("month", "2026-10-28", 1)).toBe("2026-11-01");
    expect(shiftPeriod("month", "2026-01-15", -1)).toBe("2025-12-01");
  });
});

describe("écarts", () => {
  it("volume en %, attente en minutes, taux en points, avec le bon sens", () => {
    expect(delta(182, 162, "percent", "up")).toEqual({ value: 12, kind: "percent", tone: "good" });
    expect(delta(840, 1020, "minutes", "down")).toEqual({ value: -3, kind: "minutes", tone: "good" });
    expect(delta(4.2, 3.4, "points", "down")).toEqual({ value: 0.8, kind: "points", tone: "bad" });
    expect(delta(360, 350, "minutes", "neutral")).toEqual({ value: 0, kind: "minutes", tone: "neutral" });
    expect(delta(10, 0, "percent", "up")).toBeNull();
    expect(delta(null, 5, "minutes", "down")).toBeNull();
  });
  it("pic d'affluence et minutes", () => {
    expect(peakIndex([0, 3, 9, 9, 2])).toBe(2);
    expect(peakIndex([0, 0])).toBe(-1);
    expect(toMinutes(955)).toBe(16);
    expect(toMinutes(null)).toBeNull();
  });
});

describe("export CSV", () => {
  it("séparateur ;, BOM, décimales à la française, guillemets, formules neutralisées", () => {
    const csv = toCsv([
      ["Jour", "Service", "Note"],
      ["2026-10-28", 'Consultation "générale"; adultes', 4.5],
      ["2026-10-29", "=HYPERLINK(1)", null],
    ]);
    expect(csv).toBe(
      '﻿Jour;Service;Note\r\n2026-10-28;"Consultation ""générale""; adultes";4,5\r\n2026-10-29;\'=HYPERLINK(1);\r\n',
    );
  });
});
