import { test } from "@playwright/test";
import { rpc, setUpBranch } from "./queue-helpers";

// Captures de la refonte v2, LOT 2 (écrans client) → docs/captures/v2-lot2/ : téléphone (390) et ordinateur (1440),
// clair et sombre. Établissement créé pour l'occasion.
const OUT = "../../docs/captures/v2-lot2";

for (const theme of ["light", "dark"] as const) {
  test(`@screenshots refonte v2 écrans client ${theme}`, async ({ browser }, info) => {
    const desktop = info.project.name === "desktop";
    const size = desktop ? "desktop" : "mobile";
    const { staff, serviceId, counterId, entryCode } = await setUpBranch("DOUALA CLINIC");
    for (let i = 0; i < 4; i++) await rpc(staff, "reception_create_ticket", { p_service: serviceId });
    const first = await rpc<{ id: string }>(staff, "call_next", { p_counter: counterId });
    await rpc(staff, "admit_ticket", { p_ticket: first.id });

    const context = await browser.newContext({
      colorScheme: theme,
      viewport: desktop ? { width: 1440, height: 900 } : { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: !desktop,
      hasTouch: !desktop,
      locale: "fr-FR",
    });
    const page = await context.newPage();
    const shot = async (name: string, settle = 600) => {
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(settle);
      await page.screenshot({ path: `${OUT}/${name}-${size}-${theme}.png` });
    };

    await page.goto("/");
    await shot("01-home");
    await page.goto("/scan");
    await shot("02-scanner");
    await page.goto("/c");
    await page.getByLabel("Code").fill("AB1");
    await shot("03-code");
    await page.goto(`/q/${entryCode}`);
    await shot("04-choose-service");
    await page.getByRole("button", { name: /Consultation/ }).click();
    await shot("05-name");
    await page.getByRole("button", { name: "Prendre mon ticket" }).click();
    await page.getByRole("button", { name: "Voir mon ticket" }).waitFor();
    await shot("06-ticket-taken", 300);
    await page.getByRole("button", { name: "Voir mon ticket" }).click();
    await page.waitForURL(/\/t\/[A-Za-z0-9]{22}$/);
    await shot("07-my-ticket", 1500);

    await rpc(staff, "finish_ticket", { p_ticket: first.id });
    for (let i = 0; i < 3; i++) {
      const next = await rpc<{ id: string }>(staff, "call_next", { p_counter: counterId });
      await rpc(staff, "mark_no_show", { p_ticket: next.id });
    }
    await rpc(staff, "call_next", { p_counter: counterId });
    await page.getByRole("alertdialog").waitFor();
    await shot("08-your-turn");

    await page.goto("/t");
    await shot("09-tickets");
    await page.goto("/profile");
    await shot("10-profile");
    await page.goto("/help");
    await shot("11-help");
    await page.goto("/confidentialite");
    await shot("12-privacy");
    await context.close();
  });
}
