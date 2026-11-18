import { describe, expect, it } from "vitest";
import { messages } from "@nextin/shared/i18n";
import { dbFailure, mapDbError } from "./db-errors";

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
  it("historique et erreurs métier de la file", () => {
    expect(mapDbError({ code: "23503", message: "violates foreign key constraint" })).toBe("in_use");
    expect(mapDbError({ code: "P0409", message: "counter_busy" })).toBe("counter_busy");
    expect(mapDbError({ code: "P0410", message: "branch_closed" })).toBe("branch_closed");
  });
  it("tous les codes existent dans le dictionnaire", () => {
    for (const c of ["prefix_taken", "name_taken", "not_allowed", "last_admin", "not_found", "rate_limited", "generic", "in_use", "counter_busy"] as const) {
      expect(messages.fr.errors[c]).toBeTruthy();
      expect(messages.en.errors[c]).toBeTruthy();
    }
  });
  it("erreurs métier des RPC de la console (22023, P04xx) : la vraie raison, jamais « generic »", () => {
    expect(mapDbError({ code: "22023", message: "invalid_plan" })).toBe("invalid_plan");
    expect(mapDbError({ code: "22023", message: "reason_required" })).toBe("reason_required");
    expect(mapDbError({ code: "P0422", message: "phone_invalid" })).toBe("phone_invalid");
    expect(mapDbError({ code: "22023", message: "texte libre inconnu" })).toBe("generic");
    // Une violation d'unicité garde son message de contexte.
    expect(mapDbError({ code: "23505", message: "name_taken" }, "prefix_taken")).toBe("prefix_taken");
  });
  it("sous le bon champ quand le formulaire le contient", () => {
    const form = new FormData();
    form.set("planId", "x");
    form.set("reason", "test");
    expect(dbFailure({ code: "22023", message: "invalid_plan" }, form)).toEqual({ ok: false, error: "invalid_plan", fieldErrors: { planId: "invalid_plan" } });
    expect(dbFailure({ code: "22023", message: "reason_required" }, { note: "" })).toEqual({ ok: false, error: "reason_required", fieldErrors: { note: "reason_required" } });
    expect(dbFailure({ code: "22023", message: "invalid_slug" }, form)).toEqual({ ok: false, error: "invalid_slug" });
  });
  it("chaque code levé par les migrations existe dans le dictionnaire (FR et EN)", async () => {
    const { readdirSync, readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const dir = join(__dirname, "../../../../supabase/migrations");
    const codes = new Set<string>();
    for (const file of readdirSync(dir)) for (const m of readFileSync(join(dir, file), "utf8").matchAll(/raise exception '([a-z_]+)'/g)) codes.add(m[1]!);
    const missing = [...codes].filter((c) => !(c in messages.fr.errors) || !(c in messages.en.errors));
    expect(missing).toEqual([]);
  });
});
