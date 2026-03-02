#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Uso: $0 <arquivo.sql> [container] [usuario] [database]" >&2
  exit 1
fi

INPUT_PATH="$1"
CONTAINER="${2:-contratos_db}"
USER_NAME="${3:-postgres}"
DATABASE_NAME="${4:-contratos}"

if [[ ! -f "$INPUT_PATH" ]]; then
  echo "Arquivo nao encontrado: $INPUT_PATH" >&2
  exit 1
fi

docker exec -i "$CONTAINER" psql -U "$USER_NAME" -d "$DATABASE_NAME" < "$INPUT_PATH"
echo "Restore concluido a partir de $INPUT_PATH"
