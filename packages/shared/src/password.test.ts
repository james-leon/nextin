import { describe, expect, it } from "vitest";
import { passwordProgress, passwordRules } from "./password";
import { passwordSchema } from "./schemas";

describe("règles du nouveau mot de passe", () => {
  it("coche chaque règle séparément", () => {
    expect(passwordRules("", "")).toEqual({ length: false, mix: false, match: false });
    expect(passwordRules("abcdefghij", "x")).toEqual({ length: true, mix: false, match: false });
    expect(passwordRules("abc123", "abc123")).toEqual({ length: false, mix: true, match: true });
    expect(passwordRules("nextin2026a", "nextin2026a")).toEqual({ length: true, mix: true, match: true });
    expect(passwordProgress(passwordRules("abcdefghij", ""))).toBeCloseTo(1 / 3);
  });

  it("les règles affichées et la vérification du serveur disent la même chose", () => {
    for (const value of ["", "abc", "abcdefghij", "1234567890", "abcde12345", "a1".repeat(40), "Motdepasse9"]) {
      const r = passwordRules(value, value);
      expect(r.length && r.mix, value).toBe(passwordSchema.safeParse(value).success);
    }
  });
});
