-- M5b — Rendez-vous : types (fichier séparé : une valeur d'enum ajoutée n'est utilisable qu'après validation).

create type public.appointment_status as enum ('confirmed', 'checked_in', 'completed', 'rescheduled', 'cancelled', 'no_show');

alter type public.notif_event add value if not exists 'appointment_confirmed';
alter type public.notif_event add value if not exists 'appointment_reminder_day_before';
alter type public.notif_event add value if not exists 'appointment_reminder_2h';
alter type public.notif_event add value if not exists 'appointment_rescheduled';
alter type public.notif_event add value if not exists 'appointment_cancelled';
