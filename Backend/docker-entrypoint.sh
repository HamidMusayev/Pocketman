#!/bin/sh
set -e

# Snapshot the SQLite file before any pending migration runs, so a failed or
# unwanted schema upgrade can be undone by copying the backup back.
DB=/app/data/pocketman.db
if [ -f "$DB" ]; then
  CURRENT=$(alembic current 2>/dev/null | awk '{print $1}' | head -n 1)
  HEAD=$(alembic heads 2>/dev/null | awk '{print $1}' | head -n 1)
  if [ -n "$HEAD" ] && [ "$CURRENT" != "$HEAD" ]; then
    BACKUP="$DB.bak-$(date +%Y%m%d-%H%M%S)-${CURRENT:-none}"
    cp "$DB" "$BACKUP"
    echo "Backed up database to $BACKUP before migrating ${CURRENT:-none} -> $HEAD"
    # Keep only the 5 newest backups (names sort by timestamp).
    ls -1 "$DB".bak-* 2>/dev/null | sort -r | tail -n +6 | while read -r OLD; do
      rm -f "$OLD" && echo "Removed old backup $OLD"
    done
  fi
fi

alembic upgrade head
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
