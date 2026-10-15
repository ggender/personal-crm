#!/usr/bin/env bash
# Runs on the CI runner after a green deploy to prod (.github/workflows/deploy-prod.yml): keeps the
# newest KEEP_BUILDS builds of the app image in GHCR and deletes the older ones.
# In GHCR a build is one tagged package version (the tag is the commit SHA, the version is an image
# index) and the untagged versions the index is made of: the linux/amd64 image and its attestation.
# The untagged versions of the kept builds are read from their indexes and stay. Other untagged
# versions are deleted, but only when older than MIN_UNTAGGED_AGE_SECONDS: a build may be pushing
# them right now, before its tagged index.
# Prod's rollback does not need GHCR: deploy.sh keeps prod's previous image on the server.
# Required env: GH_TOKEN (packages: write), GITHUB_REPOSITORY. DRY_RUN=1 only prints what it would
# delete.
set -euo pipefail

: "${GH_TOKEN:?}" "${GITHUB_REPOSITORY:?}"
DRY_RUN="${DRY_RUN:-}"
KEEP_BUILDS=10
MIN_UNTAGGED_AGE_SECONDS=3600

image_path="${GITHUB_REPOSITORY,,}"
owner="${image_path%%/*}"
package="${image_path#*/}"
owner_type="$(gh api "users/$owner" --jq .type)"
if [[ "$owner_type" == Organization ]]; then
  versions_url="orgs/$owner/packages/container/$package/versions"
else
  versions_url="users/$owner/packages/container/$package/versions"
fi

# One line per package version, newest first: id, digest, tags ("-" if untagged; a field is never
# empty, or read would merge two tabs into one), created at (seconds since 1970).
versions="$(gh api --paginate "$versions_url?per_page=100" --jq '.[] | [
    .id,
    .name,
    (if (.metadata.container.tags | length) > 0 then (.metadata.container.tags | join(",")) else "-" end),
    (.created_at | fromdateiso8601)
  ] | @tsv' | sort -t $'\t' -k4,4nr)"
kept_builds="$(awk -F'\t' -v n="$KEEP_BUILDS" '$3 != "-" && kept < n { print; kept++ }' <<<"$versions")"
if [[ -z "$kept_builds" ]]; then
  echo "No tagged builds of $image_path in GHCR. Nothing was deleted."
  exit 0
fi

# Digests of the kept builds and of every version they are made of. Read before anything is
# deleted: if one of them cannot be read, nothing is.
registry_token="$(curl -fsS -u "${GITHUB_ACTOR:-token}:$GH_TOKEN" \
  "https://ghcr.io/token?service=ghcr.io&scope=repository:$image_path:pull" | jq -r .token)"
accept="application/vnd.oci.image.index.v1+json,application/vnd.docker.distribution.manifest.list.v2+json"
accept+=",application/vnd.oci.image.manifest.v1+json,application/vnd.docker.distribution.manifest.v2+json"
needed=""
while IFS=$'\t' read -r _ digest tags _; do
  parts="$(curl -fsS -H "Authorization: Bearer $registry_token" -H "Accept: $accept" \
    "https://ghcr.io/v2/$image_path/manifests/$digest" | jq -r '.manifests[]?.digest')"
  needed+="$digest"$'\n'"$parts"$'\n'
  echo "keep    $tags"
done <<<"$kept_builds"

now="$(date +%s)"
deleted=0
while IFS=$'\t' read -r id digest tags created; do
  if grep -qxF "$digest" <<<"$needed"; then continue; fi
  if [[ "$tags" == - ]]; then
    if ((now - created < MIN_UNTAGGED_AGE_SECONDS)); then continue; fi
    what="untagged $digest"
  else
    what="$tags"
  fi
  if [[ -n "$DRY_RUN" ]]; then
    echo "would delete $what"
  else
    gh api -X DELETE "$versions_url/$id" --silent
    echo "deleted $what"
  fi
  deleted=$((deleted + 1))
done <<<"$versions"

echo "==> GHCR: kept the newest $(wc -l <<<"$kept_builds" | tr -d ' ') builds, ${DRY_RUN:+would have }deleted $deleted package versions"
