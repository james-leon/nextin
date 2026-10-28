-- M10b — Publicité (docs/PLAN.md §3.7, §12.4, §12.5, §12.7) : types.

-- Brouillon → en revue → refusée (modifiable puis resoumise) ou acceptée : à payer, puis active ; terminée après ses
-- dates ; mise en pause par le super admin.
create type public.campaign_status as enum ('draft', 'pending_review', 'rejected', 'awaiting_payment', 'active', 'paused', 'ended');
create type public.ad_surface as enum ('tv', 'app', 'game');
create type public.ad_event_type as enum ('impression', 'click', 'skip', 'visit');
create type public.ad_creative_kind as enum ('image', 'video');
