import { describe, expect, it } from "vitest";
import { defaultNameMode, identityLine, normalizeName, parseIdentity } from "./identity";

const labels = { age: (n: number) => `${n} ans`, file: (v: string) => `Dossier ${v}` };

describe("nom du client", () => {
  it("mode par défaut selon le secteur", () => {
    expect(defaultNameMode("clinic")).toBe("required");
    expect(defaultNameMode("hospital")).toBe("required");
    expect(defaultNameMode("bank")).toBe("off");
  });
  it("nettoie le nom", () => {
    expect(normalizeName("  Zorobabel   Nkou ")).toBe("Zorobabel Nkou");
    expect(normalizeName("   ")).toBeNull();
  });
  it("nom obligatoire, facultatif ou non demandé (même règle que la base)", () => {
    expect(parseIdentity({ mode: "required", extra: "none" }, { name: " " })).toEqual({ ok: false, error: "name_required" });
    expect(parseIdentity({ mode: "optional", extra: "none" }, { name: "" })).toEqual({ ok: true, identity: { name: null, age: null, fileNumber: null } });
    expect(parseIdentity({ mode: "off", extra: "age" }, { name: "Ignoré", age: 30 })).toEqual({ ok: true, identity: { name: null, age: null, fileNumber: null } });
    expect(parseIdentity({ mode: "required", extra: "none" }, { name: "x".repeat(81) })).toEqual({ ok: false, error: "identity_invalid" });
  });
  it("âge ou numéro de dossier seulement s'il est demandé", () => {
    expect(parseIdentity({ mode: "required", extra: "age" }, { name: "A B", age: "42", fileNumber: "D-1" })).toEqual({
      ok: true,
      identity: { name: "A B", age: 42, fileNumber: null },
    });
    expect(parseIdentity({ mode: "required", extra: "age" }, { name: "A B", age: "131" })).toEqual({ ok: false, error: "identity_invalid" });
    expect(parseIdentity({ mode: "required", extra: "age" }, { name: "A B", age: "4.5" })).toEqual({ ok: false, error: "identity_invalid" });
    expect(parseIdentity({ mode: "optional", extra: "file_number" }, { name: "A B", age: 3, fileNumber: " D-123 " })).toEqual({
      ok: true,
      identity: { name: "A B", age: null, fileNumber: "D-123" },
    });
  });
  it("ligne affichée au personnel", () => {
    expect(identityLine({ name: "Bathilde Essomba", age: 61 }, labels)).toBe("Bathilde Essomba · 61 ans");
    expect(identityLine({ name: "Bathilde Essomba", fileNumber: "D-9" }, labels)).toBe("Bathilde Essomba · Dossier D-9");
    expect(identityLine(null, labels)).toBeNull();
  });
});
