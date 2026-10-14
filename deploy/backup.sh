#!/usr/bin/env bash
# Dumps the production database into backups/ and prints the path of the new file.
# Called by deploy.sh (before migrations) and restore.sh (copy of the database it replaces):
#   backup.sh <app-version> [label]
# File name: crm_<server date>_<server time>_<app version>[_<label>].dump, pg_dump custom format.
# Load it back only with restore.sh.
set -euo pipefail

VERSION="${1:?usage: backup.sh <app-version> [label]}"
LABEL="${2:-}"

cd "$(dirname "$0")"

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
echo "$(pwd)/$file"
