#!/usr/bin/env bash
# Runs on the CI runner: copies the server-side deploy files to the server and runs deploy.sh there.
# Required env: APP_IMAGE, DEPLOY_HOST, DEPLOY_USER, DEPLOY_SSH_KEY, DEPLOY_KNOWN_HOSTS,
# GHCR_USER, GHCR_TOKEN (short-lived job token, passed to the server on stdin, never as an argument).
set -euo pipefail

: "${APP_IMAGE:?}" "${DEPLOY_HOST:?}" "${DEPLOY_USER:?}" "${DEPLOY_SSH_KEY:?}" "${DEPLOY_KNOWN_HOSTS:?}"
: "${GHCR_USER:?}" "${GHCR_TOKEN:?}"

APP_DIR=/srv/personal-crm
here="$(cd "$(dirname "$0")" && pwd)"

ssh_dir="$(mktemp -d)"
trap 'rm -rf "$ssh_dir"' EXIT
(umask 077 && printf '%s\n' "$DEPLOY_SSH_KEY" > "$ssh_dir/key")
printf '%s\n' "$DEPLOY_KNOWN_HOSTS" > "$ssh_dir/known_hosts"
ssh_opts=(-i "$ssh_dir/key" -o IdentitiesOnly=yes -o BatchMode=yes
  -o StrictHostKeyChecking=yes -o UserKnownHostsFile="$ssh_dir/known_hosts")
target="$DEPLOY_USER@$DEPLOY_HOST"

echo "==> Copying deploy files to $target:$APP_DIR"
scp -p "${ssh_opts[@]}" "$here/compose.yaml" "$here/compose.sh" "$here/deploy.sh" \
  "$here/.env.example" "$target:$APP_DIR/"

echo "==> Running deploy.sh on the server"
printf '%s' "$GHCR_TOKEN" | ssh "${ssh_opts[@]}" "$target" "$APP_DIR/deploy.sh '$APP_IMAGE' '$GHCR_USER'"
