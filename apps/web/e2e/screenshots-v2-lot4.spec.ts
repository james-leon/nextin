import { test, type Page } from "@playwright/test";
import { PASSWORD, signInViaUi, uniqueEmail } from "./helpers";
import { anonClient, rpc, setUpBranch } from "./queue-helpers";

// Captures de la refonte v2, LOT 4 (espace directeur) → docs/captures/v2-lot4/ (ou V2_SHOTS_OUT) : téléphone (390),
// tablette (768) et ordinateur (1280), clair et sombre. Établissement créé pour l'occasion.
const OUT = process.env.V2_SHOTS_OUT ?? "../../docs/captures/v2-lot4";
const ONLY = process.env.V2_SHOTS_ONLY?.split(",");
const SIZES = [
  { tag: "390", width: 390, height: 844, mobile: true },
  { tag: "768", width: 768, height: 1024, mobile: true },
  { tag: "1280", width: 1280, height: 800, mobile: false },
] as const;

async function shoot(page: Page, name: string, path: string, suffix: string, full = true) {
  if (ONLY && !ONLY.some((p) => name.startsWith(p))) return;
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/${name}-${suffix}.png`, fullPage: full });
}

for (const theme of ["light", "dark"] as const) {
  test(`@screenshots refonte v2 LOT 4 ${theme}`, async ({ browser }, info) => {
    test.skip(info.project.name !== "desktop", "une passe suffit : les tailles sont fixées ici");
    test.setTimeout(600_000);
    const b = await setUpBranch("DOUALA CLINIC");
    for (let i = 0; i < 3; i++) await rpc(b.staff, "reception_create_ticket", { p_service: b.serviceId });

    // Compte sans établissement (état vide de « Mes établissements »).
    const lonely = uniqueEmail("vide");
    await anonClient().auth.signUp({ email: lonely, password: PASSWORD });

    for (const size of SIZES) {
      const suffix = `${size.tag}-${theme}`;
      const context = await browser.newContext({
        colorScheme: theme,
        viewport: { width: size.width, height: size.height },
        deviceScaleFactor: 1,
        isMobile: size.mobile,
        hasTouch: size.mobile,
        locale: "fr-FR",
      });
      const page = await context.newPage();
      await page.goto("/login");
      await signInViaUi(page, b.email);
      await page.waitForURL((url) => url.pathname.startsWith("/app"));
      const root = `/app/o/${b.orgId}`;
      const branch = `${root}/branches/${b.branchId}`;
      await shoot(page, "01-establishments", "/app", suffix);
      await shoot(page, "02-dashboard", root, suffix);
      await shoot(page, "03-setup", `${root}/setup`, suffix);
      await shoot(page, "10-branches", `${root}/branches`, suffix);
      await shoot(page, "11-branch", branch, suffix);
      await shoot(page, "12-services", `${branch}/services`, suffix);
      await shoot(page, "13-counters", `${branch}/counters`, suffix);
      await shoot(page, "14-hours", `${branch}/hours`, suffix);
      await shoot(page, "15-branch-edit", `${branch}/edit`, suffix);
      await shoot(page, "16-qr", `${branch}/qr`, suffix);
      await shoot(page, "17-branch-new", `${root}/branches/new`, suffix);
      await shoot(page, "20-staff", `${root}/staff`, suffix);
      await shoot(page, "21-staff-invite", `${root}/staff/invite`, suffix);
      await shoot(page, "22-practitioners", `${root}/practitioners`, suffix);
      await shoot(page, "30-displays", `${branch}/displays`, suffix);
      await shoot(page, "40-billing", `${root}/billing`, suffix);
      await shoot(page, "41-branch-settings", `${branch}/settings`, suffix);
      await context.close();

      const empty = await browser.newContext({ colorScheme: theme, viewport: { width: size.width, height: size.height }, locale: "fr-FR" });
      const ep = await empty.newPage();
      await ep.goto("/login");
      await signInViaUi(ep, lonely);
      await ep.waitForURL((url) => url.pathname.startsWith("/app"));
      await shoot(ep, "01-establishments-empty", "/app", suffix);
      await empty.close();
    }
  });
}
