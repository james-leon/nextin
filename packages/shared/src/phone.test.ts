import { describe, expect, it } from "vitest";
import { formatCameroonPhone, maskPhone, normalizeCameroonPhone } from "./phone";

describe("normalizeCameroonPhone", () => {
  it.each([
    ["677123456", "+237677123456"],
    ["6 77 12 34 56", "+237677123456"],
    ["+237 677-12-34-56", "+237677123456"],
    ["00237677123456", "+237677123456"],
    ["237677123456", "+237677123456"],
    ["233 42 12 34", "+237233421234"],
  ])("normalise %s", (input, expected) => {
    expect(normalizeCameroonPhone(input)).toBe(expected);
  });

  it.each(["", "12345", "577123456", "+33612345678", "67712345a", "6771234567"])("rejette %s", (input) => {
    expect(normalizeCameroonPhone(input)).toBeNull();
  });
});

describe("format / mask", () => {
  it("formate et masque", () => {
    expect(formatCameroonPhone("+237677123456")).toBe("+237 6 77 12 34 56");
    expect(maskPhone("+237677123456")).toBe("+237 6 •• •• •• 56");
  });
});
