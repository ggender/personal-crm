#!/usr/bin/env bash
# docker compose for the production stack with the right project name and env files.
# Examples on the server (as the deploy user):
#   /srv/personal-crm/compose.sh ps
#   /srv/personal-crm/compose.sh logs --tail 100 app
set -euo pipefail

cd "$(dirname "$0")"
touch release.env
exec docker compose -p prod -f compose.yaml --env-file .env --env-file release.env "$@"
