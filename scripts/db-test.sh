#!/usr/bin/env bash
# Exécute les tests pgTAP (supabase/tests/database/*.test.sql) sur la base locale et échoue si un test échoue.
set -euo pipefail
DB_URL="${DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
status=0
for f in "$(dirname "$0")"/../supabase/tests/database/*.test.sql; do
  echo "# $(basename "$f")"
  out="$(psql "$DB_URL" -X -q -At -v ON_ERROR_STOP=1 -f "$f" 2>&1 | grep -E '^(ok|not ok|#|1\.\.|psql:|ERROR)' || true)"
  echo "$out"
  if echo "$out" | grep -qE '^(not ok|psql:|ERROR)|Looks like'; then status=1; fi
done
exit $status
