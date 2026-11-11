# NextIn — E-mails de connexion (Supabase Auth)

Modèles prêts à coller dans **Supabase → Authentication → Emails → Templates** (B3 de `docs/NEXTIN_GOLIVE_CHECKLIST.md`). Fichiers HTML dans `docs/auth-emails/`.

Ils sont **bilingues** : le français par défaut, l'anglais si le compte a été créé en anglais. La langue vient de `locale` dans les métadonnées du compte, enregistrée à l'inscription par `signUp`, et se lit `{{ .Data.locale }}` dans les modèles. Ils sont aux couleurs NextIn : fond `#F7F9FC`, carte blanche, bouton bleu nuit `#0D2C54`, liens `#1A6BB5`, icône PNG servie par l'application (les SVG sont bloqués par la plupart des messageries).

## Avant de coller
1. **SMTP** : Authentication → Emails → SMTP Settings, avec Brevo ou Resend (domaine vérifié : SPF, DKIM, DMARC).
   - Expéditeur : `NextIn <no-reply@votre-domaine>`.
   - Sans SMTP, Supabase n'envoie que quelques e-mails par heure.
2. **URL** : Authentication → URL Configuration.
   - *Site URL* = `https://<domaine>`.
   - *Redirect URLs* = `https://<domaine>/**`.
   - Les liens des modèles en dépendent : `{{ .SiteURL }}` et `{{ .RedirectTo }}`.
3. **Durées** :
   - Authentication → Providers → Email, *Email OTP Expiration* = 3600 secondes (le texte annonce 1 heure) ;
   - les liens d'inscription et d'invitation valent 24 heures (valeur par défaut).

## Modèles

| Modèle Supabase | Fichier | Objet (à coller dans *Subject*) | Utilisé par NextIn |
|---|---|---|---|
| **Confirm signup** | `auth-emails/confirmation.html` | `{{ if eq .Data.locale "en" }}Confirm your NextIn account{{ else }}Confirmez votre compte NextIn{{ end }}` | Création d'un compte (`/signup`). Le lien ouvre `/auth/confirm` (`token_hash`, `type=signup`) puis la page demandée (`next`) |
| **Magic Link** | `auth-emails/magic-link.html` | `{{ if eq .Data.locale "en" }}Your NextIn sign-in code{{ else }}Votre code de connexion NextIn{{ end }}` | Connexion par code et **mot de passe oublié** (`signInWithOtp` → code à 6 chiffres `{{ .Token }}`, puis `/reset-password`) |
| **Invite user** | `auth-emails/invite.html` | `{{ if eq .Data.locale "en" }}You're invited to NextIn{{ else }}Invitation à rejoindre NextIn{{ end }}` | Invitation envoyée depuis le tableau de bord Supabase. Les invitations du personnel de NextIn partent par l'application (P2) |
| **Reauthentication** | `auth-emails/reauthentication.html` | `{{ if eq .Data.locale "en" }}Confirm it's you{{ else }}Confirmez qu'il s'agit bien de vous{{ end }}` | « Secure password change » : code demandé avant un changement de mot de passe |
| **Change Email Address** | `auth-emails/email-change.html` | `{{ if eq .Data.locale "en" }}Confirm your new NextIn address{{ else }}Confirmez votre nouvelle adresse NextIn{{ end }}` | Changement de l'adresse du compte |

*Reset Password* n'est pas utilisé : « Mot de passe oublié ? » passe par le code de connexion (*Magic Link*), puis par `/reset-password`. Pour un mot de passe réinitialisé depuis le tableau de bord Supabase, collez aussi `magic-link.html` dans *Reset Password*, objet `{{ if eq .Data.locale "en" }}Reset your NextIn password{{ else }}Réinitialisez votre mot de passe NextIn{{ end }}`.

## Vérifier après avoir collé
1. Créez un compte de test en français sur `/signup`. L'e-mail est en français et le bouton ouvre l'application connectée.
2. Recommencez avec la langue anglaise (bascule FR / EN en haut à droite).
3. Demandez un code sur `/login` → « Recevoir un code par e-mail ». Le code reçu permet de se connecter.
4. Ouvrez l'e-mail sur un téléphone, en Gmail et en Outlook : la carte et le bouton s'affichent sur toute la largeur.

## Règles
- Aucun secret dans ces modèles : seules les variables de Supabase sont utilisées.
- Ne jamais ajouter de lien vers un autre domaine que celui de l'application.
- Toute modification se fait d'abord dans `docs/auth-emails/`, puis se recolle dans Supabase.
