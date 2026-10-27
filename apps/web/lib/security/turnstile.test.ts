import { describe, expect, it, vi } from "vitest";
import { isTurnstileTestSecret, verifyTurnstile } from "./turnstile";

function fakeFetch(payload: unknown, status = 200) {
  return vi.fn(async () => new Response(JSON.stringify(payload), { status })) as unknown as typeof fetch;
}

describe("verifyTurnstile", () => {
  it("refuse un jeton absent sans appeler Cloudflare", async () => {
    const f = fakeFetch({ success: true });
    expect(await verifyTurnstile(undefined, { secret: "s", fetchImpl: f })).toEqual({
      ok: false,
      reason: "missing-input-response",
    });
    expect(f).not.toHaveBeenCalled();
  });

  it("accepte un jeton valide et transmet l'IP", async () => {
    const f = fakeFetch({ success: true, action: "take_ticket" });
    const r = await verifyTurnstile("tok", { secret: "s", remoteIp: "1.2.3.4", expectedAction: "take_ticket", fetchImpl: f });
    expect(r).toEqual({ ok: true });
    const body = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![1].body as URLSearchParams;
    expect(body.get("remoteip")).toBe("1.2.3.4");
    expect(body.get("secret")).toBe("s");
  });

  it("propage le code d'erreur Cloudflare", async () => {
    const r = await verifyTurnstile("tok", { secret: "s", fetchImpl: fakeFetch({ success: false, "error-codes": ["timeout-or-duplicate"] }) });
    expect(r).toEqual({ ok: false, reason: "timeout-or-duplicate" });
  });

  it("rejette une action inattendue, une erreur HTTP et une panne réseau", async () => {
    expect(
      await verifyTurnstile("tok", { secret: "s", expectedAction: "take_ticket", fetchImpl: fakeFetch({ success: true, action: "login" }) }),
    ).toEqual({ ok: false, reason: "action-mismatch" });
    expect(await verifyTurnstile("tok", { secret: "s", fetchImpl: fakeFetch({}, 500) })).toEqual({ ok: false, reason: "http-500" });
    const broken = vi.fn(async () => {
      throw new TypeError("offline");
    }) as unknown as typeof fetch;
    expect(await verifyTurnstile("tok", { secret: "s", fetchImpl: broken })).toEqual({ ok: false, reason: "network-error" });
  });

  it("refuse une action différente avec une vraie clé", async () => {
    const r = await verifyTurnstile("tok", { secret: "0x4AAAAAAAreal", expectedAction: "take_ticket", fetchImpl: fakeFetch({ success: true, action: "login" }) });
    expect(r).toEqual({ ok: false, reason: "action-mismatch" });
  });

  it("n'exige pas l'action avec les clés de test Cloudflare", async () => {
    const secret = "1x0000000000000000000000000000000AA";
    expect(isTurnstileTestSecret(secret)).toBe(true);
    expect(isTurnstileTestSecret("2x0000000000000000000000000000000AA")).toBe(true);
    expect(isTurnstileTestSecret("0x4AAAAAAAreal")).toBe(false);
    const r = await verifyTurnstile("tok", { secret, expectedAction: "take_ticket", fetchImpl: fakeFetch({ success: true, action: "" }) });
    expect(r).toEqual({ ok: true });
  });
});
