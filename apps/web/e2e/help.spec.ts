import { expect, test, type Page } from "@playwright/test";
import { expectAccessible, expectTouchTargets } from "./helpers";
import { rpc, setUpBranch } from "./queue-helpers";

// C2 — page Aide du patient : depuis « Mon ticket », coordonnées publiques de l'établissement (téléphone, horaires)
// et questions fréquentes dépliables ; depuis le profil, questions seules. Aucune donnée du patient. Budget < 200 Ko.

async function firstLoadBytes(page: Page, path: string) {
  let total = 0;
  page.on("requestfinished", async (request) => {
    const sizes = await request.sizes().catch(() => null);
    if (sizes) total += sizes.responseBodySize + sizes.responseHeadersSize;
  });
  await page.goto(path, { waitUntil: "networkidle" });
  await page.waitForTimeout(300);
  return total;
}

test.describe("C2 — page Aide", () => {
  test("depuis le ticket : établissement (téléphone, horaires), questions fréquentes, retour au ticket", async ({ page }) => {
    const b = await setUpBranch(`Clinique Aide ${Date.now().toString(36)}`);
    await b.staff.from("branches").update({ phone_e164: "+237233421100" }).eq("id", b.branchId).select("id");
    const ticket = await rpc<{ public_token: string }>(b.staff, "reception_create_ticket", { p_service: b.serviceId, p_customer_name: "Awa Ngono" });
    await page.goto(`/t/${ticket.public_token}`);
    await page.getByRole("link", { name: "Aide et contact de l'établissement" }).click();
    await page.waitForURL(/\/help\?t=/);
    await expect(page.getByRole("heading", { level: 1, name: "Aide" })).toBeVisible();
    await expect(page.getByRole("link", { name: /^Appeler / })).toHaveAttribute("href", "tel:+237233421100");
    await expect(page.getByText("Horaires")).toBeVisible();
    // Jamais le nom du patient.
    await expect(page.getByText("Awa Ngono")).toHaveCount(0);
    // Question dépliable sans JS.
    const question = page.getByText("Comment annuler mon ticket ?");
    await question.click();
    await expect(page.getByText("En bas de la page de votre ticket, touchez « Annuler le ticket ».", { exact: false })).toBeVisible();
    await expectAccessible(page);
    await expectTouchTargets(page);
    await page.getByRole("link", { name: "Mon ticket" }).first().click();
    await page.waitForURL(new RegExp(`/t/${ticket.public_token}$`));
  });

  test("depuis le profil : questions seules ; budget < 200 Ko", async ({ page, browser }, info) => {
    await page.goto("/profile");
    await page.getByRole("link", { name: "Aide et questions fréquentes" }).click();
    await page.waitForURL(/\/help$/);
    await expect(page.getByText("Pour joindre un établissement, ouvrez l'aide depuis votre ticket.")).toBeVisible();
    await expect(page.getByText("Faut-il installer une application ?")).toBeVisible();
    await expectAccessible(page);
    if (info.project.name === "mobile") {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
      const fresh = await context.newPage();
      const bytes = await firstLoadBytes(fresh, "/help");
      console.log(`/help : ${Math.round(bytes / 1024)} Ko`);
      expect(bytes).toBeLessThan(200 * 1024);
      await context.close();
    }
  });
});
