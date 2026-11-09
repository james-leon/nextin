# NextIn — Référentiel UX/UI

Version 1.0 — 7 novembre 2026. Ce document s'applique à **chaque écran, existant ou futur**. Toute nouvelle page ou modification doit respecter ces règles avant d'être considérée comme terminée.

Références :
- **Apple Human Interface Guidelines** : style de base de NextIn ;
- **WCAG 2.2 niveau AA** : norme d'accessibilité en vigueur (WCAG 3.0 n'est encore qu'un brouillon) ;
- **ISO 9241-110:2020** : principes d'interaction ;
- **les 10 heuristiques de Nielsen** ;
- **Core Web Vitals** de Google ;
- **Material 3**, pour les comportements attendus par les utilisateurs Android, majoritaires au Cameroun.

---

## 0. Constat de la revue (7 novembre 2026)

| Point | État |
|---|---|
| Composants de base (bouton, liste, feuille, barre d'onglets, toast, boîte de confirmation, squelette) | Présents dans `components/ui` |
| Boutons ≥ 44 px, `aria-live` sur 17 écrans, `prefers-reduced-motion` géré | En place |
| **Écrans de chargement (`loading.tsx`)** | **0 sur 73 pages** : en 3G, un clic ne montre rien tant que le serveur n'a pas répondu |
| **Pages d'erreur (`error.tsx`, `global-error.tsx`)** | **Absentes** : une erreur inattendue affiche la page par défaut de Next.js, en anglais |
| Squelettes de chargement | Utilisés seulement dans les rendez-vous (4 composants) |
| **Composant d'état vide** | **Absent** : chaque écran improvise son message |
| Mise à jour immédiate de l'écran (optimistic UI) | Seulement au poste (file locale) ; ailleurs, l'utilisateur attend la réponse du serveur |
| Tests d'accessibilité automatiques (axe) | Seulement sur les rendez-vous |
| Coupure de mot au milieu d'un titre (« Scannez pour com-mencer ») | Défaut visible sur l'écran Scanner |

---

## 1. Les 5 états de chaque écran (obligatoire)

Chaque écran qui affiche des données prévoit ces 5 états :

| État | Règle |
|---|---|
| **Chargement** | **Squelette** de la forme exacte du contenu final (même hauteur, mêmes cartes, mêmes lignes), sans spinner plein écran. Affiché en moins de 100 ms après le clic, via `loading.tsx` ou `<Suspense>`. Un spinner seulement dans un bouton en cours d'action |
| **Vide** | Composant `EmptyState` : icône, titre court, une phrase qui explique, **une action** (« Ajouter un service », « Scanner un QR code ») |
| **Erreur** | Message humain (ce qui s'est passé + quoi faire), bouton « Réessayer » ; jamais de code technique ni de texte en anglais sur une page française |
| **Hors ligne** | Bandeau discret « Hors connexion — les données affichées datent de HH:MM » ; les actions possibles hors ligne restent actives, les autres sont grisées avec une explication |
| **Rempli** | Le contenu. Une liste longue est paginée ou virtualisée, jamais 500 lignes d'un coup |

**Sans changement de mise en page** : le squelette, l'état vide et le contenu occupent la même place, pour qu'un élément ne saute pas quand les données arrivent (CLS ≤ 0,1).

---

## 2. Retour immédiat et confiance

1. **Chaque appui a une réponse visible en moins de 100 ms** : effet d'appui (`:active` léger rétrécissement ou opacité), puis état de chargement dans le bouton (spinner et texte « Envoi… »), bouton désactivé contre le double envoi.
2. **Mise à jour immédiate de l'écran** (optimistic UI, avec `useOptimistic`) pour les actions courantes : appeler le suivant, terminer, mettre en pause, cocher, réordonner. En cas d'échec, retour à l'état précédent avec un toast d'explication.
3. **Confirmation après une action réussie** : toast court (2 à 4 s) en bas de l'écran ; vibration légère sur téléphone pour les actions importantes (ticket pris, c'est votre tour).
4. **Annulation plutôt que confirmation** : pour une action réversible (supprimer un service, retirer un membre), on agit tout de suite et on propose « Annuler » pendant 5 s. Une **boîte de confirmation** seulement pour ce qui est irréversible (supprimer un établissement, rembourser), avec le bouton destructif en rouge et le nom de ce qu'on supprime.
5. **Statut toujours visible** : « Enregistré », « Synchronisation… », « Hors connexion ».

---

## 3. Simplicité (règles Apple et Nielsen)

1. **Une action principale par écran**, en bouton plein bleu ; les autres en boutons secondaires ou dans un menu « … ».
2. **Langage de l'utilisateur** : « Prendre mon ticket », pas « Créer une entrée de file ». Phrases courtes, vouvoiement, aucun jargon (RPC, quota, session, token…).
3. **3 appuis maximum** pour les tâches quotidiennes : prendre un ticket, appeler le suivant, voir l'attente.
4. **Valeurs par défaut intelligentes** : dernier service choisi, agence de l'utilisateur, langue du téléphone.
5. **Prévenir les erreurs** : clavier adapté (numérique pour un téléphone, e-mail pour une adresse), format montré en exemple (« 6 XX XX XX XX »), validation **au moment de quitter le champ**, pas à chaque frappe ; le message d'erreur apparaît **sous le champ concerné**, en rouge, avec la solution.
6. **Divulgation progressive** : réglages avancés repliés (« Plus d'options »), assistant en étapes pour l'inscription et l'installation (3 à 5 étapes, barre de progression).
7. **Cohérence** : même composant pour la même chose partout (mêmes listes, mêmes feuilles, mêmes icônes Lucide), même place pour les mêmes actions.
8. **Première utilisation guidée** : liste de démarrage pour le responsable (créer un service, imprimer le QR code, jumeler la TV, inviter le personnel), avec la progression ; astuces ponctuelles, jamais de long tutoriel.

---

## 4. Accessibilité (WCAG 2.2 AA)

- **Contraste** : texte ≥ 4,5:1, grands textes et icônes ≥ 3:1, vérifié en clair **et** en sombre.
- **Cibles tactiles ≥ 44 × 44 px**, espacées.
- **Taille du texte** : en `rem`, qui suit le réglage du téléphone ; pas de texte de moins de 12 px ; l'écran reste utilisable à 200 % de zoom.
- **Clavier** : tout est utilisable sans souris, focus visible, ordre logique, `Échap` ferme les feuilles et boîtes.
- **Lecteurs d'écran** : chaque icône-bouton a un `aria-label` ; les changements importants (appel d'un ticket, erreur) sont annoncés par `aria-live`.
- **Mouvement** : animations de 200 à 350 ms, désactivées si `prefers-reduced-motion`.
- **Couleur jamais seule** : un statut a toujours un texte ou une icône en plus de la couleur.
- **Titres sans coupure de mot** : `hyphens: none` sur les titres, `text-wrap: balance` pour équilibrer les lignes.

---

## 5. Performance ressentie (Core Web Vitals, sur téléphone moyen en 3G)

| Mesure | Objectif |
|---|---|
| Affichage du contenu principal (LCP) | ≤ 2,5 s |
| Réponse à un appui (INP) | ≤ 200 ms |
| Stabilité de la mise en page (CLS) | ≤ 0,1 |
| Pages client (premier chargement) | < 200 Ko (règle existante) |

À appliquer :
- précharger les pages suivantes probables ;
- images au bon format (WebP) avec dimensions fixées ;
- polices locales sans clignotement ;
- aucune librairie lourde sur les pages client.

---

## 6. Adapté au terrain camerounais

- **Réseau instable** : chaque écran supporte la 3G lente et la coupure (états du §1) ; réessai automatique discret.
- **Téléphones d'entrée de gamme** : tester sur un Android de 2 Go de RAM et un écran de 360 px de large.
- **Soleil et salle d'attente** : contrastes forts sur l'écran ticket, numéro très grand.
- **Personnes peu à l'aise avec le numérique** : grands boutons, icônes accompagnées de texte, aucune action cachée derrière un geste seul (le balayage est toujours doublé d'un bouton).
- **Bilingue** : chaque texte en français et en anglais, aucun mot laissé dans la mauvaise langue.

---

## 7. Contrôle avant de dire « terminé » (pour chaque écran)

1. Les 5 états du §1 existent et ont été vus (chargement simulé en 3G, liste vide, erreur forcée, mode avion).
2. Test axe sans erreur, en clair et en sombre.
3. Navigation au clavier complète ; texte à 200 % utilisable.
4. Testé à 360 px, 768 px et 1280 px de large.
5. Aucun texte en dur hors des fichiers de traduction ; aucun texte anglais dans l'interface française.
6. Budget de 200 Ko respecté pour les pages client.
