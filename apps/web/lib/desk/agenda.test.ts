import { describe, expect, it } from "vitest";
import { hourRange, minutesOfDay, placeDay } from "./agenda";

describe("agenda de la semaine", () => {
  it("minutes dans le fuseau de l'agence (Douala, UTC+1)", () => {
    expect(minutesOfDay("2026-11-02T08:30:00Z", "Africa/Douala")).toBe(9 * 60 + 30);
    expect(minutesOfDay("2026-11-02T23:15:00Z", "Africa/Douala")).toBe(15);
  });

  it("plage horaire : 8 h – 18 h au moins, élargie aux rendez-vous", () => {
    expect(hourRange([])).toEqual([8, 18]);
    expect(hourRange([{ start: 7 * 60 + 30, end: 8 * 60 }])).toEqual([7, 18]);
    expect(hourRange([{ start: 18 * 60, end: 19 * 60 + 10 }])).toEqual([8, 20]);
  });

  it("couloirs : chevauchements côte à côte, rendez-vous successifs sur toute la largeur", () => {
    const placed = placeDay([
      { item: "a", start: 540, end: 570 },
      { item: "b", start: 550, end: 580 },
      { item: "c", start: 570, end: 600 },
      { item: "d", start: 620, end: 640 },
    ]);
    const by = Object.fromEntries(placed.map((p) => [p.item, p]));
    expect(by.a).toMatchObject({ lane: 0, lanes: 2 });
    expect(by.b).toMatchObject({ lane: 1, lanes: 2 });
    // « c » commence quand « a » se termine : il reprend le premier couloir du même groupe.
    expect(by.c).toMatchObject({ lane: 0, lanes: 2 });
    expect(by.d).toMatchObject({ lane: 0, lanes: 1 });
  });

  it("durée nulle : au moins une minute", () => {
    expect(placeDay([{ item: "x", start: 600, end: 600 }])[0]).toMatchObject({ start: 600, end: 601 });
  });
});
