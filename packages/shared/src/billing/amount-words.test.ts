import { describe, expect, it } from "vitest";
import { amountInWords, englishNumber, frenchNumber } from "./amount-words";

describe("montant en lettres (facture)", () => {
  it("nombres de la consigne, en français", () => {
    expect(frenchNumber(0)).toBe("zéro");
    expect(frenchNumber(1)).toBe("un");
    expect(frenchNumber(21)).toBe("vingt et un");
    expect(frenchNumber(71)).toBe("soixante et onze");
    expect(frenchNumber(80)).toBe("quatre-vingts");
    expect(frenchNumber(91)).toBe("quatre-vingt-onze");
    expect(frenchNumber(100)).toBe("cent");
    expect(frenchNumber(1000)).toBe("mille");
    expect(frenchNumber(61_410)).toBe("soixante et un mille quatre cent dix");
    expect(frenchNumber(1_000_000)).toBe("un million");
  });

  it("accords : cents, quatre-vingts, mille invariable, millions", () => {
    expect(frenchNumber(81)).toBe("quatre-vingt-un");
    expect(frenchNumber(77)).toBe("soixante-dix-sept");
    expect(frenchNumber(200)).toBe("deux cents");
    expect(frenchNumber(201)).toBe("deux cent un");
    expect(frenchNumber(280)).toBe("deux cent quatre-vingts");
    expect(frenchNumber(2000)).toBe("deux mille");
    expect(frenchNumber(80_000)).toBe("quatre-vingt mille");
    expect(frenchNumber(200_000)).toBe("deux cent mille");
    expect(frenchNumber(59_900)).toBe("cinquante-neuf mille neuf cents");
    expect(frenchNumber(2_500_000)).toBe("deux millions cinq cent mille");
    expect(frenchNumber(1_000_000_000)).toBe("un milliard");
  });

  it("avec la devise", () => {
    expect(amountInWords(61_410, "fr")).toBe("soixante et un mille quatre cent dix francs CFA");
    expect(amountInWords(0, "fr")).toBe("zéro franc CFA");
    expect(amountInWords(1, "fr")).toBe("un franc CFA");
    expect(amountInWords(1_000_000, "fr")).toBe("un million de francs CFA");
    expect(amountInWords(3_000_000, "fr")).toBe("trois millions de francs CFA");
    expect(amountInWords(1_000_500, "fr")).toBe("un million cinq cents francs CFA");
  });

  it("en anglais", () => {
    expect(englishNumber(0)).toBe("zero");
    expect(englishNumber(21)).toBe("twenty-one");
    expect(englishNumber(100)).toBe("one hundred");
    expect(englishNumber(1000)).toBe("one thousand");
    expect(englishNumber(1005)).toBe("one thousand and five");
    expect(englishNumber(61_410)).toBe("sixty-one thousand four hundred and ten");
    expect(englishNumber(1_000_000)).toBe("one million");
    expect(amountInWords(61_410, "en")).toBe("sixty-one thousand four hundred and ten CFA francs");
    expect(amountInWords(1, "en")).toBe("one CFA franc");
  });
});
