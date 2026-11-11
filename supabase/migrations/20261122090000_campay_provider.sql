-- B1 — Agrégateur CamPay : nouvelle valeur du type `payment_provider` (ajout seulement : compatible avec le code en
-- ligne). Notch Pay existait déjà.
alter type public.payment_provider add value if not exists 'campay';
