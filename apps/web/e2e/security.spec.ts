import { expect, test, type Page } from "@playwright/test";
import { signInViaUi } from "./helpers";
import { rpc, setUpBranch } from "./queue-helpers";

// Politique de sécurité du contenu (CSP) : aucune violation sur les pages clés (client, TV, personnel), en-têtes
// présents sur les documents et absents des fichiers statiques.

async function watchCsp(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __csp: string[] };
    w.__csp = [];
    document.addEventListener("securitypolicyviolation", (e) => w.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
  });
}
const violations = (page: Page) => page.evaluate(() => (window as unknown as { __csp: string[] }).__csp);

test.describe("Sécurité — en-têtes et CSP", () => {
  test("pages client, TV et personnel : aucune violation de la politique de sécurité", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "une taille suffit : la politique ne dépend pas de l'écran");
    test.setTimeout(90_000);
    const b = await setUpBranch("Clinique Sécurité");
    await rpc(b.staff, "set_branch_location", { p_branch: b.branchId, p_lat: 4.05, p_lng: 9.7 });
    const ticket = await rpc<{ public_token: string }>(b.staff, "reception_create_ticket", { p_service: b.serviceId });
    await watchCsp(page);

    const response = await page.goto(`/q/${b.entryCode}`);
    const csp = response!.headers()["content-security-policy"] ?? "";
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(response!.headers()["x-frame-options"]).toBe("DENY");

    for (const path of ["/", "/nearby", `/q/${b.entryCode}`, `/t/${ticket.public_token}`, `/b/${b.branchId}`, "/tv", "/login", "/cgu"]) {
      await page.goto(path, { waitUntil: "networkidle" });
      expect(await violations(page), path).toEqual([]);
    }
    await page.goto(`/login?next=${encodeURIComponent("/desk")}`);
    await signInViaUi(page, b.email);
    for (const path of [`/app/o/${b.orgId}`, `/desk/counter/${b.counterId}`, `/desk/reception/${b.branchId}`]) {
      await page.goto(path, { waitUntil: "networkidle" });
      expect(await violations(page), path).toEqual([]);
    }
  });

  test("fichiers statiques et API : pas d'en-têtes de document (budget des pages client)", async ({ request }) => {
    const api = await request.get("/api/i18n/games?locale=fr");
    expect(api.headers()["content-security-policy"]).toBeUndefined();
    expect(api.headers()["x-content-type-options"]).toBe("nosniff");
  });
});
