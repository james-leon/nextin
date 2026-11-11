import { describe, expect, it } from "vitest";
import { maskEmail } from "./mask-email";

describe("maskEmail", () => {
  it("garde la première lettre et le domaine, comme public.mask_email", () => {
    expect(maskEmail("directrice@clinique.cm")).toBe("d•••@clinique.cm");
  });
  it("adresse invalide : rien de lisible", () => {
    expect(maskEmail("sans-arobase")).toBe("•••");
  });
});
