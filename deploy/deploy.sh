#!/usr/bin/env bash
# Deploys one image of the app on this server: pull -> migrations -> new app container -> smoke /health.
# After a green smoke only the current and the previous image are kept.
#
# Called by CI through deploy/ship.sh, which pipes a short-lived GHCR token on stdin:
#   deploy.sh <image:tag> <registry-user>
# Manual rollback to the previous image, which is still on the server (no token needed):
#   deploy.sh <image:previous-tag>
#
# There is no automatic rollback: any failed step stops the script with a non-zero exit code.
set -euo pipefail

IMAGE="${1:?usage: deploy.sh <image:tag> [registry-user]}"
REGISTRY_USER="${2:-}"
TAG="${IMAGE##*:}"
REPO="${IMAGE%:*}"
HEALTH_URL="http://127.0.0.1:3000/health"

cd "$(dirname "$0")"
compose() { ./compose.sh "$@"; }
step() { echo "==> $*"; }
release_value() { sed -n "s/^$1=//p" release.env 2>/dev/null || true; }

if [[ ! -f .env ]]; then
  echo "No .env in $(pwd): create it from .env.example before the first deploy." >&2
  exit 1
fi

# What runs now becomes "previous" (a redeploy of the same image keeps the old "previous").
current="$(release_value APP_IMAGE)"
previous="$(release_value PREVIOUS_IMAGE)"
if [[ -n "$current" && "$current" != "$IMAGE" ]]; then previous="$current"; fi

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

# Shell variables win over release.env, so compose uses the image being deployed.
export APP_IMAGE="$IMAGE"

step "Starting the database"
compose up -d --wait --quiet-pull db

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

step "Removing old images (keeping current and previous)"
docker image ls "$REPO" --format '{{.Repository}}:{{.Tag}}' | while read -r ref; do
  [[ "$ref" == "$IMAGE" || "$ref" == "$previous" || "$ref" == *:"<none>" ]] && continue
  docker image rm "$ref" >/dev/null && echo "removed $ref" || echo "could not remove $ref" >&2
done

step "Deployed $IMAGE"
