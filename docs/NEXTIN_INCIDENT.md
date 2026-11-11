# NextIn — Procédure en cas d'incident et registre des restaurations

Document séparé de `docs/NEXTIN_SECURITY_AND_PRIVACY.md` (S4 de la liste avant mise en ligne). À relire chaque trimestre et après chaque incident. Responsable sécurité : Wintek, contact@wintekservices.com, +237 690 72 23 16.

## 1. Qu'est-ce qu'un incident ?
Tout événement qui touche, ou pourrait toucher, la **confidentialité**, l'**intégrité** ou la **disponibilité** des données des visiteurs, du personnel ou de la facturation.

| Niveau | Exemples | Délai de réaction |
|---|---|---|
| **Critique** | fuite de données personnelles ; clé de service Supabase exposée ; accès d'un établissement aux données d'un autre ; base indisponible plus d'une heure en heures d'ouverture | immédiat (moins de 15 min) |
| **Élevé** | compte administrateur compromis ; paiements activés à tort ; alertes « 10 échecs de connexion » en série ; export massif inexpliqué | moins d'une heure |
| **Modéré** | panne partielle (WhatsApp, TV, e-mails) ; faille signalée sans exploitation constatée | dans la journée |

Les alertes automatiques (S3) arrivent à l'adresse de sécurité réglée dans la console (Réglages → Adresse des alertes de sécurité) :
- connexion d'un administrateur depuis un nouvel appareil ;
- 10 échecs de connexion en 15 minutes ;
- double authentification désactivée ;
- nouvel administrateur ;
- export massif.

## 2. Procédure
1. **Détecter et signaler** (immédiatement). Toute personne qui constate un incident prévient le responsable sécurité. Elle note :
   - l'heure ;
   - ce qui a été vu ;
   - les établissements concernés ;
   - une capture d'écran si possible.
2. **Contenir** (dans l'heure, plus tôt si critique) :
   - révoquer les accès en cause : mot de passe, sessions dans Supabase (Authentication → Users → *Sign out*), double authentification (console → Réinitialiser) ;
   - faire tourner les secrets exposés, dans Vercel puis Supabase : `SUPABASE_SERVICE_ROLE_KEY`, `WHATSAPP_TOKEN`, `PAYMENT_WEBHOOK_SECRET` et les clés de l'agrégateur, `NOTIFY_DISPATCH_SECRET`, `SMTP_PASSWORD`, clés VAPID ;
   - suspendre si besoin l'établissement concerné depuis la console (motif obligatoire, journalisé).
3. **Évaluer** (sous 24 h) :
   - périmètre : quelles données, quels établissements, combien de personnes ;
   - cause, à l'aide du journal d'audit (inaltérable), de `security_alerts`, des journaux Supabase et Vercel ;
   - conserver les preuves : exports des journaux, horodatés.
4. **Notifier** :
   - chaque établissement concerné, sans délai (il est responsable des données de ses visiteurs) ;
   - l'autorité camerounaise de protection des données, dans le délai prévu par la loi n° 2024/017 ;
   - les personnes concernées si le risque est élevé (avec l'établissement).
5. **Corriger** : supprimer la cause, ajouter un test qui empêche le retour du problème (pgTAP ou Playwright), déployer.
6. **Retour d'expérience** (sous 2 semaines) : rapport écrit (chronologie, cause, données touchées, mesures prises), mise à jour de ce document et du registre ci-dessous.

## 3. Registre des incidents
| Date | Niveau | Nature | Périmètre (établissements, personnes) | Notifications faites (qui, quand) | Mesures | Clos le |
|---|---|---|---|---|---|---|
| | | | | | | |

## 4. Tests de restauration (chaque mois)
Une sauvegarde n'existe que si sa restauration a été essayée. Chaque mois, à partir de l'offre Supabase Pro (sauvegarde quotidienne et restauration à un instant donné) :
1. Restaurer la sauvegarde de la veille dans un **projet Supabase séparé** (jamais sur la production).
2. Vérifier :
   - nombre d'établissements, de tickets de la veille et de factures, comparés à la production ;
   - connexion d'un compte de test ;
   - lecture d'une facture PDF ;
   - `pnpm db:test` contre le projet restauré (facultatif).
3. Noter la durée totale (objectif : moins de 2 heures) et les écarts.
4. Supprimer le projet de test et ses données personnelles.

| Mois | Date | Sauvegarde restaurée (date, heure) | Durée | Contrôles (OK / écarts) | Testeur | Remarques |
|---|---|---|---|---|---|---|
| | | | | | | |

## 5. Contacts utiles
- Supabase : support depuis le tableau de bord (offre Pro : support prioritaire).
- Vercel : support depuis le tableau de bord.
- Agrégateur de paiement : support marchand (à compléter après signature).
- Meta (WhatsApp Business) : Business Support.
