import { describe, expect, it } from "vitest";
import fixtures from "./pricing.fixtures.json";
import {
  accountEmail,
  accountSmsText,
  accountTemplateParams,
  accountWhatsappText,
  ACCOUNT_TEMPLATES,
  annualSavings,
  billingBanner,
  canIssue,
  computeSubscriptionPrice,
  formatBillingDate,
  guessChannel,
  maskMsisdn,
  targetStatus,
  type PriceInput,
} from "./index";

describe("computeSubscriptionPrice (parité avec public.subscription_price)", () => {
  for (const c of fixtures.cases) {
    it(c.name, () => {
      expect(computeSubscriptionPrice(c as unknown as PriceInput)).toEqual(c.expected);
    });
  }
  it("économie annuelle = mois offerts", () => {
    expect(annualSavings(45000, 2)).toBe(90000);
  });
});

describe("targetStatus (parité avec public.subscription_target_status)", () => {
  const now = new Date("2026-11-10T20:00:00Z");
  const base = { trialEndsAt: null, currentPeriodEnd: null, graceEndsAt: null, readOnlySince: null };
  it("fin d'essai → lecture seule", () => {
    expect(targetStatus({ ...base, status: "trialing", trialEndsAt: "2026-11-10T19:00:00Z" }, 7, now)).toBe("read_only");
    expect(targetStatus({ ...base, status: "trialing", trialEndsAt: "2026-11-11T19:00:00Z" }, 7, now)).toBe("trialing");
  });
  it("échéance passée → grâce, fin de grâce → lecture seule", () => {
    expect(targetStatus({ ...base, status: "active", currentPeriodEnd: "2026-11-10T00:00:00Z" }, 7, now)).toBe("past_due");
    expect(targetStatus({ ...base, status: "past_due", graceEndsAt: "2026-11-10T00:00:00Z" }, 7, now)).toBe("read_only");
  });
  it("lecture seule depuis N jours → suspendu", () => {
    expect(targetStatus({ ...base, status: "read_only", readOnlySince: "2026-11-03T20:00:00Z" }, 7, now)).toBe("suspended");
    expect(targetStatus({ ...base, status: "read_only", readOnlySince: "2026-11-04T20:00:00Z" }, 7, now)).toBe("read_only");
  });
  it("émission bloquée seulement en lecture seule ou suspendu", () => {
    expect(["trialing", "active", "past_due", "read_only", "suspended"].map((s) => canIssue(s as never))).toEqual([true, true, true, false, false]);
  });
});

describe("billingBanner", () => {
  const now = new Date("2026-11-10T08:00:00Z");
  it("essai : seulement les 7 derniers jours", () => {
    expect(billingBanner({ status: "trialing", trialEndsAt: "2026-11-20T08:00:00Z", graceEndsAt: null }, now)).toBeNull();
    expect(billingBanner({ status: "trialing", trialEndsAt: "2026-11-13T08:00:00Z", graceEndsAt: null }, now)).toEqual({ kind: "trial", daysLeft: 3 });
  });
  it("grâce, lecture seule, actif", () => {
    expect(billingBanner({ status: "past_due", trialEndsAt: null, graceEndsAt: "2026-11-12T08:00:00Z" }, now)).toEqual({ kind: "past_due", daysLeft: 2 });
    expect(billingBanner({ status: "read_only", trialEndsAt: null, graceEndsAt: null }, now)).toEqual({ kind: "read_only" });
    expect(billingBanner({ status: "active", trialEndsAt: null, graceEndsAt: null }, now)).toBeNull();
    expect(billingBanner(null, now)).toBeNull();
  });
});

describe("numéros", () => {
  it("masque identique à la base", () => {
    expect(maskMsisdn("+237677100001")).toBe("+2376•• •• •• 01");
  });
  it("opérateur deviné", () => {
    expect(guessChannel("+237677100001")).toBe("mtn_momo");
    expect(guessChannel("+237699100001")).toBe("orange_money");
    expect(guessChannel("+237652100001")).toBe("mtn_momo");
    expect(guessChannel("+237657100001")).toBe("orange_money");
    expect(guessChannel("+237222100001")).toBeNull();
  });
});

describe("messages du compte", () => {
  const data = {
    reminder: "trial_end" as const,
    organization: "Clinique du Lac",
    date: "2026-11-12",
    amount_xaf: 45000,
    link: "https://example.test/pay/abc",
  };
  it("dates longues FR / EN", () => {
    expect(formatBillingDate("2026-11-12", "fr")).toBe("12 novembre 2026");
    expect(formatBillingDate("2026-11-12", "en")).toBe("12 November 2026");
  });
  it("rappel de fin d'essai : modèle et variables", () => {
    expect(accountTemplateParams("billing_reminder", "fr", data)).toHaveLength(4);
    const text = accountWhatsappText("billing_reminder", "fr", data);
    expect(text).toContain("Clinique du Lac");
    expect(text).toContain("12 novembre 2026");
    expect(text).toContain("https://example.test/pay/abc");
    expect(text).not.toMatch(/\{\{\d\}\}/);
  });
  it("code : même modèle d'authentification que M9", () => {
    expect(ACCOUNT_TEMPLATES.phone_code.name).toBe("code_verification");
    expect(accountWhatsappText("phone_code", "en", { code: "123456" })).toContain("*123456*");
  });
  it("chaque modèle remplit toutes ses variables, FR et EN", () => {
    for (const [key, t] of Object.entries(ACCOUNT_TEMPLATES)) {
      for (const locale of ["fr", "en"] as const) {
        const vars = t.body[locale].match(/\{\{\d+\}\}/g)?.length ?? 0;
        expect(t.params({ ...data, until: "2026-11-20", invoice: "FAC-2026-000001", period_end: "2026-12-12", used: 1200, quota: 1500, code: "1" }, locale), key).toHaveLength(vars);
      }
    }
  });
  it("SMS en GSM-7, 160 caractères au plus", () => {
    const kinds = [
      ["phone_code", { code: "123456" }],
      ["billing_reminder", data],
      ["billing_reminder", { ...data, reminder: "period_end" }],
      ["billing_reminder", { ...data, reminder: "grace", until: "2026-11-19" }],
      ["deletion_notice", { ...data, until: "2026-12-12" }],
      ["payment_confirmed", { invoice: "FAC-2026-000123", period_end: "2026-12-12" }],
      ["quota_alert", { used: 1200, quota: 1500, link: data.link }],
    ] as const;
    for (const [kind, d] of kinds) {
      for (const locale of ["fr", "en"] as const) {
        const sms = accountSmsText(kind, locale, d);
        expect(sms.length, `${kind} ${locale}`).toBeLessThanOrEqual(160);
        expect(sms).toMatch(/^[\x20-\x7e]*$/);
      }
    }
  });
  it("e-mail : objet et signature", () => {
    const mail = accountEmail("payment_confirmed", "fr", { invoice: "FAC-2026-000001", amount_xaf: 25000, organization: "X", period_end: "2026-12-01", link: "l" });
    expect(mail.subject).toContain("FAC-2026-000001");
    expect(mail.text).toContain("NextIn par Wintek");
  });
});
