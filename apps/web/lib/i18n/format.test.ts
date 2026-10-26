import { describe, expect, it } from "vitest";
import { messages } from "@nextin/shared/i18n";
import { formatMessage } from "./format";

describe("formatMessage", () => {
  it("remplace les variables", () => {
    expect(formatMessage("En cours : {code} · {counter}", { code: "C-043", counter: "Guichet 2" })).toBe("En cours : C-043 · Guichet 2");
  });

  it("gère les pluriels, =0 et # en français et en anglais", () => {
    const fr = messages.fr.client.service.people;
    expect(formatMessage(fr, { count: 0, minutes: 0 }, "fr")).toBe("Personne en attente · ≈ 0 min");
    expect(formatMessage(fr, { count: 1, minutes: 4 }, "fr")).toBe("1 personne · ≈ 4 min");
    expect(formatMessage(fr, { count: 6, minutes: 18 }, "fr")).toBe("6 personnes · ≈ 18 min");
    const en = messages.en.client.service.people;
    expect(formatMessage(en, { count: 1, minutes: 4 }, "en")).toBe("1 person · ≈ 4 min");
    expect(formatMessage(en, { count: 3, minutes: 9 }, "en")).toBe("3 people · ≈ 9 min");
  });

  it("donne le même résultat que next-intl sur les messages client", () => {
    expect(formatMessage(messages.fr.client.ticket.star, { count: 5 }, "fr")).toBe("5 étoiles");
    expect(formatMessage(messages.fr.client.ticket.star, { count: 1 }, "fr")).toBe("1 étoile");
    expect(formatMessage(messages.fr.client.ticket.recalled, { count: 2 })).toBe("Rappel n° 2");
  });

  it("laisse visible une variable manquante", () => {
    expect(formatMessage("Bonjour {name}")).toBe("Bonjour {name}");
  });
});
