import { expect, test, type Page } from "@playwright/test";
import { admin, pairDisplay } from "./ads-helpers";
import { expectAccessible, signInViaUi } from "./helpers";
import { setUpBranch } from "./queue-helpers";

/**
 * Correctifs après le LOT 6a (`docs/modules/UX-NAVIGATION.md`) : réaction immédiate à chaque navigation (lien marqué
 * « en cours », barre de progression au-delà de 150 ms) et code de présence de l'écran TV seulement si l'agence
 * accepte les tickets à distance.
 */

async function login(page: Page, email: string, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await signInViaUi(page, email);
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
}

/** Réseau ralenti : 2 s de plus pour toute requête de la page visée (données RSC comprises). */
async function slowDown(page: Page, pattern: RegExp) {
  await page.route(pattern, async (route) => {
    await new Promise((r) => setTimeout(r, 2_000));
    await route.continue();
  });
}

/** Lien touché : marqué « en cours » tout de suite, barre visible avant l'arrivée, tout disparaît à l'arrivée. */
async function expectFeedback(page: Page, link: ReturnType<Page["getByRole"]>, arrived: () => Promise<void>) {
  await link.click();
  await expect(link).toHaveAttribute("aria-busy", "true", { timeout: 300 });
  await expect(page.locator("#nx-nav")).toHaveAttribute("data-on", "", { timeout: 1_000 });
  await expect(page.locator("#nx-nav")).toBeVisible();
  await arrived();
  await expect(page.locator("#nx-nav")).not.toHaveAttribute("data-on", "");
  await expect(page.locator('a[aria-busy="true"]')).toHaveCount(0);
}

test.describe("Navigation : réaction immédiate", () => {
  test("« Mes établissements » → établissement : ligne en cours et barre, puis tableau de bord", async ({ page }) => {
    const b = await setUpBranch(`Clinique Lente ${Date.now()}`);
    await login(page, b.email, "/app");
    const { data: org } = await admin.from("organizations").select("name").eq("id", b.orgId).single();
    const row = page.getByRole("link", { name: new RegExp(org!.name) }).first();
    await expect(row).toBeVisible();
    await slowDown(page, new RegExp(`/app/o/${b.orgId}`));
    // Pendant le chargement : chevron masqué, indicateur affiché à sa place (cercle du personnel).
    const indicator = row.locator("[data-nav-indicator]");
    const spinning = () =>
      indicator.evaluate((el) => getComputedStyle(el, "::after").content !== "none" && getComputedStyle(el.querySelector("svg")!).visibility === "hidden");
    await expectFeedback(page, row, async () => {
      expect(await spinning()).toBe(true);
      await page.waitForURL(new RegExp(`/app/o/${b.orgId}$`), { timeout: 15_000 });
    });
    await expectAccessible(page);
    await page.emulateMedia({ colorScheme: "dark" });
    await expectAccessible(page);
  });

  test("barre latérale du back-office (ordinateur)", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "barre latérale à partir de 1024 px");
    const b = await setUpBranch(`Clinique Latérale ${Date.now()}`);
    await login(page, b.email, `/app/o/${b.orgId}`);
    await slowDown(page, new RegExp(`/app/o/${b.orgId}/staff`));
    const link = page.getByRole("navigation").getByRole("link", { name: "Personnel" });
    await expectFeedback(page, link, async () => {
      await page.waitForURL(new RegExp(`/app/o/${b.orgId}/staff$`), { timeout: 15_000 });
    });
  });

  test("onglet client « À proximité »", async ({ page }) => {
    await page.goto("/");
    await slowDown(page, /\/nearby/);
    // Barre d'onglets en bas sur téléphone, barre latérale sur ordinateur : un seul lien visible.
    const tab = page.getByRole("link", { name: "À proximité" }).filter({ visible: true }).first();
    await expectFeedback(page, tab, async () => {
      await page.waitForURL(/\/nearby$/, { timeout: 15_000 });
    });
    await expectAccessible(page);
  });
});

test.describe("Écran TV : code de présence seulement avec les tickets à distance", () => {
  test("sans ticket à distance : ni code ni « ?p= » ; avec : code affiché", async ({ page, request }, info) => {
    test.skip(info.project.name !== "desktop", "écran TV");
    const b = await setUpBranch(`Clinique TV ${Date.now()}`);
    const device = await pairDisplay(request, b.staff, b.branchId, false);
    const read = async () =>
      ((await (await request.get("/api/tv/session", { headers: { Authorization: `Bearer ${device}` } })).json()) as {
        session: { presence_url: string; entry_url: string };
      }).session;

    const off = await read();
    expect(off.presence_url).toBe(off.entry_url);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.addInitScript((t) => localStorage.setItem("nextin-tv-token", t), device);
    await page.goto("/tv");
    await expect(page.getByText("Scannez le QR code de l'accueil pour prendre un ticket", { exact: false })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Code de présence")).toHaveCount(0);

    await admin.from("branch_settings").update({ remote_tickets_enabled: true }).eq("branch_id", b.branchId);
    const on = await read();
    expect(on.presence_url).toMatch(new RegExp(`^${on.entry_url}\\?p=[0-9A-F]{6}$`));
    await page.reload();
    await expect(page.getByText("Code de présence")).toBeVisible({ timeout: 15_000 });
  });
});
