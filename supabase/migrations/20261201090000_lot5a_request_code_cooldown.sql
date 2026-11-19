-- LOT 5a (B10) — « Renvoyer le code » d'une demande de rendez-vous : au plus un code par minute, vérifié par la base.
-- Additive et compatible avec le code en ligne : même signature, même erreur (`rate_limited`, P0429) que la limite de
-- trois codes déjà en place ; seule une vérification s'ajoute. L'heure d'envoi du dernier code se déduit de son
-- expiration (`code_expires_at` = envoi + 10 minutes), déjà renvoyée par `request_view` : la page reprend son compte à
-- rebours après un rechargement sans nouvelle colonne.

create or replace function public.issue_request_code(p_request uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_r public.appointment_requests;
  v_code text;
begin
  select * into v_r from public.appointment_requests where id = p_request for update;
  if v_r.status <> 'unverified' then raise exception 'invalid_state' using errcode = 'P0409'; end if;
  -- Un code par minute au plus : le précédent a été envoyé il y a moins de 60 s.
  if v_r.code_expires_at is not null and v_r.code_expires_at - interval '10 minutes' > now() - interval '60 seconds' then
    raise exception 'rate_limited' using errcode = 'P0429';
  end if;
  if v_r.codes_sent >= 3 then raise exception 'rate_limited' using errcode = 'P0429'; end if;
  v_code := public.random_string(6, '0123456789');
  update public.appointment_requests
  set code_hash = public.sha256_hex(v_code || ':' || v_r.id), code_expires_at = now() + interval '10 minutes',
      code_attempts = 0, codes_sent = codes_sent + 1
  where id = v_r.id;
  -- Le code n'est gardé en clair que pendant sa validité (envoi, SMS de secours) : le texte enregistré est masqué
  -- et le code est effacé dès la vérification, l'annulation ou l'expiration (`clear_request_codes`).
  perform public.clear_request_codes(v_r.id);
  update public.notification_jobs set status = 'cancelled', error = 'code_replaced'
  where appointment_request_id = v_r.id and event = 'request_code' and status = 'pending';
  insert into public.notification_jobs (organization_id, branch_id, appointment_request_id, contact_id, event, channel, dedupe_key, payload)
  select c.organization_id, c.branch_id, v_r.id, c.id, 'request_code', c.channel::public.notif_channel,
         'request_code:' || v_r.id || ':' || (v_r.codes_sent + 1), jsonb_build_object('code', v_code)
  from public.notification_contacts c
  where c.appointment_request_id = v_r.id and c.appointment_id is null and c.ticket_id is null
    and c.channel in ('email', 'whatsapp', 'sms');
  perform public.kick_notification_dispatch();
end;
$$;

-- Les droits ne changent pas (fonction interne : aucun rôle ne l'exécute directement).
revoke all on function public.issue_request_code(uuid) from public, anon, authenticated;
