#!/usr/bin/env bash
# Base limpia + shim de Supabase + migraciones + seed + tests pgTAP, con un solo comando.
# Uso: scripts/test-db.sh            (tests)
#      scripts/test-db.sh --demo     (además carga seed.demo.sql y deja la base lista para mirar)
# Requiere: Postgres 16+ local con pgTAP (apt: postgresql-16-pgtap, trae pg_prove) y Node.
# Conexión: PGBASE (por defecto postgresql://postgres:postgres@127.0.0.1:5432). Base: PGTEST_DB (hotel_andy_test).
set -euo pipefail
cd "$(dirname "$0")/.."

BASE=${PGBASE:-postgresql://postgres:postgres@127.0.0.1:5432}
DB=${PGTEST_DB:-hotel_andy_test}
URL="$BASE/$DB"
sql() { psql -X -q -v ON_ERROR_STOP=1 "$@"; }

pg_isready -q -d "$BASE/postgres" || { command -v pg_ctlcluster >/dev/null && pg_ctlcluster 16 main start; }

node scripts/seed.mjs
sql "$BASE/postgres" -c "drop database if exists $DB with (force)" -c "create database $DB"
sql "$URL" -c "alter database $DB set search_path = public, extensions" \
  -c "create schema if not exists extensions" -c "create extension if not exists pgtap with schema extensions"
sql "$URL" -f supabase/tests/_shim.sql > /dev/null
for f in supabase/migrations/*.sql; do sql "$URL" -f "$f"; done
sql "$URL" -f supabase/seed.sql
if [ -f supabase/seed.private.sql ]; then sql "$URL" -f supabase/seed.private.sql; fi

pg_prove -d "$URL" supabase/tests/*.test.sql

if [ "${1:-}" = "--demo" ]; then
  sql "$URL" -f supabase/seed.demo.sql
  echo "Base con datos DEMO lista: $URL"
fi
