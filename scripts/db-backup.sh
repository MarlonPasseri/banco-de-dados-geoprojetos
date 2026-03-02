#!/usr/bin/env bash
set -euo pipefail

CONTAINER="${1:-contratos_db}"
OUTPUT_PATH="${2:-}"
USER_NAME="${3:-postgres}"
DATABASE_NAME="${4:-contratos}"

if [[ -z "$OUTPUT_PATH" ]]; then
  stamp="$(date +%Y%m%d_%H%M%S)"
  OUTPUT_PATH="backups/contratos_${stamp}.sql"
fi

mkdir -p "$(dirname "$OUTPUT_PATH")"

docker exec "$CONTAINER" pg_dump -U "$USER_NAME" -d "$DATABASE_NAME" --clean --if-exists --no-owner --no-privileges > "$OUTPUT_PATH"
echo "Backup salvo em $OUTPUT_PATH"
