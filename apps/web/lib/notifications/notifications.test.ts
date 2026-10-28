import { describe, expect, it, vi } from "vitest";
import { sendJob, type ClaimedJob } from "./send";
import { signMetaPayload, verifyMetaSignature } from "./signature";
import { cloudWhatsApp, fakeWhatsApp } from "./providers/whatsapp";
import { consoleSms } from "./providers/sms";
import { fakePush } from "./providers/push";
import type { TicketView } from "@/lib/client/types";

process.env.APP_URL = "http://localhost:3000";

const ticket = {
  id: "t1",
  display_code: "C-047",
  status: "waiting",
  source: "reception",
  priority_reason: null,
  service: { id: "s", name: "Consultation", name_en: null, prefix: "C", color: "#1A6BB5" },
  branch: { id: "b", name: "Akwa" },
  organization: { name: "DOUALA CLINIC", default_locale: "fr" },
  position: 4,
  wait_seconds: 1500,
  counter: null,
  called_at: null,
  serving_started_at: null,
  finished_at: null,
  rating: null,
  rating_enabled: true,
  created_at: "2026-10-28T08:00:00Z",
} as TicketView;

function job(over: Partial<ClaimedJob> = {}): ClaimedJob {
  return {
    id: "j1",
    event: "ticket_confirmed",
    channel: "whatsapp",
    attempt: 1,
    payload: {},
    guard: false,
    fallback_status: null,
    contact: {
      id: "c1",
      phone_e164: "+237690000001",
      locale: "fr",
      push_subscription: null,
      window_expires_at: null,
      opted_out: false,
    },
    token: "Xk3QpL9vR2mT8wYz4b7K3Q",
    ticket,
    ...over,
  };
}

function providers() {
  const whatsapp = fakeWhatsApp();
  return {
    whatsapp: { ...whatsapp, sendText: vi.fn(whatsapp.sendText), sendTemplate: vi.fn(whatsapp.sendTemplate) },
    sms: consoleSms(),
    push: fakePush(),
  };
}

describe("signature des webhooks Meta", () => {
  it("accepte la bonne signature, refuse une signature modifiée ou absente", () => {
    const body = '{"object":"whatsapp_business_account"}';
    const header = signMetaPayload(body, "secret");
    expect(verifyMetaSignature(body, header, "secret")).toBe(true);
    expect(verifyMetaSignature(`${body} `, header, "secret")).toBe(false);
    expect(verifyMetaSignature(body, header, "autre")).toBe(false);
    expect(verifyMetaSignature(body, null, "secret")).toBe(false);
    expect(verifyMetaSignature(body, "sha256=abc", "secret")).toBe(false);
  });
});

describe("envoi d'un job", () => {
  it("hors fenêtre de 24 h : modèle approuvé avec ses variables", async () => {
    const p = providers();
    const out = await sendJob(job(), p);
    expect(out).toMatchObject({ status: "sent", template: "ticket_confirme" });
    expect(p.whatsapp.sendTemplate).toHaveBeenCalledWith("+237690000001", "ticket_confirme", "fr", [
      "C-047",
      "DOUALA CLINIC – Akwa",
      "3",
      "25",
      "http://localhost:3000/t/Xk3QpL9vR2mT8wYz4b7K3Q",
    ]);
  });
  it("dans la fenêtre : message libre (même texte que le modèle)", async () => {
    const p = providers();
    const out = await sendJob(job({ contact: { ...job().contact!, window_expires_at: new Date(Date.now() + 3_600_000).toISOString(), locale: "en" } }), p);
    expect(p.whatsapp.sendText).toHaveBeenCalledOnce();
    expect(out.text).toMatch(/^Your ticket C-047 is confirmed at DOUALA CLINIC – Akwa\./);
    expect(out.template).toBeUndefined();
  });
  it("ticket déjà appelé : « bientôt votre tour » ignoré ; poste traduit pour « c'est votre tour »", async () => {
    const called = { ...ticket, status: "called", position: null, counter: { kind: "cabinet", number: 3, label: null } } as TicketView;
    expect(await sendJob(job({ event: "almost_your_turn", ticket: called }), providers())).toMatchObject({ status: "skipped", error: "not_relevant" });
    const out = await sendJob(job({ event: "your_turn", channel: "sms", ticket: called }), providers());
    expect(out).toMatchObject({ status: "sent", text: "NextIn : c'est votre tour ! Ticket C-047, presentez-vous : Cabinet 3." });
  });
  it("STOP : rien n'est envoyé ; délai de garde annulé si WhatsApp a été remis", async () => {
    const p = providers();
    expect(await sendJob(job({ contact: { ...job().contact!, opted_out: true } }), p)).toMatchObject({ status: "skipped", error: "opted_out" });
    expect(await sendJob(job({ channel: "sms", guard: true, fallback_status: "read" }), p)).toMatchObject({ status: "skipped" });
    expect(p.whatsapp.sendTemplate).not.toHaveBeenCalled();
  });
  it("échec définitif simulé (numéro de test en 99999) : pas de nouvel essai, le SMS prendra le relais", async () => {
    const out = await sendJob(job({ contact: { ...job().contact!, phone_e164: "+237690099999" } }), providers());
    expect(out).toMatchObject({ status: "failed", retryIn: null });
  });
  it("retard du praticien : heure de retour à Douala", async () => {
    const out = await sendJob(job({ event: "practitioner_late", channel: "sms", payload: { until: "2026-10-28T09:30:00Z" } }), providers());
    expect(out.text).toContain("retour vers 10:30");
  });
  it("push : abonnement expiré désactivé", async () => {
    const gone = vi.fn(async () => undefined);
    const push = { name: "web-push" as const, send: async () => ({ ok: false as const, retryable: false, gone: true, error: "push 410" }) };
    const out = await sendJob(
      job({ channel: "push", contact: { ...job().contact!, phone_e164: null, push_subscription: { endpoint: "https://push.test/x", keys: { p256dh: "k", auth: "a" } } } }),
      { ...providers(), push },
      gone,
    );
    expect(out.status).toBe("failed");
    expect(gone).toHaveBeenCalledWith("c1");
  });
});

describe("WhatsApp Cloud API", () => {
  it("requête d'un modèle et identifiant du message", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ messages: [{ id: "wamid.ABC" }] }), { status: 200 }));
    const wa = cloudWhatsApp({ token: "tok", phoneNumberId: "123" }, fetchMock as unknown as typeof fetch);
    expect(await wa.sendTemplate("+237690000001", "cest_votre_tour", "fr", ["C-047", "X", "Cabinet 3"])).toEqual({ ok: true, messageId: "wamid.ABC" });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/^https:\/\/graph\.facebook\.com\/v\d+\.0\/123\/messages$/);
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
    expect(JSON.parse(init.body as string)).toEqual({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: "237690000001",
      type: "template",
      template: {
        name: "cest_votre_tour",
        language: { code: "fr" },
        components: [{ type: "body", parameters: [{ type: "text", text: "C-047" }, { type: "text", text: "X" }, { type: "text", text: "Cabinet 3" }] }],
      },
    });
  });
  it("erreurs : limite de débit = nouvel essai ; destinataire injoignable = définitif", async () => {
    const reply = (status: number, code: number) => vi.fn(async () => new Response(JSON.stringify({ error: { code, message: "x" } }), { status }));
    const rate = cloudWhatsApp({ token: "t", phoneNumberId: "1" }, reply(400, 130429) as unknown as typeof fetch);
    expect(await rate.sendText("+237690000001", "x")).toMatchObject({ ok: false, retryable: true });
    const dead = cloudWhatsApp({ token: "t", phoneNumberId: "1" }, reply(400, 131026) as unknown as typeof fetch);
    expect(await dead.sendText("+237690000001", "x")).toMatchObject({ ok: false, retryable: false });
  });
});
