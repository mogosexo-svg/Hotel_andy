#!/usr/bin/env bash
# Regenera src/lib/database.types.ts. Con `supabase start` corriendo usa la base local de Docker;
# si no, la base del plan B (scripts/test-db.sh). Uso: scripts/gen-types.sh [db-url]
set -euo pipefail
cd "$(dirname "$0")/.."
URL=${1:-${PGBASE:-postgresql://postgres:postgres@127.0.0.1:5432}/${PGTEST_DB:-hotel_andy_test}}
mkdir -p src/lib
if npx -y supabase@3 status > /dev/null 2>&1; then
  npx -y supabase@3 gen types --lang typescript --schema public > src/lib/database.types.ts
else
  npx -y supabase@3 gen types --lang typescript --schema public --remote="$URL" > src/lib/database.types.ts
fi
npx -y prettier@3 --log-level warn --write src/lib/database.types.ts
