import { describe, expect, it } from "vitest";
import { signupSchema } from "@nextin/shared/schemas";
import { messages } from "@nextin/shared/i18n";
import { fieldErrorsFrom, mapAuthError } from "./errors";

describe("mapAuthError", () => {
  it("traduit les codes Supabase connus", () => {
    expect(mapAuthError({ code: "invalid_credentials" })).toBe("invalid_credentials");
    expect(mapAuthError({ code: "email_exists" })).toBe("user_already_exists");
    expect(mapAuthError({ code: "over_email_send_rate_limit" })).toBe("rate_limited");
    expect(mapAuthError({ code: "otp_expired" })).toBe("code_invalid");
  });
  it("repli générique ou 429", () => {
    expect(mapAuthError({ code: "unexpected_failure" })).toBe("generic");
    expect(mapAuthError({ status: 429 })).toBe("rate_limited");
    expect(mapAuthError(null)).toBe("generic");
  });
  it("chaque code produit existe dans les deux langues", () => {
    for (const code of ["invalid_credentials", "user_already_exists", "rate_limited", "code_invalid", "generic"] as const) {
      expect(messages.fr.errors[code]).toBeTruthy();
      expect(messages.en.errors[code]).toBeTruthy();
    }
  });
});

describe("fieldErrorsFrom", () => {
  it("une erreur par champ, clés du dictionnaire", () => {
    const r = signupSchema.safeParse({ fullName: "A", email: "pas-un-email", password: "court" });
    expect(r.success).toBe(false);
    const fe = fieldErrorsFrom(r.error!, Object.keys(messages.fr.errors));
    expect(fe).toEqual({ fullName: "name_too_short", email: "email_invalid", password: "password_too_short" });
  });
});
