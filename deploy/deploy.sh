#!/usr/bin/env bash
# Deploys one image of the app to one environment of this server (prod or staging, see
# environments.sh). The same script for both; it runs from the folder of that environment:
# [prod only: database backup] -> pull -> migrations -> new app container -> smoke /health.
# After a green smoke on prod only the images still needed and the newest backups are kept.
# Two deploys of one environment never run at the same time: the second waits for the first.
#
# Called by CI through deploy/ship.sh, which pipes a short-lived GHCR token on stdin:
#   deploy.sh <environment> <image:tag> <registry-user>
# Manual rollback of prod to the previous image, which is still on the server (no token needed):
#   /srv/personal-crm/deploy.sh prod <image:previous-tag>
#
# There is no automatic rollback: any failed step stops the script with a non-zero exit code.
set -euo pipefail

ENVIRONMENT="${1:?usage: deploy.sh <environment> <image:tag> [registry-user]}"
IMAGE="${2:?usage: deploy.sh <environment> <image:tag> [registry-user]}"
REGISTRY_USER="${3:-}"
TAG="${IMAGE##*:}"
REPO="${IMAGE%:*}"
KEEP_BACKUPS=10
# How long a deploy waits for another deploy or restore of the same environment to finish.
LOCK_WAIT_SECONDS=600

cd "$(dirname "$0")"
source ./environments.sh
load_environment "$ENVIRONMENT"
if [[ "$(pwd)" != "$APP_DIR" ]]; then
  echo "deploy.sh $ENVIRONMENT must run from $APP_DIR, not from $(pwd)." >&2
  exit 1
fi
HEALTH_URL="http://127.0.0.1:$APP_PORT/health"

compose() { ./compose.sh "$@"; }
step() { echo "==> $*"; }
release_value() { sed -n "s/^$1=//p" "${2:-release.env}" 2>/dev/null || true; }

if [[ ! -f .env ]]; then
  echo "No .env in $(pwd): create it from .env.example before the first deploy." >&2
  exit 1
fi

# One deploy or restore of an environment at a time, whoever starts it (CI or a person by hand).
# Taken before release.env is read: the deploy that waited sees what the previous one left there.
exec 9> deploy.lock
if ! flock -w "$LOCK_WAIT_SECONDS" 9; then
  echo "Another deploy or restore of $ENVIRONMENT is still running after ${LOCK_WAIT_SECONDS}s. Nothing was changed." >&2
  exit 1
fi

# What runs now becomes "previous" (a redeploy of the same image keeps the old "previous").
current="$(release_value APP_IMAGE)"
previous="$(release_value PREVIOUS_IMAGE)"
if [[ -n "$current" && "$current" != "$IMAGE" ]]; then previous="$current"; fi

# Shell variables win over release.env, so compose uses the image being deployed.
export APP_IMAGE="$IMAGE"

step "Deploying $IMAGE to $ENVIRONMENT ($PUBLIC_URL)"

step "Starting the database"
# stdin keeps the registry token for the pull below: steps before it must not read it.
compose up -d --wait --quiet-pull db < /dev/null

if [[ "$BACKUP" == yes ]]; then
  # The backup is named after the version that ran before this deploy ("none" on the very first one).
  version_before="none"
  if [[ -n "$current" ]]; then version_before="${current##*:}"; fi
  step "Backing up the database (app version before this deploy: $version_before)"
  ./backup.sh "$version_before"
fi

if docker image inspect "$IMAGE" >/dev/null 2>&1; then
  step "Image $IMAGE is already on the server"
else
  step "Pulling $IMAGE"
  # Log in with a throwaway config so the registry token is never left on disk.
  docker_config="$(mktemp -d)"
  trap 'rm -rf "$docker_config"' EXIT
  # Login output is shown only on failure: on success docker warns about that temporary file.
  if [[ -n "$REGISTRY_USER" ]] &&
    ! login_output="$(DOCKER_CONFIG="$docker_config" docker login "${REPO%%/*}" \
      -u "$REGISTRY_USER" --password-stdin 2>&1)"; then
    echo "$login_output" >&2
    exit 1
  fi
  DOCKER_CONFIG="$docker_config" docker pull --quiet "$IMAGE"
fi

step "Applying migrations (one-off container)"
compose run --rm --no-deps -T migrate

step "Starting the app"
compose up -d --no-deps app
printf 'APP_IMAGE=%s\nPREVIOUS_IMAGE=%s\n' "$IMAGE" "$previous" > release.env

step "Smoke test: $HEALTH_URL"
body=""
for _ in $(seq 1 30); do
  body="$(curl -fsS --max-time 5 "$HEALTH_URL" 2>/dev/null)" && break
  body=""
  sleep 2
done
if [[ "$body" != *"\"version\":\"$TAG\""* ]]; then
  echo "SMOKE FAILED: $HEALTH_URL did not answer 200 with version $TAG (got: ${body:-no answer})." >&2
  echo "Deploy failed, nothing was rolled back. Logs: $(pwd)/compose.sh logs --tail 100 app" >&2
  exit 1
fi
echo "$body"

# Images are cleaned up after a deploy to prod only: prod's rollback needs its previous image, and
# staging may run a newer image than prod, so its current image stays too.
if [[ "$ENVIRONMENT" == prod ]]; then
  staging_dir="$(load_environment staging && echo "$APP_DIR")"
  staging_image="$(release_value APP_IMAGE "$staging_dir/release.env")"
  step "Removing old images (keeping prod current and previous, staging current)"
  docker image ls "$REPO" --format '{{.Repository}}:{{.Tag}}' | while read -r ref; do
    [[ "$ref" == "$IMAGE" || "$ref" == "$previous" || "$ref" == "$staging_image" ||
      "$ref" == *:"<none>" ]] && continue
    docker image rm "$ref" >/dev/null && echo "removed $ref" || echo "could not remove $ref" >&2
  done
fi

if [[ "$BACKUP" == yes ]]; then
  step "Removing old backups (keeping the newest $KEEP_BACKUPS)"
  # Names start with the date and time, so the name order is the age order.
  find backups -maxdepth 1 -name 'crm_*.dump' | sort -r | tail -n +$((KEEP_BACKUPS + 1)) |
    while read -r old; do
      rm -f -- "$old" && echo "removed $old"
    done
fi

step "Deployed $IMAGE to $ENVIRONMENT"
