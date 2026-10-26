import { test } from "@playwright/test";

// Captures du module pour la revue (pnpm --filter @nextin/web screenshots) → docs/captures/m1/.
const OUT = "../../docs/captures/m1";

for (const theme of ["light", "dark"] as const) {
  test(`@screenshots /design ${theme}`, async ({ browser }, info) => {
    const isMobile = info.project.name === "mobile";
    const context = await browser.newContext({
      colorScheme: theme,
      viewport: isMobile ? { width: 390, height: 844 } : { width: 1280, height: 900 },
      deviceScaleFactor: 2,
      locale: "fr-FR",
    });
    const page = await context.newPage();
    await page.goto("/design", { waitUntil: "networkidle" });
    await page.screenshot({ path: `${OUT}/design-${info.project.name}-${theme}.png`, fullPage: isMobile });
    if (isMobile) {
      await page.locator("#ticket").scrollIntoViewIfNeeded();
      await page.locator("#ticket").screenshot({ path: `${OUT}/ticket-${theme}.png` });
      await page.getByRole("button", { name: "Choisir la priorité" }).click();
      await page.getByRole("dialog").waitFor();
      await page.waitForTimeout(600);
      await page.screenshot({ path: `${OUT}/sheet-${theme}.png` });
    }
    await context.close();
  });
}
