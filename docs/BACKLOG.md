# Backlog — améliorations pour la fin du développement

Points notés pendant les tests réels, à traiter **après le M11** (sauf décision contraire). Chaque entrée garde le contexte nécessaire pour être reprise telle quelle.

Le premier lot (vue ordinateur du poste médecin, menu latéral, actions de la barre de navigation, « Mes établissements » en grille, lien en double, « Mon ticket » sur ordinateur, présence par l'écran TV, icônes de secteur, contraste de « C'est votre tour », choix des agences, caisse) est traité : voir `docs/modules/BACKLOG-1.md`.

## En attente

### Notifications du personnel (refonte v2, maquette 07)
La maquette prévoit des notifications que l'application n'envoie pas encore : nouvelle demande de rendez-vous et
attente trop longue (sur le téléphone), résumé de la journée et factures par e-mail. Seule la demande d'aide d'un patient
est réglable aujourd'hui (son et vibration à l'accueil, par appareil). Chaque ajout demande un envoi réel (base →
expéditeur M7) avant d'afficher son interrupteur.

### Moyeu des réglages de l'établissement (refonte v2, maquette 07)
La maquette montre une page de réglages avec une liste de rubriques à gauche (Informations, Agences, File d'attente,
Rendez-vous, Messages, Publicité, Sécurité, Données personnelles). Les rubriques existent dans le back-office, chacune à
sa place ; un moyeu unique avec recherche reste à concevoir. L'enregistrement automatique est déjà en place.

### Appareils connectés : lieu approximatif
La maquette affiche la ville de chaque appareil (« Douala · il y a 2 h »). Il faudrait une géolocalisation de l'adresse
IP (donnée personnelle) : non fait, à décider avec la politique de confidentialité.

### Application de caisse dédiée
Les caissiers valident aujourd'hui les bons depuis `/ads/redeem` dans le navigateur. Une application installable (PWA dédiée ou écran du M11) éviterait la connexion par e-mail sur le téléphone de la caisse.

### Textes des pages client par page
Chaque page client choisit ses textes (`LiteMessages`). Un test pourrait vérifier qu'aucune clé brute (`client.xxx.yyy`) ne s'affiche sur chaque page, pour éviter un oubli lors d'un ajout de composant.

### Audit des dépendances : avis ignorés (à réexaminer le 1er décembre 2026)
`pnpm audit --prod --audit-level high` reste au niveau « high ». Seuls les identifiants listés ici sont ignorés (`auditConfig.ignoreGhsas` dans `pnpm-workspace.yaml`), un par un :

| Avis | Paquet | Chemin | Raison | Réexamen |
|---|---|---|---|---|
| GHSA-fc5q-39xc-vjpf (ReDoS, high) | picomatch ≤ 4.0.7 | `apps/web > next-intl > @parcel/watcher > picomatch` | Aucune version corrigée publiée. `@parcel/watcher` est un outil de surveillance de fichiers : aucune entrée utilisateur n'atteint picomatch. | **À retirer dès qu'une version corrigée existe — réexaminer le 1er décembre 2026.** |
