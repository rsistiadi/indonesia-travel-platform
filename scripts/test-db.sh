#!/usr/bin/env bash
# Runs migrations + seed + permission tests on a throwaway local Postgres.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN=/usr/lib/postgresql/16/bin
D=/tmp/itp-pg; P=54329
as_pg() { if [ "$(id -u)" = 0 ]; then su postgres -s /bin/bash -c "$*"; else bash -c "$*"; fi; }
as_pg "$PGBIN/pg_ctl -D $D stop -m immediate" >/dev/null 2>&1 || true
rm -rf $D; mkdir -p $D; chmod 777 /tmp; chown postgres $D 2>/dev/null || true
as_pg "$PGBIN/initdb -D $D -A trust" >/dev/null
as_pg "$PGBIN/pg_ctl -D $D -o '-p $P -k /tmp' -l $D/log -w start" >/dev/null
trap 'as_pg "$PGBIN/pg_ctl -D $D stop -m immediate" >/dev/null 2>&1' EXIT
PSQL="psql -h /tmp -p $P -U postgres -v ON_ERROR_STOP=1 -q"
$PSQL -d postgres -c "create database itp" >/dev/null
for f in "$ROOT/supabase/tests/00_shim.sql" "$ROOT"/supabase/migrations/*.sql "$ROOT/supabase/seed.sql" "$ROOT"/supabase/tests/[1-9]*.sql; do
  echo "== $(basename $f)"; $PSQL -d itp -f "$f"
done
echo "ALL DB TESTS PASSED"
