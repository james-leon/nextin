import { createHmac, randomUUID } from "node:crypto";
import { test } from "@playwright/test";
import { E2E_NOTIFY } from "./notify-env";
import { rpc, setUpBranch } from "./queue-helpers";

// Captures M7 (alertes de « Mon ticket ») → docs/captures/m7/. Établissement créé pour l'occasion.
const OUT = "../../docs/captures/m7";

for (const theme of ["light", "dark"] as const) {
  test(`@screenshots alertes M7 ${theme}`, async ({ browser, request }, info) => {
    test.skip(info.project.name !== "mobile", "page client : téléphone");
    const b = await setUpBranch("DOUALA CLINIC");
    for (let i = 0; i < 5; i++) await rpc(b.staff, "reception_create_ticket", { p_service: b.serviceId });
    const ticket = await rpc<{ display_code: string; public_token: string }>(b.staff, "reception_create_ticket", { p_service: b.serviceId });
    const context = await browser.newContext({
      colorScheme: theme,
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      locale: "fr-FR",
    });
    const page = await context.newPage();
    const shot = async (name: string) => {
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(600);
      await page.screenshot({ path: `${OUT}/${name}-mobile-${theme}.png` });
    };
    await page.goto(`/t/${ticket.public_token}`);
    await shot("01-ticket-whatsapp-optin");

    // Le client envoie le message prérempli (webhook simulé, signé comme Meta).
    const body = JSON.stringify({
      object: "whatsapp_business_account",
      entry: [{ id: "shot", changes: [{ field: "messages", value: { messages: [{ id: `wamid.shot.${randomUUID()}`, from: `2376${String(Date.now()).slice(-8)}`, type: "text", text: { body: `NEXTIN ${ticket.display_code} ${ticket.public_token.slice(-4)}` } }] } }] }],
    });
    await request.post("/api/whatsapp/webhook", {
      data: body,
      headers: { "Content-Type": "application/json", "X-Hub-Signature-256": `sha256=${createHmac("sha256", E2E_NOTIFY.WHATSAPP_APP_SECRET).update(body).digest("hex")}` },
    });
    await page.getByText("Alertes WhatsApp activées").waitFor();
    await shot("02-ticket-whatsapp-on");
    await context.close();
  });
}
