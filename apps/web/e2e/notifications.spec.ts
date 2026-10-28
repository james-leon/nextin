import { createHmac, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { expectAccessible } from "./helpers";
import { E2E_NOTIFY } from "./notify-env";
import { rpc, setUpBranch, supabaseOptions } from "./queue-helpers";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, supabaseOptions);

type Job = { event: string; channel: string; status: string; template_name: string | null; provider_message_id: string | null; guard: boolean; payload: { text?: string } };

async function jobs(ticketId: string): Promise<Job[]> {
  const { data } = await admin
    .from("notification_jobs")
    .select("event, channel, status, template_name, provider_message_id, guard, payload")
    .eq("ticket_id", ticketId)
    .order("created_at");
  return (data ?? []) as Job[];
}

/** Webhook WhatsApp signé comme Meta. */
async function webhook(request: APIRequestContext, value: Record<string, unknown>, secret = E2E_NOTIFY.WHATSAPP_APP_SECRET) {
  const body = JSON.stringify({ object: "whatsapp_business_account", entry: [{ id: "e2e", changes: [{ field: "messages", value }] }] });
  return request.post("/api/whatsapp/webhook", {
    data: body,
    headers: { "Content-Type": "application/json", "X-Hub-Signature-256": `sha256=${createHmac("sha256", secret).update(body).digest("hex")}` },
  });
}
const inbound = (from: string, text: string) => ({ messages: [{ id: `wamid.e2e.${randomUUID()}`, from, type: "text", text: { body: text } }] });

test.describe("M7 — notifications", () => {
  test.skip(({ isMobile }) => !isMobile, "parcours client sur téléphone");

  test("opt-in WhatsApp → confirmation → appel → remis → STOP", async ({ page, request }) => {
    const b = await setUpBranch("Clinique Alertes");
    // « Bientôt votre tour » quand il ne reste qu'une personne devant.
    await b.staff.from("branch_settings").update({ almost_turn_threshold: 1 }).eq("branch_id", b.branchId).select("branch_id").single();
    for (let i = 0; i < 2; i++) await rpc(b.staff, "reception_create_ticket", { p_service: b.serviceId });
    const ticket = await rpc<{ id: string; display_code: string; public_token: string }>(b.staff, "reception_create_ticket", { p_service: b.serviceId });
    const from = `2376${String(Date.now()).slice(-8)}`;

    await page.goto(`/t/${ticket.public_token}`);
    const button = page.getByRole("link", { name: "Recevoir mes alertes sur WhatsApp" });
    const optIn = `NEXTIN ${ticket.display_code} ${ticket.public_token.slice(-4)}`;
    await expect(button).toHaveAttribute("href", `https://wa.me/${E2E_NOTIFY.NEXT_PUBLIC_WHATSAPP_NUMBER}?text=${encodeURIComponent(optIn)}`);
    await expect(page.getByText("WhatsApp s'ouvre avec un message prérempli")).toBeVisible();
    await expectAccessible(page);

    // Signature absente ou fausse : refusé.
    expect((await request.post("/api/whatsapp/webhook", { data: "{}", headers: { "Content-Type": "application/json" } })).status()).toBe(401);
    expect((await webhook(request, inbound(from, optIn), "mauvais-secret")).status()).toBe(401);
    // Vérification de l'abonnement par Meta.
    const verify = await request.get(`/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=${E2E_NOTIFY.WHATSAPP_VERIFY_TOKEN}&hub.challenge=42`);
    expect(await verify.text()).toBe("42");

    // Le client envoie le message prérempli : alertes activées en direct sur la page, confirmation en message libre.
    const message = inbound(from, optIn);
    expect((await webhook(request, message)).status()).toBe(200);
    await expect(page.getByRole("status").filter({ hasText: "Alertes WhatsApp activées" })).toBeVisible();
    await expect(button).toHaveCount(0);
    await expect
      .poll(async () => (await jobs(ticket.id)).map((j) => `${j.event}/${j.status}`), { timeout: 15_000 })
      .toEqual(["ticket_confirmed/sent"]);
    const [confirmed] = await jobs(ticket.id);
    expect(confirmed!.template_name).toBeNull();
    expect(confirmed!.payload.text).toContain(`Votre ticket ${ticket.display_code} est bien enregistré chez Clinique Alertes – Akwa.`);
    expect(confirmed!.payload.text).toContain(`/t/${ticket.public_token}`);
    // Webhook rejoué par Meta : sans effet.
    await webhook(request, message);

    // Deux appels plus loin : « bientôt votre tour », puis « c'est votre tour » avec délai de garde SMS.
    const first = await rpc<{ id: string }>(b.staff, "call_next", { p_counter: b.counterId });
    await rpc(b.staff, "mark_no_show", { p_ticket: first.id });
    await expect.poll(async () => (await jobs(ticket.id)).map((j) => `${j.event}/${j.status}`), { timeout: 15_000 }).toContain("almost_your_turn/sent");
    const second = await rpc<{ id: string }>(b.staff, "call_next", { p_counter: b.counterId });
    await rpc(b.staff, "mark_no_show", { p_ticket: second.id });
    await rpc(b.staff, "call_next", { p_counter: b.counterId });
    await expect.poll(async () => (await jobs(ticket.id)).find((j) => j.event === "your_turn" && j.channel === "whatsapp")?.status, { timeout: 15_000 }).toBe("sent");
    const turn = (await jobs(ticket.id)).find((j) => j.event === "your_turn" && j.channel === "whatsapp")!;
    expect(turn.payload.text).toBe(`C'est votre tour ! Ticket ${ticket.display_code} chez Clinique Alertes – Akwa.\nPrésentez-vous : Cabinet 3.\nRépondez STOP pour ne plus recevoir ces messages.`);
    await expect.poll(async () => (await jobs(ticket.id)).find((j) => j.channel === "sms")).toMatchObject({ status: "pending", guard: true });

    // Accusé de remise WhatsApp : statut mis à jour (le SMS de garde sera ignoré).
    await webhook(request, { statuses: [{ id: turn.provider_message_id, status: "delivered" }] });
    await expect.poll(async () => (await jobs(ticket.id)).find((j) => j.event === "your_turn" && j.channel === "whatsapp")?.status).toBe("delivered");

    // STOP : plus rien, y compris pour un rappel.
    await webhook(request, inbound(from, "STOP"));
    await rpc(b.staff, "recall_ticket", { p_ticket: ticket.id });
    await page.waitForTimeout(500);
    const after = await jobs(ticket.id);
    expect(after.filter((j) => j.event === "your_turn" && j.channel === "whatsapp")).toHaveLength(1);
    await expect(page.getByRole("link", { name: "Recevoir mes alertes sur WhatsApp" })).toBeVisible();
  });

  test("numéro saisi à l'accueil : modèle approuvé, échec de remise → SMS de secours", async ({ request }) => {
    const b = await setUpBranch("Clinique SMS");
    // Numéro de test se terminant par 99999 : le faux fournisseur WhatsApp échoue définitivement.
    const ticket = await rpc<{ id: string }>(b.staff, "reception_create_ticket", {
      p_service: b.serviceId,
      p_phone_e164: "+237690099999",
      p_consent: true,
      p_locale: "en",
    });
    await expect
      .poll(async () => (await jobs(ticket.id)).filter((j) => j.status !== "skipped").map((j) => `${j.channel}/${j.status}`), { timeout: 15_000 })
      .toEqual(["whatsapp/failed", "sms/sent"]);
    const [wa, sms] = (await jobs(ticket.id)).filter((j) => j.status !== "skipped");
    expect(wa!.template_name).toBe("ticket_confirme");
    expect(sms!.payload.text).toMatch(/^NextIn: ticket C-001 confirmed at Clinique SMS - Akwa\. 0 ahead of you/);

    // L'expéditeur n'accepte que la base (secret partagé).
    expect((await request.post("/api/notifications/dispatch", { headers: { Authorization: "Bearer faux" } })).status()).toBe(401);
    const ok = await request.post("/api/notifications/dispatch", { headers: { Authorization: `Bearer ${E2E_NOTIFY.NOTIFY_DISPATCH_SECRET}` } });
    expect(ok.status()).toBe(200);
  });
});
