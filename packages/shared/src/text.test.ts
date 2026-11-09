import { describe, expect, it } from "vitest";
import { randomSlugSuffix, safeNextPath, slugWithSuffix, slugify } from "./text";

describe("slugify", () => {
  it.each([
    ["DOUALA CLINIC", "douala-clinic"],
    ["Clinique Sainte-Thérèse d'Akwa", "clinique-sainte-therese-d-akwa"],
    ["  Eneo — Agence Bonanjo  ", "eneo-agence-bonanjo"],
    ["Hôpital Laquintinie", "hopital-laquintinie"],
  ])("%s → %s", (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });
  it("respecte les bornes 3–48", () => {
    expect(slugify("A").length).toBeGreaterThanOrEqual(3);
    expect(slugify("x".repeat(80)).length).toBe(48);
    expect(slugify("€€€")).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });
  it("suffixe numéroté sans dépasser 48", () => {
    expect(slugWithSuffix("douala-clinic", 2)).toBe("douala-clinic-2");
    expect(slugWithSuffix("x".repeat(48), 12)).toHaveLength(48);
    expect(slugWithSuffix("douala-clinic", "k7p4")).toBe("douala-clinic-k7p4");
  });
  it("suffixe aléatoire valide pour un slug", () => {
    const s = randomSlugSuffix();
    expect(s).toMatch(/^[a-z2-9]{4}$/);
    expect(slugWithSuffix("eneo", s)).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });
});

describe("safeNextPath", () => {
  it.each([
    ["/app", "/app"],
    ["/invite/abc?x=1", "/invite/abc?x=1"],
    ["https://evil.example", "/app"],
    ["//evil.example/app", "/app"],
    ["/\\evil.example", "/app"],
    ["javascript:alert(1)", "/app"],
    [undefined, "/app"],
  ])("%s → %s", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });
});
