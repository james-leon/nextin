# Backlog — améliorations pour la fin du développement

Points notés pendant les tests réels, à traiter **après le M11** (sauf décision contraire). Chaque entrée garde le contexte nécessaire pour être reprise telle quelle.

Le premier lot (vue ordinateur du poste médecin, menu latéral, actions de la barre de navigation, « Mes établissements » en grille, lien en double, « Mon ticket » sur ordinateur, présence par l'écran TV, icônes de secteur, contraste de « C'est votre tour », choix des agences, caisse) est traité : voir `docs/modules/BACKLOG-1.md`.

## En attente

### Application de caisse dédiée
Les caissiers valident aujourd'hui les bons depuis `/ads/redeem` dans le navigateur. Une application installable (PWA dédiée ou écran du M11) éviterait la connexion par e-mail sur le téléphone de la caisse.

### Textes des pages client par page
Chaque page client choisit ses textes (`LiteMessages`). Un test pourrait vérifier qu'aucune clé brute (`client.xxx.yyy`) ne s'affiche sur chaque page, pour éviter un oubli lors d'un ajout de composant.

### Audit des dépendances : avis ignorés (à réexaminer le 1er décembre 2026)
`pnpm audit --prod --audit-level high` reste au niveau « high ». Seuls les identifiants listés ici sont ignorés (`auditConfig.ignoreGhsas` dans `pnpm-workspace.yaml`), un par un :

| Avis | Paquet | Chemin | Raison | Réexamen |
|---|---|---|---|---|
| GHSA-fc5q-39xc-vjpf (ReDoS, high) | picomatch ≤ 4.0.7 | `apps/web > next-intl > @parcel/watcher > picomatch` | Aucune version corrigée publiée. `@parcel/watcher` est un outil de surveillance de fichiers : aucune entrée utilisateur n'atteint picomatch. | **À retirer dès qu'une version corrigée existe — réexaminer le 1er décembre 2026.** |
