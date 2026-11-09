import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, documentSecurityHeaders } from "./headers";

describe("en-têtes de sécurité", () => {
  const prod = {
    NODE_ENV: "production",
    APP_URL: "https://app.nextin.example",
    NEXT_PUBLIC_SUPABASE_URL: "https://abcd.supabase.co",
    NEXT_PUBLIC_MAP_TILES_URL: "https://tiles.example.com/{z}/{x}/{y}.png?key=k",
  };
  it("CSP de production : origines prévues seulement, pas d'eval, pas de cadre, HTTPS forcé", () => {
    const csp = contentSecurityPolicy(prod);
    expect(csp).toContain("connect-src 'self' https://abcd.supabase.co wss://abcd.supabase.co");
    expect(csp).toContain("img-src 'self' data: blob: https://abcd.supabase.co https://tiles.example.com");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("upgrade-insecure-requests");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).not.toContain("key=k");
  });
  it("local : temps réel en ws, eval en développement, pas de HSTS en HTTP", () => {
    const env = { NODE_ENV: "development", APP_URL: "http://localhost:3000", NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321" };
    expect(contentSecurityPolicy(env)).toContain("ws://127.0.0.1:54321");
    expect(contentSecurityPolicy(env)).toContain("'unsafe-eval'");
    expect(documentSecurityHeaders(env).some((h) => h.key === "Strict-Transport-Security")).toBe(false);
    expect(documentSecurityHeaders(prod).find((h) => h.key === "Strict-Transport-Security")?.value).toBe("max-age=63072000; includeSubDomains");
  });
});
