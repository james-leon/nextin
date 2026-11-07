# Grille tarifaire v2 et quotas mensuels

Statut : **terminé, en attente de validation**. Référence demandée : `docs/NEXTIN_MASTER_SPEC.md` partie 5 — absent du dépôt, les valeurs ci-dessous (fournies par Wintek) font foi.
Migration : `supabase/migrations/20261114090000_pricing_v2.sql`. Tests : `supabase/tests/database/pricing_v2.test.sql`, `m10a_billing.test.sql` (mis à jour), `e2e/billing.spec.ts`, `e2e/dashboard.spec.ts`.

## Formules (valeurs initiales, modifiables par le super admin)
| | Starter | Business | Premium | Enterprise |
|---|---|---|---|---|
| Prix mensuel HT | 29 900 FCFA | 59 900 FCFA | 124 900 FCFA | Sur devis |
| Agences (établissements) | 1 | 1 | 3 | sur mesure |
| Services | 3 | 10 | 30 | sur mesure |
| Guichets | 3 | 10 | 30 | sur mesure |
| Écrans TV | 1 | 3 | 10 | sur mesure |
| Utilisateurs | 5 | 15 | 50 | sur mesure |
| Tickets par mois | 1 500 | 6 000 | 15 000 | sur mesure |
| WhatsApp par mois | 500 | 2 000 | 6 000 | sur mesure |
| Historique | 3 mois | 12 mois | 24 mois | sur mesure |
| Fonctions | tickets QR, accueil, postes, écran TV, annonces vocales, alertes | + rendez-vous, ticket à distance, statistiques avancées, export | + multisite, support prioritaire | tout, support dédié |

- Paiement annuel : 2 mois offerts (réglage `annual_free_months`). Essai gratuit : Business (`trial_eligible`).
- Enterprise : pas de paiement en ligne (`plan_quote_only`) ; carte « Sur devis » et « Nous contacter » (e-mail, sinon téléphone de Wintek saisis dans les réglages de la plateforme). Le super admin fixe les limites de chaque client (« Limites sur mesure » dans le détail d'un abonnement : vide = valeur de la formule, « illimité » = sans limite ; motif journalisé).
- Établissements existants : Essentiel → Starter, Pro → Business, Entreprise → Premium (lignes renommées : mêmes identifiants, échéances inchangées ; factures passées intactes, leurs lignes sont figées). Le nouveau prix s'applique au prochain renouvellement.
- Les limites sont désormais **par établissement** (et non plus par agence). Un établissement qui dépasse déjà une limite garde tout ce qu'il a : seul l'ajout est refusé.

## Quotas du mois
- Tickets : un ticket créé = 1 unité (une réorientation n'en crée pas ; un changement de statut ne compte jamais). WhatsApp : messages envoyés.
- Alertes au directeur (WhatsApp, et e-mail si connu) à 80 % (`quota_alert_percent`) puis à 100 %, une fois par mois et par seuil. Bandeau dans le back-office pour tout le personnel ; « Changer de formule » et « Acheter une extension » pour les administrateurs.
- **Jamais de blocage d'une file en cours** : le jour où la limite est atteinte, les tickets (et les messages) continuent jusqu'à la fermeture. À partir du lendemain : prise de ticket refusée (`monthly_quota_reached`, message clair côté client et côté accueil), et seuls les messages « C'est votre tour » partent sur WhatsApp. Le compteur repart à zéro le 1er du mois (Douala).
- Extensions (`quota_packs`) : pack de tickets, pack WhatsApp ; prix, quantité, nom et mise en vente par le super admin (console → Formules → Extensions de quota). Achat depuis la page Abonnement → facture `extension` → `/pay` (MTN MoMo, Orange Money) → ajoutée au mois en cours dès le paiement, blocage levé si la nouvelle limite le permet. **Valeurs initiales provisoires, à confirmer** : 1 000 tickets = 10 000 FCFA ; 500 WhatsApp = 7 500 FCFA ; 2 000 WhatsApp = 25 000 FCFA.

## Historique des statistiques
Tableau de bord et exports masquent les jours antérieurs à l'historique de la formule (`stats_history_start`) : rien n'est supprimé, tout réapparaît en passant à une formule supérieure. Note « Historique limité à N mois » quand la période choisie dépasse.

## Modèles WhatsApp à faire approuver par Meta (avant la mise en production)
- `alerte_quota_tickets` (80 % des tickets), `quota_tickets_atteint` (100 % des tickets), `quota_whatsapp_atteint` (100 % des messages). `alerte_quota` (80 % WhatsApp) est inchangé.

## Tableau de bord
- Période par défaut : « 30 derniers jours » (glissants, comparés aux 30 jours précédents) ; Jour, Semaine, Mois au choix.
- Courbe « Attente moyenne par jour » : moins de 7 jours renseignés → « Pas encore assez de données : revenez dans quelques jours. »

## Pages client : prise en ligne indisponible
Lecture seule, suspension, quota de tickets bloquant (à partir du lendemain) ou fonction absente de la formule : dès l'ouverture de /q, /b et /b/…/rdv, encadré neutre « La prise de ticket en ligne est momentanément indisponible. Adressez-vous à l'accueil. », services sans temps d'attente, bouton désactivé. Le visiteur ne voit jamais la raison (abonnement, paiement, quota) : un seul booléen `online_open` est exposé (`requests_open` pour la demande de rendez-vous sur /b). Si l'état change après l'ouverture, le refus de la base est ramené au même encadré. Le quota de tickets ne ferme pas les demandes de rendez-vous. Le personnel garde ses bandeaux détaillés (`BillingBanner`, `QuotaBanner`).
Tests : `supabase/tests/database/online_availability.test.sql`, `apps/web/e2e/online-availability.spec.ts`.
