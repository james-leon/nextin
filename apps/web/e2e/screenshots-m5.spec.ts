import { test, type Page } from "@playwright/test";
import { signInViaUi } from "./helpers";
import { addDoctors, rpc, setUpBranch } from "./queue-helpers";

// Captures M5 (postes agent et accueil, ticket imprimé) → docs/captures/m5/. Établissement créé pour l'occasion.
const OUT = "../../docs/captures/m5";

async function prepare() {
  const b = await setUpBranch("DOUALA CLINIC");
  const docs = await addDoctors(b);
  await rpc(b.staff, "reception_create_ticket", { p_service: b.serviceId, p_priority_reason: "appointment" });
  for (let i = 0; i < 4; i++) await rpc(b.staff, "reception_create_ticket", { p_service: b.serviceId });
  await rpc(b.staff, "reception_create_ticket", { p_service: b.serviceId, p_practitioner: docs.abena });
  return { ...b, ...docs };
}

for (const theme of ["light", "dark"] as const) {
  test(`@screenshots poste agent M5 ${theme}`, async ({ browser }, info) => {
    test.skip(info.project.name !== "mobile", "poste agent : téléphone");
    const b = await prepare();
    const context = await browser.newContext({
      colorScheme: theme,
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      locale: "fr-FR",
    });
    const page: Page = await context.newPage();
    const shot = async (name: string) => {
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${OUT}/${name}-mobile-${theme}.png` });
    };
    await page.goto(`/login?next=${encodeURIComponent("/desk")}`);
    await signInViaUi(page, b.email);
    await page.waitForURL(/\/desk$/);
    await shot("01-desk-choice");
    await page.goto(`/desk/counter/${b.counterId}`);
    await page.getByRole("button", { name: "Alerter le suivant" }).click();
    await page.getByText("Patient alerté").waitFor();
    await shot("02-agent-alerted");
    await page.getByRole("button", { name: "Admettre" }).click();
    await page.getByText("Client en cours").waitFor();
    await page.waitForTimeout(2200);
    await shot("03-agent-serving");
    await context.setOffline(true);
    await page.getByRole("button", { name: "Terminer et alerter le suivant" }).click();
    await page.getByText("Hors ligne").first().waitFor();
    await page.screenshot({ path: `${OUT}/04-agent-offline-mobile-${theme}.png` });
    await context.setOffline(false);
    await context.close();
  });

  test(`@screenshots accueil M5 ${theme}`, async ({ browser }, info) => {
    test.skip(info.project.name !== "desktop", "accueil : grand écran");
    const b = await prepare();
    await rpc(b.staff, "declare_practitioner_absence", { p_practitioner: b.bilong, p_kind: "late", p_until: new Date(Date.now() + 40 * 60_000).toISOString() });
    await rpc(b.staff, "call_next", { p_counter: b.counterId });
    const context = await browser.newContext({ colorScheme: theme, viewport: { width: 1280, height: 860 }, deviceScaleFactor: 2, locale: "fr-FR" });
    const page: Page = await context.newPage();
    const shot = async (name: string) => {
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${OUT}/${name}-desktop-${theme}.png` });
    };
    await page.goto(`/login?next=${encodeURIComponent(`/desk/reception/${b.branchId}`)}`);
    await signInViaUi(page, b.email);
    await page.waitForURL(/reception/);
    await shot("05-reception");
    await page.getByRole("button", { name: "Nouveau ticket" }).click();
    await page.getByRole("radio", { name: "Dr Abena" }).click();
    await page.getByLabel("WhatsApp du patient (facultatif)").fill("6 77 12 34 56");
    await page.getByLabel("Le patient accepte de recevoir ses alertes sur WhatsApp").click();
    await shot("06-reception-new-ticket");
    await page.getByRole("button", { name: "Créer le ticket" }).click();
    await page.getByText("Ticket créé").waitFor();
    await shot("07-reception-created");
    const href = await page.getByRole("link", { name: "Imprimer le ticket" }).getAttribute("href");
    await page.getByRole("button", { name: "Fermer" }).click();
    await page.getByRole("button", { name: /^Dr Abena/ }).click();
    await page.getByLabel("Retour prévu à").waitFor();
    await shot("08-practitioner-absence");
    if (theme === "light") {
      const print = await context.newPage();
      await print.addInitScript(() => (window.print = () => undefined));
      await print.goto(href!);
      await print.waitForLoadState("networkidle");
      await print.screenshot({ path: `${OUT}/09-printed-ticket-80mm.png` });
    }
    await context.close();
  });
}
