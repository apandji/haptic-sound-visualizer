#!/usr/bin/env bash
# Safe online backup of the research SQLite database.
# Uses sqlite3 .backup (consistent snapshot while the app is running).
#
# Usage:
#   ./scripts/backup_db.sh
#   ./scripts/backup_db.sh /path/to/Box/backup-folder
#
# See docs/DATA_STORAGE_PLAN.md for IRB-appropriate storage guidance.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB="${ROOT}/haptic_research_v2.db"
DEST="${1:-${ROOT}/backups}"
STAMP="$(date -u +%Y-%m-%dT%H%M%SZ)"
OUT="${DEST}/haptic_research_v2_${STAMP}.db"

if [[ ! -f "$DB" ]]; then
  echo "Database not found: $DB" >&2
  exit 1
fi

mkdir -p "$DEST"

if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "sqlite3 is required but not installed." >&2
  exit 1
fi

sqlite3 "$DB" ".backup '${OUT}'"
echo "Backup written: $OUT"
