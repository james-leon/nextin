import { describe, expect, it } from "vitest";
import { formatTime, minutesToSeconds, nextCounterNumber, qrEntryUrl, suggestPrefix } from "./structure";

describe("suggestPrefix", () => {
  it("initiale du nom", () => {
    expect(suggestPrefix("Consultation générale", [])).toBe("C");
    expect(suggestPrefix("Écographie", [])).toBe("E");
  });
  it("évite les préfixes pris", () => {
    expect(suggestPrefix("Caisse", ["C"])).toBe("A");
    expect(suggestPrefix("Caisse", ["C", "A", "I", "S", "E"])).toBe("CA");
    expect(suggestPrefix("Labo", ["L", "A", "B", "O", "LA"])).toBe("LB");
  });
  it("nom sans lettre", () => {
    expect(suggestPrefix("123", [])).toMatch(/^[A-Z]{1,2}$/);
  });
});

describe("structure", () => {
  it("prochain numéro libre", () => {
    const existing = [
      { kind: "cabinet", number: 1 },
      { kind: "cabinet", number: 2 },
      { kind: "cabinet", number: 4 },
      { kind: "guichet", number: 1 },
    ];
    expect(nextCounterNumber(existing, "cabinet")).toBe(3);
    expect(nextCounterNumber(existing, "caisse")).toBe(1);
  });
  it("URL du QR depuis APP_URL", () => {
    expect(qrEntryUrl("Abc123", { APP_URL: "https://nextin.example/" })).toBe("https://nextin.example/q/Abc123");
  });
  it("heures et durées", () => {
    expect(formatTime("07:30:00")).toBe("07:30");
    expect(formatTime("7:5")).toBe("07:05");
    expect(minutesToSeconds(10)).toBe(600);
    expect(minutesToSeconds(0)).toBe(60);
    expect(minutesToSeconds(500)).toBe(7200);
  });
});

describe("summarizeOpeningHours", () => {
  const short = (d: number) => ["", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"][d]!;
  it("regroupe les jours consécutifs identiques", async () => {
    const { summarizeOpeningHours } = await import("./structure");
    const rows = [1, 2, 3, 4, 5].map((weekday) => ({ weekday, opens_at: "07:30:00", closes_at: "17:00:00" }));
    rows.push({ weekday: 6, opens_at: "08:00:00", closes_at: "12:00:00" });
    expect(summarizeOpeningHours(rows, short, "Fermé")).toBe("Lun–Ven 07:30–17:00 · Sam 08:00–12:00");
  });
  it("jours isolés, fermé", async () => {
    const { summarizeOpeningHours } = await import("./structure");
    expect(
      summarizeOpeningHours(
        [
          { weekday: 1, opens_at: "08:00", closes_at: "12:00" },
          { weekday: 3, opens_at: "08:00", closes_at: "12:00" },
          { weekday: 7, opens_at: "09:00", closes_at: "11:00" },
        ],
        short,
        "Fermé",
      ),
    ).toBe("Lun 08:00–12:00 · Mer 08:00–12:00 · Dim 09:00–11:00");
    expect(summarizeOpeningHours([], short, "Fermé")).toBe("Fermé");
  });
});
