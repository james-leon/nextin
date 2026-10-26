import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { PASSWORD, expectAccessible, expectTouchTargets, signInViaUi, signUpViaUi, uniqueEmail } from "./helpers";

test.describe("M1 — authentification et établissements", () => {
  test("un espace du personnel exige une connexion et revient à la page demandée", async ({ page }) => {
    await page.goto("/app/new");
    await expect(page).toHaveURL(/\/login\?next=%2Fapp%2Fnew$/);
    await expect(page.getByRole("heading", { level: 1, name: "Connexion" })).toBeVisible();
  });

  test("inscription → création d'établissement → liste, puis déconnexion et reconnexion", async ({ page }) => {
    const email = uniqueEmail("directeur");
    await signUpViaUi(page, { name: "Dr Ngo Biyong", email });
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByRole("heading", { name: "Aucun établissement pour l'instant" })).toBeVisible();
    await expectAccessible(page);

    await page.getByRole("link", { name: "Créer un établissement" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Nouvel établissement" })).toBeVisible();

    // Validation : secteur obligatoire.
    await page.getByLabel("Nom de l'établissement").fill("Clinique Test Akwa");
    await expect(page.getByText("Identifiant : clinique-test-akwa")).toBeVisible();
    await page.getByRole("button", { name: "Créer l'établissement" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Choisissez un secteur." })).toBeVisible();

    await page.getByRole("radio", { name: "Clinique" }).click();
    await expect(page.getByRole("radio", { name: "Clinique" })).toHaveAttribute("aria-checked", "true");
    await expectAccessible(page);
    await expectTouchTargets(page);
    await page.getByRole("button", { name: "Créer l'établissement" }).click();

    await expect(page).toHaveURL(/\/app\?created=/);
    await expect(page.getByRole("status").filter({ hasText: "Établissement créé." })).toBeVisible();
    await expect(page.getByText("Clinique Test Akwa")).toBeVisible();
    await expect(page.getByText("Clinique · Administrateur")).toBeVisible();
    await expectAccessible(page);

    // Déjà connecté : /login renvoie vers /app.
    await page.goto("/login");
    await expect(page).toHaveURL(/\/app$/);

    await page.getByRole("button", { name: "Se déconnecter" }).click();
    await expect(page).toHaveURL(/\/login$/);

    await signInViaUi(page, email, "MauvaisMotDePasse1");
    await expect(page.getByRole("alert").filter({ hasText: "E-mail ou mot de passe incorrect." })).toBeVisible();

    await signInViaUi(page, email);
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByText("Clinique Test Akwa")).toBeVisible();
  });

  test("deux établissements portant le même nom reçoivent des identifiants distincts", async ({ page }) => {
    await signUpViaUi(page, { name: "Serge Tchoupo", email: uniqueEmail("eneo") });
    for (let i = 0; i < 2; i++) {
      await page.goto("/app/new");
      await page.getByLabel("Nom de l'établissement").fill("Eneo Bonanjo Doublon");
      await page.getByRole("radio", { name: "Service public (eau, électricité)" }).click();
      await page.getByRole("button", { name: "Créer l'établissement" }).click();
      await expect(page).toHaveURL(/\/app\?created=/);
    }
    await expect(page.getByText("Eneo Bonanjo Doublon")).toHaveCount(2);
  });

  test("les erreurs de formulaire sont expliquées champ par champ", async ({ page }) => {
    await page.goto("/signup");
    await page.getByLabel("Nom complet").fill("A");
    await page.getByLabel("E-mail").fill("pas-un-email");
    await page.getByLabel("Mot de passe", { exact: true }).fill("court");
    await page.getByRole("button", { name: "Créer mon compte" }).click();
    await expect(page).toHaveURL(/\/signup$/);
    await expect(page.getByText("Au moins 2 caractères.")).toBeVisible();
    await expect(page.getByText("Adresse e-mail invalide.")).toBeVisible();
    await expect(page.getByText("Au moins 10 caractères.")).toBeVisible();
    await expect(page.getByLabel("E-mail")).toHaveAttribute("aria-invalid", "true");
    await expectAccessible(page);
  });

  test("une adresse déjà inscrite est signalée", async ({ page, browser }) => {
    const email = uniqueEmail("doublon");
    await signUpViaUi(page, { name: "Premier Compte", email });
    await expect(page).toHaveURL(/\/app$/);
    const otherContext = await browser.newContext();
    const other = await otherContext.newPage();
    await signUpViaUi(other, { name: "Second Compte", email, expectSuccess: false });
    await expect(other.getByRole("alert").filter({ hasText: "Un compte existe déjà" })).toBeVisible();
    await otherContext.close();
  });

  test("redirection ouverte refusée après connexion", async ({ page }) => {
    const email = uniqueEmail("redirect");
    await signUpViaUi(page, { name: "Test Redirect", email });
    await page.getByRole("button", { name: "Se déconnecter" }).click();
    await page.goto(`/login?next=${encodeURIComponent("https://evil.example/app")}`);
    await signInViaUi(page, email);
    await expect(page).toHaveURL(/^http:\/\/localhost:\d+\/app$/);
  });

  test("invitation : aperçu, création de compte et adhésion à l'équipe", async ({ page, browser }) => {
    const adminEmail = uniqueEmail("admin");
    await signUpViaUi(page, { name: "Directrice Invite", email: adminEmail });
    await page.goto("/app/new");
    await page.getByLabel("Nom de l'établissement").fill("Clinique Invitation");
    await page.getByRole("radio", { name: "Clinique" }).click();
    await page.getByRole("button", { name: "Créer l'établissement" }).click();
    await page.waitForURL(/\/app\?created=/);
    const orgId = new URL(page.url()).searchParams.get("created")!;

    // L'administratrice crée l'invitation (l'écran « Personnel » arrive au M2).
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false },
    });
    const { error: loginError } = await supabase.auth.signInWithPassword({ email: adminEmail, password: PASSWORD });
    expect(loginError).toBeNull();
    const receptionistEmail = uniqueEmail("accueil");
    const { data: token, error } = await supabase.rpc("create_invitation", {
      p_org: orgId,
      p_role: "receptionist",
      p_email: receptionistEmail,
    });
    expect(error).toBeNull();

    const guestContext = await browser.newContext();
    const guest = await guestContext.newPage();
    await guest.goto(`/invite/${token}`);
    await expect(guest.getByText("Vous êtes invité à rejoindre Clinique Invitation en tant que Réceptionniste.")).toBeVisible();
    await expect(guest.getByText(/Invitation envoyée à a•••@nextin\.test/)).toBeVisible();
    await expectAccessible(guest);
    await guest.getByRole("link", { name: "Créer un compte" }).click();
    await signUpViaUi(guest, { name: "Mireille Ekambi", email: receptionistEmail, next: `/invite/${token}` });
    await expect(guest).toHaveURL(new RegExp(`/invite/${token}$`));
    await guest.getByRole("button", { name: "Rejoindre l'équipe" }).click();
    await expect(guest).toHaveURL(/\/app\?joined=/);
    await expect(guest.getByRole("status").filter({ hasText: "Vous avez rejoint Clinique Invitation." })).toBeVisible();
    await expect(guest.getByText("Clinique · Réceptionniste")).toBeVisible();

    // Lien réutilisé : l'invitation est consommée.
    await guest.goto(`/invite/${token}`);
    await expect(guest.getByRole("heading", { name: "Invitation déjà utilisée" })).toBeVisible();
    await guestContext.close();
  });

  test("lien d'invitation inconnu", async ({ page }) => {
    await page.goto("/invite/inexistant-0000000000000000");
    await expect(page.getByRole("heading", { name: "Invitation introuvable" })).toBeVisible();
  });

  test("écran de connexion accessible, en anglais aussi", async ({ page }) => {
    await page.goto("/login");
    await expectAccessible(page);
    await expectTouchTargets(page);
    await page.getByRole("button", { name: "Recevoir un code par e-mail" }).click();
    await expect(page.getByRole("button", { name: "Envoyer le code" })).toBeVisible();
    await page.getByRole("button", { name: "English" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
    await page.getByRole("button", { name: "Français" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Connexion" })).toBeVisible();
  });
});
