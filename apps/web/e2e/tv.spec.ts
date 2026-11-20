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
    // Parcours long (appairage, quatre appels annoncés, révocation) : 30 s ne suffisent pas sur une machine chargée.
    test.setTimeout(60_000);
    const b = await setUpBranch("Clinique TV");
    const tvContext = await browser.newContext({ viewport: { width: 1920, height: 1080 }, locale: "fr-FR" });
    const tv = await tvContext.newPage();
    await spyOnSpeech(tv);
    await tv.goto("/tv");
    await expect(tv.getByRole("heading", { name: "Appairez cet écran" })).toBeVisible();
    // Code en deux groupes de trois cases (maquette v2 23) : lu dans l'attribut du bloc.
    const codeBox = tv.locator("[data-pairing-code]");
    await expect(codeBox).toHaveAttribute("data-pairing-code", /^\d{6}$/);
    await expect(codeBox.locator(".sr-only")).toHaveText(/^\d{3} \d{3}$/);
    const code = (await codeBox.getAttribute("data-pairing-code"))!;

    const staffContext = await browser.newContext({ locale: "fr-FR" });
    const staff = await staffContext.newPage();
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
    await expect
      .poll(async () => {
        await staff.reload();
        // Carte de l'écran (grille) : son statut « En ligne ».
        return staff.getByRole("listitem").filter({ hasText: "Salle d'attente" }).innerText();
      }, { timeout: 20_000 })
      .toContain("En ligne");

    // L'écran passe seul à l'affichage de la file (maquette v2 23 : aucun appel, QR code de l'agence à droite).
    await expect(tv.getByText("Les appels s'afficheront ici.")).toBeVisible({ timeout: 15_000 });
    await expect(tv.locator("header")).toContainText("Clinique TV");
    await expect(tv.locator("header")).toContainText("Akwa");
    await expect(tv.getByRole("img", { name: "Scannez, prenez votre ticket" })).toBeVisible();
    await expect(tv.getByText(`Code : ${b.shortCode}`)).toBeAttached();
    const previous = tv.getByRole("region", { name: "Appels précédents" });
    await expect(previous).toContainText("Aucun appel précédent");
    // « Activer le son » : un seul geste ; ensuite « Son activé » s'affiche.
    const soundGate = tv.getByRole("button", { name: /Activer le son/ });
    if (await soundGate.isVisible()) await soundGate.click();
    await expect(soundGate).toBeHidden();

    // « Alerter le suivant » : ligne marquée « Appel », flash vert plein écran, annonce vocale ; aucun nom.
    for (let i = 0; i < 4; i++) await rpc(b.staff, "reception_create_ticket", { p_service: b.serviceId });
    await expect(tv.getByText("4 personnes", { exact: true })).toBeVisible();
    const first = await rpc<{ id: string }>(b.staff, "call_next", { p_counter: b.counterId });
    const calls = tv.getByRole("region", { name: "Ticket appelé" });
    await expect(calls.getByRole("listitem")).toHaveCount(1);
    await expect(calls.getByRole("listitem").first()).toContainText("C-001");
    await expect(calls.getByRole("listitem").first()).toContainText("Cabinet 3");
    await expect(calls.getByRole("listitem").first()).toContainText("Appel");
    const flash = tv.getByTestId("tv-flash");
    await expect(flash).toContainText("C-001");
    await expect(flash).toContainText("Allez au cabinet 3");
    await expect(flash).toBeHidden({ timeout: 8_000 });
    await expect(tv.getByRole("region", { name: "À suivre" })).toContainText(/C-002.*C-003.*C-004/);
    await expect.poll(() => tv.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken)).toContain("Ticket C 1. Présentez-vous au cabinet 3.");
    await expectAccessible(tv);

    // Rappel : nouvelle annonce et nouveau flash ; patient admis : l'étiquette « Appel » disparaît.
    await rpc(b.staff, "recall_ticket", { p_ticket: first.id });
    await expect
      .poll(() => tv.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken.filter((s) => s.startsWith("Ticket C 1.")).length))
      .toBe(2);
    await rpc(b.staff, "admit_ticket", { p_ticket: first.id });
    await expect(calls.getByRole("listitem").first()).not.toContainText("Appel");
    await rpc(b.staff, "call_next", { p_counter: b.counterId, p_finish_current: true });
    await expect(calls.getByRole("listitem").first()).toContainText("C-002");

    // Plus aucun appel en cours : message calme et appels précédents (terminés depuis moins de 30 minutes).
    const { data: second } = await b.staff.from("tickets").select("id").eq("display_code", "C-002").eq("branch_id", b.branchId).single();
    await rpc(b.staff, "admit_ticket", { p_ticket: second!.id });
    await rpc(b.staff, "finish_ticket", { p_ticket: second!.id });
    await expect(tv.getByText("Les appels s'afficheront ici.")).toBeVisible();
    await expect(previous.getByRole("listitem")).toHaveText([/C-002.*Cabinet 3/, /C-001.*Cabinet 3/]);
    await expectAccessible(tv);

    // Révocation : l'écran revient à l'appairage.
    await staff.getByRole("link", { name: /Salle d'attente/ }).click();
    await staff.waitForURL(/\/displays\/[0-9a-f-]{36}$/);
    // Fiche de l'écran rendue par le serveur : le bouton n'ouvre la confirmation qu'une fois la page hydratée
    // (CI plus lente) ; on réessaie le clic jusqu'à ce que la confirmation s'ouvre.
    const confirm = staff.getByRole("alertdialog");
    await expect(async () => {
      await staff.getByRole("button", { name: "Révoquer l'écran" }).click();
      await expect(confirm).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 15_000 });
    await confirm.getByRole("button", { name: "Révoquer l'écran" }).click();
    await expect(staff.getByText("Écran révoqué.")).toBeVisible();
    await tv.reload();
    await expect(tv.getByRole("heading", { name: "Appairez cet écran" })).toBeVisible();
    await expect(tv.getByRole("alert").filter({ hasText: "Cet écran n'est plus appairé." })).toBeVisible();
    await tvContext.close();
    await staffContext.close();
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
    await page.getByLabel("De", { exact: true }).fill("12:00");
    await page.getByLabel("À", { exact: true }).fill("14:00");
    await expectAccessible(page);
    // Enregistrement automatique (maquette v2 19).
    await expect(page.getByRole("status").filter({ hasText: "Enregistré automatiquement" })).toBeVisible();
    await expect
      .poll(async () => (await b.staff.from("announcement_settings").select("languages, repeat_count, quiet_hours").single()).data)
      .toEqual({ languages: ["fr", "en"], repeat_count: 2, quiet_hours: [{ from: "12:00", to: "14:00" }] });
  });
});
