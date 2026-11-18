import { expect, test } from "@playwright/test";

// Journal de diagnostic du captcha (navigateur → serveur) : accepte un rapport court (action, code Cloudflare), ignore
// tout le reste, toujours 204 et sans en-têtes de document (route /api).
test.describe("Diagnostic du captcha", () => {
  test.skip(({ isMobile }) => !isMobile, "route seule : une passe suffit");

  test("rapport valide ou non : 204, rien d'autre renvoyé", async ({ request }) => {
    const valid = await request.post("/api/diagnostics/captcha", { data: { action: "take_ticket", code: "110200" } });
    expect(valid.status()).toBe(204);
    expect(await valid.text()).toBe("");
    expect(valid.headers()["content-security-policy"]).toBeUndefined();
    for (const data of [{ action: "take_ticket" }, { action: "Take ticket!", code: "1" }, { action: "take_ticket", code: "x".repeat(300) }, "pas du JSON"]) {
      const response = await request.post("/api/diagnostics/captcha", { data });
      expect(response.status()).toBe(204);
    }
  });
});
