import { describe, expect, it } from "vitest";
import { formatXaf } from "./money";

describe("formatXaf", () => {
  it("formate sans décimales", () => {
    expect(formatXaf(25000, "fr").replace(/\s/g, " ")).toBe("25 000 FCFA");
    expect(formatXaf(25000, "en")).toBe("25,000 FCFA");
  });
  it("refuse les montants non entiers", () => {
    expect(() => formatXaf(10.5)).toThrow(RangeError);
  });
});
