#!/bin/bash
# PostgreSQL backup script — stores compressed dump in backups/ and keeps last KEEP_DAYS days.
# Usage: ./scripts/backup.sh
# Cron example (nightly at 03:00): 0 3 * * * /var/www/dikanish/scripts/backup.sh >> /var/www/dikanish/backups/backup.log 2>&1
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_DIR/backups}"
KEEP_DAYS="${KEEP_DAYS:-7}"

# Load .env if DATABASE_URL not already set in environment
if [ -z "${DATABASE_URL:-}" ] && [ -f "$PROJECT_DIR/.env" ]; then
  set -o allexport
  # shellcheck disable=SC1091
  source "$PROJECT_DIR/.env"
  set +o allexport
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "[ERROR] DATABASE_URL is not set. Set it in .env or as an environment variable." >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup_$TIMESTAMP.sql.gz"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting backup → $BACKUP_FILE"
pg_dump "$DATABASE_URL" | gzip > "$BACKUP_FILE"

SIZE=$(du -sh "$BACKUP_FILE" | cut -f1)
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Done: $SIZE"

# Remove backups older than KEEP_DAYS days
REMOVED=$(find "$BACKUP_DIR" -name "backup_*.sql.gz" -mtime +"$KEEP_DAYS" -print -delete | wc -l | tr -d ' ')
[ "$REMOVED" -gt 0 ] && echo "[$(date '+%Y-%m-%d %H:%M:%S')] Removed $REMOVED old backup(s)"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] OK — backup complete"
