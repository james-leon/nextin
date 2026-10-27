import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { signUpViaUi, uniqueEmail } from "./helpers";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** Ouvre /app et vérifie qu'on arrive sur /login sans boucle de redirection. */
async function expectLoginWithoutLoop(page: Page) {
  const redirects: string[] = [];
  page.on("response", (r) => {
    if (r.status() >= 300 && r.status() < 400) redirects.push(new URL(r.url()).pathname);
  });
  await page.goto("/app");
  await expect(page).toHaveURL(/\/login\?next=%2Fapp$/);
  await expect(page.getByRole("heading", { level: 1, name: "Connexion" })).toBeVisible();
  expect(redirects.length).toBeLessThanOrEqual(2);
  // La page de connexion reste stable (aucune redirection vers /app).
  await page.reload();
  await expect(page).toHaveURL(/\/login/);
}

test.describe("Session invalide", () => {
  test("utilisateur supprimé côté serveur (ex. seed relancé) : pas de boucle, session effacée", async ({ page }) => {
    const email = uniqueEmail("ghost");
    await signUpViaUi(page, { name: "Session Fantôme", email });
    await expect(page).toHaveURL(/\/app/);
    const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const user = data.users.find((u) => u.email === email)!;
    await admin.auth.admin.deleteUser(user.id);

    await expectLoginWithoutLoop(page);
    const cookies = await page.context().cookies();
    expect(cookies.filter((c) => /^sb-.*-auth-token/.test(c.name) && c.value)).toEqual([]);
  });

  test("cookie de session illisible : pas de boucle", async ({ page, baseURL }) => {
    const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split(".")[0];
    await page.context().addCookies([{ name: `sb-${ref}-auth-token`, value: "base64-eyJhY2Nlc3NfdG9rZW4iOiJ4In0", url: baseURL! }]);
    await expectLoginWithoutLoop(page);
  });
});
