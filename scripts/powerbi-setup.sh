#!/usr/bin/env bash
set -euo pipefail

BI_USER="${1:-powerbi_reader}"
BI_PASSWORD="${2:-}"
CONTAINER="${3:-contratos_db}"
USER_NAME="${4:-postgres}"
DATABASE_NAME="${5:-contratos}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SQL_PATH="$SCRIPT_DIR/sql/powerbi_setup.sql"

if [[ ! -f "$SQL_PATH" ]]; then
  echo "Arquivo SQL nao encontrado: $SQL_PATH" >&2
  exit 1
fi

DOCKER_ARGS=(exec -i "$CONTAINER" psql -v ON_ERROR_STOP=1)
if [[ -n "$BI_PASSWORD" ]]; then
  DOCKER_ARGS+=(-v "bi_user=$BI_USER" -v "bi_password=$BI_PASSWORD")
fi
DOCKER_ARGS+=(-U "$USER_NAME" -d "$DATABASE_NAME")

docker "${DOCKER_ARGS[@]}" < "$SQL_PATH"
echo "Views de BI atualizadas no banco $DATABASE_NAME."
if [[ -n "$BI_PASSWORD" ]]; then
  echo "Usuario readonly '$BI_USER' criado/atualizado."
else
  echo "Usuario readonly nao foi criado porque nenhuma senha foi informada."
fi
