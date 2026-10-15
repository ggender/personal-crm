#!/usr/bin/env bash
# docker compose for the environment whose folder this script is in (see environments.sh): the right
# project name, address, port and env files. Examples on the server (as the deploy user):
#   /srv/personal-crm/compose.sh ps                               # prod
#   /srv/personal-crm-staging/compose.sh logs --tail 100 app      # staging, current container only
#   (all the logs, also of removed containers: sudo journalctl -t staging-app, see README)
set -euo pipefail

cd "$(dirname "$0")"
source ./environments.sh
load_environment_of_dir "$(pwd)"

# Shell variables win over the env files: compose.yaml gets the settings of this environment.
export PUBLIC_URL APP_PORT
touch release.env
exec docker compose -p "$DEPLOY_ENV" -f compose.yaml --env-file .env --env-file release.env "$@"
