# Refonte v2 — LOT 2 : écrans client (patient)

Ce lot applique les fondations du LOT 1 aux écrans du patient. Il ne modifie que l'interface : aucune migration, aucune RPC modifiée, aucun changement du temps réel, de Turnstile, du hors-ligne, des notifications push, des coupons ou des jeux.

## Écrans refaits

| Écran | Route | Maquette v2 |
|---|---|---|
| Accueil (« Bonjour », prendre un ticket, récents) | `/` | 01 · accueil |
| Scanner plein écran (cadre, lampe, « Saisir le code ») | `/scan` | 02 · scanner |
| Saisir le code (six cases) | `/c` | 02 · saisir le code |
| Choisir le service → Votre nom → Ticket pris | `/q/[code]` | 01 · choix du service, 02 · votre nom, ticket pris |
| Prise en ligne indisponible (encadré neutre, services désactivés) | `/q/[code]`, `/b/[id]` | 02 · prise en ligne indisponible |
| Mon ticket (en-tête « En direct », héros, file en points) | `/t/[token]` | 01 · mon ticket |
| C'est votre tour (plein écran vert, « J'arrive ») | `/t/[token]` | 01 · c'est votre tour |
| Tickets (en cours, historique) | `/t` | 01 · mes tickets |
| Profil (langue, apparence, aide, conditions) | `/profile` | 01 · profil |
| À proximité (catégories, grande carte, lignes avec vignette) | `/nearby` | 01 · à proximité |
| Fiche établissement (état d'ouverture, services) | `/b/[id]` | 03 · fiche établissement |
| Ticket à distance (« Partez vers 10:05 ») | `/t/[token]` | 03 · ticket à distance |
| Demande de rendez-vous (jours, créneaux) | `/b/[id]/rdv` | 03 · créneau, coordonnées |
| Demande envoyée, réponse (carte calendrier, « au lieu de ») | `/r/[token]` | 03 · demande envoyée, réponse |
| Aide (établissement, « Appeler l'accueil », FAQ) | `/help` | 13 · aide |
| Confidentialité (« En bref », sommaire fixe sur ordinateur) | `/confidentialite` | 13 · confidentialité |
| Bon de réduction (code en chiffres arrondis) | `/coupon/[token]` | pas de maquette ; style v2 |

## Écarts volontaires

- **Aucune barre d'onglets sur « Mon ticket » au téléphone.** La règle du projet veut que rien ne masque le ticket, et la page frôle le budget de 200 Ko. Un retour « Tickets » est placé dans l'en-tête.
- **Pas de carte « Votre position »** : la maquette 01 ne la montre pas ; la file en points du héros la remplace. Cela allège aussi la page.
- **Pas d'heure d'ouverture par service** : la base ne connaît pas cette donnée. Un service sans poste ouvert reste choisissable, avec la mention « Aucun poste ouvert ».
- **Pas de case WhatsApp sur l'écran « Votre nom »** : l'inscription WhatsApp passe par le client lui-même (« NEXTIN C-047 7K3Q »), depuis « Mon ticket ».
- **« Nom effacé après 30 jours »** est remplacé par une formulation générale, car la durée de conservation se règle par établissement.
- **Code d'agence à 6 caractères** (et non 4, comme sur la maquette), conformément au format réel. Le bouton « Continuer » reste actif et affiche l'erreur si le code est incomplet.
- **Pas de photo en tête de la fiche établissement** (budget de `/b`).
- **Pas de ligne « Alertes WhatsApp » dans le profil** : il n'existe aucun réglage global.
- **Demande de rendez-vous sur une seule page** (service, praticien, jour, créneau, coordonnées), sans étape séparée « Coordonnées » ; le récapitulatif reprend le créneau choisi.
- **Pas de bouton « Ajouter au calendrier »** sur la réponse : il faudrait un fichier `.ics`, renvoyé au LOT 3.
- **Vert « C'est votre tour » `#187A31`** (contraste AA), comme au LOT 1.
- **Écrans de démarrage iOS pour 9 tailles seulement** (iPhone récents, SE, iPad Air). Sur un autre écran, iOS affiche la couleur de fond de la page.

## Jetons ajoutés

`--icon-gray` (#8E8E93) et `--icon-indigo` (#5856D6), pour les carrés d'icône du profil (Aide, Apparence).

## Écran de démarrage iOS

- Images `apple-touch-startup-image` claires (#F2F2F7) et sombres (#000000) avec l'icône NextIn, déclarées par `metadata.appleWebApp.startupImage`.
- Fond de `html` déjà défini par les jetons, et `themeInitScript` placé avant le premier rendu.
- Police système uniquement : aucune attente de police au démarrage.
