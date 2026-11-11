# C1 — Paiement manuel dans la console Wintek

Pour un client qui paie hors ligne (espèces au bureau, virement, chèque, Mobile Money reçu hors agrégateur).
Réservé au super admin (`assert_platform_admin`, double authentification selon les réglages).

## Enregistrer
Console → détail d'un abonnement → facture « À payer » → **Encaisser** (`/admin/invoices/<facture>/payment`) :
mode, montant (égal au total de la facture), date de réception (aujourd'hui ou dans les 12 derniers mois),
référence (obligatoire sauf pour les espèces : numéro de virement, de chèque ou de transaction), note.

`admin_record_manual_payment(facture, champs)` → table `manual_payments` (lecture : console seulement) →
`settle_invoice` : **même effet qu'un paiement en ligne** — `settle_invoice` est la logique extraite de
`confirm_payment`, que l'agrégateur emprunte aussi (facture payée, abonnement activé ou prolongé, établissement
réactivé, événements `paid` / `reactivated`, reçu `payment_confirmed` au client ; campagne activée ; extension de
quota ajoutée). Date de paiement de la facture = date de réception. Journal : `payment.manual_recorded`
(référence comprise). Facture PDF : « Payée le … via virement » (`invoice_document.manual_method`).

## Annuler
Même page, si la facture a été réglée par un paiement manuel : motif obligatoire, code de double authentification
récent si elle est exigée (`assert_mfa(null, true)`, `useMfaStepUp`). `admin_cancel_manual_payment` : facture de
nouveau ouverte, abonnement rétabli dans son état d'avant (instantané `subscription_before`), établissement
re-suspendu s'il l'était, extension retirée, campagne remise en attente de paiement ; événement `payment_cancelled`,
journal `payment.manual_cancelled`. **Refusée si une autre facture a été payée depuis** (`cancel_not_latest`) :
annuler d'abord la plus récente. Un nouveau paiement peut ensuite être enregistré.

## Tests
pgTAP `manual_payments.test.sql` (26) ; les tests de facturation existants (`m10a_billing`, `pricing_v2`, `m10b_ads`)
couvrent `confirm_payment` après l'extraction. Playwright `manual-payment.spec.ts` ; écran ajouté à
`responsive.spec.ts`.

Migration : `20261126090000_c1_manual_payments.sql` (table et fonctions nouvelles ; `confirm_payment` et
`invoice_document` gardent leur signature ; contrainte des événements élargie) — compatible avec `main`.

Corrigé au passage (B5) : `mfa_required` / `mfa_recent_required` sont désormais transmis par `mapDbError`, ce qui
déclenche la demande du code (`useMfaStepUp`) sur toutes les actions sensibles.
