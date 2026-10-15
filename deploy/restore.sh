#!/usr/bin/env bash
# Restores the database of one environment from a prod backup made by backup.sh. Run by hand on the
# server, from the folder of the environment to restore (see environments.sh):
#   prod:    sudo -u deploy /srv/personal-crm/restore.sh /srv/personal-crm/backups/<file>.dump
#   staging: sudo -u deploy /srv/personal-crm-staging/restore.sh [<file>.dump]
#            without a file it loads the newest prod backup: staging's data is a copy of prod's.
#
# Shows what will be replaced and waits for "yes" -> [prod: backs up the current database] ->
# stops the app -> drops the database, creates it empty and loads the backup ->
# [staging: applies the migrations of the version it runs] -> starts the same app version.
# The app version is never changed. On prod migrations are not run: a backup is loaded into the
# version it was made with.
#
# There is no automatic rollback: any failed step stops the script with a non-zero exit code.
set -euo pipefail

FILE="${1:-}"
DB=crm

if [[ -n "$FILE" ]]; then
  if [[ ! -f "$FILE" ]]; then
    echo "No such file: $FILE" >&2
    exit 1
  fi
  # Resolve before cd: the path may be relative to the caller's folder.
  FILE="$(realpath "$FILE")"
fi

cd "$(dirname "$0")"
source ./environments.sh
load_environment_of_dir "$(pwd)"
compose() { ./compose.sh "$@"; }
step() { echo "==> $*"; }
release_value() { sed -n "s/^$1=//p" release.env 2>/dev/null || true; }

if [[ -z "$FILE" ]]; then
  if [[ "$DEPLOY_ENV" == prod ]]; then
    echo "usage: restore.sh <backup-file.dump>" >&2
    exit 1
  fi
  prod_backups="$(load_environment prod && echo "$APP_DIR")/backups"
  # Names start with the date and time, so the last name is the newest backup.
  FILE="$(find "$prod_backups" -maxdepth 1 -name 'crm_*.dump' | sort | tail -n 1)"
  if [[ -z "$FILE" ]]; then
    echo "No prod backups in $prod_backups." >&2
    exit 1
  fi
fi

# Same lock as deploy.sh: no restore while a deploy of this environment runs, and the other way round.
exec 9> deploy.lock
if ! flock -n 9; then
  echo "A deploy or restore of $DEPLOY_ENV is running now. Try again when it ends. Nothing was changed." >&2
  exit 1
fi

image="$(release_value APP_IMAGE)"
if [[ -z "$image" ]]; then
  echo "No APP_IMAGE in $(pwd)/release.env: nothing is deployed, deploy the app first." >&2
  exit 1
fi
version="${image##*:}"
# crm_<date>_<time>_<version>[_<label>].dump
backup_version="$(basename "$FILE" | sed -nE 's/^crm_[0-9-]+_[0-9-]+_([^_.]+).*\.dump$/\1/p')"

step "Checking the backup file"
compose up -d --wait db < /dev/null
if ! compose exec -T db pg_restore --list < "$FILE" > /dev/null; then
  echo "$FILE is not a database backup made by backup.sh. Nothing was changed." >&2
  exit 1
fi

echo
echo "Database to replace: $DB (docker compose project $DEPLOY_ENV on $(hostname), $PUBLIC_URL)"
echo "Running app version: $version"
echo "Backup to load:      $FILE ($(du -h "$FILE" | cut -f1))"
echo "Backup app version:  ${backup_version:-unknown}"
if [[ "$DEPLOY_ENV" == prod && "$backup_version" != "$version" ]]; then
  echo
  echo "WARNING: the backup was made with another app version than the one running now."
  echo "The app may fail on it. To run the backup's version first: deploy.sh prod <its image>."
fi
if [[ "$DEPLOY_ENV" != prod ]]; then
  echo
  echo "After the load the migrations of the running version are applied to the data."
fi
echo
echo "All current data in the database $DB of $DEPLOY_ENV will be deleted and replaced with this backup."
copy=""
if [[ "$BACKUP" == yes ]]; then
  echo "A copy of the current database is saved to backups/ first."
else
  echo "No copy of the current database is made: $DEPLOY_ENV has no backups."
fi
read -r -p 'Type "yes" to continue: ' answer
if [[ "$answer" != "yes" ]]; then
  echo "Cancelled. Nothing was changed."
  exit 1
fi

if [[ "$BACKUP" == yes ]]; then
  step "Backing up the current database"
  copy="$(./backup.sh "$version" before-restore)"
  echo "$copy"
fi

on_error() {
  echo "RESTORE FAILED. The app may be stopped and the database $DB empty or missing." >&2
  if [[ -n "$copy" ]]; then echo "The database as it was before this restore: $copy" >&2; fi
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

if [[ "$DEPLOY_ENV" != prod ]]; then
  step "Applying migrations of $version (one-off container)"
  compose run --rm --no-deps -T migrate < /dev/null
fi

step "Starting the app $image"
compose up -d --wait --wait-timeout 120 --no-deps app

trap - ERR
step "Restored $DB of $DEPLOY_ENV from $FILE, app $version is running"
