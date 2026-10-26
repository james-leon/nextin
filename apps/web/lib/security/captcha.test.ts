import { describe, expect, it, vi } from "vitest";
import { captchaConfig, verifyCaptchaToken } from "./captcha";

describe("captchaConfig", () => {
  it("actif avec les deux clés", () => {
    expect(captchaConfig({ NEXT_PUBLIC_TURNSTILE_SITE_KEY: "site", TURNSTILE_SECRET_KEY: "secret" })).toEqual({
      enabled: true,
      siteKey: "site",
    });
  });
  it("désactivé en local sans clé", () => {
    expect(captchaConfig({ APP_URL: "http://localhost:3000" })).toEqual({ enabled: false, siteKey: null });
    expect(captchaConfig({})).toEqual({ enabled: false, siteKey: null });
  });
  it("refuse une configuration à moitié faite", () => {
    expect(() => captchaConfig({ NEXT_PUBLIC_TURNSTILE_SITE_KEY: "site" })).toThrow(/half-configured/);
  });
  it("refuse un déploiement public sans clé", () => {
    expect(() => captchaConfig({ APP_URL: "https://nextin.example" })).toThrow(/required/);
  });
});

describe("verifyCaptchaToken", () => {
  it("laisse passer quand Turnstile est désactivé", async () => {
    expect(await verifyCaptchaToken(undefined, { env: {} })).toEqual({ ok: true });
  });
  it("vérifie auprès de Cloudflare quand il est actif", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ success: false, "error-codes": ["invalid-input-response"] })));
    const r = await verifyCaptchaToken("tok", {
      env: { NEXT_PUBLIC_TURNSTILE_SITE_KEY: "s", TURNSTILE_SECRET_KEY: "k" },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(r).toEqual({ ok: false, reason: "invalid-input-response" });
  });
});
