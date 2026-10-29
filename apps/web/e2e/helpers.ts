import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import { expect, type Page } from "@playwright/test";

export const PASSWORD = "Douala2026test";

export function uniqueEmail(prefix: string): string {
  return `${prefix}.${Date.now()}.${Math.random().toString(36).slice(2, 7)}@nextin.test`;
}

export async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  const blocking = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(blocking.map((v) => `${v.id}: ${v.nodes.map((n) => `${n.target.join(" ")} ${n.html.slice(0, 120)} ${n.failureSummary?.split("\n").pop()?.trim() ?? ""}`).join(", ")}`)).toEqual([]);
}

export async function expectTouchTargets(page: Page) {
  const tooSmall = await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>("main button, main a[href], main [role=switch], main input:not([type=hidden])"))
      .filter((el) => el.offsetParent !== null)
      .map((el) => {
        const r = el.getBoundingClientRect();
        const before = getComputedStyle(el, "::before");
        const h = Math.max(r.height, before.content !== "none" ? parseFloat(before.height) || 0 : 0);
        return { label: el.getAttribute("aria-label") ?? el.textContent?.trim().slice(0, 30), w: r.width, h, input: el.tagName === "INPUT" };
      })
      .filter((t) => t.h < 44 || (!t.input && t.w < 44)),
  );
  expect(tooSmall).toEqual([]);
}

export async function signUpViaUi(
  page: Page,
  { name, email, next, expectSuccess = true }: { name: string; email: string; next?: string; expectSuccess?: boolean },
) {
  await page.goto(next ? `/signup?next=${encodeURIComponent(next)}` : "/signup");
  await page.getByLabel("Nom complet").fill(name);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  if (expectSuccess) await page.waitForURL((url) => url.pathname !== "/signup");
}

export async function signInViaUi(page: Page, email: string, password = PASSWORD) {
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
}

/** Numéro camerounais aléatoire (jamais en 99999, réservé aux échecs simulés). */
export function randomPhone(): string {
  return `6${String(Math.floor(Math.random() * 1e8)).padStart(8, "0").replace(/99999$/, "12345")}`;
}

/** Dernier code de vérification envoyé à un numéro (lu dans la file d'envoi, comme le recevrait le directeur). */
export async function latestPhoneCode(phoneLocal: string): Promise<string> {
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data } = await admin
    .from("account_messages")
    .select("payload")
    .eq("kind", "phone_code")
    .eq("channel", "whatsapp")
    .eq("to_phone", `+237${phoneLocal}`)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  return (data!.payload as { code: string }).code;
}

/** Étapes 1 et 2 de l'inscription d'un établissement (M10a) : téléphone puis code reçu. */
export async function verifyPhoneViaUi(page: Page, phone = randomPhone()) {
  await page.getByLabel("Numéro de téléphone").fill(phone);
  await page.getByRole("button", { name: "Recevoir le code" }).click();
  await expect(page.getByRole("heading", { name: "Code de vérification" })).toBeVisible();
  await page.getByLabel("Code").fill(await latestPhoneCode(phone));
  await page.getByRole("button", { name: "Vérifier" }).click();
  await expect(page.getByRole("heading", { name: "Votre établissement" })).toBeVisible();
  return phone;
}

/** Identifiant de l'établissement dans l'URL du back-office. */
export function orgIdFromUrl(url: string): string {
  return /\/app\/o\/([0-9a-f-]{36})/.exec(url)![1]!;
}

/** Crée un compte directeur puis un établissement (essai) ; renvoie l'URL racine du back-office. */
export async function createOrgViaUi(page: Page, { orgName, email, type = "Clinique" }: { orgName: string; email: string; type?: string }) {
  await signUpViaUi(page, { name: "Directrice Test", email });
  await page.goto("/app/new");
  await verifyPhoneViaUi(page);
  await page.getByLabel("Nom de l'établissement").fill(orgName);
  await page.getByRole("radio", { name: type, exact: true }).click();
  await page.getByRole("button", { name: "Créer l'établissement" }).click();
  await page.waitForURL(/\/app\/o\/[0-9a-f-]{36}\/setup\?welcome=1/);
  return `/app/o/${orgIdFromUrl(page.url())}`;
}

/** Crée une agence et renvoie son URL. */
export async function createBranchViaUi(page: Page, root: string, name: string) {
  await page.goto(`${root}/branches/new`);
  await page.getByLabel("Nom de l'agence").fill(name);
  await page.getByLabel("Ville").fill("Douala");
  await page.getByRole("button", { name: "Créer l'agence" }).click();
  await page.waitForURL(/\/branches\/[0-9a-f-]{36}\?saved=1$/);
  return new URL(page.url()).pathname;
}

/**
 * Capture pleine page fidèle : la barre d'action du bas (fixe) est posée en bas du document, comme on la voit une fois
 * la page défilée jusqu'au bout. Sans cela, la capture la dessine au milieu de la page, sur le contenu.
 */
export async function fullPageShot(page: Page, path: string) {
  const style = await page.addStyleTag({ content: "html{position:relative}.safe-bottom.fixed{position:absolute!important}" });
  await page.screenshot({ path, fullPage: true });
  await style.evaluate((el) => (el as Element).remove());
}
