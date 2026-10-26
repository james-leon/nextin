import { describe, expect, it } from "vitest";
import { messages } from "@nextin/shared/i18n";
import { mapDbError } from "./db-errors";

describe("mapDbError", () => {
  it("unicité selon le contexte", () => {
    expect(mapDbError({ code: "23505" }, "prefix_taken")).toBe("prefix_taken");
    expect(mapDbError({ code: "23505" })).toBe("name_taken");
  });
  it("droits, dernier administrateur, introuvable", () => {
    expect(mapDbError({ code: "42501" })).toBe("not_allowed");
    expect(mapDbError({ code: "P0001", message: "An organization must keep at least one active org_admin" })).toBe("last_admin");
    expect(mapDbError({ code: "PGRST116" })).toBe("not_found");
    expect(mapDbError({ code: "XX000" })).toBe("generic");
    expect(mapDbError(null)).toBe("generic");
  });
  it("tous les codes existent dans le dictionnaire", () => {
    for (const c of ["prefix_taken", "name_taken", "not_allowed", "last_admin", "not_found", "rate_limited", "generic"] as const) {
      expect(messages.fr.errors[c]).toBeTruthy();
      expect(messages.en.errors[c]).toBeTruthy();
    }
  });
});
