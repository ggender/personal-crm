#!/usr/bin/env bash
# Daily backup of the prod database: backup.sh <running app version> daily. Started at 03:00 Moscow
# time by the systemd timer personal-crm-backup.timer (deploy/systemd/, installed by hand, see
# README), as the deploy user. By hand, the same way:
#   sudo systemctl start personal-crm-backup.service
# Waits for a running deploy or restore of prod: they hold the same lock.
set -euo pipefail

# How long the backup waits for a deploy or restore of prod to finish.
LOCK_WAIT_SECONDS=1800

cd "$(dirname "$0")"
source ./environments.sh
load_environment_of_dir "$(pwd)"

exec 9> deploy.lock
if ! flock -w "$LOCK_WAIT_SECONDS" 9; then
  echo "A deploy or restore of $DEPLOY_ENV is still running after ${LOCK_WAIT_SECONDS}s. No backup was made." >&2
  exit 1
fi

image="$(sed -n 's/^APP_IMAGE=//p' release.env 2>/dev/null || true)"
version="none"
if [[ -n "$image" ]]; then version="${image##*:}"; fi

echo "==> Daily backup of the $DEPLOY_ENV database (app version $version)"
./backup.sh "$version" daily
