import { describe, expect, it } from "vitest";
import { isOnlineUnavailable } from "./online-unavailable";

describe("refus liés à l'abonnement côté client", () => {
  it("abonnement, quota et formule : message neutre ; autres erreurs : message habituel", () => {
    for (const code of ["subscription_read_only", "monthly_quota_reached", "feature_unavailable"]) expect(isOnlineUnavailable(code)).toBe(true);
    for (const code of ["branch_closed", "rate_limited", "generic", null]) expect(isOnlineUnavailable(code)).toBe(false);
  });
});
