import { describe, expect, it } from "vitest";
import { clientLogLine, clientLogSchema, createClientLogLimiter, deviceFamily, scrub, scrubPath } from "./client-log";

describe("journal des erreurs du navigateur", () => {
  it("masque adresses e-mail, numéros de téléphone et jetons", () => {
    expect(scrub("Échec pour leonel@exemple.cm")).toBe("Échec pour [email]");
    expect(scrub("Numéro +237 6 99 00 11 22 refusé")).toBe("Numéro [n] refusé");
    expect(scrub("ticket AbCdEfGhIjKlMnOpQrStUv introuvable")).toBe("ticket … introuvable");
    expect(scrub("agence d495b857-52fd-45d3-99cc-9ae25924f78a")).toBe("agence …");
    expect(scrub("TypeError: undefined is not an object (evaluating 'a.b')")).toBe("TypeError: undefined is not an object (evaluating 'a.b')");
  });

  it("garde le chemin seul, sans origine, paramètres ni jeton", () => {
    expect(scrubPath("https://nextin.cm/t/AbCdEfGhIjKlMnOpQrStUv?x=1#y")).toBe("/t/…");
    expect(scrubPath("/r/AbCdEfGhIjKlMnOpQrStUv/calendar")).toBe("/r/…/calendar");
    expect(scrubPath("/_next/static/chunks/1_zjt64hmoooq.js")).toBe("/_next/static/chunks/1_zjt64hmoooq.js");
    expect(scrubPath(undefined)).toBeUndefined();
  });

  it("refuse les champs inconnus et les messages trop longs", () => {
    expect(clientLogSchema.safeParse({ kind: "error", message: "x" }).success).toBe(true);
    expect(clientLogSchema.safeParse({ kind: "error", message: "x", email: "a@b.cm" }).success).toBe(false);
    expect(clientLogSchema.safeParse({ kind: "other", message: "x" }).success).toBe(false);
    expect(clientLogSchema.safeParse({ kind: "error", message: "x".repeat(501) }).success).toBe(false);
  });

  it("ligne de journal sans donnée personnelle", () => {
    const line = clientLogLine(
      { kind: "sw", message: "navigation_timeout_offline", path: "/t/AbCdEfGhIjKlMnOpQrStUv", sw: "nextin-v4", standalone: true },
      deviceFamily("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1"),
    );
    expect(line).toEqual({ kind: "sw", message: "navigation_timeout_offline", path: "/t/…", sw: "nextin-v4", standalone: true, device: "iphone" });
  });

  it("limite par adresse : dix par minute, puis de nouveau après la fenêtre", () => {
    const allow = createClientLogLimiter(10, 60_000);
    const now = 1_000_000;
    for (let i = 0; i < 10; i++) expect(allow("a", now)).toBe(true);
    expect(allow("a", now)).toBe(false);
    expect(allow("b", now)).toBe(true);
    expect(allow("a", now + 60_001)).toBe(true);
  });
});
