import { expect, test, type Page } from "@playwright/test";
import { expectAccessible, signInViaUi } from "./helpers";
import { rpc, setUpBranch } from "./queue-helpers";

/** Capture les phrases prononcées par la synthèse vocale (pas de segments enregistrés en local). */
async function spyOnSpeech(page: Page) {
  await page.addInitScript(() => {
    const spoken: string[] = [];
    (window as unknown as { __spoken: string[] }).__spoken = spoken;
    Object.defineProperty(window, "speechSynthesis", {
      value: {
        speak: (u: SpeechSynthesisUtterance) => {
          if (u.text) spoken.push(u.text);
          setTimeout(() => u.onend?.(new Event("end") as SpeechSynthesisEvent), 10);
        },
        getVoices: () => [],
        cancel: () => undefined,
      },
    });
  });
}

test.describe("M6 — écran TV", () => {
  test.skip(({ isMobile }) => isMobile, "écran de salle d'attente : grand écran");

  test("appairage par code → appels affichés et annoncés → révocation", async ({ browser }) => {
    const b = await setUpBranch("Clinique TV");
    const tvContext = await browser.newContext({ viewport: { width: 1920, height: 1080 }, locale: "fr-FR" });
    const tv = await tvContext.newPage();
    await spyOnSpeech(tv);
    await tv.goto("/tv");
    await expect(tv.getByRole("heading", { name: "Appairez cet écran" })).toBeVisible();
    const codeText = tv.locator("p[aria-live]");
    await expect(codeText).toHaveText(/^\d{3} \d{3}$/);
    const code = (await codeText.innerText()).replace(/\D/g, "");

    const staff = await browser.newPage();
    const displays = `/app/o/${b.orgId}/branches/${b.branchId}/displays`;
    await staff.goto(`/login?next=${encodeURIComponent(displays)}`);
    await signInViaUi(staff, b.email);
    await staff.waitForURL((u) => u.pathname === displays);
    await expectAccessible(staff);
    await staff.getByLabel("Code affiché sur l'écran").fill("000000");
    await staff.getByLabel("Nom de l'écran").fill("Salle d'attente");
    await staff.getByRole("button", { name: "Appairer" }).click();
    await expect(staff.getByText("Code inconnu ou expiré. Vérifiez le code affiché sur l'écran.")).toBeVisible();
    await staff.getByLabel("Code affiché sur l'écran").fill(code);
    await staff.getByLabel("Nom de l'écran").fill("Salle d'attente");
    await staff.getByRole("button", { name: "Appairer" }).click();
    await expect(staff.getByText("Écran appairé.", { exact: false })).toBeVisible();
    await expect(staff.getByRole("link", { name: /Salle d'attente/ })).toContainText("En ligne", { timeout: 15_000 });

    // L'écran passe seul à l'affichage de la file.
    await expect(tv.getByText("Les appels s'afficheront ici.")).toBeVisible({ timeout: 15_000 });
    await expect(tv.getByText("Clinique TV · Akwa")).toBeVisible();
    await expect(tv.getByRole("img", { name: "Scannez, prenez votre ticket" })).toBeVisible();
    await expect(tv.getByText(`Code : ${b.shortCode}`)).toBeVisible();

    // « Alerter le suivant » : ticket en héros, poste, annonce vocale.
    await rpc(b.staff, "reception_create_ticket", { p_service: b.serviceId });
    await rpc(b.staff, "reception_create_ticket", { p_service: b.serviceId });
    const first = await rpc<{ id: string }>(b.staff, "call_next", { p_counter: b.counterId });
    const hero = tv.getByRole("region", { name: "Ticket appelé" });
    await expect(hero).toContainText("C-001");
    await expect(hero).toContainText("Cabinet");
    await expect(hero).toContainText("3");
    await expect.poll(() => tv.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken)).toContain("Ticket C 1. Présentez-vous au cabinet 3.");
    await expectAccessible(tv);

    // Rappel : nouvelle annonce ; appel suivant : l'ancien passe dans la rangée du bas.
    await rpc(b.staff, "recall_ticket", { p_ticket: first.id });
    await expect
      .poll(() => tv.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken.filter((s) => s.startsWith("Ticket C 1.")).length))
      .toBe(2);
    await rpc(b.staff, "admit_ticket", { p_ticket: first.id });
    await rpc(b.staff, "call_next", { p_counter: b.counterId, p_finish_current: true });
    await expect(hero).toContainText("C-002");

    // Révocation : l'écran revient à l'appairage.
    await staff.getByRole("link", { name: /Salle d'attente/ }).click();
    await staff.getByRole("button", { name: "Révoquer l'écran" }).click();
    await staff.getByRole("alertdialog").getByRole("button", { name: "Révoquer l'écran" }).click();
    await expect(staff.getByText("Écran révoqué.")).toBeVisible();
    await tv.reload();
    await expect(tv.getByRole("heading", { name: "Appairez cet écran" })).toBeVisible();
    await tvContext.close();
  });

  test("annonces vocales : réglages enregistrés", async ({ page }) => {
    const b = await setUpBranch();
    const path = `/app/o/${b.orgId}/branches/${b.branchId}/displays/announcements`;
    await page.goto(`/login?next=${encodeURIComponent(path)}`);
    await signInViaUi(page, b.email);
    await page.waitForURL((u) => u.pathname === path);
    await page.getByLabel("English").click();
    await page.getByRole("radio", { name: "2 fois" }).click();
    await page.getByLabel("Activer une plage de silence").click();
    await page.getByLabel("De").fill("12:00");
    await page.getByLabel("À", { exact: true }).fill("14:00");
    await expectAccessible(page);
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await page.waitForURL(/displays\?saved=1$/);
    const { data } = await b.staff.from("announcement_settings").select("languages, repeat_count, quiet_hours").single();
    expect(data).toEqual({ languages: ["fr", "en"], repeat_count: 2, quiet_hours: [{ from: "12:00", to: "14:00" }] });
  });
});
