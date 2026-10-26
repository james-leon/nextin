import { describe, expect, it } from "vitest";
import { entryCodeFromScan, normalizeShortCode } from "./entry-code";

describe("entryCodeFromScan", () => {
  it("lit le jeton d'un QR code NextIn, quel que soit l'hôte", () => {
    expect(entryCodeFromScan("https://nextin.cm/q/AbCdEfGhIjKlMnOpQrStUv")).toBe("AbCdEfGhIjKlMnOpQrStUv");
    expect(entryCodeFromScan("http://192.168.1.20:3000/q/K7M2PQ?x=1")).toBe("K7M2PQ");
  });
  it("refuse les autres QR codes", () => {
    expect(entryCodeFromScan("https://example.com/promo")).toBeNull();
    expect(entryCodeFromScan("WIFI:S:Clinic;T:WPA;P:secret;;")).toBeNull();
  });
});

describe("normalizeShortCode", () => {
  it("accepte 6 caractères, casse et espaces ignorés", () => {
    expect(normalizeShortCode(" k7m 2pq ")).toBe("K7M2PQ");
    expect(normalizeShortCode("K7M-2PQ")).toBe("K7M2PQ");
  });
  it("refuse les autres longueurs", () => {
    expect(normalizeShortCode("K7M2P")).toBeNull();
    expect(normalizeShortCode("K7M2PQ9")).toBeNull();
  });
});
