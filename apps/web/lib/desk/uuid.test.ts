import { describe, expect, it } from "vitest";
import { uuidV4 } from "./uuid";

describe("uuidV4", () => {
  it("produit des UUID v4 valides et distincts", () => {
    const a = uuidV4();
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(uuidV4()).not.toBe(a);
  });
});
