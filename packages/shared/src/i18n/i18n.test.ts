import { describe, expect, it } from "vitest";
import { localeFromAcceptLanguage, messages } from "./index";

function keys(obj: object, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === "string" ? [`${prefix}${k}`] : keys(v as object, `${prefix}${k}.`),
  );
}

function placeholders(obj: object): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const walk = (o: object, p: string) => {
    for (const [k, v] of Object.entries(o)) {
      if (typeof v === "string") out[`${p}${k}`] = (v.match(/\{\w+\}/g) ?? []).sort();
      else walk(v as object, `${p}${k}.`);
    }
  };
  walk(obj, "");
  return out;
}

describe("i18n", () => {
  it("FR et EN ont exactement les mêmes clés", () => {
    expect(keys(messages.en).sort()).toEqual(keys(messages.fr).sort());
  });
  it("les variables {x} sont identiques dans les deux langues", () => {
    expect(placeholders(messages.en)).toEqual(placeholders(messages.fr));
  });
  it("aucune chaîne vide", () => {
    for (const locale of ["fr", "en"] as const) {
      const p = placeholders(messages[locale]);
      for (const key of Object.keys(p)) {
        const value = key.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], messages[locale]);
        expect(value, `${locale}:${key}`).not.toBe("");
      }
    }
  });
  it("Accept-Language : FR par défaut, EN si préféré", () => {
    expect(localeFromAcceptLanguage(null)).toBe("fr");
    expect(localeFromAcceptLanguage("de-DE,de;q=0.9")).toBe("fr");
    expect(localeFromAcceptLanguage("en-US,en;q=0.9,fr;q=0.8")).toBe("en");
    expect(localeFromAcceptLanguage("fr-CM,en;q=0.5")).toBe("fr");
    expect(localeFromAcceptLanguage("de;q=0.9,en;q=0.4")).toBe("en");
  });
});
