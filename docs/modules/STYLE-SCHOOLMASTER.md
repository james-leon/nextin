# Alignement sur SchoolMaster (autre produit Wintek)

Statut : **terminé, en attente de validation**. Première étape : connexion du personnel + couleur d'action sur tout le produit.
Captures avant : `docs/captures/responsive/before-schoolmaster/` ; après : `docs/captures/responsive/` (clair et sombre, 5 tailles) ; planches : `docs/captures/responsive/comparaison-schoolmaster/`.

## Couleur d'action
| Rôle | Clair | Sombre | Jeton |
|---|---|---|---|
| Bouton principal (`Button`/`IconButton` `filled`) | Navy `#0D2C54`, texte blanc (14,1:1) | `#2A6FB5`, texte blanc (5,2:1 ; bord 3,3:1 sur `#1C1C1E`) | `bg-primary`, `hover:bg-primary-pressed` |
| Liens, boutons secondaires, sélections (pastille, onglet, case cochée) | Blue `#1A6BB5` | `#5EA8F0` (texte) | `text-accent-text`, `bg-accent` |

En sombre, le bleu nuit n'est plus visible sur le noir (1,5:1) : le bouton principal passe à un bleu plus clair, toujours plus sombre que le bleu des liens. L'écran TV (« Activer le son », sur fond sombre) garde le bleu Wintek.

## Polices (étape 2)
- **Sora** (600 à 800) : grands titres et titres de section — tous les `h1` et `h2` (règle de base) et la classe `font-display`.
- **Inter** : tout le texte courant, à la place de la police système ; échelle de tailles iOS en `rem` inchangée.
- Fichiers de Google Fonts (licence OFL, `apps/web/app/fonts/OFL-*.txt`), réduits au sous-ensemble latin et polices variables : Inter 48 Ko, Sora 25 Ko. Chargés par `next/font/local` (`app/fonts.ts`) : servis par l'application, aucune requête vers Google (ni au build, ni au chargement), polices de repli aux métriques ajustées (pas de saut de mise en page).
- **Budget des pages client** : sans précaution, +73 Ko dépasseraient 200 Ko. Les pages client et `/pay` affichent d'abord la police système, puis Inter et Sora une fois la page chargée et le navigateur au repos (`FontsAfterLoad`, même règle que les photos et la publicité). Les en-têtes propres aux documents (`X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`) ne sont plus renvoyés avec les fichiers statiques de `/_next/static` (`nosniff` reste partout) : environ 2 Ko de moins par page. Mesures (test Playwright, téléphone) : `/` 178 Ko, `/q` 193, `/t` 197, `/t` avec publicité 198, `/nearby` 198, `/b` 198, `/b/…/rdv` 189, `/pay` 190.
- Espace du personnel, connexion, écran TV, pages légales : Inter et Sora dès l'affichage (sans préchargement).

## Couleurs et formes (étape 2)
| Élément | Avant | Après |
|---|---|---|
| Fond | `#F5F5F7` | `#F7F9FC` |
| Bordures, séparateurs | gris Apple `rgb(60 60 67 / 0.29)` | `#E8EDF4` |
| Vert succès | `#2EC04E` | `#15A05A` (texte vert : `#176B2C`, AA) |
| Liens et focus | `#1A6BB5` | inchangé : 5,5:1 sur blanc contre 5,2:1 pour le `#2563EB` de SchoolMaster |
| Rayon de base | champs 12 px, grand bouton 14 px | 12 px partout (cartes 24 px, héros 28 px inchangés) |

## Connexion du personnel
- Ordinateur (≥ 1024 px) : panneau gauche bleu nuit (`#0D2C54` → `#081D38`, dégradé très léger) : `Logo` inversé + « par Wintek — Winner Technology », sur-titre orange en capitales espacées, grand titre sur 3 lignes, accroche, 3 avantages (tuiles translucides), copyright (année courante, fuseau de Douala). Panneau droit `bg-grouped` avec le formulaire.
- Téléphone et tablette : panneau droit seul. Bascule FR / EN en pilule en haut à droite.
- Formulaire : icône de l'app, « Bon retour », « Connectez-vous à votre espace NextIn », champs avec icône (enveloppe, cadenas) et œil, « Se souvenir de moi » + « Mot de passe oublié ? », « Se connecter → » pleine largeur, « Connexion sécurisée · Données chiffrées » (bouclier vert), connexion par code e-mail conservée, lien d'inscription, pied de page légal.
- Inscription, invitation et « Nouveau mot de passe » partagent le gabarit (`AuthHeader`, `LegalFooter`).

## Se souvenir de moi
Cochée par défaut (comportement d'avant). Décochée : cookie marqueur `nextin_session_only` (httpOnly), et les cookies Supabase sont écrits sans `maxAge` ni `expires` (`sessionOnly`, `lib/auth/session-cookies.ts`) par l'action de connexion, le client serveur et le proxy (rafraîchissement) : la session se ferme avec le navigateur. Le marqueur est effacé à la déconnexion et à une connexion « se souvenir ».

## Mot de passe oublié
Les modèles d'e-mail de récupération Supabase ne sont pas configurés : « Mot de passe oublié ? » réutilise la connexion par code e-mail, puis mène à `/reset-password` (compte connecté exigé) : nouveau mot de passe + confirmation, `passwordSchema`, `supabase.auth.updateUser`. Erreurs : `password_mismatch`, `same_password`.

## Pages légales
`/cgu` (14 articles) et `/confidentialite` (13 articles), en français ou en anglais selon la langue choisie : sommaire, puis articles numérotés ancrés (`#article-3`). Le contenu se saisit dans `apps/web/lib/legal/documents.ts` (`paragraphs`, `updatedAt`) ; tant qu'un article est vide, « Bientôt disponible » en tête et « Contenu à venir » sous l'article. Les intitulés des articles sont une proposition à ajuster avec les textes définitifs. Mention « Conforme à la loi n° 2024/017 (Cameroun) » sous les liens de la connexion.

## Tests
`e2e/auth.spec.ts` : titre « Bon retour », bascule anglaise, « Se souvenir de moi » (cookies sans expiration), mot de passe oublié et nouveau mot de passe, pages légales (et 404 pour un autre document), axe et cibles tactiles.
