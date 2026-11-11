# NextIn — Recette du pilote sur place

Grille de **15 tests manuels**, à dérouler dans l'établissement pilote avant l'ouverture au public, puis après chaque
mise à jour importante. Un test est **OK** seulement si tout le « résultat attendu » est constaté ; sinon **KO**, avec
une remarque précise (écran, heure, capture). Les tests KO sont corrigés puis rejoués.

**Matériel** : 2 téléphones Android (dont un ancien, connexion 3G ou partage limité), 1 iPhone, 1 ordinateur pour
l'accueil, 1 ordinateur ou tablette par poste, l'écran TV de la salle d'attente (son activé), le QR code imprimé
(chevalet A5) et l'affiche A4, l'imprimante de tickets 80 mm si l'accueil en a une.

**Comptes** : un administrateur (directeur), un compte d'accueil, un compte agent par poste. Double authentification
activée sur le compte administrateur si elle est exigée. Numéro WhatsApp de test du testeur (consentement donné).

| N° | Test | Testeur | Date | Résultat (OK / KO) | Remarque |
|---|---|---|---|---|---|
| 1 | Prise de ticket par QR code | | | | |
| 2 | Prise de ticket par code court | | | | |
| 3 | Ticket à l'accueil pour un patient sans téléphone | | | | |
| 4 | Appel, admission, fin au poste | | | | |
| 5 | Annonce sur l'écran TV | | | | |
| 6 | Alertes WhatsApp | | | | |
| 7 | Patient absent à l'appel | | | | |
| 8 | Priorité accordée par l'accueil | | | | |
| 9 | Réorientation vers un autre service | | | | |
| 10 | Annulation par le patient | | | | |
| 11 | Demande d'aide depuis la page du ticket | | | | |
| 12 | Coupure du réseau au poste | | | | |
| 13 | Ticket à distance et confirmation de présence | | | | |
| 14 | Tableau de bord et export | | | | |
| 15 | Confidentialité et sécurité | | | | |

---

## 1. Prise de ticket par QR code
**Étapes**
1. Sur un téléphone Android, ouvrir l'appareil photo et scanner le QR code du chevalet A5.
2. Sur la page qui s'ouvre, choisir le service « Consultation ».
3. Si l'agence demande le nom, le saisir ; toucher « Prendre un ticket ».

**Résultat attendu**
- La page « Mon ticket » s'ouvre en moins de 5 secondes, même en 3G.
- Elle affiche le numéro en grand (format `C-0xx`), le badge « En direct », la position et l'attente estimée.
- Le même numéro apparaît dans la file de l'accueil, sans recharger la page.
- Aucun compte ni mot de passe n'est demandé au patient.

## 2. Prise de ticket par code court
**Étapes**
1. Sur l'iPhone, ouvrir le site NextIn et toucher l'onglet « Scanner », puis « Saisir un code ».
2. Saisir le code court affiché sur l'affiche A4 ; choisir un service ; prendre un ticket.

**Résultat attendu**
- Même résultat qu'au test 1.
- Un code faux affiche « Ce QR code ou ce code n'est plus valable. Demandez le code à l'accueil. »

## 3. Ticket à l'accueil pour un patient sans téléphone
**Étapes**
1. À l'accueil, toucher « Nouveau ticket ».
2. Choisir le service et, si besoin, le praticien. Saisir le nom si l'agence le demande.
3. Saisir le numéro WhatsApp du patient en cochant son accord, puis imprimer le ticket (80 mm).

**Résultat attendu**
- Le ticket imprimé porte le numéro, le service et un QR code de suivi.
- Il ne porte **jamais** le nom du patient.
- Le patient reçoit le message de confirmation WhatsApp.
- Sans l'accord coché, le numéro n'est pas enregistré.

## 4. Appel, admission, fin au poste
**Étapes**
1. Au poste, toucher « Ouvrir le poste ».
2. Toucher « Alerter le suivant », puis « Admettre ».
3. Attendre une minute, puis toucher « Terminer et alerter le suivant ».

**Résultat attendu**
- Le bouton principal change de rôle à chaque étape : Ouvrir → Alerter le suivant → Admettre → Terminer et alerter le suivant.
- Le chrono démarre à l'admission.
- Sur le téléphone du patient, la carte « C'est votre tour » s'affiche, avec son et vibration.
- Le patient suivant est alerté à la fin.
- « Alerter le suivant » est refusé tant que le patient alerté n'est pas traité.

## 5. Annonce sur l'écran TV
**Étapes**
1. L'écran TV est appairé (code à 6 chiffres saisi dans Agences → Écrans), et « Activer le son » a été touché.
2. Appeler un ticket depuis un poste.

**Résultat attendu**
- Le numéro et le poste s'affichent en grand en moins de 3 secondes, et le carillon puis l'annonce vocale se font entendre.
- Les trois appels précédents restent visibles.
- **Aucun nom** n'apparaît.
- Si la publicité est activée pour cet écran, elle ne masque jamais un appel en cours.

## 6. Alertes WhatsApp
**Étapes**
1. Sur la page de son ticket, le patient touche « Recevoir mes alertes sur WhatsApp ».
2. Il envoie le message prérempli (`NEXTIN C-0xx …`).
3. Faire avancer la file jusqu'à son tour.

**Résultat attendu**
- Le patient reçoit une confirmation, puis « bientôt votre tour » au seuil réglé, puis « c'est votre tour » à l'appel.
- Aucun message ne contient son nom.
- Répondre « STOP » arrête tous les messages.

## 7. Patient absent à l'appel
**Étapes**
1. Appeler un patient qui ne se présente pas.
2. Attendre le délai réglé (3 min par défaut) sans l'admettre.
3. Le rappeler une seconde fois sans réponse.

**Résultat attendu**
- Après le premier délai, le ticket recule de 3 places, la carte « Vous avez été appelé » s'affiche chez le patient et le poste alerte le suivant.
- Après le second appel manqué, le ticket est annulé (absent) et le patient en est prévenu.
- Un ticket à distance n'est jamais déclaré absent automatiquement.

## 8. Priorité accordée par l'accueil
**Étapes**
1. À l'accueil, sélectionner un ticket en attente.
2. Toucher « Rendre prioritaire » et choisir un motif (femme enceinte, personne âgée…).

**Résultat attendu**
- Le ticket passe en tête de son service, avec la pastille du motif.
- Le poste l'appelle avant les autres.
- Côté patient, aucun bouton ne permet de se déclarer prioritaire.

## 9. Réorientation vers un autre service
**Étapes**
1. Au poste, ouvrir le menu « … » du patient en cours.
2. Le transférer vers « Laboratoire ».

**Résultat attendu**
- Le patient garde le même lien.
- Sa page affiche le nouveau service et la nouvelle position.
- Il reçoit un message de réorientation s'il a activé les alertes.
- Le ticket ne compte pas comme un nouveau ticket dans le quota du mois.

## 10. Annulation par le patient
**Étapes**
1. Sur la page de son ticket, le patient touche « Annuler le ticket » (lien gris en bas), puis confirme.

**Résultat attendu**
- La confirmation affiche « Annuler votre ticket C-0xx ? ».
- Après confirmation, le ticket disparaît de la file de l'accueil, et la page propose « Prendre un nouveau ticket ».

## 11. Demande d'aide depuis la page du ticket
**Étapes**
1. Le patient touche « Demander de l'aide à l'accueil ».
2. Il retouche le bouton tout de suite.
3. À l'accueil, toucher « Traité ».

**Résultat attendu**
- L'accueil voit en direct l'encadré « Demande d'aide » avec le numéro, et la pastille « Aide » sur la ligne.
- La seconde demande est refusée (« moins de 5 minutes »).
- Rien n'apparaît sur l'écran TV.
- Après « Traité », l'encadré disparaît.
- La page « Aide » du patient affiche le téléphone et les horaires de l'agence.

## 12. Coupure du réseau au poste
**Étapes**
1. Au poste, couper le Wi-Fi.
2. Faire « Alerter le suivant », « Admettre » puis « Terminer ».
3. Rétablir le réseau.

**Résultat attendu**
- Le poste reste utilisable hors ligne, avec un bandeau.
- Au retour du réseau, les actions sont rejouées dans l'ordre.
- En cas de conflit (patient déjà appelé ailleurs), un bandeau l'indique et le suivant disponible est appelé.
- Aucun ticket n'est perdu ni appelé deux fois.

## 13. Ticket à distance et confirmation de présence
*Seulement si l'agence a activé le ticket à distance.*

**Étapes**
1. Hors de l'établissement, ouvrir « À proximité », choisir l'agence et prendre un ticket à distance.
2. Toucher « Je suis en route ».
3. Arrivé sur place, scanner le QR code de l'écran TV.

**Résultat attendu**
- « À proximité » propose d'activer la position avant que le navigateur ne la demande, et la section « Récents » liste l'agence.
- Le ticket n'est jamais appelé tant que la présence n'est pas confirmée.
- Après le scan, « Présence confirmée » s'affiche et le ticket est appelé à son tour.

## 14. Tableau de bord et export
**Étapes**
1. Avec le compte administrateur, ouvrir la vue d'ensemble et choisir « Aujourd'hui », puis « Hier ».
2. Choisir une « Période personnalisée » de 10 jours.
3. Exporter en CSV « par jour et par service ».

**Résultat attendu**
- Les indicateurs (tickets émis, attente, durée, abandons) correspondent aux tests du jour.
- Chaque indicateur est comparé à la période précédente de même durée ; une période de plus de 92 jours est refusée.
- Le CSV s'ouvre dans Excel avec les accents.
- L'export demande le code de double authentification s'il est exigé.

## 15. Confidentialité et sécurité
**Étapes**
1. Vérifier l'écran TV, les messages WhatsApp, le ticket imprimé et le tableau de bord.
2. Se connecter avec un compte d'accueil d'un **autre** établissement et tenter d'ouvrir une page de l'agence pilote (URL copiée).
3. Laisser la console Wintek inactive 30 minutes.

**Résultat attendu**
- Le nom du patient n'apparaît nulle part ailleurs que sur les postes de l'agence (et peut y être masqué).
- L'autre établissement obtient « introuvable », sans aucune donnée.
- La console se ferme après 30 minutes d'inactivité et redemande la connexion.

---

## Signature
| Rôle | Nom | Date | Décision (mise en service : oui / non / avec réserves) |
|---|---|---|---|
| Directeur de l'établissement | | | |
| Wintek | | | |
