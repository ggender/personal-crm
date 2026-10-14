#!/usr/bin/env bash
# Restores the production database from a backup made by backup.sh. Run by hand on the server:
#   sudo -u deploy /srv/personal-crm/restore.sh /srv/personal-crm/backups/<file>.dump
#
# Shows what will be replaced and waits for "yes" -> backs up the current database ->
# stops the app -> drops the database, creates it empty and loads the backup ->
# starts the same app version. The app version is never changed and migrations are not run.
#
# There is no automatic rollback: any failed step stops the script with a non-zero exit code.
set -euo pipefail

FILE="${1:?usage: restore.sh <backup-file.dump>}"
DB=crm

if [[ ! -f "$FILE" ]]; then
  echo "No such file: $FILE" >&2
  exit 1
fi
# Resolve before cd: the path may be relative to the caller's folder.
FILE="$(realpath "$FILE")"

cd "$(dirname "$0")"
compose() { ./compose.sh "$@"; }
step() { echo "==> $*"; }
release_value() { sed -n "s/^$1=//p" release.env 2>/dev/null || true; }

image="$(release_value APP_IMAGE)"
if [[ -z "$image" ]]; then
  echo "No APP_IMAGE in $(pwd)/release.env: nothing is deployed, deploy the app first." >&2
  exit 1
fi
version="${image##*:}"
# crm_<date>_<time>_<version>[_<label>].dump
backup_version="$(basename "$FILE" | sed -nE 's/^crm_[0-9-]+_[0-9-]+_([^_.]+).*\.dump$/\1/p')"

step "Checking the backup file"
compose up -d --wait db
if ! compose exec -T db pg_restore --list < "$FILE" > /dev/null; then
  echo "$FILE is not a database backup made by backup.sh. Nothing was changed." >&2
  exit 1
fi

echo
echo "Database to replace: $DB (docker compose project prod on $(hostname))"
echo "Running app version: $version"
echo "Backup to load:      $FILE ($(du -h "$FILE" | cut -f1))"
echo "Backup app version:  ${backup_version:-unknown}"
if [[ "$backup_version" != "$version" ]]; then
  echo
  echo "WARNING: the backup was made with another app version than the one running now."
  echo "The app may fail on it. To run the backup's version first: deploy.sh <its image>."
fi
echo
echo "All current data in the database $DB will be deleted and replaced with this backup."
echo "A copy of the current database is saved to backups/ first."
read -r -p 'Type "yes" to continue: ' answer
if [[ "$answer" != "yes" ]]; then
  echo "Cancelled. Nothing was changed."
  exit 1
fi

step "Backing up the current database"
copy="$(./backup.sh "$version" before-restore)"
echo "$copy"

on_error() {
  echo "RESTORE FAILED. The app may be stopped and the database $DB empty or missing." >&2
  echo "The database as it was before this restore: $copy" >&2
  echo "Logs: $(pwd)/compose.sh logs --tail 100 app db" >&2
}
trap on_error ERR

step "Stopping the app"
compose stop app

step "Dropping and creating the database $DB"
compose exec -T db dropdb -U crm --force "$DB" < /dev/null
compose exec -T db createdb -U crm -O crm "$DB" < /dev/null

step "Loading $FILE"
compose exec -T db pg_restore -U crm -d "$DB" --single-transaction --exit-on-error < "$FILE"

step "Starting the app $image"
compose up -d --wait --wait-timeout 120 --no-deps app

trap - ERR
step "Restored $DB from $FILE, app $version is running"
