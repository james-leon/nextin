import { describe, expect, it } from "vitest";
import { POSTER_COLORS, contrastRatio, displayDomain, servicesLine } from "./poster-colors";

describe("affiche QR (maquette v2 14)", () => {
  it("QR bleu nuit sur papier blanc : contraste largement suffisant pour les lecteurs (≥ 7:1)", () => {
    expect(contrastRatio(POSTER_COLORS.ink, POSTER_COLORS.paper)).toBeGreaterThan(12);
    expect(contrastRatio(POSTER_COLORS.ink2, POSTER_COLORS.paper)).toBeGreaterThanOrEqual(4.5);
    // Texte blanc sur le bandeau bleu nuit.
    expect(contrastRatio(POSTER_COLORS.paper, POSTER_COLORS.ink)).toBeGreaterThan(12);
  });

  it("domaine tiré de l'adresse de l'application, jamais en dur", () => {
    expect(displayDomain("https://nextin.wintekservices.com")).toBe("nextin.wintekservices.com");
    expect(displayDomain("http://192.168.1.20:3000/")).toBe("192.168.1.20:3000");
  });

  it("étape « Choisissez » : trois premiers services puis « … »", () => {
    expect(servicesLine(["Consultation", "Pédiatrie", "Laboratoire", "Radiologie"], "Choisissez votre service.")).toBe("Consultation, pédiatrie, laboratoire…");
    expect(servicesLine(["Consultation", "Pédiatrie"], "x")).toBe("Consultation, pédiatrie.");
    expect(servicesLine([], "Choisissez votre service.")).toBe("Choisissez votre service.");
  });
});
