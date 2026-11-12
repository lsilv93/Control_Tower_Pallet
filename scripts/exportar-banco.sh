#!/usr/bin/env bash
# Exporta o banco (estrutura + dados) para SQL puro, pronto para importar em outro PostgreSQL.
#
# Uso:
#   DATABASE_URL="postgresql://usuario:senha@host:5432/banco" bash scripts/exportar-banco.sh [pasta_destino]
#
# Gera:
#   <pasta>/control_tower_pallet.sql         estrutura + dados (INSERTs) + histórico de migrações
#   <pasta>/control_tower_pallet_schema.sql  somente a estrutura (tabelas, enums, índices, triggers)
set -euo pipefail
: "${DATABASE_URL:?Defina DATABASE_URL com a conexão do banco de origem}"
DESTINO="${1:-database}"
mkdir -p "$DESTINO"
URL="${DATABASE_URL%%\?*}"   # o pg_dump não aceita parâmetros como ?pgbouncer=true
OPCOES=(--no-owner --no-privileges --no-comments --schema=public)

pg_dump "$URL" "${OPCOES[@]}" --inserts --column-inserts > "$DESTINO/control_tower_pallet.sql"
pg_dump "$URL" "${OPCOES[@]}" --schema-only > "$DESTINO/control_tower_pallet_schema.sql"
# Num servidor novo o schema public já existe: torna a criação idempotente.
sed -i 's/^CREATE SCHEMA public;$/CREATE SCHEMA IF NOT EXISTS public;/' "$DESTINO/control_tower_pallet.sql" "$DESTINO/control_tower_pallet_schema.sql"
echo "Exportado em $DESTINO/: control_tower_pallet.sql e control_tower_pallet_schema.sql"
