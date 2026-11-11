import { expect, test } from "@playwright/test";
import { expectAccessible, expectTouchTargets, signInViaUi } from "./helpers";
import { rpc, setUpBranch } from "./queue-helpers";

// C3 — « Demander de l'aide » depuis la page du ticket : pastille et encadré à l'accueil en direct, « Traité » ;
// une demande toutes les 5 minutes ; rien sur l'écran TV (aucune modification du ticket, vérifié en pgTAP).

test.describe("C3 — demande d'aide", () => {
  test("patient : demande ; accueil : pastille et « Traité »", async ({ page, browser }, info) => {
    test.skip(info.project.name !== "desktop", "accueil sur ordinateur, patient sur téléphone dans un second contexte");
    test.setTimeout(90_000);
    const b = await setUpBranch(`Clinique Aide Accueil ${Date.now().toString(36)}`);
    const ticket = await rpc<{ public_token: string; display_code: string }>(b.staff, "reception_create_ticket", { p_service: b.serviceId });

    await page.goto(`/login?next=${encodeURIComponent(`/desk/reception/${b.branchId}`)}`);
    await signInViaUi(page, b.email);
    await page.waitForURL(new RegExp(`/desk/reception/${b.branchId}$`));
    await expect(page.getByRole("heading", { name: /Demande d'aide/ })).toHaveCount(0);

    const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: "fr-FR" });
    const patient = await phone.newPage();
    await patient.goto(`/t/${ticket.public_token}`);
    await patient.getByRole("button", { name: "Demander de l'aide à l'accueil" }).click();
    await expect(patient.getByText("Demande envoyée : un membre de l'accueil vient vous voir.")).toBeVisible();
    await expectTouchTargets(patient);

    // Accueil : encadré et pastille, en direct (canal privé de l'agence).
    const callout = page.getByRole("region", { name: /Demande d'aide/ });
    await expect(callout).toBeVisible({ timeout: 20_000 });
    await expect(callout).toContainText(ticket.display_code);
    await expect(page.getByRole("button", { name: new RegExp(`^${ticket.display_code}`) }).getByText("Aide", { exact: true })).toBeVisible();
    await expectAccessible(page);
    await page.emulateMedia({ colorScheme: "dark" });
    await expectAccessible(page);
    await page.emulateMedia({ colorScheme: "light" });

    // Une seconde demande dans les 5 minutes : refusée, message clair.
    await patient.reload();
    await patient.getByRole("button", { name: "Demander de l'aide à l'accueil" }).click();
    await expect(patient.getByText("Demande déjà envoyée il y a moins de 5 minutes", { exact: false })).toBeVisible();

    await page.getByRole("button", { name: `Demande d'aide du ticket ${ticket.display_code} traitée` }).click();
    await expect(callout).toHaveCount(0);
    await phone.close();
  });
});
