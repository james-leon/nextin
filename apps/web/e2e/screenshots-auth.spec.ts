import { test } from "@playwright/test";
import { signUpViaUi, uniqueEmail, verifyPhoneViaUi } from "./helpers";

// Captures des écrans d'authentification et d'établissement (M1) → docs/captures/m1/.
const OUT = "../../docs/captures/m1";

for (const theme of ["light", "dark"] as const) {
  test(`@screenshots écrans M1 ${theme}`, async ({ browser }, info) => {
    test.skip(info.project.name !== "mobile", "captures mobiles uniquement");
    const context = await browser.newContext({ colorScheme: theme, viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "fr-FR" });
    const page = await context.newPage();
    const shot = (name: string) => page.screenshot({ path: `${OUT}/${name}-${theme}.png` });

    await page.goto("/login");
    await shot("login");
    await page.goto("/signup");
    await shot("signup");

    await signUpViaUi(page, { name: "Dr Ngo Biyong", email: uniqueEmail(`capture-${theme}`) });
    await shot("app-empty");
    await page.goto("/app/new");
    await verifyPhoneViaUi(page);
    await page.getByLabel("Nom de l'établissement").fill("DOUALA CLINIC");
    await page.getByRole("radio", { name: "Clinique" }).click();
    await shot("org-new");
    await page.getByRole("button", { name: "Créer l'établissement" }).click();
    await page.waitForURL(/welcome=1/);
    await page.goto("/app");
    await shot("app-list");
    await context.close();
  });
}
