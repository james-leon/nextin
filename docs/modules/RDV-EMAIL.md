# Demandes de rendez-vous en ligne : vérification par e-mail

Statut : **terminé, en attente de validation**.
Migrations : `supabase/migrations/20261116090000_request_email_types.sql` (canal `email`) et `20261116090100_request_email.sql`.
Tests : `supabase/tests/database/request_email.test.sql` (pgTAP, 40 vérifications), `m9_remote` et `m9_request_duplicates` (parcours WhatsApp, canal activé dans le test), `packages/shared/src/notifications/notifications.test.ts` et `schemas/schemas.test.ts` (Vitest), `apps/web/lib/notifications/notifications.test.ts`, `apps/web/e2e/remote.spec.ts` (Playwright).

## Parcours du patient (`/b/<agence>/rdv` puis `/r/<jeton>`)
1. Service, praticien, jour, créneau (inchangé).
2. **Adresse e-mail** (obligatoire) et **téléphone facultatif**, pour que l'accueil puisse joindre le patient : aucun message n'est envoyé sur ce numéro.
3. Texte affiché : « Vous recevrez un code, puis la réponse de l'accueil par e-mail. Pas d'e-mail ? Appelez l'établissement. » Lien « Appeler l'établissement » si l'agence a un numéro.
4. Code à 6 chiffres envoyé par e-mail ; la page `/r/<jeton>` le fait saisir (« Vérifiez votre adresse e-mail », adresse masquée `a•••@exemple.cm`, conseil sur les courriers indésirables).
5. Réponse de l'accueil (confirmé, autre créneau, refusé) puis rappels (la veille à 18 h, 2 h avant) **par e-mail**, avec un lien vers la page de la demande.
6. En attente ou confirmé : bouton « Être prévenu aussi sur ce téléphone » (notification du navigateur, si le patient l'autorise et si les clés VAPID sont configurées). L'abonnement suit le rendez-vous : réponse et rappels.

## Règles (identiques au code WhatsApp)
- Code : empreinte SHA-256 seulement en base, valable 10 minutes, 5 essais, 3 envois par demande ; effacé de la file d'envoi après vérification ou expiration.
- Limites : 5 demandes par jour **par adresse**, par numéro (s'il est donné) et par appareil (session anonyme) ; 30 par 10 minutes par IP ; captcha Turnstile.
- Doublons : une demande en attente par demandeur et par créneau ; `appointment_request_max_pending` demandes en attente au plus. Le demandeur est identifié par son adresse (sinon son numéro) : `appointment_requests.requester_key`.

## Données personnelles
- L'adresse est visible **du seul personnel de l'agence** (boîte des demandes, fiche du rendez-vous) ; le patient la voit masquée ; la console Wintek n'y a pas accès.
- Purgée avec les autres données après `organizations.data_retention_days` : `appointment_requests.email`, `appointments.email`, contacts (`notification_contacts.email`) et textes enregistrés.
- Le texte enregistré d'un e-mail envoyé ne contient ni le code ni l'adresse.

## Canaux (console Wintek → Réglages)
`platform_settings.request_channels` : canaux proposés, dans l'ordre (e-mail seul par défaut). WhatsApp et SMS sont prévus : si plusieurs canaux sont cochés, le patient choisit (le premier est proposé par défaut). Un canal non coché est refusé par la base (`channel_unavailable`). WhatsApp exige les modèles approuvés par Meta ; le SMS attend le branchement d'un fournisseur (`docs/sms-providers.md`).

## Envoi des e-mails
| Variable | Rôle |
|---|---|
| `EMAIL_PROVIDER` | `smtp` pour envoyer ; `console` (défaut, développement et tests) : rien n'est envoyé, l'objet et le texte s'affichent dans le terminal |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE` | serveur SMTP. **Brevo** : `smtp-relay.brevo.com`, 587. **Resend** : `smtp.resend.com`, 465 |
| `SMTP_USER`, `SMTP_PASSWORD` | Brevo : identifiant et clé SMTP (Brevo → SMTP & API → SMTP). Resend : `resend` et la clé API |
| `EMAIL_FROM` | expéditeur sur un domaine vérifié chez le fournisseur (SPF, DKIM), ex. `NextIn <no-reply@votre-domaine>` |
| `EMAIL_REPLY_TO` | facultatif |

Variable manquante avec `EMAIL_PROVIDER=smtp` : avertissement unique dans les journaux (noms des variables, jamais leur valeur) et e-mails affichés dans la console. Les e-mails du compte (M10a) passent par le même fournisseur.

Contenu (`@nextin/shared/notifications`, `notificationEmail`) : texte brut + HTML sobre (carte blanche, grand titre, un seul bouton bleu nuit vers la page de la demande), FR/EN selon la langue du patient. Jamais de nom de patient.

## Pour le personnel
- Boîte des demandes : ligne « E-mail » (lien `mailto:`) et « Téléphone » s'il a été donné.
- Fiche du rendez-vous : « E-mail » et « Téléphone » (au lieu de « WhatsApp ») pour un rendez-vous issu d'une demande par e-mail. Un déplacement garde l'adresse, les rappels par e-mail et le lien de la demande ; il ne crée jamais de contact WhatsApp sans accord.

## Captures
`docs/captures/rdv-email/` : formulaire, saisie du code, demande envoyée (téléphone, tablette, ordinateur ; clair et sombre), boîte des demandes, réglage de la console, e-mail du code et e-mail de confirmation.
