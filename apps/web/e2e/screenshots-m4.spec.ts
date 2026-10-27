import { test, type Page } from "@playwright/test";
import { signInViaUi } from "./helpers";
import { rpc, setUpBranch } from "./queue-helpers";

// Captures M4 (parcours client, réglages) → docs/captures/m4/. Établissement créé pour l'occasion.
const OUT = "../../docs/captures/m4";

for (const theme of ["light", "dark"] as const) {
  test(`@screenshots parcours client M4 ${theme}`, async ({ browser }, info) => {
    test.skip(info.project.name !== "mobile", "pages client : téléphone");
    const { staff, serviceId, counterId, entryCode } = await setUpBranch("DOUALA CLINIC");
    for (let i = 0; i < 4; i++) await rpc(staff, "reception_create_ticket", { p_service: serviceId });
    const first = await rpc<{ id: string }>(staff, "call_next", { p_counter: counterId });
    await rpc(staff, "admit_ticket", { p_ticket: first.id });

    const context = await browser.newContext({
      colorScheme: theme,
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      locale: "fr-FR",
    });
    const page = await context.newPage();
    const shot = async (name: string, settle = 600) => {
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(settle);
      await page.screenshot({ path: `${OUT}/${name}-mobile-${theme}.png` });
    };

    await page.goto("/");
    await shot("01-scanner");
    await page.goto("/c");
    await shot("01b-code");
    await page.goto(`/q/${entryCode}`);
    await shot("02-choose-service");
    await page.getByRole("button", { name: "Prendre mon ticket" }).click();
    await page.waitForURL(/\/t\/[A-Za-z0-9]{22}$/);
    await shot("03-my-ticket", 1500);

    await rpc(staff, "finish_ticket", { p_ticket: first.id });
    for (let i = 0; i < 3; i++) {
      const next = await rpc<{ id: string }>(staff, "call_next", { p_counter: counterId });
      await rpc(staff, "mark_no_show", { p_ticket: next.id });
    }
    const mine = await rpc<{ id: string }>(staff, "call_next", { p_counter: counterId });
    await page.getByText("C'est votre tour").waitFor();
    await shot("03b-called");
    await rpc(staff, "admit_ticket", { p_ticket: mine.id });
    await rpc(staff, "finish_ticket", { p_ticket: mine.id });
    await page.getByText("Merci de votre visite").waitFor();
    await page.getByRole("radio", { name: "5 étoiles" }).click();
    await shot("03c-served-rating");

    await page.goto("/profile");
    await shot("04-profile");
    await context.close();
  });

  test(`@screenshots réglages M4 ${theme}`, async ({ browser }, info) => {
    test.skip(info.project.name !== "desktop", "espace du personnel : grand écran");
    const { email } = await setUpBranch("DOUALA CLINIC");
    const context = await browser.newContext({
      colorScheme: theme,
      viewport: { width: 1280, height: 860 },
      deviceScaleFactor: 2,
      locale: "fr-FR",
    });
    const page: Page = await context.newPage();
    const shot = async (name: string) => {
      await page.waitForLoadState("networkidle");
      await page.screenshot({ path: `${OUT}/${name}-desktop-${theme}.png` });
    };
    await page.goto("/login");
    await signInViaUi(page, email);
    await page.waitForURL(/\/app$/);
    await page.goto("/app/settings");
    await shot("05-settings");
    await context.close();
  });
}
