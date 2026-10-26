-- pgTAP — M4 : entrée client (QR ou code court) et services ouverts à l'accès prioritaire.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(6);

insert into auth.users (id, instance_id, aud, role, email, is_anonymous, created_at)
values ('a4000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@m4.test', false, now());
select set_config('request.jwt.claims', json_build_object('sub', 'a4000000-0000-0000-0000-00000000000a', 'role', 'authenticated')::text, true);
set local role authenticated;
create temp table ids on commit drop as
  select public.create_organization('M4 Clinic', 'pgtap-m4-clinic', 'clinic') as org;
alter table ids add column branch uuid;
update ids set branch = public.create_branch(org, 'Akwa');
insert into public.services (organization_id, branch_id, name, prefix, default_service_seconds, allow_priority)
select org, branch, 'Consultation', 'C', 600, true from ids
union all select org, branch, 'Caisse', 'K', 120, false from ids;
reset role;

create temp table entry on commit drop as
  select public.resolve_entry((select short_code from public.qr_codes where branch_id = (select branch from ids))) as v;
grant select on entry to anon;

select is((select v->>'source' from entry), 'short_code', 'le code court est reconnu');
select is((select jsonb_array_length(v->'priority_service_ids') from entry), 1, 'un seul service accepte la priorité');
select is((select v->'priority_service_ids'->>0 from entry),
  (select id::text from public.services where prefix = 'C' and branch_id = (select branch from ids)), 'il s''agit de la consultation');
select is((select jsonb_array_length(v->'board'->'services') from entry), 2, 'le tableau liste les deux services');

update public.services set active = false where prefix = 'C' and branch_id = (select branch from ids);
set local role anon;
select is(jsonb_array_length(public.resolve_entry((select v->>'entry_code' from entry))->'priority_service_ids'), 0,
  'un service désactivé n''est plus proposé en priorité (lecture anonyme)');
select ok(public.resolve_entry((select v->>'entry_code' from entry))::text !~ 'admin@m4.test', 'aucune donnée personnelle dans l''entrée');
reset role;

select * from finish();
rollback;
