import { describe, expect, it } from "vitest";
import { SERVICE_COLORS, formatTicketCode, spellTicketCode } from "./ticket";

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

describe("formatTicketCode", () => {
  it("préfixe, tiret, 3 chiffres", () => {
    expect(formatTicketCode("C", 47)).toBe("C-047");
    expect(formatTicketCode("K", 9)).toBe("K-009");
    expect(formatTicketCode("RC", 120)).toBe("RC-120");
    expect(formatTicketCode("C", 1204)).toBe("C-1204");
  });
  it("refuse préfixe ou numéro invalides", () => {
    expect(() => formatTicketCode("c", 1)).toThrow(RangeError);
    expect(() => formatTicketCode("ABC", 1)).toThrow(RangeError);
    expect(() => formatTicketCode("C", 0)).toThrow(RangeError);
    expect(() => formatTicketCode("C", 1.5)).toThrow(RangeError);
  });
  it("épelle pour les lecteurs d'écran", () => {
    expect(spellTicketCode("C-047")).toBe("C 0 4 7");
  });
});

describe("SERVICE_COLORS", () => {
  it.each(Object.entries(SERVICE_COLORS))("%s : texte blanc lisible (AA ≥ 4,5:1 pour du texte gras ≥ 3:1)", (_, hex) => {
    expect(1.05 / (luminance(hex) + 0.05)).toBeGreaterThanOrEqual(3);
  });
});
