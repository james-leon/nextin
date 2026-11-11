import { createHmac } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { platformAdmin } from "./ads-helpers";
import { expectAccessible, signInViaUi } from "./helpers";
import { setUpBranch, supabaseOptions } from "./queue-helpers";

// B5 — double authentification : configuration imposée par l'établissement, code demandé à la connexion,
// réinitialisation par le super admin (journalisée), console Wintek fermée après 30 minutes d'inactivité.
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, supabaseOptions);

/** Code TOTP (RFC 6238 : HMAC-SHA1, 30 s, 6 chiffres) d'une clé base32, pour la fenêtre `step`. */
function totp(secret: string, step = Math.floor(Date.now() / 30_000)): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const c of secret.replace(/=+$/, "").toUpperCase()) bits += alphabet.indexOf(c).toString(2).padStart(5, "0");
  const key = Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hmac = createHmac("sha1", key).update(counter).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  return String((hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}

/** Attend la fenêtre de 30 s suivante (un code déjà utilisé peut être refusé). */
async function nextWindow(page: Page, used: number) {
  while (Math.floor(Date.now() / 30_000) <= used) await page.waitForTimeout(500);
}

test.describe("B5 — double authentification", () => {
  test("établissement qui l'exige : configuration, code à la connexion, réinitialisation par le super admin", async ({ page, browser }, info) => {
    test.skip(info.project.name !== "desktop", "parcours du back-office ; une taille suffit");
    test.setTimeout(120_000);
    const b = await setUpBranch("Clinique Double Authentification");
    const required = await admin.from("organizations").update({ mfa_required_all: true }).eq("id", b.orgId).select("id");
    expect(required.data).toHaveLength(1);

    // Connexion : la configuration est imposée avant tout écran du back-office.
    await page.goto(`/login?next=${encodeURIComponent(`/app/o/${b.orgId}/staff`)}`);
    await signInViaUi(page, b.email);
    await page.waitForURL(/\/app\/settings\/security\?setup=1/);
    await expect(page.getByText("Votre rôle exige la double authentification.")).toBeVisible();
    await expectAccessible(page);
    await page.getByRole("button", { name: "Configurer la double authentification" }).click();
    await expect(page.getByRole("img", { name: "QR code de configuration de la double authentification" })).toBeVisible();
    const secret = (await page.getByTestId("mfa-secret").textContent())!.trim();
    let used = Math.floor(Date.now() / 30_000);
    await page.getByLabel("Code à 6 chiffres").fill(totp(secret, used));
    await page.getByRole("button", { name: "Activer" }).click();
    // Retour dans l'établissement, puis l'écran du personnel.
    await page.waitForURL(new RegExp(`/app/o/${b.orgId}`));
    await page.goto(`/app/o/${b.orgId}/staff`);
    // Réglage visible des administrateurs, activé.
    await expect(page.getByRole("switch", { name: "Double authentification pour tout le personnel" })).toBeChecked();

    // Nouvelle connexion : code demandé après le mot de passe.
    const second = await browser.newContext();
    const again = await second.newPage();
    await again.goto("/login?next=%2Fapp");
    await signInViaUi(again, b.email);
    await again.waitForURL(/\/mfa\?next=/);
    await expect(again.getByRole("heading", { name: "Double authentification" })).toBeVisible();
    await again.getByLabel("Code à 6 chiffres").fill("000000");
    await again.getByRole("button", { name: "Vérifier" }).click();
    await expect(again.getByText("Code incorrect ou expiré.").first()).toBeVisible();
    await nextWindow(again, used);
    used = Math.floor(Date.now() / 30_000);
    await again.getByLabel("Code à 6 chiffres").fill(totp(secret, used));
    await again.getByRole("button", { name: "Vérifier" }).click();
    await again.waitForURL(/\/app(\/|$)/);
    await again.goto("/app/settings");
    await expect(again.getByText("Activée")).toBeVisible();
    await second.close();

    // Téléphone perdu : le super admin réinitialise le facteur, avec un motif (journalisé).
    const wintek = await platformAdmin();
    const console_ = await browser.newContext();
    const adminPage = await console_.newPage();
    await adminPage.goto("/login?next=%2Fadmin%2Fsettings");
    await signInViaUi(adminPage, wintek.email);
    await adminPage.waitForURL(/\/admin\/settings/);
    await adminPage.getByLabel("Adresse e-mail du compte").fill(b.email);
    await adminPage.getByLabel("Motif").fill("Téléphone perdu");
    await adminPage.getByRole("button", { name: "Réinitialiser" }).click();
    await adminPage.waitForURL(/\/admin\/settings\?saved=1/);
    const { data: user } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const target = user.users.find((u) => u.email === b.email)!;
    const { data: factors } = await admin.auth.admin.mfa.listFactors({ userId: target.id });
    expect(factors?.factors ?? []).toHaveLength(0);
    const { data: logged } = await admin.from("audit_log").select("diff").eq("action", "security.mfa_reset").eq("entity_id", target.id);
    expect(logged?.[0]?.diff).toMatchObject({ reason: "Téléphone perdu" });
    await console_.close();
  });

  test("console Wintek : session fermée après 30 minutes sans requête", async ({ page, context }, info) => {
    test.skip(info.project.name !== "desktop", "console Wintek ; une taille suffit");
    const wintek = await platformAdmin();
    await page.goto("/login?next=%2Fadmin");
    await signInViaUi(page, wintek.email);
    await page.waitForURL(/\/admin(\/|$)/);
    // Dernière requête de la console il y a 31 minutes.
    await context.addCookies([{ name: "nextin_admin_seen", value: String(Date.now() - 31 * 60_000), url: new URL(page.url()).origin }]);
    await page.goto("/admin");
    await page.waitForURL(/\/login\?next=%2Fadmin&error=session_expired/);
    await expect(page.getByText("Session fermée après 30 minutes d'inactivité.")).toBeVisible();
    // Déconnecté pour de bon : l'espace du personnel renvoie à la connexion.
    await page.goto("/app");
    await page.waitForURL(/\/login/);
  });
});
