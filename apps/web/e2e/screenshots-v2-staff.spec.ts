import { test } from "@playwright/test";
import { signInViaUi } from "./helpers";
import { rpc, setUpBranch } from "./queue-helpers";

// Captures de la refonte v2, LOT 3 (personnel) → docs/captures/v2-lot3/ (ou V2_SHOTS_OUT) : téléphone (390) et
// ordinateur (1440), clair et sombre. Établissement créé pour l'occasion, quelques tickets dans la file.
const OUT = process.env.V2_SHOTS_OUT ?? "../../docs/captures/v2-lot3";
const ONLY = process.env.V2_SHOTS_ONLY?.split(",");

for (const theme of ["light", "dark"] as const) {
  test(`@screenshots refonte v2 écrans du personnel ${theme}`, async ({ browser }, info) => {
    test.setTimeout(240_000);
    const desktop = info.project.name === "desktop";
    const size = desktop ? "desktop" : "mobile";
    const { staff, email, orgId, branchId, serviceId, counterId } = await setUpBranch("DOUALA CLINIC");
    for (let i = 0; i < 5; i++) await rpc(staff, "reception_create_ticket", { p_service: serviceId });
    const first = await rpc<{ id: string }>(staff, "call_next", { p_counter: counterId });
    await rpc(staff, "admit_ticket", { p_ticket: first.id });

    const context = await browser.newContext({
      colorScheme: theme,
      viewport: desktop ? { width: 1440, height: 900 } : { width: 390, height: 844 },
      deviceScaleFactor: desktop ? 1 : 2,
      isMobile: !desktop,
      hasTouch: !desktop,
      locale: "fr-FR",
    });
    const page = await context.newPage();
    const shot = async (name: string, path: string, full = false) => {
      if (ONLY && !ONLY.some((p) => name.startsWith(p))) return;
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(700);
      await page.screenshot({ path: `${OUT}/${name}-${size}-${theme}.png`, fullPage: full });
    };

    await shot("01-login", "/login");
    await shot("02-signup", "/signup");
    await page.goto("/login");
    await signInViaUi(page, email);
    await page.waitForURL((url) => url.pathname.startsWith("/app"));
    const org = `/app/o/${orgId}`;
    await shot("10-dashboard", org, true);
    await shot("11-billing", `${org}/billing`, true);
    await shot("20-settings-account", "/app/settings", true);
    await shot("21-settings-security", "/app/settings/security", true);
    await shot("22-branch-settings", `${org}/branches/${branchId}/settings`, true);
    await shot("23-org-settings", `${org}/settings`, true);
    await shot("24-staff", `${org}/staff`, true);
    await shot("30-desk-choice", "/desk");
    await shot("31-desk-counter", `/desk/counter/${counterId}`);
    await shot("32-reception", `/desk/reception/${branchId}`);
    await context.close();
  });
}
