# Refonte v2 — LOT 6a : espace annonceur (maquette 24), affiche QR (14) et facture (15)

Les écrans sont refaits ; le fonctionnement (M10a, M10b, backlog n° 1) et les RPC ne changent pas.
**Aucune migration** : tout passe par les RPC et tables existantes (`save_campaign`, `save_creative`, `save_quiz`,
`submit_campaign`, `campaign_checkout`, `redeem_coupon`, `set_ad_preferences`, `create_pay_link`, `check_rate_limit`…).

Captures : `docs/captures/v2-lot6a/` (390, 820 et 1440 px, clair et sombre ; `e2e/screenshots-v2-lot6a.spec.ts`), plus
l'affiche A4/A5 et la facture (à régler, payée) exportées en PNG.

## A. Structure de l'espace annonceur

- Barre latérale bleu nuit (`AdsNav`, `SidebarPanel`) : logo « NextIn · Espace annonceur », carte de l'annonceur
  (initiales, nom, « Secteur · Ville »), rubriques Campagnes, Valider un bon, Formules, Caissiers (propriétaire), puis
  « Compte » (Mes établissements, Réglages) et la personne connectée en bas. Un caissier ne voit que « Valider un bon »
  (et toute autre page le renvoie vers les bons).
- `/ads` : ouverture du compte, sinon redirection vers `/ads/campaigns` (ou `/ads/redeem` pour un caissier).
- Campagnes en maître-détail (`app/(staff)/ads/campaigns/layout.tsx`) : « + », lignes avec carré coloré selon le statut,
  « Argent · jusqu'au 28 nov. » / « Bronze · 7 jours » / « Terminée le 31 oct. », pastille (Diffusée vert, À payer
  orange, En validation bleu, Refusée rouge, Brouillon / En pause / Terminée gris) : `CAMPAIGN_STATUS_TONE`,
  `campaignListLine` (`@nextin/shared/ads`), aussi utilisés par la console Wintek et les annonces Maison.
- Détail (`CampaignDetail`) : sur-titre « Campagne · formule Argent », « Modifier » (teinté) seulement en brouillon ou
  refusée, **une** phrase de statut en encadré teinté (`CalloutCard tinted`, `campaignNotice`) — « Diffusée du 14 au
  28 novembre dans 12 agences. », « Campagne validée » + « Payez pour lancer la diffusion le 23 novembre. »,
  « En cours de validation par l'équipe Wintek. », « Campagne refusée : <motif>. Modifiez-la puis soumettez-la de
  nouveau. », pause et fin en une phrase, brouillon. Puis, la diffusion commencée : six chiffres en une carte à filets
  (`StatGroup` 3×2), « Affichages par jour » (pic orange), « Mise à jour chaque heure… ». Avant : le récapitulatif.
  Agences retenues, ligne « Factures › » (feuille, PDF). Action principale « Payer 15 000 FCFA » → `/pay/<jeton>`.

## B. Nouvelle campagne en cinq étapes

- Étapes `CAMPAIGN_STEPS` (1 Formule · 2 Ciblage · 3 Visuels · 4 Jeux · 5 Envoi) : frise numérotée sur tablette et
  ordinateur, « Étape 2 sur 5 » sur téléphone ; titre = nom de l'étape, retour = étape précédente (« Campagnes » à
  l'étape 1). Routes : `/ads/campaigns/new` (étape 1) puis `/ads/campaigns/<id>/edit?step=n`.
- « Continuer » enregistre le brouillon (`saveCampaignStep` → `save_campaign`) et ouvre l'étape suivante ; les feuilles
  (visuel, agences, habillage, quiz) reviennent à leur étape (`returnTo`, seulement une étape de la même campagne).
  Campagne quittée : brouillon, rouverte à la première étape incomplète (`firstIncompleteStep` : formule, puis visuel).
- Récapitulatif permanent à droite à partir de 1 024 px (`CampaignSummaryCard aside` : formule, période « Du 23 nov. au
  6 déc. », villes « Tout le pays », établissements « Tous », agences « 15 au plus » / « Toutes », total) ; sur
  téléphone, c'est l'étape 5 (`full`). Calcul pur `campaignSummary`, fin de diffusion `campaignEndsOn`.
- Étape 1 : nom et début en liste groupée ; formules actives hors Maison (prix, durée, description, pastilles
  `packageBadges` : Écrans TV, Application, Jeux, Quiz, Sky Catch), à choix unique, carte choisie teintée.
- Étape 2 : villes en pastilles (4 visibles puis « + n », `visibleCities`), types d'établissement, ligne « Agences »
  (choix existant, plafond de la formule), « Plages de diffusion » en feuille ; pastille cochée en bleu nuit plein.
- Étape 3 : chaque visuel dans l'aperçu TV 16:9 (`AdPreview`, étiquette « Publicité », titre et offre en bas), « + Ajouter
  un visuel », aide sur les formats ; aperçu en direct dans la feuille ; poids vérifié avant l'envoi puis par la base ;
  vidéo seulement pour une formule TV seule (règle actuelle). « Continuer » désactivé sans visuel, avec la raison.
- Étape 4 : Bronze → « La formule Bronze ne comprend pas les jeux. » ; Argent → quiz sponsorisé (récompense, validité,
  « Question 1 sur 3 », réponses à bouton radio, la bonne en vert) ; Or → habillage de Sky Catch (éditeur existant) et
  quiz. Quiz facultatif : rien saisi, « Continuer » passe à l'envoi.
- Étape 5 : récapitulatif, visa du ministère de la Santé seulement si le secteur l'exige (numéro, justificatif), puis
  « Soumettre à la validation » ; sans visa, la base refuse et la raison s'affiche.

## C. Ouverture, formules, bons, caissiers

- Ouverture : pictogramme orange, « Annoncez dans les salles d'attente », quatre champs groupés (secteur en ligne
  `SelectRow`), « Créer mon espace annonceur ».
- Formules (`/ads/packages`) : mêmes cartes en lecture seule, « Nouvelle campagne ».
- Valider un bon : zone sombre de la caméra (« Visez le QR code du client »), « Code du bon », « Vérifier » (teinté).
  Résultat : grand rond vert « Bon valable » (offre, campagne, validité, « Une fois validé… »), « Valider le bon », puis
  « Bon validé le … » ; déjà utilisé ou expiré : rond rouge et date. L'action renvoie `confirmed` pour distinguer
  « validé à l'instant » de « déjà utilisé » (même RPC).
- Caissiers : phrase d'explication, liste (initiales, adresse, « Validation des bons seulement », « Retirer » confirmé),
  champ « Adresse e-mail du caissier », aide, « Ajouter le caissier » (teinté).

## D. Publicité de l'établissement

- `/app/o/<org>/ads` : secteurs refusés en pastilles (refusé = bleu nuit plein), jeux pendant l'attente (interrupteurs),
  ligne « Annonces Maison · Vos services, gratuitement · n › ». **Enregistrement automatique** (`useAutoSave`,
  `autosave=1`, plus de bouton « Enregistrer »).
- `/app/o/<org>/ads/house` : interrupteur « Diffuser mes annonces Maison », liste, « + ».
- Annonce Maison (`/app/o/<org>/ads/new`) : phrase, aperçu TV au nom de l'établissement, titre, offre, visuel
  obligatoire, « Publier l'annonce » (sans validation). Le brouillon est créé au choix du visuel (le chemin du fichier
  doit contenir l'identifiant de l'annonce, contrôle de `save_creative`), puis `publishHouseAd` enregistre titre,
  visuel et publie.

## E. Affiche QR (`lib/pdf/qr-poster.tsx`)

A4 et A5 (mêmes proportions, en % de la largeur), par agence ou par service : établissement en bleu nuit, « Agence de
… », « Prenez votre ticket ici. », ligne anglaise, QR bleu nuit dans un cadre arrondi marqué « SCANNEZ », « Pas de
caméra ? Allez sur <domaine> » (`getAppUrl()`, jamais en dur) et le code, trois étapes à numéros orange (la deuxième
cite les trois premiers services puis « … »), bandeau bleu nuit avec le logo en version sombre (`PdfLogo tone="dark"`).
Textes `poster.*` (FR/EN). Contraste du QR testé (`poster.test.ts`).

## F. Facture (`lib/pdf/invoice.tsx`)

En-tête logo + « by Wintek · <raison sociale> », « Facture », numéro, pastille « À régler » (orange) / « Payée » (vert)
/ « Annulée » ; trois colonnes Émise par (NIU masqué si vide), Facturée à, Dates (période « 21 nov. – 20 déc. », tiret : la police embarquée n'a pas la flèche) ;
tableau, remise « −5 990 », sous-total, « TVA (x %) », « Total à payer » ; « Arrêtée à la somme de … francs CFA. »
(`amountInWords`, FR et EN, testé). Facture ouverte : encadré « Payer par Mobile Money » avec QR et lien `/pay/<jeton>`
créé au téléchargement (`create_pay_link`, service role, seulement pour un administrateur de l'établissement ou le
propriétaire / éditeur de l'annonceur, 10 par heure et par utilisateur) ; sinon, le texte sans lien. Payée : « Payée
le … · MTN MoMo · réf. … » (référence du paiement confirmé). Pied « Wintek · e-mail · téléphone » et pied des réglages.

## Liste de contrôle (UX §7)

- [x] **5 états** : chargement (boutons « Enregistrement… », envoi des fichiers), vide (aucune campagne, aucun caissier,
  aucune annonce Maison, placeholder du détail, aperçu sans visuel), erreur (raison de la base : visa, visuel, quiz),
  hors ligne (pages du personnel : comportement inchangé), contenu.
- [x] **axe clair et sombre** : parcours en cinq étapes, détail, bons, caissiers, formules (`e2e/ads-lot6a.spec.ts`),
  Publicité et annonce Maison (`e2e/ads.spec.ts`), et toutes les tailles de `e2e/responsive.spec.ts`.
- [x] **Clavier** : pastilles et formules sont des boutons (`role="checkbox"` / `radio`), frise en liens, fichiers dans
  des libellés atteignables ; focus visible.
- [x] **Texte à 200 %** : tailles en `rem`, cartes sans hauteur fixe ; vérifié à 125 % à 360 px par le test responsive.
- [x] **360 / 768 / 1280 px** (et 390, 820, 1180, 1440, 1920) : écrans ajoutés à `e2e/responsive.spec.ts`.
- [x] **Aucun texte en dur ni anglais en français** : dictionnaires `ads`, `adPrefs`, `poster`, `invoicePdf`.
- [x] **Budget 200 Ko** : rien ne change sur les pages client (espace annonceur et PDF côté personnel).
- [x] **Cibles de 44 px** : `expectTouchTargets` sur les nouveaux écrans.

## Écarts avec les maquettes (justifiés)

- **Action principale sur ordinateur** : « Continuer » reste en bas du contenu (comme la maquette) grâce à
  `BottomBar dock={false}` ; les autres pages gardent la règle (action dans la barre de titre).
- **En-tête du parcours** : titre = étape (« Ciblage »), sur-titre « Nouvelle campagne » ou nom de la campagne, retour =
  étape précédente sur toutes les tailles (la maquette ordinateur titre « Nouvelle campagne » avec retour « Campagnes »).
- **Surfaces** : la campagne prend toutes les surfaces de sa formule (la maquette ne propose plus de les cocher). Une
  vidéo reste réservée aux formules TV seule.
- **Secteur** : celui de l'annonceur (la maquette ne le demande plus dans la campagne).
- **Quiz** : titre du quiz = nom de la campagne (champ absent de la maquette), nombre de bons inchangé ; toutes les
  questions sur la page, chacune titrée « Question n sur N ».
- **Pastilles des formules** : bronze, argent et or assombris (`--medal-*`) pour un texte blanc lisible (AA).
- **Téléphone** : rubriques en pastilles en haut des pages (au lieu d'un retour « Annonceur »).
- **Affiche** : tailles légèrement réduites (titre 8,4 %, QR 31 % de la largeur, marges resserrées) pour tenir sur une page A4 et A5.
- **Facture** : pas de seconde ligne grise sous les désignations (l'instantané n'en contient pas) ; orange de la
  pastille assombri (`#B85E0F`) pour l'impression.
- **Annonce Maison** : un brouillon reste si l'on quitte après avoir choisi le visuel (visible dans la liste).

## Tests

- Vitest : `campaign-wizard.test.ts` (ordre des étapes, reprise, frise, récapitulatif, villes, statuts, phrases),
  `amount-words.test.ts` (0, 1, 21, 71, 80, 91, 100, 1 000, 61 410, 1 000 000, accords, anglais), `poster.test.ts`
  (contraste du QR, domaine, services), `billing.test.ts` (contenu de la facture : ouverte avec et sans lien, payée,
  annulée, NIU masqué).
- Playwright : `ads-lot6a.spec.ts` (Bronze en cinq étapes avec récapitulatif et reprise, quiz Argent, bon valable puis
  déjà utilisé, caissier limité, PDF affiche A4/A5 et facture ouverte puis payée), `ads.spec.ts` (parcours complet
  jusqu'au paiement, visa exigé, Publicité et annonce Maison), `backlog.spec.ts`, `responsive.spec.ts`.

## Vérifications

ESLint et TypeScript propres ; Vitest 436 tests ; pgTAP inchangé et vert ; `pnpm audit --prod` sans vulnérabilité ;
Playwright complet : 222 réussis (les 4 échecs du premier passage — contraste du bouton « + n » des villes en sombre —
corrigés puis revérifiés).
