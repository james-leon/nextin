# P2 — Invitations du personnel envoyées par e-mail

Avant : le lien d'invitation était seulement affiché, à copier et transmettre à la main.

## Envoi
- « Inviter un membre » (`/app/o/<org>/staff/invite`) : après `create_invitation`, l'e-mail part aussitôt
  (`sendInvitationEmail`, `lib/notifications/invitation.ts` → `invitationEmail` FR/EN dans la langue de l'établissement,
  une seule action « Accepter l'invitation », lien `absoluteUrl('/invite/<jeton>')`, valable 7 jours).
- Écran de confirmation : « Invitation envoyée » ; le lien reste proposé en secours (WhatsApp, copie). Si l'e-mail
  ne part pas : « Invitation prête » et le lien à transmettre.
- Fournisseur : `EMAIL_PROVIDER=smtp` (+ `SMTP_*`, `EMAIL_FROM`), sinon console (texte affiché en local).

## Renvoyer
- `reissue_invitation(invitation)` : **nouveau jeton** (seule son empreinte est stockée ; l'ancien lien cesse de
  fonctionner) et 7 nouveaux jours. Mêmes droits que l'invitation (`can_manage_member` : administrateur, responsable
  de l'agence pour ses rôles, super admin), double authentification selon les réglages (`assert_mfa`), 3 renvois par
  heure et par invitation, journalisé (`member.invite_resent`).
- Équipe de l'établissement : bouton « Renvoyer » sur chaque invitation en attente (à côté d'« Annuler »).
- Console : détail d'un abonnement → « Invitation du responsable » (établissements créés depuis la console, P1).
- Si l'e-mail du renvoi ne part pas, le nouveau lien est proposé à la copie.

## Tests
pgTAP `reissue_invitation.test.sql` (11) ; Playwright `invitations-email.spec.ts` (équipe et console, ancien lien
refusé) ; `structure.spec.ts` mis à jour (« Invitation envoyée »).

Migration : `20261125090000_p2_reissue_invitation.sql` (nouvelle fonction seulement, compatible avec `main`).
