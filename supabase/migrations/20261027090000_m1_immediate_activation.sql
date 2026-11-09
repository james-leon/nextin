-- ═════════════════════════════════════════════════════════════════════════════
-- M1 — Activation immédiate des établissements (PLAN §11 : aucune validation manuelle)
-- et lecture d'une invitation avant acceptation.
-- ═════════════════════════════════════════════════════════════════════════════

alter table public.organizations alter column status set default 'active';

-- Établissements créés avant ce changement (pilotes, démo) : activés.
update public.organizations set status = 'active' where status = 'pending';

/**
 * Aperçu d'une invitation à partir de son jeton (page /invite/[token]), avant connexion.
 * Ne révèle que le nom de l'établissement, le rôle et l'adresse masquée ; le jeton (192 bits)
 * n'est pas devinable.
 */
create or replace function public.get_invitation(p_token text)
returns table (
  organization_name text,
  role public.member_role,
  email_hint text,
  state text,
  expires_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    o.name,
    i.role,
    case
      when i.email is null then null
      else left(split_part(i.email::text, '@', 1), 1) || '•••@' || split_part(i.email::text, '@', 2)
    end,
    case
      when i.accepted_at is not null then 'accepted'
      when i.expires_at < now() then 'expired'
      else 'valid'
    end,
    i.expires_at
  from public.invitations i
  join public.organizations o on o.id = i.organization_id
  where i.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    and o.status <> 'suspended';
$$;

revoke execute on function public.get_invitation(text) from public;
grant execute on function public.get_invitation(text) to anon, authenticated;
