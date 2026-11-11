-- Nettoyage des données créées par les tests e2e (revue responsive §3), exécuté par `scripts/e2e-cleanup.mjs`.
-- Données de test : établissements et annonceurs dont TOUS les membres ont une adresse `@nextin.test`
-- (`uniqueEmail` des tests) ou créés depuis la console par un compte de test sans membre, et ces comptes. Les données de démo (`.demo`) ne sont jamais touchées.
-- Factures immuables (`invoices_guard`) : déclencheur suspendu le temps de ce bloc (une transaction), pour ces seules lignes.
do $$
declare
  v_users uuid[] := array(select id from auth.users where email like '%@nextin.test');
  v_orgs uuid[] := array(
    select o.id from public.organizations o
    where (exists (select 1 from public.memberships m where m.organization_id = o.id)
        and not exists (select 1 from public.memberships m where m.organization_id = o.id and m.user_id <> all (v_users)))
       -- Créé depuis la console par un super admin de test, invitation jamais acceptée (P1).
       or (o.created_by = any (v_users) and not exists (select 1 from public.memberships m where m.organization_id = o.id)));
  v_advertisers uuid[] := array(
    select a.id from public.advertisers a
    where exists (select 1 from public.advertiser_members m where m.advertiser_id = a.id)
      and not exists (select 1 from public.advertiser_members m where m.advertiser_id = a.id and m.user_id <> all (v_users)));
begin
  -- Liens de paiement et paiements de ces factures d'abord (clés étrangères sans suppression en cascade).
  delete from public.pay_links where invoice_id in (
    select id from public.invoices where organization_id = any (v_orgs) or advertiser_id = any (v_advertisers));
  delete from public.payments where invoice_id in (
    select id from public.invoices where organization_id = any (v_orgs) or advertiser_id = any (v_advertisers));
  alter table public.invoices disable trigger invoices_guard;
  delete from public.invoices where organization_id = any (v_orgs) or advertiser_id = any (v_advertisers);
  alter table public.invoices enable trigger invoices_guard;
  delete from public.advertisers where id = any (v_advertisers);
  delete from public.organizations where id = any (v_orgs);
  delete from auth.users where id = any (v_users);
end $$;
