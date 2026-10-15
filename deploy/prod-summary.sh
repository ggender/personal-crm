#!/usr/bin/env bash
# Runs on the CI runner at the end of Deploy prod (.github/workflows/deploy-prod.yml), whatever the
# deploy's result: writes to the run summary which commit went to prod, or that its deploy failed.
# Required env: SHA, NOTE (where the commit came from, see prod-version.sh), OUTCOME (of the deploy
# step: success, failure, cancelled or skipped), GITHUB_REPOSITORY, GITHUB_SERVER_URL,
# GITHUB_STEP_SUMMARY.
set -euo pipefail

: "${SHA:?}" "${OUTCOME:?}" "${GITHUB_REPOSITORY:?}" "${GITHUB_SERVER_URL:?}" "${GITHUB_STEP_SUMMARY:?}"
NOTE="${NOTE:-}"

here="$(cd "$(dirname "$0")" && pwd)"
source "$here/environments.sh"
load_environment prod

commit_link="[\`${SHA:0:7}\`]($GITHUB_SERVER_URL/$GITHUB_REPOSITORY/commit/$SHA)"
if [[ "$OUTCOME" == success ]]; then
  title="Deployed to prod: \`$SHA\`"
else
  title="Deploy to prod FAILED ($OUTCOME): \`$SHA\`. Nothing was rolled back."
fi
{
  echo "### $title"
  echo
  echo "- Commit: $commit_link${NOTE:+ — $NOTE}"
  echo "- Version running now: $PUBLIC_URL/health"
} >> "$GITHUB_STEP_SUMMARY"
echo "$title"
