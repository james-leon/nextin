# Agrégateurs Mobile Money pour le Cameroun — comparatif court (M10a)

But : choisir le premier fournisseur réel pour encaisser les abonnements par MTN MoMo et Orange Money. En attendant, NextIn utilise le **faux fournisseur** (`PAYMENT_PROVIDER=fake`). Brancher un agrégateur se résume à écrire un adaptateur dans `packages/payments`.

Recherche du 28/10/2026, à partir des pages publiques des fournisseurs et d'articles récents. Les grilles tarifaires changent souvent : chaque chiffre est **à confirmer par écrit** auprès du fournisseur avant de signer, en citant l'offre « abonnements SaaS, encaissement MTN + Orange, XAF ». Les sites de Notch Pay, Fapshi et MeSomb n'étaient pas consultables directement depuis l'environnement de travail ; leurs chiffres viennent des extraits indexés.

## Tableau

| | Notch Pay | Fapshi | MeSomb | CinetPay | Flutterwave |
|---|---|---|---|---|---|
| **Frais d'encaissement MTN MoMo** | ≈ 2 % | 3 % (tout compris) | non publiés (sur demande) | 2 % | 2 % (hors TVA) |
| **Frais d'encaissement Orange Money** | ≈ 2 % | 3 % | non publiés | 2,2 % | 2 % (hors TVA) |
| **Retrait vers votre compte** | 1 % vers Mobile Money | gratuit (annoncé) | à confirmer | crédit sous 8 jours au plus (CGU) ; plafonds de retrait publiés | 1 % vers Mobile Money, 1 500 XAF vers une banque |
| **Abonnement ou frais fixes** | aucun | aucun | 0 $ par mois (plugin) | aucun | aucun |
| **Délai de reversement** | à confirmer (solde disponible, retrait à la demande) | à la demande | à confirmer | jusqu'à 8 jours après l'encaissement | J+1 ouvré selon une source tierce, non confirmé ; une source signale une pause des virements au Cameroun |
| **API de paiement** | REST, paiement direct sur le numéro ou page hébergée | REST, lien de paiement ou paiement direct | REST, SDK (JS, PHP, Python…), page hébergée | REST, page de paiement, guichet | REST v3, « Francophone Mobile Money » (MTN, Orange en XAF) |
| **Webhooks signés** | oui, HMAC SHA-256 (en-tête `x-notch-signature`, clé de hachage test ou production) | à vérifier : prévoir la revérification systématique par l'API de statut | oui (signature des requêtes, à vérifier) | oui, jeton HMAC (`x-token`) | oui, en-tête `verif-hash` (secret partagé) |
| **Revérification du statut** | oui | oui | oui | oui | oui |
| **Documents demandés (compte marchand)** | KYC : pièce d'identité du gérant, et pour une société RCCM et NIU (à confirmer) | KYC : pièce d'identité ; société : RCCM et NIU (à confirmer) | KYC entreprise (à confirmer) | KYC : CNI ou passeport du gérant, justificatif de domicile, RCCM, NIU, statuts | KYB complet : statuts, RCCM, NIU, pièces des dirigeants, RIB |

Points communs à tous :
- Les frais des opérateurs payés par le client (retrait, transfert) ne concernent pas l'encaissement marchand.
- La taxe sur les transferts d'argent (0,2 % et 4 FCFA par opération) s'applique aux transferts et aux retraits, pas au paiement marchand. Elle peut toucher le reversement vers votre compte Mobile Money.
- Sans KYC validé, le compte reste en mode test : prévoir **1 à 3 semaines** d'activation.

## Lecture rapide
- **Notch Pay** : frais bas (≈ 2 %), webhooks signés et bien documentés, pas de frais fixes. **Premier choix technique** pour NextIn, avec une dépendance à un acteur jeune.
- **Fapshi** : très simple, retraits gratuits, mais 3 % par transaction. La signature des webhooks est à vérifier ; à défaut, on revérifie systématiquement le statut, ce que NextIn fait déjà.
- **MeSomb** : couvre aussi Airtel et d'autres pays, mais les commissions marchandes ne sont pas publiées : demander une grille écrite.
- **CinetPay** : acteur établi en Afrique francophone, avec une page de paiement complète. Deux inconvénients : Orange plus cher (2,2 %) et un crédit jusqu'à 8 jours, avec des plafonds de retrait à faire relever.
- **Flutterwave** : 2 % hors TVA et paiements internationaux, mais le KYB est le plus lourd et la situation des virements au Cameroun doit être confirmée par écrit.

## Recommandation
1. Ouvrir en parallèle deux comptes marchands : **Notch Pay** (principal) et **CinetPay** (secours).
2. Pour chacun, obtenir par écrit :
   - la grille tarifaire MTN et Orange en XAF, avec ou sans TVA ;
   - le délai et le coût du reversement ;
   - les plafonds ;
   - la liste exacte des documents demandés ;
   - le format et la signature des webhooks.
3. Écrire l'adaptateur du fournisseur retenu dans `packages/payments`, sur le modèle du faux fournisseur : `createCheckout`, `verifyWebhook`, `parseEvent`, `fetchStatus`. Ajouter ses clés à `.env.example`, sans valeurs.

## Pièces à préparer côté Wintek (communes à tous)
- RCCM et NIU (attestation d'immatriculation, plateforme ATOM de la DGI).
- Statuts de la société.
- CNI ou passeport du gérant.
- Justificatif de domicile ou de siège récent.
- Numéros MTN et Orange au nom de la société pour les reversements, ou RIB.
- URL publique du webhook : `{APP_URL}/api/payments/webhook/<fournisseur>`.

## Sources
- [Notch Pay — tarifs](https://notchpay.co/pricing), [FAQ développeurs](https://developer.notchpay.co/faq), [vérification des webhooks](https://developer.notchpay.co/get-started/webhooks/verify)
- [Fapshi — tarifs](https://www.fapshi.com/en/pricing)
- [MeSomb — documentation](https://docs.mesomb.com/), [paiement en ligne](https://docs.mesomb.com/development/payment), [frais Orange et MTN (blog)](https://mesomb.com/en/blog/what-are-the-orange-money-and-mobile-money-rates)
- [CinetPay — tarifs](https://cinetpay.com/pricing), [CGU des services](https://cinetpay.com/legal/cgu-services)
- [Flutterwave — tarifs Cameroun](https://flutterwave.com/cm/pricing), [Francophone Mobile Money](https://developer.flutterwave.com/docs/francophone), [ticket GitHub tiers sur le délai et la pause des virements](https://github.com/vaam-apps/vpay/issues/292)
- [Guide marchand CamerPay (documents KYC)](https://camerpay.biz/blog/comment-accepter-paiements-en-ligne-cameroun?lang=en), [Orange Money Pro — paiement marchand](https://business.orange.cm/fr/orange-money-pro/paiement-marchand.html), [NIU et plateforme ATOM](https://lefisk.cm/blog/atom-dgi-cameroun-immatriculation-fiscale-guide-complet)
- [Taxe sur les transferts Mobile Money (Cameroon Tribune)](https://www.cameroon-tribune.cm/article.html/68589/fr.html/transfert-retrait-dargent-par-mobile-money-les-frais-en-hausse)
