-- Absent automatique après l'appel — nouveaux messages (migration séparée : une valeur ajoutée à un enum
-- n'est utilisable qu'après validation de la transaction).

-- Premier appel manqué : le client est replacé quelques places plus loin.
alter type public.notif_event add value if not exists 'missed_call';
-- Deuxième appel manqué : le ticket est annulé définitivement.
alter type public.notif_event add value if not exists 'missed_call_cancelled';
