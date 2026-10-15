#!/usr/bin/env bash
# Dumps the production database into backups/ and prints the path of the new file. Prod only:
# staging makes no backups, its data is a copy of a prod backup (see restore.sh).
# Called by deploy.sh (before migrations, no label), daily-backup.sh (label "daily") and restore.sh
# (copy of the database it replaces, label "before-restore"):
#   backup.sh <app-version> [label]
# File name: crm_<server date>_<server time>_<app version>[_<label>].dump, pg_dump custom format.
# Load it back only with restore.sh.
# After a new backup, only the newest KEEP_BACKUPS of its kind stay: of the ones made before a deploy
# (no label) or of the daily ones. Backups with any other label are never deleted automatically.
set -euo pipefail

VERSION="${1:?usage: backup.sh <app-version> [label]}"
LABEL="${2:-}"
KEEP_BACKUPS=7

cd "$(dirname "$0")"
source ./environments.sh
load_environment_of_dir "$(pwd)"
if [[ "$BACKUP" != yes ]]; then
  echo "No backups in $DEPLOY_ENV: backup.sh runs on prod only." >&2
  exit 1
fi

# Backups hold all the data: readable by the deploy user only.
umask 077
mkdir -p backups
chmod 700 backups

file="backups/crm_$(date +%Y-%m-%d_%H-%M-%S)_${VERSION}${LABEL:+_$LABEL}.dump"
partial="$file.partial"
# A failed dump leaves no file that could be mistaken for a backup.
trap 'rm -f "$partial"' EXIT

# stdin is closed: deploy.sh gets the registry token on stdin and still needs it for the pull.
./compose.sh exec -T db pg_dump -U crm -d crm --format=custom < /dev/null > "$partial"
mv "$partial" "$file"

case "$LABEL" in
  "") kind='^crm_[0-9-]+_[0-9-]+_[^_]+\.dump$' ;;
  daily) kind='^crm_[0-9-]+_[0-9-]+_[^_]+_daily\.dump$' ;;
  *) kind="" ;;
esac
if [[ -n "$kind" ]]; then
  # Names start with the date and time, so the name order is the age order. Messages go to stderr:
  # stdout is only the path of the new file, restore.sh reads it.
  find backups -maxdepth 1 -name 'crm_*.dump' -printf '%f\n' | { grep -E "$kind" || true; } | sort -r |
    tail -n +$((KEEP_BACKUPS + 1)) | while read -r old; do
      rm -f -- "backups/$old" && echo "removed old backup backups/$old" >&2
    done
fi

echo "$(pwd)/$file"
