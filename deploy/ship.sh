#!/usr/bin/env bash
# Runs on the CI runner: copies the server-side deploy files to the folder of one environment on the
# server and runs deploy.sh there.
# Required env: DEPLOY_ENV (prod or staging, see environments.sh), APP_IMAGE, GHCR_USER, GHCR_TOKEN
# (short-lived job token, passed to the server on stdin, never as an argument) and the DEPLOY_* of
# ssh.sh.
set -euo pipefail

: "${DEPLOY_ENV:?}" "${APP_IMAGE:?}" "${GHCR_USER:?}" "${GHCR_TOKEN:?}"

here="$(cd "$(dirname "$0")" && pwd)"
source "$here/environments.sh"
load_environment "$DEPLOY_ENV"
source "$here/ssh.sh"

# The whole deploy/ folder goes to the server, so a new script there needs no change here.
# Each environment has its own folder, so a deploy never changes the scripts of the other one.
# Server-only files (.env, release.env, backups/) are not in deploy/ and stay untouched;
# --no-overwrite-dir keeps the mode of the app folder itself. Copying is not under deploy.sh's lock:
# GitHub runs one deploy of an environment at a time (concurrency in the deploy workflows).
echo "==> Copying deploy/ to $target:$APP_DIR"
tar -C "$here" -cf - . | ssh "${ssh_opts[@]}" "$target" "tar -C $APP_DIR --no-overwrite-dir -xf -"

echo "==> Running deploy.sh $DEPLOY_ENV on the server"
printf '%s' "$GHCR_TOKEN" |
  ssh "${ssh_opts[@]}" "$target" "$APP_DIR/deploy.sh '$DEPLOY_ENV' '$APP_IMAGE' '$GHCR_USER'"
