-- M10a — Abonnements automatiques, paiements Mobile Money, super admin (docs/PLAN.md §11) : types.

create type public.subscription_status as enum ('trialing', 'active', 'past_due', 'read_only', 'suspended');
create type public.billing_period as enum ('monthly', 'annual');
create type public.invoice_status as enum ('open', 'paid', 'void');
create type public.payment_provider as enum ('fake', 'notchpay', 'fapshi', 'mesomb', 'cinetpay', 'flutterwave');
create type public.payment_channel as enum ('mtn_momo', 'orange_money');
create type public.payment_status as enum ('pending', 'succeeded', 'failed', 'expired');
