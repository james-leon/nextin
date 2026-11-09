# Absent automatique après l'appel

Statut : **terminé, en attente de validation**.
Migrations : `supabase/migrations/20261115090000_auto_no_show_types.sql` (nouveaux messages) et `20261115090100_auto_no_show.sql`.
Tests : `supabase/tests/database/auto_no_show.test.sql` (pgTAP, 31 vérifications), `apps/web/e2e/no-show.spec.ts` (Playwright), `packages/shared/src/notifications/notifications.test.ts`.

## Règle
Rien à faire pour l'accueil ni pour l'agent : la base s'en charge (tâche pg_cron `nextin-sweep-missed-calls`, toutes les 30 s).

1. **Premier appel manqué** : un ticket appelé (`called`) qui n'est pas admis dans `no_show_grace_seconds` (défaut 180 s) :
   - repasse en attente, recule de `no_show_move_back_places` places (défaut 3, même calcul que « Reculer » : derrière les tickets de même priorité) ;
   - événement `missed_call` (le poste qui a appelé est gardé pour les statistiques) ;
   - le client est prévenu : message `missed_call` (WhatsApp `appel_manque`, SMS, push) et carte « Vous avez été appelé » sur « Mon ticket » ;
   - le poste appelle aussitôt le suivant, s'il est ouvert et libre. Si le ticket replacé est seul dans la file, il n'est pas rappelé tout de suite : l'agent décide.
2. **Deuxième appel manqué** du même ticket : absent définitif (`no_show`, événement avec `auto: true`), message `missed_call_cancelled` (WhatsApp `ticket_annule_appels_manques`) et texte dédié sur « Mon ticket » ; le poste appelle le suivant. Un rendez-vous arrivé suit son ticket (absent).
3. **Rien avant l'appel** : un ticket en attente, même depuis des heures, n'est jamais reculé ni annulé par cette règle.
4. **Un « Rappeler » relance le délai** (compté depuis le dernier appel ou rappel).
5. **Ticket à distance** : exclu, il garde ses règles du M9 (recul puis annulation faute de présence confirmée).
6. Le nouvel appel qui suit un appel manqué renvoie bien « C'est votre tour » (clé de déduplication distincte).
7. Le poste n'est jamais bloqué : si l'agent agit au même moment (poste verrouillé), la tâche n'appelle pas le suivant à sa place.

## Réglages (« Réglages de la file », section « Absence à l'appel »)
| Réglage | Colonne | Défaut | Bornes |
|---|---|---|---|
| Absent automatique | `branch_settings.auto_no_show_enabled` | activé | — |
| Délai après l'appel | `no_show_grace_seconds` | 180 s | 30 s à 30 min (par 30 s jusqu'à 5 min) |
| Recul au premier appel manqué | `no_show_move_back_places` | 3 places | 1 à 20 |

Colonne `tickets.missed_calls` (0, 1, 2), exposée au client par `ticket_view` (`missed_calls`) ; jamais de nom.

## Modèles WhatsApp à faire approuver par Meta (avant la mise en production)
`appel_manque` et `ticket_annule_appels_manques` (catégorie Utilité, FR et EN) : texte exact dans `docs/modules/M7.md` §3. En attendant l'approbation, ils partent en message libre dans la fenêtre de 24 h, sinon par SMS de secours.

## Captures
`docs/captures/absence-auto/` : réglages (clair et sombre), « Mon ticket » après un appel manqué et après l'annulation.
