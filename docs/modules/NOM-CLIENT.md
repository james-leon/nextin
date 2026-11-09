# Nom du client sur les tickets et les rendez-vous

Statut : **terminé, en attente de validation**. Migration `20261112090000_customer_names.sql`.

## Réglage par agence
« Réglages de la file » → **Nom du client** : *Non demandé*, *Facultatif* ou *Obligatoire*, puis **Demander aussi** : rien d'autre, l'âge ou le numéro de dossier.
- Défaut : obligatoire pour les cliniques et hôpitaux, non demandé pour les autres secteurs (déclencheur `branch_settings_name_default`, agences existantes mises à jour par la migration).
- Règles publiques (sans donnée personnelle) : `customer_identity_rules(branch)`, lues par les pages client côté serveur.

## Saisie
| Où | Comportement |
|---|---|
| « Choisir un service » (`/q`), ticket à distance (`/b/[id]`) | Champ « Votre nom » (+ âge ou numéro de dossier) avant « Prendre mon ticket ». Nom obligatoire : message sous le champ et focus. Gardé sur l'appareil (`localStorage`, protégé par try/catch) pour la fois suivante. |
| Demande de rendez-vous en ligne (`/b/[id]/rdv`) | Même champ, à la place des initiales. |
| Accueil — « Nouveau ticket » | Nom (+ âge ou dossier) ; exigé par le formulaire si l'agence le demande. |
| Accueil — ticket sélectionné | « Saisir le nom » / « Modifier le nom » (patient sans téléphone, ticket imprimé), « Rendre prioritaire ». |
| Rendez-vous — « Nouveau rendez-vous » | Le champ nom remplace le repère en initiales ; affiché dans l'agenda, les demandes, le détail et la liste du médecin ; recopié sur le ticket à l'arrivée. |

La base refuse un ticket ou une demande de client sans nom quand il est obligatoire (`name_required`). Pour le personnel, la base l'accepte vide (le formulaire l'exige) afin de ne jamais bloquer l'accueil : le nom peut être complété ensuite.

## Poste agent / médecin
- Nom (et âge ou dossier) sous le numéro du patient en cours et dans « À suivre ».
- Bouton « Masquer le nom » / « Afficher le nom », et masquage automatique après 2 minutes sans activité (`useNameMask`) : l'écran peut être vu du public. Même bouton à l'accueil (icône œil dans la barre de navigation).
- Actions secondaires d'un ticket (priorité, nom) dans le menu « … » de la ligne : une seule action principale visible par écran.

## Confidentialité
- Les noms des tickets sont dans une table à part, `ticket_identities`, lisible du **seul personnel de l'agence** (ni le client, ni un autre établissement, ni la console Wintek) ; aucune écriture directe (RPC uniquement).
- Jamais sur l'écran TV, dans l'annonce vocale, les messages WhatsApp / SMS, les diffusions temps réel publiques, les statistiques ni le journal d'audit (vérifié par pgTAP). Un changement de nom prévient les postes par l'événement `identity` du canal privé du personnel, sans le nom.
- Effacés avec les autres données personnelles après `data_retention_days` (`purge_personal_data()`).
- Texte de confidentialité du Profil mis à jour.

## Tests
| Suite | Contenu |
|---|---|
| pgTAP `customer_names.test.sql` (31) | Défauts par secteur, règles publiques, nom obligatoire / vide / invalide, nettoyage, RLS (agence, autre établissement, client, visiteur), absence du nom dans le tableau de l'écran TV, la vue du client, toutes les diffusions, les messages et l'audit, saisie et correction, réorientation, mode non demandé, purge |
| Vitest `identity.test.ts` | Mêmes règles que la base (`parseIdentity`), ligne affichée au personnel |
| Playwright `names.spec.ts` | Nom obligatoire puis mémorisé sur l'appareil ; visible au poste ; jamais sur l'écran TV ; masquage manuel et automatique (horloge simulée) ; accueil : nom et priorité depuis le ticket sélectionné, aucun bouton par ligne |

## Données de démo
DOUALA CLINIC (Akwa) : nom obligatoire et âge demandé ; file du jour et rendez-vous avec des noms et âges réalistes. Eneo : nom non demandé.
