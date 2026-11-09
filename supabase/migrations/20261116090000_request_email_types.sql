-- Demandes de rendez-vous en ligne vérifiées par e-mail — nouveau canal (migration séparée : une valeur ajoutée
-- à un enum n'est utilisable qu'après validation de la transaction).
alter type public.notif_channel add value if not exists 'email';
