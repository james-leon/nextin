import { describe, expect, it } from "vitest";
import { initialsOf } from "./initials";

describe("initialsOf", () => {
  it("prend la première et la dernière initiale, sans titre", () => {
    expect(initialsOf("Douala Clinic")).toBe("DC");
    expect(initialsOf("Dr Joseph Ekwalla")).toBe("JE");
    expect(initialsOf("Mme Ngo Biyong Anne")).toBe("NA");
  });
  it("un seul mot ou vide", () => {
    expect(initialsOf("eneo")).toBe("EN");
    expect(initialsOf("  ")).toBe("");
  });
});
