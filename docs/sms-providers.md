# SMS de secours — comparatif des fournisseurs pour le Cameroun

Contexte : NextIn n'envoie un SMS **qu'en secours** (§5.5 et M7), dans trois cas :
- WhatsApp a échoué ;
- le patient n'a pas WhatsApp ;
- « c'est votre tour » n'a pas été remis en 2 minutes.

Le volume restera donc faible : quelques pour cent des messages. Pour l'instant, le faux fournisseur `console` est actif (`SMS_PROVIDER=console`). Brancher un vrai fournisseur ne demande qu'un fichier, `apps/web/lib/notifications/providers/sms.ts`.

Les prix ci-dessous sont **indicatifs** (recherche du 28/10/2026) : ils varient beaucoup selon les sources et les volumes. **Demandez un devis écrit** avant de choisir.

| Option | Réseaux | Prix indicatif par SMS | Nom d'expéditeur « NextIn » | API | Mise en place |
|---|---|---|---|---|---|
| **Agrégateur local** (Etech Keys, MboaSMS, AfrikSMS, Cooms…) | MTN, Orange, Camtel, Nexttel | **~7 à 15 FCFA** selon le volume. Exemple : Etech Keys 13 FCFA jusqu'à 99 999 SMS, 10 FCFA au-delà d'un million | Oui, après validation par l'agrégateur. MTN exige une validation manuelle (liste blanche) | HTTP REST simple, facturation en FCFA, paiement Mobile Money souvent possible | Quelques jours ; la validation du nom chez MTN peut prendre plus longtemps |
| **Orange SMS API** (Orange Developer, offre officielle) | Orange ; offre « Cameroon » avec hors réseau | Forfaits prépayés, environ **22 FCFA** par SMS (100 à 1 000 SMS), environ 17 FCFA pour 10 000 SMS ; tarifs plus bas sur l'offre « Orange uniquement » | Gratuit, 11 caractères maximum, validation sous 5 jours ouvrés (15 jours si le message part vers MTN) | OAuth2 + REST, documentation publique | Compte Orange Developer, demande du nom, achat de forfaits (Orange Money ou crédit) |
| **Plateformes internationales** (Plivo, Unimatrix, BudgetSMS…) | MTN, Orange via des routes internationales | **~0,04 à 0,27 USD** (~25 à 160 FCFA) selon la route | Variable ; MTN impose une liste blanche | Excellentes API, facturation en USD ou EUR | Rapide pour démarrer, mais remise moins fiable sur les routes internationales et prix plus élevés |

À noter :
- **MTN** est l'opérateur le plus strict : nom d'expéditeur et contenu sont validés manuellement. Orange demande un contrat et une validation du contenu.
- Depuis juin 2026, Orange refuse dans certains pays les SMS envoyés avec un nom d'expéditeur généré automatiquement : il faut un nom personnalisé.
- Les textes NextIn sont prévus en alphabet GSM-7, sans accents, pour tenir en **un seul SMS de 160 caractères** (test Vitest).

## Recommandation
1. **Un agrégateur local** qui couvre MTN et Orange, avec un nom d'expéditeur « NextIn » validé sur les deux réseaux.
   - C'est le meilleur rapport prix / remise pour des numéros camerounais, avec une facturation en FCFA.
   - Demandez à 2 ou 3 agrégateurs un devis écrit et la liste de leurs routes (directes ou internationales).
   - Demandez aussi un rapport de remise (DLR) par webhook.
2. En complément ou en attendant : **Orange SMS API**. C'est l'offre officielle, simple à ouvrir, mais elle couvre surtout les numéros Orange.

Ce que je devrai recevoir pour brancher le fournisseur retenu :
- le nom du fournisseur ;
- l'URL de son API et sa documentation ;
- les noms des variables d'environnement (clé API, et secret de webhook s'il y en a un), que vous renseignerez vous-même : jamais dans la conversation ni dans Git.

## Sources
- [Orange Developer — SMS Cameroon, tarifs](https://developer.orange.com/apis/sms-cm/pricing) · [FAQ (nom d'expéditeur)](https://developer.orange.com/apis/sms-cm/faq) · [Orange only](https://developer.orange.com/apis/sms-onnet-cm) · [Orange Business Cameroun — API SMS](https://business.orange.cm/fr/apis-orange/api-sms.html)
- [Etech Keys — tarifs](https://www.etech-keys.com/pricing.html) · [MboaSMS](https://mboasms-v2.netlify.app/) · [AfrikSMS](https://www.afriksms.com/) · [Cooms](https://cooms.app/)
- [Plivo — Cameroon](https://www.plivo.com/sms/pricing/cm/) · [Unimatrix](https://www.unimtx.com/sms/cm) · [BudgetSMS](https://www.budgetsms.net/sms-gateway-pricing/cm/cameroon/) · [eSMS Africa — index des prix](https://esmsafrica.io/sms-pricing)
- [MediaSystem — MTN, Orange ou Camtel](https://www.mediasystem.cm/blog/mtn-orange-ou-camtel-quel-operateur-pour-vos-sms-pro) · [sempico — Cameroon](https://sempico.solutions/pricing/cameroon/)
