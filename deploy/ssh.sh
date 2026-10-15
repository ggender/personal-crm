# shellcheck shell=bash
# ssh to the server from the CI runner. Sourced by ship.sh and prod-version.sh, never run.
# Required env: DEPLOY_HOST, DEPLOY_USER, DEPLOY_SSH_KEY, DEPLOY_KNOWN_HOSTS.
# Sets ssh_opts (use as "${ssh_opts[@]}") and target; the key lives in a temporary folder that is
# removed when the script exits.

: "${DEPLOY_HOST:?}" "${DEPLOY_USER:?}" "${DEPLOY_SSH_KEY:?}" "${DEPLOY_KNOWN_HOSTS:?}"

ssh_dir="$(mktemp -d)"
trap 'rm -rf "$ssh_dir"' EXIT
(umask 077 && printf '%s\n' "$DEPLOY_SSH_KEY" > "$ssh_dir/key")
printf '%s\n' "$DEPLOY_KNOWN_HOSTS" > "$ssh_dir/known_hosts"
# shellcheck disable=SC2034 # used by the scripts that source this file
ssh_opts=(-i "$ssh_dir/key" -o IdentitiesOnly=yes -o BatchMode=yes
  -o StrictHostKeyChecking=yes -o UserKnownHostsFile="$ssh_dir/known_hosts")
# shellcheck disable=SC2034
target="$DEPLOY_USER@$DEPLOY_HOST"
