# Alignement sur SchoolMaster (autre produit Wintek)

Statut : **terminé, en attente de validation**. Première étape : connexion du personnel + couleur d'action sur tout le produit.
Captures avant : `docs/captures/responsive/before-schoolmaster/` ; après : `docs/captures/responsive/` (clair et sombre, 5 tailles) ; planches : `docs/captures/responsive/comparaison-schoolmaster/`.

## Couleur d'action
| Rôle | Clair | Sombre | Jeton |
|---|---|---|---|
| Bouton principal (`Button`/`IconButton` `filled`) | Navy `#0D2C54`, texte blanc (14,1:1) | `#2A6FB5`, texte blanc (5,2:1 ; bord 3,3:1 sur `#1C1C1E`) | `bg-primary`, `hover:bg-primary-pressed` |
| Liens, boutons secondaires, sélections (pastille, onglet, case cochée) | Blue `#1A6BB5` | `#5EA8F0` (texte) | `text-accent-text`, `bg-accent` |

En sombre, le bleu nuit n'est plus visible sur le noir (1,5:1) : le bouton principal passe à un bleu plus clair, toujours plus sombre que le bleu des liens. L'écran TV (« Activer le son », sur fond sombre) garde le bleu Wintek.

## Police des grands titres
`font-display` (`--font-display`) sur les grands titres seulement : `NavigationBar` (grand titre), connexion, scanner, poste. En attendant le nom de la police de SchoolMaster, elle retombe sur la police système (SF Pro Display / Inter). Une fois le nom confirmé : la charger par `next/font` (fichier sous licence dans le dépôt ou Google Fonts) et l'affecter à `--font-display-brand` ; aucun autre changement.

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
`/legal/terms` (CGU) et `/legal/privacy` (politique de confidentialité) : « Bientôt disponible » jusqu'à ce que Wintek fournisse les textes. Mention « Conforme à la loi n° 2024/017 (Cameroun) » sous les liens.

## Tests
`e2e/auth.spec.ts` : titre « Bon retour », bascule anglaise, « Se souvenir de moi » (cookies sans expiration), mot de passe oublié et nouveau mot de passe, pages légales (et 404 pour un autre document), axe et cibles tactiles.
