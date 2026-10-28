import { describe, expect, it, vi } from "vitest";
import { sendAccountMessage, type ClaimedAccountMessage } from "@/lib/notifications/account";
import { consoleEmail } from "@/lib/notifications/providers/email";
import { fakePush } from "@/lib/notifications/providers/push";
import { consoleSms } from "@/lib/notifications/providers/sms";
import { fakeWhatsApp } from "@/lib/notifications/providers/whatsapp";
import { formatXafPlain } from "./format";
import { invoiceContent } from "./invoice-content";
import type { InvoiceDocumentData } from "./types";

const t = (key: string, v?: Record<string, string | number>) => (v ? `${key}:${Object.values(v).join("|")}` : key);

const invoice: InvoiceDocumentData = {
  id: "i1",
  number: "FAC-2026-000042",
  status: "paid",
  billing_period: "annual",
  period_start: "2026-11-01T00:00:00Z",
  period_end: "2027-11-01T00:00:00Z",
  lines: [
    { kind: "plan", label: "Pro", label_en: "Pro", quantity: 10, unit_xaf: 45000, amount_xaf: 450000 },
    { kind: "annual_note", label: "Paiement annuel : 2 mois offerts", label_en: "Annual payment: 2 months free", amount_xaf: 0 },
    { kind: "discount", label: "Remise · Partenaire", label_en: "Discount · Partner", amount_xaf: -45000 },
  ],
  subtotal_xaf: 450000,
  discount_xaf: 45000,
  vat_rate: 0,
  tax_xaf: 0,
  total_xaf: 405000,
  issued_at: "2026-10-25T08:00:00Z",
  due_at: "2026-11-01T00:00:00Z",
  paid_at: "2026-10-26T10:00:00Z",
  paid_channel: "orange_money",
  buyer_snapshot: { name: "DOUALA CLINIC", phone: "+237677000000", email: null, city: "Douala" },
  seller_snapshot: { legal_name: "Wintek SARL", rc: "RC/DLA/2024/B/1234", niu: "M012345678901A", address: "Akwa, Douala", phone: "", email: "", footer: "Merci" },
};

describe("facture PDF : contenu depuis l'instantané figé", () => {
  it("lignes, remise, TVA non applicable, cachet « payée »", () => {
    const c = invoiceContent(invoice, "fr", t, (k) => (k === "orange_money" ? "Orange Money" : k));
    expect(c.number).toBe("FAC-2026-000042");
    expect(c.seller.lines).toEqual(["Wintek SARL", "Akwa, Douala", "rc:RC/DLA/2024/B/1234", "niu:M012345678901A"]);
    expect(c.buyer.lines[0]).toBe("DOUALA CLINIC");
    expect(c.lines.map((l) => l.amount)).toEqual([formatXafPlain(450000, "fr"), "", formatXafPlain(-45000, "fr")]);
    expect(c.totals.map((r) => r.label)).toEqual(["subtotal", "discount", "noTax", "total"]);
    expect(c.totals.at(-1)).toMatchObject({ value: formatXafPlain(405000, "fr"), strong: true });
    expect(c.stamp).toEqual({ text: expect.stringContaining("Orange Money"), tone: "paid" });
  });
  it("montants sans espace fine (absente de la police embarquée)", () => {
    expect(formatXafPlain(1900000, "fr")).not.toMatch(/[  ]/);
  });
  it("TVA appliquée et facture annulée", () => {
    const c = invoiceContent({ ...invoice, status: "void", vat_rate: 19.25, tax_xaf: 77963 }, "en", t, (k) => k);
    expect(c.totals[2]).toEqual({ label: "tax:19.25", value: formatXafPlain(77963, "en") });
    expect(c.stamp).toEqual({ text: "voided", tone: "void" });
    expect(c.lines[0]!.label).toBe("Pro");
  });
});

function providers() {
  const whatsapp = fakeWhatsApp();
  return {
    whatsapp: { ...whatsapp, sendTemplate: vi.fn(whatsapp.sendTemplate), sendText: vi.fn(whatsapp.sendText) },
    sms: { ...consoleSms(), send: vi.fn(consoleSms().send) },
    push: fakePush(),
    email: { ...consoleEmail(), send: vi.fn(consoleEmail().send) },
  };
}

const base: ClaimedAccountMessage = {
  id: "m1",
  organization_id: "00000000-0000-0000-0000-000000000001",
  kind: "billing_reminder",
  channel: "whatsapp",
  to_phone: "+237677000000",
  to_email: null,
  locale: "fr",
  payload: { reminder: "period_end", organization: "DOUALA CLINIC", date: "2026-11-12", amount_xaf: 45000, pay_token: "A".repeat(32) },
  attempt: 1,
};

describe("messages du compte", () => {
  it("rappel : modèle Meta avec le lien de paiement", async () => {
    const p = providers();
    expect(await sendAccountMessage(base, p)).toEqual({ status: "sent" });
    const [to, name, lang, params] = p.whatsapp.sendTemplate.mock.calls[0]!;
    expect([to, name, lang]).toEqual(["+237677000000", "rappel_echeance", "fr"]);
    expect(params.at(-1)).toMatch(/\/pay\/A{32}$/);
  });
  it("code de vérification : modèle d'authentification, code transmis au bouton", async () => {
    const p = providers();
    await sendAccountMessage({ ...base, kind: "phone_code", payload: { code: "123456" } }, p);
    expect(p.whatsapp.sendTemplate.mock.calls[0]!.slice(1, 2)).toEqual(["code_verification"]);
    expect(p.whatsapp.sendTemplate.mock.calls[0]![4]).toBe("123456");
  });
  it("code déjà effacé (vérifié) : rien n'est envoyé", async () => {
    const p = providers();
    expect(await sendAccountMessage({ ...base, kind: "phone_code", payload: {} }, p)).toMatchObject({ status: "skipped" });
    expect(p.whatsapp.sendTemplate).not.toHaveBeenCalled();
  });
  it("e-mail : reçu de paiement avec lien vers la page Abonnement", async () => {
    const p = providers();
    await sendAccountMessage(
      { ...base, kind: "payment_confirmed", channel: "email", to_phone: null, to_email: "dir@clinique.test", payload: { invoice: "FAC-2026-000001", amount_xaf: 25000, period_end: "2026-12-01" } },
      p,
    );
    const [to, subject, text] = p.email.send.mock.calls[0]!;
    expect(to).toBe("dir@clinique.test");
    expect(subject).toContain("FAC-2026-000001");
    expect(text).toContain("/app/o/00000000-0000-0000-0000-000000000001/billing");
  });
  it("SMS de secours en GSM-7", async () => {
    const p = providers();
    await sendAccountMessage({ ...base, channel: "sms", payload: { ...base.payload, reminder: "grace", until: "2026-11-19" } }, p);
    expect(p.sms.send.mock.calls[0]![1]).toMatch(/^[\x20-\x7e]+$/);
  });
  it("échec temporaire : nouvel essai, puis définitif au 3e", async () => {
    const p = providers();
    p.whatsapp.sendTemplate.mockResolvedValue({ ok: false, retryable: true, error: "503" });
    expect((await sendAccountMessage(base, p)).retryIn).toBeGreaterThan(0);
    expect((await sendAccountMessage({ ...base, attempt: 3 }, p)).retryIn).toBeNull();
  });
});
