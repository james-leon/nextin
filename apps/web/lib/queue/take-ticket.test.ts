import { describe, expect, it, vi } from "vitest";
import { handleTakeTicket, type TakeTicketDeps } from "./take-ticket";

const env = { APP_URL: "http://localhost:3000" };
const serviceId = "6f1c1f9e-4b8a-4b8f-9a55-3c3c1d2a7b10";
const token = "AbCdEfGhIjKlMnOpQrStUv";
const body = { serviceId, source: "qr", entryCode: token };

function deps(overrides: Partial<TakeTicketDeps> = {}): TakeTicketDeps {
  return {
    userId: "e3000000-0000-0000-0000-000000000001",
    ipHash: "hash",
    verifyCaptcha: async () => ({ ok: true }),
    throttle: async () => true,
    take: async () => ({ data: { public_token: token, display_code: "C-047" }, error: null }),
    env,
    ...overrides,
  };
}

describe("handleTakeTicket", () => {
  it("crée le ticket et renvoie son lien", async () => {
    const r = await handleTakeTicket(body, deps());
    expect(r).toEqual({
      status: 201,
      body: { ok: true, ticket: { publicToken: token, displayCode: "C-047", url: `http://localhost:3000/t/${token}` } },
    });
  });

  it("valide la demande avant tout appel", async () => {
    const take = vi.fn();
    const r = await handleTakeTicket({ serviceId, source: "qr" }, deps({ take }));
    expect(r).toEqual({ status: 400, body: { ok: false, error: "invalid_entry" } });
    expect(take).not.toHaveBeenCalled();
  });

  it("exige une session", async () => {
    expect((await handleTakeTicket(body, deps({ userId: null }))).status).toBe(401);
  });

  it("limite avant le captcha", async () => {
    const verifyCaptcha = vi.fn();
    const r = await handleTakeTicket(body, deps({ throttle: async () => false, verifyCaptcha }));
    expect(r).toEqual({ status: 429, body: { ok: false, error: "rate_limited" } });
    expect(verifyCaptcha).not.toHaveBeenCalled();
  });

  it("refuse un captcha invalide", async () => {
    const r = await handleTakeTicket(body, deps({ verifyCaptcha: async () => ({ ok: false, reason: "rejected" }) }));
    expect(r.body).toEqual({ ok: false, error: "captcha_failed" });
  });

  it("rend le ticket déjà actif", async () => {
    const r = await handleTakeTicket(
      body,
      deps({ take: async () => ({ data: null, error: { code: "P0422", message: "active_ticket_exists", details: token } }) }),
    );
    expect(r).toEqual({ status: 409, body: { ok: false, error: "active_ticket_exists", ticketUrl: `http://localhost:3000/t/${token}` } });
  });

  it("traduit les erreurs métier et masque les autres", async () => {
    const closed = await handleTakeTicket(body, deps({ take: async () => ({ data: null, error: { code: "P0410", message: "branch_closed" } }) }));
    expect(closed).toEqual({ status: 410, body: { ok: false, error: "branch_closed" } });
    const boom = await handleTakeTicket(body, deps({ take: async () => ({ data: null, error: { code: "XX000", message: "boom" } }) }));
    expect(boom).toEqual({ status: 500, body: { ok: false, error: "generic" } });
  });
});
