import { describe, expect, it } from "vitest";
import { fr } from "../i18n/fr";
import { QUEUE_ERROR_CODES, queueErrorCode, queueErrorStatus } from "./errors";

describe("queueErrorCode", () => {
  it("reconnaît les codes métier levés par les RPC", () => {
    expect(queueErrorCode({ code: "P0409", message: "counter_busy" })).toBe("counter_busy");
    expect(queueErrorCode({ code: "P0422", message: "active_ticket_exists" })).toBe("active_ticket_exists");
  });
  it("traduit les refus de droits", () => {
    expect(queueErrorCode({ code: "42501", message: "permission denied for function take_ticket" })).toBe("not_allowed");
  });
  it("ignore les autres erreurs", () => {
    expect(queueErrorCode({ code: "XX000", message: "boom" })).toBeNull();
    expect(queueErrorCode(null)).toBeNull();
  });
  it("chaque code a un message et un statut HTTP", () => {
    for (const code of QUEUE_ERROR_CODES) {
      expect(fr.errors[code]).toBeTruthy();
      expect(queueErrorStatus(code)).toBeGreaterThanOrEqual(400);
    }
    expect(queueErrorStatus("active_ticket_exists")).toBe(409);
    expect(queueErrorStatus("rate_limited")).toBe(429);
  });
});
