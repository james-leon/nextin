import { expect, test } from "@playwright/test";
import { signInViaUi } from "./helpers";
import { addDoctors, rpc, setUpBranch } from "./queue-helpers";

// Captures M6 (écran TV, menu Écrans) → docs/captures/m6/.
const OUT = "../../docs/captures/m6";

for (const theme of ["light", "dark"] as const) {
  test(`@screenshots écran TV et menu Écrans M6 ${theme}`, async ({ browser }, info) => {
    test.skip(info.project.name !== "desktop", "grand écran");
    const b = await setUpBranch("DOUALA CLINIC");
    const { cab4 } = await addDoctors(b);
    for (let i = 0; i < 6; i++) await rpc(b.staff, "reception_create_ticket", { p_service: b.serviceId });

    const tvContext = await browser.newContext({ viewport: { width: 1920, height: 1080 }, locale: "fr-FR", colorScheme: theme });
    const tv = await tvContext.newPage();
    await tv.addInitScript(() => Object.defineProperty(window, "speechSynthesis", { value: { speak: () => undefined, getVoices: () => [], cancel: () => undefined } }));
    await tv.goto("/tv");
    const codeEl = tv.locator("p[aria-live]");
    await codeEl.filter({ hasText: /^\d{3} \d{3}$/ }).waitFor();
    if (theme === "light") await tv.screenshot({ path: `${OUT}/01-tv-pairing.png` });
    const code = (await codeEl.innerText()).replace(/\D/g, "");

    const staffContext = await browser.newContext({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 2, locale: "fr-FR", colorScheme: theme });
    const staff = await staffContext.newPage();
    const displays = `/app/o/${b.orgId}/branches/${b.branchId}/displays`;
    await staff.goto(`/login?next=${encodeURIComponent(displays)}`);
    await signInViaUi(staff, b.email);
    await staff.waitForURL((u) => u.pathname === displays);
    await staff.getByLabel("Code affiché sur l'écran").fill(code);
    await staff.getByLabel("Nom de l'écran").fill("Salle d'attente");
    await staff.screenshot({ path: `${OUT}/03-admin-pair-desktop-${theme}.png` });
    await staff.getByRole("button", { name: "Appairer" }).click();
    await staff.waitForURL(/paired=1/);
    // Page rendue côté serveur : rechargée jusqu'à ce que l'écran se soit manifesté.
    await expect
      .poll(async () => {
        await staff.reload();
        return staff.getByRole("link", { name: /Salle d'attente/ }).innerText();
      }, { timeout: 20_000 })
      .toContain("En ligne");
    await staff.screenshot({ path: `${OUT}/04-admin-displays-desktop-${theme}.png` });
    await staff.goto(`${displays}/announcements`);
    await staff.screenshot({ path: `${OUT}/05-admin-announcements-desktop-${theme}.png` });

    if (theme === "light") {
      await tv.getByText("Les appels s'afficheront ici.").waitFor({ timeout: 15_000 });
      for (const counter of [b.counterId, cab4]) {
        const c = await rpc<{ id: string }>(b.staff, "call_next", { p_counter: counter });
        await rpc(b.staff, "admit_ticket", { p_ticket: c.id });
      }
      await rpc(b.staff, "call_next", { p_counter: b.counterId, p_finish_current: true });
      await rpc(b.staff, "call_next", { p_counter: cab4, p_finish_current: true });
      await tv.getByRole("region", { name: "Ticket appelé" }).getByText("C-004").waitFor();
      await tv.waitForTimeout(800);
      await tv.screenshot({ path: `${OUT}/02-tv-board.png` });
    }
    await tvContext.close();
    await staffContext.close();
  });
}
