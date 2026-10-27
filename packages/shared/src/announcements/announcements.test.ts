import { describe, expect, it } from "vitest";
import { announcementSegments, announcementText, inQuietHours, parseTicketCode, voiceSegments } from "./index";

const base = { code: "C-047", counterKind: "cabinet" as const, counterNumber: 3, languages: ["fr"] as const, chime: true };

describe("annonces vocales", () => {
  it("lit le numéro du ticket", () => {
    expect(parseTicketCode("C-047")).toEqual({ prefix: "C", number: 47 });
    expect(parseTicketCode("AB-1204")).toEqual({ prefix: "AB", number: 1204 });
    expect(parseTicketCode("x")).toBeNull();
  });

  it("compose la séquence de segments : carillon, ticket, lettre, numéro, poste", () => {
    expect(announcementSegments(base)).toEqual([
      "chime",
      "fr/word-ticket",
      "fr/letter-c",
      "fr/47",
      "fr/please-go-to",
      "fr/to-cabinet",
      "fr/3",
    ]);
  });

  it("enchaîne le français puis l'anglais, sans carillon si désactivé", () => {
    const keys = announcementSegments({ ...base, code: "AB-005", counterKind: "caisse", counterNumber: 1, languages: ["fr", "en"], chime: false })!;
    expect(keys.slice(0, 7)).toEqual(["fr/word-ticket", "fr/letter-a", "fr/letter-b", "fr/5", "fr/please-go-to", "fr/to-caisse", "fr/1"]);
    expect(keys.slice(7)).toEqual(["en/word-ticket", "en/letter-a", "en/letter-b", "en/5", "en/please-go-to", "en/to-caisse", "en/1"]);
  });

  it("passe à la synthèse vocale pour un libellé libre ou un grand numéro", () => {
    expect(announcementSegments({ ...base, counterLabel: "Salle bleue" })).toBeNull();
    expect(announcementSegments({ ...base, code: "C-1204" })).toBeNull();
    expect(announcementText("fr", base)).toBe("Ticket C 47. Présentez-vous au cabinet 3.");
    expect(announcementText("en", { ...base, counterKind: "guichet", counterNumber: 2 })).toBe("Ticket C 47. Please go to counter 2.");
    expect(announcementText("fr", { ...base, counterLabel: "Salle bleue" })).toBe("Ticket C 47. Présentez-vous : Salle bleue.");
  });

  it("liste tous les segments à enregistrer", () => {
    const fr = voiceSegments("fr");
    expect(fr.find((s) => s.key === "fr/to-caisse")?.text).toBe("à la caisse");
    expect(fr.filter((s) => s.key.startsWith("fr/letter-"))).toHaveLength(26);
    expect(fr.some((s) => s.key === "fr/999")).toBe(true);
    // Chaque segment d'une annonce existe dans la liste à enregistrer.
    const all = new Set([...fr, ...voiceSegments("en")].map((s) => s.key));
    for (const k of announcementSegments({ ...base, languages: ["fr", "en"] })!) if (k !== "chime") expect(all.has(k)).toBe(true);
  });

  it("respecte les plages de silence (heure de Douala, y compris de nuit)", () => {
    const at = (iso: string) => new Date(iso);
    const ranges = [{ from: "12:00", to: "14:00" }, { from: "22:00", to: "06:00" }];
    expect(inQuietHours(ranges, at("2026-10-27T12:30:00+01:00"), "Africa/Douala")).toBe(true);
    expect(inQuietHours(ranges, at("2026-10-27T14:00:00+01:00"), "Africa/Douala")).toBe(false);
    expect(inQuietHours(ranges, at("2026-10-27T23:15:00+01:00"), "Africa/Douala")).toBe(true);
    expect(inQuietHours(ranges, at("2026-10-27T05:59:00+01:00"), "Africa/Douala")).toBe(true);
    expect(inQuietHours([], at("2026-10-27T12:30:00+01:00"), "Africa/Douala")).toBe(false);
  });
});
