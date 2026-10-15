#!/usr/bin/env bash
# Runs on the CI runner: copies the server-side deploy files to the folder of one environment on the
# server and runs deploy.sh there.
# Required env: DEPLOY_ENV (prod or staging, see environments.sh), APP_IMAGE, DEPLOY_HOST,
# DEPLOY_USER, DEPLOY_SSH_KEY, DEPLOY_KNOWN_HOSTS, GHCR_USER, GHCR_TOKEN (short-lived job token,
# passed to the server on stdin, never as an argument).
set -euo pipefail

: "${DEPLOY_ENV:?}" "${APP_IMAGE:?}" "${DEPLOY_HOST:?}" "${DEPLOY_USER:?}" "${DEPLOY_SSH_KEY:?}"
: "${DEPLOY_KNOWN_HOSTS:?}" "${GHCR_USER:?}" "${GHCR_TOKEN:?}"

here="$(cd "$(dirname "$0")" && pwd)"
source "$here/environments.sh"
load_environment "$DEPLOY_ENV"

ssh_dir="$(mktemp -d)"
trap 'rm -rf "$ssh_dir"' EXIT
(umask 077 && printf '%s\n' "$DEPLOY_SSH_KEY" > "$ssh_dir/key")
printf '%s\n' "$DEPLOY_KNOWN_HOSTS" > "$ssh_dir/known_hosts"
ssh_opts=(-i "$ssh_dir/key" -o IdentitiesOnly=yes -o BatchMode=yes
  -o StrictHostKeyChecking=yes -o UserKnownHostsFile="$ssh_dir/known_hosts")
target="$DEPLOY_USER@$DEPLOY_HOST"

# The whole deploy/ folder goes to the server, so a new script there needs no change here.
# Each environment has its own folder, so a deploy never changes the scripts of the other one.
# Server-only files (.env, release.env, backups/) are not in deploy/ and stay untouched;
# --no-overwrite-dir keeps the mode of the app folder itself. Copying is not under deploy.sh's lock:
# GitHub runs one deploy of an environment at a time (concurrency in deploy.yml).
echo "==> Copying deploy/ to $target:$APP_DIR"
tar -C "$here" -cf - . | ssh "${ssh_opts[@]}" "$target" "tar -C $APP_DIR --no-overwrite-dir -xf -"

echo "==> Running deploy.sh $DEPLOY_ENV on the server"
printf '%s' "$GHCR_TOKEN" |
  ssh "${ssh_opts[@]}" "$target" "$APP_DIR/deploy.sh '$DEPLOY_ENV' '$APP_IMAGE' '$GHCR_USER'"
