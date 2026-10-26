#!/usr/bin/env bash
# Lance une commande contre le Supabase LOCAL : retire les variables du projet distant
# éventuellement présentes dans l'environnement (elles priment sur apps/web/.env.local).
# Usage : bash scripts/local-env.sh pnpm --filter @nextin/web build
exec env -u NEXT_PUBLIC_SUPABASE_URL -u NEXT_PUBLIC_SUPABASE_ANON_KEY -u SUPABASE_SERVICE_ROLE_KEY \
  -u SUPABASE_DB_PASSWORD -u SUPABASE_PROJECT_REF -u SUPABASE_ACCESS_TOKEN \
  -u NEXT_PUBLIC_TURNSTILE_SITE_KEY -u TURNSTILE_SECRET_KEY -u APP_URL "$@"
