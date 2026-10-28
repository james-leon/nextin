import { createClient } from "@supabase/supabase-js";
import { test, type Browser, type Page } from "@playwright/test";
import { signInViaUi } from "./helpers";
import { supabaseOptions } from "./queue-helpers";

// Captures M9 (distance) avec les données de démo (`pnpm seed:demo:local`) en téléphone, tablette (portrait et paysage)
// et ordinateur → docs/captures/m9/. Position simulée à environ 2 km de l'agence d'Akwa.
const OUT = "../../docs/captures/m9";
const SIZES = {
  mobile: { width: 390, height: 844, isMobile: true },
  "tablet-portrait": { width: 820, height: 1180, isMobile: true },
  "tablet-landscape": { width: 1180, height: 820, isMobile: true },
  desktop: { width: 1440, height: 900, isMobile: false },
} as const;
type Size = keyof typeof SIZES;
const HOME = { latitude: 4.064, longitude: 9.707 };

const admin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, supabaseOptions);

async function shot(page: Page, name: string) {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
}

async function open(browser: Browser, size: Size, theme: "light" | "dark") {
  const s = SIZES[size];
  const context = await browser.newContext({
    colorScheme: theme,
    viewport: { width: s.width, height: s.height },
    deviceScaleFactor: 2,
    isMobile: s.isMobile,
    hasTouch: s.isMobile,
    locale: "fr-FR",
    geolocation: HOME,
    permissions: ["geolocation"],
  });
  return { context, page: await context.newPage() };
}

for (const size of Object.keys(SIZES) as Size[]) {
  test(`@screenshots client M9 ${size}`, async ({ browser }, info) => {
    test.skip(info.project.name !== "desktop", "captures pilotées une seule fois");
    test.skip(!process.env.SEED_DEMO_PASSWORD, "données de démo requises (SEED_DEMO_PASSWORD)");
    test.setTimeout(180_000);
    for (const theme of size === "mobile" || size === "desktop" ? (["light", "dark"] as const) : (["light"] as const)) {
      const { context, page } = await open(browser, size, theme);
      await page.goto("/nearby");
      await page.getByText("Autour de vous").waitFor();
      await shot(page, `01-nearby-${size}-${theme}`);
      if (size === "mobile") {
        await page.getByRole("button", { name: "Carte" }).click();
        await page.getByRole("region", { name: "Carte des établissements à proximité" }).waitFor();
        await page.getByRole("button", { name: /DOUALA CLINIC/ }).click();
        await shot(page, `02-nearby-map-${size}-${theme}`);
        await page.getByRole("button", { name: "Liste" }).click();
      }
      await page.getByRole("link", { name: /DOUALA CLINIC/ }).first().click();
      await page.getByRole("heading", { name: "DOUALA CLINIC" }).waitFor();
      const branchUrl = new URL(page.url()).pathname;
      await shot(page, `03-branch-${size}-${theme}`);

      if (theme === "light") {
        // Ticket à distance : « quand partir », confirmation de présence.
        await page.getByRole("button", { name: "Prendre un ticket à distance" }).first().click();
        await page.waitForURL(/\/t\//);
        await page.getByText("Quand partir").waitFor();
        await shot(page, `04-remote-ticket-${size}-${theme}`);
        await page.getByRole("button", { name: "Annuler le ticket" }).click();
        await page.getByRole("alertdialog").getByRole("button", { name: "Annuler le ticket" }).click();
        await page.getByText("Ticket annulé").waitFor();

        // Demande de rendez-vous : formulaire, code WhatsApp, demande envoyée.
        await page.goto(`${branchUrl}/rdv`);
        await page.getByRole("heading", { name: "Demande de rendez-vous" }).waitFor();
        const day = page.getByRole("radiogroup", { name: "Jour" }).getByRole("radio").filter({ hasNotText: "Complet" }).first();
        await day.click();
        await page.getByRole("radiogroup", { name: "Créneau" }).getByRole("radio").nth(2).click();
        await page.getByLabel("Numéro WhatsApp", { exact: true }).fill(`699${String(Date.now()).slice(-6)}`);
        await page.getByLabel("Initiales (facultatif)").fill("M.E.");
        await shot(page, `05-request-form-${size}-${theme}`);
        await page.getByRole("button", { name: "Envoyer la demande" }).last().click();
        await page.waitForURL(/\/r\//);
        await page.getByRole("heading", { name: "Vérifiez votre numéro" }).waitFor();
        await shot(page, `06-request-verify-${size}-${theme}`);
        const token = new URL(page.url()).pathname.split("/").pop()!;
        const { data: request } = await admin().from("appointment_requests").select("id").eq("public_token", token).single();
        const { data: job } = await admin()
          .from("notification_jobs")
          .select("payload")
          .eq("appointment_request_id", request!.id)
          .eq("event", "request_code")
          .order("created_at", { ascending: false })
          .limit(1)
          .single();
        await page.getByLabel("Code de vérification").fill(String((job!.payload as { code: string }).code));
        await page.getByRole("button", { name: "Valider" }).click();
        await page.getByRole("heading", { name: "Demande envoyée" }).waitFor();
        await shot(page, `07-request-sent-${size}-${theme}`);
      }
      await context.close();
    }
  });

  test(`@screenshots accueil M9 ${size}`, async ({ browser }, info) => {
    test.skip(info.project.name !== "desktop", "captures pilotées une seule fois");
    test.skip(!process.env.SEED_DEMO_PASSWORD, "données de démo requises (SEED_DEMO_PASSWORD)");
    test.setTimeout(120_000);
    const { data: branch } = await admin().from("branches").select("id, organization_id").eq("name", "Akwa").limit(1).single();
    for (const theme of size === "mobile" || size === "desktop" ? (["light", "dark"] as const) : (["light"] as const)) {
      const { context, page } = await open(browser, size, theme);
      await page.goto(`/login?next=${encodeURIComponent(`/desk/reception/${branch!.id}/appointments?view=requests`)}`);
      await signInViaUi(page, "accueil@doualaclinic.demo", process.env.SEED_DEMO_PASSWORD);
      await page.getByRole("heading", { name: "Demandes de rendez-vous" }).waitFor();
      await page.getByRole("region", { name: "Demandes de rendez-vous" }).getByRole("button").first().click();
      await page.getByText("Proposer un autre créneau").waitFor();
      await shot(page, `08-requests-inbox-${size}-${theme}`);
      if (theme === "light") {
        await page.goto(`/desk/reception/${branch!.id}`);
        await page.getByRole("heading", { name: "Accueil" }).waitFor();
        await shot(page, `09-reception-${size}-${theme}`);
      }
      await context.close();
    }
    if (size === "desktop" || size === "mobile") {
      const { context, page } = await open(browser, size, "light");
      await page.goto(`/login?next=${encodeURIComponent(`/app/o/${branch!.organization_id}/branches/${branch!.id}/settings`)}`);
      await signInViaUi(page, "directeur@doualaclinic.demo", process.env.SEED_DEMO_PASSWORD);
      await page.getByRole("heading", { name: "Réglages de la file" }).waitFor();
      await shot(page, `10-branch-settings-${size}-light`);
      await context.close();
    }
  });
}
