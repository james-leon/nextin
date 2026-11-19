import { describe, expect, it } from "vitest";
import { buildIcs, doualaStamp, escapeIcsText, foldIcsLine } from "./ics";

describe("fichier iCalendar d'un rendez-vous", () => {
  const ics = buildIcs({
    uid: "rdv-123@nextin",
    start: new Date("2026-11-19T13:30:00Z"),
    end: new Date("2026-11-19T14:00:00Z"),
    summary: "Rendez-vous · Consultation, Dr Abena",
    location: "DOUALA CLINIC – Akwa; Douala",
    stamp: new Date("2026-11-18T10:00:00Z"),
  });

  it("heure de Douala (UTC+1) avec le fuseau déclaré", () => {
    expect(ics).toContain("DTSTART;TZID=Africa/Douala:20261119T143000");
    expect(ics).toContain("DTEND;TZID=Africa/Douala:20261119T150000");
    expect(ics).toContain("TZOFFSETTO:+0100");
    expect(doualaStamp(new Date("2026-12-31T23:30:00Z"))).toBe("20270101T003000");
  });

  it("rappel une heure avant", () => {
    expect(ics).toContain("BEGIN:VALARM");
    expect(ics).toContain("TRIGGER:-PT60M");
  });

  it("textes échappés, lignes CRLF repliées à 75 octets", () => {
    expect(ics).toContain("SUMMARY:Rendez-vous · Consultation\\, Dr Abena");
    expect(ics).toContain("LOCATION:DOUALA CLINIC – Akwa\; Douala");
    expect(escapeIcsText("a\nb")).toBe("a\\nb");
    expect(ics.split("\r\n").every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true);
    const folded = foldIcsLine(`DESCRIPTION:${"é".repeat(60)}`);
    expect(folded.split("\r\n ").join("")).toBe(`DESCRIPTION:${"é".repeat(60)}`);
  });
});
