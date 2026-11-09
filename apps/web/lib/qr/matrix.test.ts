import { describe, expect, it } from "vitest";
import { qrMatrix } from "./matrix";

describe("qrMatrix", () => {
  it("produit un chemin SVG de modules", () => {
    const m = qrMatrix("https://nextin.example/q/Abcdefghijklmnopqrstuv");
    expect(m.size).toBeGreaterThanOrEqual(25);
    expect(m.path).toMatch(/^M\d+ \d+h\d+v1h-\d+z/);
  });
  it("zone de silence ajoutée autour", () => {
    const a = qrMatrix("x");
    const b = qrMatrix("x", 4);
    expect(b.size).toBe(a.size + 8);
  });
  it("déterministe", () => {
    expect(qrMatrix("abc").path).toBe(qrMatrix("abc").path);
  });
});
