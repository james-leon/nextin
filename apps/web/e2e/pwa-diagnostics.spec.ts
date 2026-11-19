import { expect, test } from "@playwright/test";
import { expectAccessible } from "./helpers";

// LOT 5a (E) — diagnostic de l'écran blanc sur iPhone : erreurs du navigateur envoyées à /api/client-log (sans donnée
// personnelle), page /debug/pwa non indexée (service worker, version, mode écran d'accueil, caches, dernière erreur,
// « Réinitialiser »).
test.describe("PWA : diagnostic", () => {
  test.skip(({ isMobile }) => !isMobile, "une taille suffit");

  test("/api/client-log : accepte un message valide, ignore le reste, toujours 204", async ({ request }) => {
    const ok = await request.post("/api/client-log", { data: { kind: "error", message: "TypeError: x is undefined", path: "/t/AbCdEfGhIjKlMnOpQrStUv" } });
    expect(ok.status()).toBe(204);
    const unknownField = await request.post("/api/client-log", { data: { kind: "error", message: "x", email: "a@b.cm" } });
    expect(unknownField.status()).toBe(204);
    const tooBig = await request.post("/api/client-log", { data: { kind: "error", message: "x".repeat(5000) } });
    expect(tooBig.status()).toBe(204);
    expect((await request.get("/api/client-log")).status()).toBe(405);
  });

  test("une erreur JavaScript part vers /api/client-log et reste visible dans /debug/pwa", async ({ page }) => {
    await page.goto("/");
    // Contenu envoyé (le corps d'un `sendBeacon` n'est pas exposé par le navigateur de test) : copie avant l'envoi.
    await page.evaluate(() => {
      const w = window as unknown as { __beacons: string[] };
      w.__beacons = [];
      const send = navigator.sendBeacon.bind(navigator);
      navigator.sendBeacon = (url, data) => {
        if (data instanceof Blob) void data.text().then((text) => w.__beacons.push(text));
        return send(url, data);
      };
    });
    const beacon = page.waitForRequest((r) => r.url().endsWith("/api/client-log") && r.method() === "POST");
    await page.evaluate(() => setTimeout(() => {
      throw new Error("Diagnostic de test");
    }));
    await beacon;
    const sent = JSON.parse((await page.waitForFunction(() => (window as unknown as { __beacons: string[] }).__beacons[0]).then((h) => h.jsonValue())) ?? "{}");
    expect(sent).toMatchObject({ kind: "error", message: expect.stringContaining("Diagnostic de test"), path: "/", standalone: false });

    await page.goto("/debug/pwa");
    await expect(page.getByRole("heading", { level: 1, name: "Diagnostic de l'application" })).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expect(page.getByText(/Diagnostic de test/)).toBeVisible();
    await expect(page.getByText("Ouverte depuis l'écran d'accueil")).toBeVisible();
    // Service worker de la version en cours (enregistré au premier chargement).
    await expect.poll(async () => {
      await page.reload();
      return page.getByText("nextin-v4", { exact: true }).count();
    }, { timeout: 20_000 }).toBeGreaterThan(0);
    await expect(page.getByText("nextin-v4-static")).toBeVisible();
    await expectAccessible(page);
    await page.emulateMedia({ colorScheme: "dark" });
    await expectAccessible(page);

    // Réinitialiser : service worker désinstallé, caches vidés (cette page, mise en cache par le service worker lors des
    // rechargements, n'y est plus), dernière erreur effacée.
    await expect.poll(() => page.evaluate(async () => !!(await caches.match("/debug/pwa")))).toBe(true);
    await page.getByRole("button", { name: "Réinitialiser" }).click();
    await page.waitForLoadState("load");
    await expect(page.getByText("Aucune erreur enregistrée")).toBeVisible();
    expect(await page.evaluate(async () => !!(await caches.match("/debug/pwa")))).toBe(false);
  });
});
