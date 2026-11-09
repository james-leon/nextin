import { describe, expect, it } from "vitest";
import { distanceMeters, formatDistance, leaveAdvice, travelSeconds } from "./index";

describe("distanceMeters", () => {
  it("≈ 2 km pour 0,018° de latitude à Douala", () => {
    expect(distanceMeters({ lat: 4.05, lng: 9.7 }, { lat: 4.068, lng: 9.7 })).toBeGreaterThan(1990);
    expect(distanceMeters({ lat: 4.05, lng: 9.7 }, { lat: 4.068, lng: 9.7 })).toBeLessThan(2010);
  });
  it("Douala → Yaoundé ≈ 200 km", () => {
    const d = distanceMeters({ lat: 4.05, lng: 9.7 }, { lat: 3.87, lng: 11.52 });
    expect(d / 1000).toBeGreaterThan(195);
    expect(d / 1000).toBeLessThan(210);
  });
});

describe("travelSeconds (parité avec public.remote_travel_seconds)", () => {
  it("2 km à 20 km/h → 468 s", () => {
    expect(travelSeconds(2000, 20)).toBe(468);
  });
  it("2 minutes au moins", () => {
    expect(travelSeconds(50, 20)).toBe(120);
  });
});

describe("leaveAdvice", () => {
  it("trajet inconnu", () => expect(leaveAdvice(600, null, 600)).toEqual({ state: "unknown" }));
  it("plus tard", () => expect(leaveAdvice(3600, 900, 600)).toEqual({ state: "later", minutes: 35 }));
  it("maintenant", () => expect(leaveAdvice(1530, 900, 600)).toEqual({ state: "now" }));
  it("en retard", () => expect(leaveAdvice(600, 900, 600)).toEqual({ state: "late", minutes: 15 }));
});

describe("formatDistance", () => {
  it("mètres, puis kilomètres", () => {
    expect(formatDistance(847, "fr")).toBe("850 m");
    expect(formatDistance(2440, "fr")).toBe("2,4 km");
    expect(formatDistance(12_400, "fr")).toBe("12 km");
  });
});
