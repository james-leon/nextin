-- pgTAP — S2 : isolement entre établissements, généré pour **chaque** table métier (toute table de `public` qui
-- porte `organization_id`). La directrice de l'établissement B ne lit, ne modifie ni ne supprime aucune ligne de A.
-- Une table ajoutée plus tard est contrôlée automatiquement. Le test vérifie aussi qu'il porte sur des données
-- réelles (au moins 15 tables remplies pour A) pour ne pas réussir à vide.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
grant execute on function public.create_organization(text, text, public.org_type, text, integer) to authenticated;

select plan(5);
alter table public.branch_settings alter column customer_name_mode set default 'optional';

create schema tests;
create function tests.login_as(p_id uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated', 'is_anonymous', false)::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function tests.logout() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;
create temp table ids (name text primary key, id uuid) on commit drop;
grant all on ids to authenticated;
create function tests.id(p_name text) returns uuid language sql as $$ select id from ids where name = p_name $$;

/** Tables métier : tables de `public` avec une colonne `organization_id`. */
create function tests.tenant_tables() returns setof text language sql stable as $$
  select c.table_name::text
  from information_schema.columns c
  join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name
  where c.table_schema = 'public' and c.column_name = 'organization_id' and t.table_type = 'BASE TABLE'
  order by 1;
$$;

/**
 * Exécuté avec les droits de la session courante (pas SECURITY DEFINER) : pour chaque table, lecture, modification
 * et suppression des lignes de `p_org` ; renvoie les violations. Un refus de droit (42501) est un succès.
 */
create function tests.leaks(p_org uuid) returns text[] language plpgsql as $$
declare
  v_table text;
  v_count bigint;
  v_out text[] := '{}';
begin
  for v_table in select tests.tenant_tables() loop
    begin
      execute format('select count(*) from public.%I where organization_id = $1', v_table) into v_count using p_org;
      if v_count > 0 then v_out := v_out || format('%s : %s ligne(s) lue(s)', v_table, v_count); end if;
    exception when insufficient_privilege then null;
    end;
    begin
      execute format('update public.%I set organization_id = organization_id where organization_id = $1', v_table) using p_org;
      get diagnostics v_count = row_count;
      if v_count > 0 then v_out := v_out || format('%s : %s ligne(s) modifiée(s)', v_table, v_count); end if;
    exception when insufficient_privilege then null;
    end;
    begin
      execute format('delete from public.%I where organization_id = $1', v_table) using p_org;
      get diagnostics v_count = row_count;
      if v_count > 0 then v_out := v_out || format('%s : %s ligne(s) supprimée(s)', v_table, v_count); end if;
    exception when insufficient_privilege then null;
    end;
  end loop;
  return v_out;
end;
$$;

/** Tables où l'établissement a au moins une ligne (lecture en administrateur de la base). */
create function tests.filled(p_org uuid) returns text[] language plpgsql security definer as $$
declare
  v_table text;
  v_count bigint;
  v_out text[] := '{}';
begin
  for v_table in select tests.tenant_tables() loop
    execute format('select count(*) from public.%I where organization_id = $1', v_table) into v_count using p_org;
    if v_count > 0 then v_out := v_out || v_table; end if;
  end loop;
  return v_out;
end;
$$;
grant usage on schema tests to authenticated;
grant execute on all functions in schema tests to authenticated;

-- ─── Établissement A : structure, personnel, file, rendez-vous, notifications ─
insert into auth.users (id, instance_id, aud, role, email, created_at) values
  ('15000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@isolation.test', now()),
  ('15000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@isolation.test', now());
select tests.login_as('15000000-0000-0000-0000-0000000000a1');
insert into ids select 'org_a', public.create_organization('Clinique A', 'pgtap-iso-a', 'clinic');
insert into ids select 'branch_a', public.create_branch(tests.id('org_a'), 'Akwa');
insert into public.services (organization_id, branch_id, name, prefix, default_service_seconds)
values (tests.id('org_a'), tests.id('branch_a'), 'Consultation', 'C', 600);
insert into ids select 'svc_a', id from public.services where branch_id = tests.id('branch_a');
insert into public.counters (organization_id, branch_id, kind, number) values (tests.id('org_a'), tests.id('branch_a'), 'cabinet', 1);
insert into ids select 'cab_a', id from public.counters where branch_id = tests.id('branch_a');
insert into public.counter_services (organization_id, counter_id, service_id) values (tests.id('org_a'), tests.id('cab_a'), tests.id('svc_a'));
insert into public.specialties (organization_id, name) values (tests.id('org_a'), 'Médecine générale');
insert into public.practitioners (organization_id, branch_id, display_name) values (tests.id('org_a'), tests.id('branch_a'), 'Dr Abena');
select public.create_invitation(tests.id('org_a'), 'agent', tests.id('branch_a'), 'nouvel.agent@isolation.test');
select tests.logout();
delete from public.opening_hours where branch_id = tests.id('branch_a');
insert into public.opening_hours (organization_id, branch_id, weekday, opens_at, closes_at)
select tests.id('org_a'), tests.id('branch_a'), d, '00:00', '23:59:59' from generate_series(1, 7) d;
insert into public.branch_closures (organization_id, branch_id, date) values (tests.id('org_a'), tests.id('branch_a'), current_date + 30);
select tests.login_as('15000000-0000-0000-0000-0000000000a1');
select public.open_counter(tests.id('cab_a'));
-- Ticket avec nom, numéro WhatsApp (consentement) : identité, contact, travaux de notification, événements.
insert into ids select 'ticket_a', (public.reception_create_ticket(tests.id('svc_a'), null, null, null, '+237690001111', true, 'fr', 'Awa Ngono') ->> 'id')::uuid;
select public.reception_create_ticket(tests.id('svc_a'));
select public.call_next(tests.id('cab_a'));
select tests.logout();

-- ─── Établissement B ──────────────────────────────────────────────────────────
select tests.login_as('15000000-0000-0000-0000-0000000000b1');
insert into ids select 'org_b', public.create_organization('Clinique B', 'pgtap-iso-b', 'clinic');
select tests.logout();

select ok(cardinality(tests.filled(tests.id('org_a'))) >= 15,
  format('données réelles de A dans au moins 15 tables (%s)', array_to_string(tests.filled(tests.id('org_a')), ', ')));
select ok((select count(*) from tests.tenant_tables()) >= 40, 'toutes les tables métier sont contrôlées (40 au moins)');

-- La directrice de B : rien de A.
select tests.login_as('15000000-0000-0000-0000-0000000000b1');
select is(tests.leaks(tests.id('org_a')), '{}'::text[], 'B ne lit, ne modifie ni ne supprime aucune ligne de A, dans aucune table');
-- Et réciproquement, la directrice de A ne voit rien de B.
select tests.login_as('15000000-0000-0000-0000-0000000000a1');
select is(tests.leaks(tests.id('org_b')), '{}'::text[], 'A ne lit, ne modifie ni ne supprime aucune ligne de B');
select tests.logout();
-- Rien n'a été supprimé ni modifié pour de bon.
select ok(cardinality(tests.filled(tests.id('org_a'))) >= 15, 'les données de A sont intactes');

select * from finish();
rollback;
