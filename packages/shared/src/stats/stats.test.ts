import { describe, expect, it } from "vitest";
import {
  comparisonRange,
  customRangeError,
  delta,
  hasEnoughPoints,
  isNavigable,
  isSingleDay,
  MAX_CUSTOM_DAYS,
  peakIndex,
  periodRange,
  rangeDays,
  shiftPeriod,
  STATS_PERIODS,
  toCsv,
  toMinutes,
} from "./index";

describe("période par défaut : 30 derniers jours glissants", () => {
  it("se termine le jour de référence, comparée aux 30 jours d'avant", () => {
    expect(STATS_PERIODS[0]).toBe("last30");
    const range = periodRange("last30", "2026-11-04");
    expect(range).toEqual({ from: "2026-10-06", to: "2026-11-04" });
    expect(comparisonRange("last30", range, "2026-11-04")).toEqual({ from: "2026-09-06", to: "2026-10-05" });
    expect(shiftPeriod("last30", "2026-11-04", -1)).toBe("2026-10-05");
  });
  it("courbe tracée à partir de 7 jours renseignés", () => {
    expect(hasEnoughPoints([1, 2, null, 3, 4, 5, 6])).toBe(false);
    expect(hasEnoughPoints([1, 2, 0, 3, 4, 5, 6])).toBe(true);
  });
});

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

describe("C4 — aujourd'hui, hier, période personnalisée", () => {
  const today = "2026-11-11";
  it("aujourd'hui comparé à hier ; hier comparé à avant-hier", () => {
    const r = periodRange("today", today);
    expect(r).toEqual({ from: today, to: today });
    expect(comparisonRange("today", r, today)).toEqual({ from: "2026-11-10", to: "2026-11-10" });
    const y = periodRange("yesterday", today);
    expect(y).toEqual({ from: "2026-11-10", to: "2026-11-10" });
    expect(comparisonRange("yesterday", y, today)).toEqual({ from: "2026-11-09", to: "2026-11-09" });
  });
  it("personnalisée : comparée à la période précédente de même durée", () => {
    const r = { from: "2026-10-01", to: "2026-10-10" };
    expect(rangeDays(r)).toBe(10);
    expect(comparisonRange("custom", r, today)).toEqual({ from: "2026-09-21", to: "2026-09-30" });
  });
  it("validation : ordre, futur, 92 jours au plus, limite d'historique", () => {
    expect(customRangeError("2026-10-01", "2026-10-10", today, null)).toBeNull();
    expect(customRangeError("2026-10-10", "2026-10-01", today, null)).toBe("range_order");
    expect(customRangeError("2026-11-01", "2026-11-12", today, null)).toBe("range_future");
    expect(customRangeError("2026-08-10", "2026-11-10", today, null)).toBe("range_too_long");
    expect(customRangeError("2026-08-12", "2026-11-11", today, null)).toBeNull();
    expect(MAX_CUSTOM_DAYS).toBe(92);
    expect(customRangeError("2026-05-01", "2026-05-10", today, "2026-06-01")).toBe("range_history");
    expect(customRangeError("2026-13-01", "2026-10-10", today, null)).toBe("range_invalid");
  });
  it("navigation et affichage par heure", () => {
    expect(isNavigable("today")).toBe(false);
    expect(isNavigable("custom")).toBe(false);
    expect(isNavigable("week")).toBe(true);
    expect(shiftPeriod("today", today, -1)).toBe(today);
    expect(isSingleDay("yesterday", periodRange("yesterday", today))).toBe(true);
    expect(isSingleDay("custom", { from: "2026-10-01", to: "2026-10-03" })).toBe(false);
  });
});
