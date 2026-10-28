-- M9 — Nouveaux types (migration séparée : une valeur ajoutée à un enum n'est utilisable qu'après validation).

-- Messages du ticket à distance et des demandes de rendez-vous (docs/PLAN.md §5.3, §12.6).
alter type public.notif_event add value 'time_to_leave';
alter type public.notif_event add value 'presence_reminder';
alter type public.notif_event add value 'remote_cancelled';
alter type public.notif_event add value 'request_code';
alter type public.notif_event add value 'request_accepted';
alter type public.notif_event add value 'request_modified';
alter type public.notif_event add value 'request_declined';

create type public.appointment_request_status as enum (
  -- Numéro pas encore vérifié (code WhatsApp) : invisible de l'accueil.
  'unverified',
  'pending',
  'accepted',
  'modified',
  'declined',
  'expired',
  'cancelled'
);
