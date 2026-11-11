-- ═════════════════════════════════════════════════════════════════════════════
-- P2 — Invitations du personnel envoyées par e-mail : « Renvoyer » une invitation en attente.
-- Le jeton n'est jamais stocké en clair : renvoyer = nouveau jeton (l'ancien lien cesse de fonctionner) et
-- 7 nouveaux jours. Ajout seulement (nouvelle fonction), compatible avec le code en ligne.
-- ═════════════════════════════════════════════════════════════════════════════

create or replace function public.reissue_invitation(p_invitation uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv public.invitations;
  v_token text;
  v_org_name text;
  v_locale text;
begin
  select * into v_inv from public.invitations where id = p_invitation and accepted_at is null for update;
  if not found then raise exception 'invitation_invalid' using errcode = 'P0002'; end if;
  if public.is_anonymous() or not public.can_manage_member(v_inv.organization_id, v_inv.branch_id, v_inv.role) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  perform public.assert_mfa(v_inv.organization_id);
  if v_inv.email is null then raise exception 'email_required' using errcode = '22023'; end if;
  -- Trois renvois par heure et par invitation (protège la boîte du destinataire et l'expéditeur).
  if not public.check_rate_limit('invitation_resend:' || p_invitation, 3, interval '1 hour') then
    raise exception 'rate_limited' using errcode = 'P0429';
  end if;

  v_token := translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/=', '-_');
  update public.invitations
  set token_hash = encode(extensions.digest(v_token, 'sha256'), 'hex'), expires_at = now() + interval '7 days'
  where id = p_invitation;
  select name, default_locale into v_org_name, v_locale from public.organizations where id = v_inv.organization_id;
  perform public.audit(v_inv.organization_id, 'member.invite_resent', 'invitation', p_invitation,
    jsonb_build_object('role', v_inv.role, 'branch_id', v_inv.branch_id));
  return jsonb_build_object('token', v_token, 'email', v_inv.email, 'role', v_inv.role,
    'organization', v_org_name, 'locale', v_locale, 'expires_at', now() + interval '7 days');
end;
$$;

revoke execute on function public.reissue_invitation(uuid) from public, anon;
grant execute on function public.reissue_invitation(uuid) to authenticated;
