#!/usr/bin/env bash
# Runs on the CI runner of Deploy prod (.github/workflows/deploy-prod.yml): picks the commit to
# deploy to prod and writes sha, image and note (where the commit came from) to $GITHUB_OUTPUT.
#   ROLLBACK=true      the version prod ran before the current one, as the server remembers it
#                      (PREVIOUS_IMAGE in release.env); no staging check, REQUESTED_SHA is ignored
#   REQUESTED_SHA=...  this commit (a short SHA is fine), only if one of its deploys to staging was
#                      green
#   neither            the commit of the last green deploy to staging
# Staging deploys are read from the deployments of the GitHub environment "staging", which the
# deploy-staging job of deploy-staging.yml records.
# Required env: GH_TOKEN (deployments: read), GITHUB_REPOSITORY, GITHUB_OUTPUT; for a rollback also
# the DEPLOY_* of ssh.sh.
set -euo pipefail

: "${GH_TOKEN:?}" "${GITHUB_REPOSITORY:?}" "${GITHUB_OUTPUT:?}"
ROLLBACK="${ROLLBACK:-false}"
REQUESTED_SHA="${REQUESTED_SHA:-}"
# How many of the newest staging deploys are searched for the last green one.
STAGING_DEPLOYS_TO_SEARCH=30

here="$(cd "$(dirname "$0")" && pwd)"
source "$here/environments.sh"
repo="$GITHUB_REPOSITORY"
image_repo="ghcr.io/${repo,,}"

fail() {
  echo "$*" >&2
  exit 1
}

# True if the deployment $1 ever got the status "success". Its latest status may be a later one.
deployment_was_green() {
  local states
  states="$(gh api "repos/$repo/deployments/$1/statuses?per_page=100" --jq '.[].state')" ||
    fail "Could not read the statuses of deployment $1 from GitHub. Nothing was changed."
  grep -qx success <<<"$states"
}

# True if one of the deploys of commit $1 to staging was green.
green_on_staging() {
  local ids id
  ids="$(gh api "repos/$repo/deployments?environment=staging&sha=$1&per_page=100" --jq '.[].id')" ||
    fail "Could not read the deploys to staging from GitHub. Nothing was changed."
  for id in $ids; do
    if deployment_was_green "$id"; then return 0; fi
  done
  return 1
}

# Sets sha to the commit of the newest green deploy to staging (GitHub lists deployments newest
# first); false if there is none.
find_last_green_on_staging() {
  local deployments id commit
  deployments="$(gh api "repos/$repo/deployments?environment=staging&per_page=$STAGING_DEPLOYS_TO_SEARCH" \
    --jq '.[] | "\(.id) \(.sha)"')" ||
    fail "Could not read the deploys to staging from GitHub. Nothing was changed."
  while read -r id commit; do
    if [[ -n "$id" ]] && deployment_was_green "$id"; then
      sha="$commit"
      return 0
    fi
  done <<<"$deployments"
  return 1
}

if [[ "$ROLLBACK" == true ]]; then
  if [[ -n "$REQUESTED_SHA" ]]; then
    echo "Rollback: the commit field ($REQUESTED_SHA) is ignored."
  fi
  load_environment prod
  source "$here/ssh.sh"
  release="$(ssh "${ssh_opts[@]}" "$target" "cat $APP_DIR/release.env" < /dev/null)"
  current="$(sed -n 's/^APP_IMAGE=//p' <<<"$release")"
  previous="$(sed -n 's/^PREVIOUS_IMAGE=//p' <<<"$release")"
  if [[ -z "$previous" ]]; then
    fail "Prod has no previous version to roll back to (release.env: ${release:-empty}). Nothing was changed."
  fi
  if [[ "$previous" != "$image_repo:"* ]]; then
    fail "The previous version of prod is $previous, not an image of $image_repo. Nothing was changed."
  fi
  sha="${previous##*:}"
  note="rollback from ${current##*:}, the version prod ran before it"
elif [[ -n "$REQUESTED_SHA" ]]; then
  if [[ ! "$REQUESTED_SHA" =~ ^[0-9a-fA-F]{7,40}$ ]]; then
    fail "\"$REQUESTED_SHA\" is not a commit SHA (7 to 40 hex characters). Nothing was changed."
  fi
  if ! sha="$(gh api "repos/$repo/commits/$REQUESTED_SHA" --jq .sha)"; then
    fail "No commit $REQUESTED_SHA in $repo. Nothing was changed."
  fi
  if ! green_on_staging "$sha"; then
    fail "Commit $sha has no green deploy to staging: prod gets only what passed staging. Nothing was changed."
  fi
  note="entered by hand, passed staging"
else
  if ! find_last_green_on_staging; then
    fail "No green deploy to staging among the newest $STAGING_DEPLOYS_TO_SEARCH. Nothing was changed."
  fi
  note="the last green deploy to staging"
fi

if [[ ! "$sha" =~ ^[0-9a-f]{40}$ ]]; then
  fail "\"$sha\" is not a full commit SHA. Nothing was changed."
fi
echo "==> Version for prod: $sha ($note)"
{
  echo "sha=$sha"
  echo "image=$image_repo:$sha"
  echo "note=$note"
} >> "$GITHUB_OUTPUT"
