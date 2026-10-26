import { expect, test } from "@playwright/test";
import { expectAccessible, expectTouchTargets, signInViaUi } from "./helpers";
import { anonClient, rpc, setUpBranch } from "./queue-helpers";

test.describe("M4 — réglages du personnel et poste de test", () => {
  test("réglages : apparence et langue", async ({ page }) => {
    const { email } = await setUpBranch();
    await page.goto("/login");
    await signInViaUi(page, email);
    await page.waitForURL(/\/app$/);
    await page.getByRole("link", { name: "Réglages" }).first().click();
    await expect(page.getByRole("heading", { level: 1, name: "Réglages" })).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();
    await expectAccessible(page);
    await expectTouchTargets(page);
    await page.getByRole("radio", { name: "Sombre" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expectAccessible(page);
    await page.getByRole("radio", { name: "Auto" }).click();
    await page.getByRole("radio", { name: "English" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
  });

  test("poste de test : alerter, admettre, terminer ; le client suit", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "écran du personnel");
    const { email, orgId, branchId, staff, serviceId } = await setUpBranch();
    const ticket = await rpc<{ public_token: string }>(staff, "reception_create_ticket", { p_service: serviceId });
    const visitor = anonClient();
    const status = async () => (await rpc<{ status: string }>(visitor, "get_ticket", { p_token: ticket.public_token })).status;

    await page.goto(`/login?next=${encodeURIComponent(`/app/o/${orgId}/branches/${branchId}`)}`);
    await signInViaUi(page, email);
    await page.getByRole("link", { name: /Poste de test/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Poste de test" })).toBeVisible();
    await expect(page.getByText("Aucun ticket alerté")).toBeVisible();
    await expectAccessible(page);

    await page.getByRole("button", { name: "Alerter le suivant" }).click();
    await expect(page.getByText("C-001")).toBeVisible();
    await expect(page.getByText("Alerté", { exact: true })).toBeVisible();
    expect(await status()).toBe("called");

    await page.getByRole("button", { name: "Admettre" }).click();
    await expect(page.getByText(/Admis · 00:0\d/)).toBeVisible();
    expect(await status()).toBe("serving");

    await page.getByRole("button", { name: "Terminer" }).click();
    await expect(page.getByText("Aucun ticket alerté")).toBeVisible();
    expect(await status()).toBe("served");
  });
});
